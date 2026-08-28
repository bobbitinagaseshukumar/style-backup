const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');
const prisma = require('../config/db');

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
   * Analyze uploaded apparel image and retrieve visually similar real products from PostgreSQL.
   * STRICT PRIVACY: Zero facial recognition or personal inference. Apparel attributes only.
   */
  async searchByImage({ imageBase64, mimeType = 'image/jpeg', textPrompt = '', maxBudget = null, limit = 8 }) {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return { success: false, error: 'Valid image file is required' };
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
    let detectedAttributes = {
      productType: 'clothing',
      category: null,
      color: null,
      pattern: null,
      style: null,
      keywords: []
    };

    // 1. Analyze Image using Gemini Vision if configured
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
          detectedAttributes = {
            productType: parsed.productType || 'clothing',
            category: parsed.category || null,
            color: parsed.color || null,
            pattern: parsed.pattern || null,
            style: parsed.style || null,
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : []
          };
          console.log('[VisualSearchService] ✅ Detected attributes:', JSON.stringify(detectedAttributes));
        }
      } catch (gemErr) {
        console.warn('[VisualSearchService] Vision analysis fallback:', gemErr.message);
      }
    }

    // 2. Query Real PostgreSQL Products matching detected visual attributes
    const whereConditions = [
      { status: 'PUBLISHED' },
      { isVisible: true }
    ];

    if (maxBudget && maxBudget > 0) {
      whereConditions.push({ price: { lte: Math.min(maxBudget, 1000000) } });
    }

    const attrOrs = [];

    // Match color
    if (detectedAttributes.color) {
      attrOrs.push({ colors: { contains: detectedAttributes.color, mode: 'insensitive' } });
      attrOrs.push({ name: { contains: detectedAttributes.color, mode: 'insensitive' } });
      attrOrs.push({ description: { contains: detectedAttributes.color, mode: 'insensitive' } });
    }

    // Match productType
    if (detectedAttributes.productType && detectedAttributes.productType !== 'clothing') {
      attrOrs.push({ name: { contains: detectedAttributes.productType, mode: 'insensitive' } });
      attrOrs.push({ description: { contains: detectedAttributes.productType, mode: 'insensitive' } });
      attrOrs.push({ tags: { contains: detectedAttributes.productType, mode: 'insensitive' } });
      attrOrs.push({ category: { name: { contains: detectedAttributes.productType, mode: 'insensitive' } } });
    }

    // Match keywords
    if (detectedAttributes.keywords.length > 0) {
      detectedAttributes.keywords.forEach(kw => {
        if (kw && kw.length > 2) {
          attrOrs.push({ name: { contains: kw, mode: 'insensitive' } });
          attrOrs.push({ tags: { contains: kw, mode: 'insensitive' } });
        }
      });
    }

    if (attrOrs.length > 0) {
      whereConditions.push({ OR: attrOrs });
    }

    let candidates = await prisma.product.findMany({
      where: { AND: whereConditions },
      take: limit,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 2 },
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    // Fallback if strict visual search returns 0 items
    if (candidates.length === 0) {
      candidates = await prisma.product.findMany({
        where: { status: 'PUBLISHED', isVisible: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 2 },
          category: { select: { id: true, name: true, slug: true } }
        }
      });
    }

    return {
      success: true,
      detected: detectedAttributes,
      products: candidates
    };
  }
}

module.exports = new VisualSearchService();
