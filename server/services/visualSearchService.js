const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');
const prisma = require('../config/db');

// Allowed MIME types for upload validation
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
// Max base64 payload size (~5MB raw = ~6.7MB base64)
const MAX_BASE64_LENGTH = 7 * 1024 * 1024;

class VisualSearchService {
  constructor() {
    this.apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.client = null;
    this.model = 'gemini-3.6-flash';

    if (this.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.error('[VisualSearchService] ❌ Failed to initialize:', err.message);
      }
    }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.client);
  }

  /**
   * Step 8: Similarity scoring — transparent weights based on available product metadata
   */
  _calculateSimilarityScore(product, detectedAttributes) {
    let score = 0;
    const name = (product.name || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const tags = (product.tags || '').toLowerCase();
    const colors = (product.colors || '').toLowerCase();
    const catName = (product.category?.name || '').toLowerCase();

    // Product type match = strong score (+30)
    if (detectedAttributes.productType && detectedAttributes.productType !== 'clothing') {
      const pt = detectedAttributes.productType.toLowerCase();
      if (name.includes(pt) || tags.includes(pt) || catName.includes(pt)) score += 30;
      else if (desc.includes(pt)) score += 15;
    }

    // Color match = strong score (+25)
    if (detectedAttributes.color) {
      const c = detectedAttributes.color.toLowerCase();
      if (colors.includes(c) || name.includes(c)) score += 25;
      else if (desc.includes(c)) score += 10;
    }

    // Category match = strong score (+20)
    if (detectedAttributes.category) {
      const cat = detectedAttributes.category.toLowerCase();
      if (catName.includes(cat)) score += 20;
    }

    // Pattern match = moderate score (+15)
    if (detectedAttributes.pattern) {
      const p = detectedAttributes.pattern.toLowerCase();
      if (name.includes(p) || tags.includes(p) || desc.includes(p)) score += 15;
    }

    // Style match = moderate score (+15)
    if (detectedAttributes.style) {
      const s = detectedAttributes.style.toLowerCase();
      if (tags.includes(s) || desc.includes(s) || name.includes(s)) score += 15;
    }

    // Keyword matches (+5 each)
    if (detectedAttributes.keywords && detectedAttributes.keywords.length > 0) {
      detectedAttributes.keywords.forEach(kw => {
        const k = kw.toLowerCase();
        if (name.includes(k) || tags.includes(k)) score += 5;
      });
    }

    // Featured/trending boost (+3)
    if (product.featured) score += 3;
    if (product.trending) score += 3;

    return score;
  }

  /**
   * Analyze uploaded apparel image and retrieve visually similar real products from PostgreSQL.
   * STRICT PRIVACY: Zero facial recognition or personal inference. Apparel attributes only.
   */
  async searchByImage({ imageBase64, mimeType = 'image/jpeg', textPrompt = '', maxBudget = null, limit = 8 }) {
    // ─── Step 3: Image Validation ───
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return { success: false, error: 'Valid image file is required' };
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { success: false, error: 'Only JPEG, PNG, and WebP images are supported' };
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();

    // Validate base64 size (prevents oversized uploads)
    if (cleanBase64.length > MAX_BASE64_LENGTH) {
      return { success: false, error: 'Image is too large. Please upload an image under 5MB.' };
    }

    let detectedAttributes = {
      productType: 'clothing',
      category: null,
      color: null,
      pattern: null,
      style: null,
      keywords: []
    };

    // ─── Step 5: AI Vision Analysis using Gemini ───
    if (this.isConfigured()) {
      try {
        const promptText = `Analyze this fashion/apparel image and extract retail attributes as a JSON object matching this schema:
{
  "productType": "shirt | saree | dress | kurta | jacket | shoes | jewellery | jeans | trousers | top | bag",
  "category": "men | women | kids | jewellery",
  "color": "black | blue | red | white | green | gold | pink | yellow | maroon | grey",
  "pattern": "solid | printed | embroidered | striped | checkered | floral",
  "style": "casual | formal | festive | traditional | party | bridal",
  "keywords": ["array", "of", "3-5", "descriptive", "terms"]
}
STRICT PRIVACY: Do NOT perform facial recognition or personal identification. Focus ONLY on clothing & accessories. Return JSON only.`;

        const response = await this.client.models.generateContent({
          model: this.model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: cleanBase64 } },
                { text: promptText }
              ]
            }
          ],
          config: {
            temperature: 0.1,
            maxOutputTokens: 300,
            responseMimeType: 'application/json'
          }
        });

        const text = response?.text || '';
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));

          // Step 6: AI Output Validation — sanitize, limit string lengths, reject unexpected
          detectedAttributes = {
            productType: typeof parsed.productType === 'string' ? parsed.productType.slice(0, 50) : 'clothing',
            category: typeof parsed.category === 'string' ? parsed.category.slice(0, 30) : null,
            color: typeof parsed.color === 'string' ? parsed.color.slice(0, 30) : null,
            pattern: typeof parsed.pattern === 'string' ? parsed.pattern.slice(0, 30) : null,
            style: typeof parsed.style === 'string' ? parsed.style.slice(0, 30) : null,
            keywords: Array.isArray(parsed.keywords)
              ? parsed.keywords.filter(k => typeof k === 'string').map(k => k.slice(0, 30)).slice(0, 5)
              : []
          };
          console.log('[VisualSearchService] ✅ Detected attributes:', JSON.stringify(detectedAttributes));
        }
      } catch (gemErr) {
        console.warn('[VisualSearchService] Vision analysis fallback:', gemErr.message);
      }
    }

    // ─── Step 7 & 9: Progressive Fallback Database Search ───
    const baseConditions = [
      { status: 'PUBLISHED' },
      { isVisible: true },
      { stock: { gt: 0 } }  // Step 24: Respect inventory
    ];

    if (maxBudget && maxBudget > 0) {
      baseConditions.push({ price: { lte: Math.min(maxBudget, 1000000) } });
    }

    const productInclude = {
      images: { orderBy: { isPrimary: 'desc' }, take: 2 },
      category: { select: { id: true, name: true, slug: true } }
    };

    // Attempt 1: Strict match — productType + color + style/pattern
    let candidates = [];
    const strictOrs = [];

    if (detectedAttributes.color) {
      strictOrs.push({ colors: { contains: detectedAttributes.color, mode: 'insensitive' } });
      strictOrs.push({ name: { contains: detectedAttributes.color, mode: 'insensitive' } });
    }
    if (detectedAttributes.productType && detectedAttributes.productType !== 'clothing') {
      strictOrs.push({ name: { contains: detectedAttributes.productType, mode: 'insensitive' } });
      strictOrs.push({ tags: { contains: detectedAttributes.productType, mode: 'insensitive' } });
      strictOrs.push({ category: { name: { contains: detectedAttributes.productType, mode: 'insensitive' } } });
    }
    if (detectedAttributes.style) {
      strictOrs.push({ tags: { contains: detectedAttributes.style, mode: 'insensitive' } });
    }
    if (detectedAttributes.pattern) {
      strictOrs.push({ tags: { contains: detectedAttributes.pattern, mode: 'insensitive' } });
      strictOrs.push({ name: { contains: detectedAttributes.pattern, mode: 'insensitive' } });
    }

    if (strictOrs.length > 0) {
      candidates = await prisma.product.findMany({
        where: { AND: [...baseConditions, { OR: strictOrs }] },
        take: 20,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        include: productInclude
      });
    }

    // Attempt 2: Relaxed — productType + color only
    if (candidates.length < 3) {
      const relaxedOrs = [];
      if (detectedAttributes.productType && detectedAttributes.productType !== 'clothing') {
        relaxedOrs.push({ name: { contains: detectedAttributes.productType, mode: 'insensitive' } });
        relaxedOrs.push({ tags: { contains: detectedAttributes.productType, mode: 'insensitive' } });
        relaxedOrs.push({ category: { name: { contains: detectedAttributes.productType, mode: 'insensitive' } } });
      }
      if (detectedAttributes.color) {
        relaxedOrs.push({ colors: { contains: detectedAttributes.color, mode: 'insensitive' } });
        relaxedOrs.push({ name: { contains: detectedAttributes.color, mode: 'insensitive' } });
        relaxedOrs.push({ description: { contains: detectedAttributes.color, mode: 'insensitive' } });
      }
      // Add keyword matches
      detectedAttributes.keywords.forEach(kw => {
        if (kw && kw.length > 2) {
          relaxedOrs.push({ name: { contains: kw, mode: 'insensitive' } });
          relaxedOrs.push({ tags: { contains: kw, mode: 'insensitive' } });
        }
      });

      if (relaxedOrs.length > 0) {
        const relaxedResults = await prisma.product.findMany({
          where: { AND: [...baseConditions, { OR: relaxedOrs }] },
          take: 20,
          orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
          include: productInclude
        });

        // Merge without duplicates
        const existingIds = new Set(candidates.map(c => c.id));
        relaxedResults.forEach(r => {
          if (!existingIds.has(r.id)) {
            candidates.push(r);
            existingIds.add(r.id);
          }
        });
      }
    }

    // Attempt 3: Broadest — productType OR category only
    if (candidates.length < 3) {
      const broadOrs = [];
      if (detectedAttributes.productType && detectedAttributes.productType !== 'clothing') {
        broadOrs.push({ name: { contains: detectedAttributes.productType, mode: 'insensitive' } });
        broadOrs.push({ category: { name: { contains: detectedAttributes.productType, mode: 'insensitive' } } });
      }
      if (detectedAttributes.category) {
        broadOrs.push({ category: { name: { contains: detectedAttributes.category, mode: 'insensitive' } } });
      }

      if (broadOrs.length > 0) {
        const broadResults = await prisma.product.findMany({
          where: { AND: [...baseConditions, { OR: broadOrs }] },
          take: 20,
          orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
          include: productInclude
        });

        const existingIds = new Set(candidates.map(c => c.id));
        broadResults.forEach(r => {
          if (!existingIds.has(r.id)) {
            candidates.push(r);
            existingIds.add(r.id);
          }
        });
      }
    }

    // Step 10: No match at all — friendly message, no fabrication
    if (candidates.length === 0) {
      return {
        success: true,
        detected: detectedAttributes,
        products: [],
        note: "I couldn't find a close match in our current collection."
      };
    }

    // ─── Step 8: Apply Similarity Scoring & Rank ───
    const scoredCandidates = candidates.map(prod => ({
      ...prod,
      _similarityScore: this._calculateSimilarityScore(prod, detectedAttributes)
    }));

    // Sort by similarity score descending
    scoredCandidates.sort((a, b) => b._similarityScore - a._similarityScore);

    // Remove internal score before returning
    const finalProducts = scoredCandidates.slice(0, limit).map(({ _similarityScore, ...prod }) => prod);

    return {
      success: true,
      detected: detectedAttributes,
      products: finalProducts
    };
  }
}

module.exports = new VisualSearchService();
