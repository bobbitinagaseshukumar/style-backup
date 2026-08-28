const prisma = require('../config/db');

class ProductIntentService {
  /**
   * Validate and sanitize structured AI intent output before querying PostgreSQL via Prisma.
   * STRICT SAFETY: Prevents SQL injections, negative prices, giant bounds, or arbitrary database fields.
   */
  validateIntent(intentObj) {
    if (!intentObj || typeof intentObj !== 'object') {
      return {
        intent: 'product_search',
        keywords: [],
        maxPrice: null,
        minPrice: null,
        color: null,
        category: null,
        subcategory: null,
        occasion: null,
        gender: null,
        sort: 'relevance'
      };
    }

    const cleanString = (val) => {
      if (typeof val !== 'string') return null;
      const s = val.trim().slice(0, 100);
      return s.length > 0 ? s : null;
    };

    const cleanNumber = (val) => {
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return null;
      if (val < 0) return null;
      return Math.min(val, 1000000);
    };

    const keywords = Array.isArray(intentObj.keywords)
      ? intentObj.keywords.map(cleanString).filter(Boolean).slice(0, 5)
      : [];

    return {
      intent: cleanString(intentObj.intent) || 'product_search',
      category: cleanString(intentObj.category),
      subcategory: cleanString(intentObj.subcategory),
      keywords,
      color: cleanString(intentObj.color),
      minPrice: cleanNumber(intentObj.minPrice),
      maxPrice: cleanNumber(intentObj.maxPrice),
      occasion: cleanString(intentObj.occasion),
      gender: cleanString(intentObj.gender),
      sort: ['price_asc', 'price_desc', 'newest'].includes(intentObj.sort) ? intentObj.sort : 'relevance'
    };
  }

  /**
   * Extract meaningful search terms from raw user message.
   * Strips filler words and extracts product keywords, colors, and budget.
   */
  _parseRawQuery(msg) {
    if (!msg || typeof msg !== 'string') return { terms: [], maxPrice: null, color: null };

    const q = msg.toLowerCase().trim();

    // Extract price from patterns like "under 500", "below 1500", "under 5 rupees"
    let maxPrice = null;
    const priceMatch = q.match(/(?:under|below|within|less than|upto|up to|max|budget)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i)
      || q.match(/(?:₹|rs\.?|inr)\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = parseFloat(priceMatch[1]);
    }

    // Extract color
    const colorList = ['red', 'blue', 'black', 'white', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'gold', 'silver', 'maroon', 'navy', 'beige', 'cream', 'multicolor', 'multi'];
    let color = null;
    for (const c of colorList) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(q)) {
        color = c;
        break;
      }
    }

    // Strip filler words and extract product-relevant terms
    const fillerWords = new Set([
      'i', 'me', 'my', 'want', 'need', 'looking', 'for', 'show', 'find', 'get', 'give',
      'please', 'can', 'you', 'some', 'a', 'an', 'the', 'to', 'buy', 'purchase',
      'under', 'below', 'within', 'above', 'between', 'less', 'than', 'more',
      'rupees', 'rupee', 'rs', 'inr', 'price', 'budget', 'around', 'about',
      'of', 'in', 'on', 'at', 'with', 'and', 'or', 'but', 'is', 'are', 'was',
      'it', 'its', 'this', 'that', 'these', 'those', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'very', 'really', 'good', 'best', 'nice', 'great', 'like', 'just',
      'something', 'anything', 'one', 'ones', 'upto', 'up', 'max', 'maximum',
      'color', 'colour', 'colors', 'colours', 'type', 'kind', 'item', 'items', 'wear', 'clothing', 'style', 'styled',
      ...colorList
    ]);

    const terms = q
      .replace(/[₹,\.!?;:'"()]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !fillerWords.has(w) && !/^\d+$/.test(w));

    return { terms, maxPrice, color };
  }

  /**
   * Execute real database search using validated AI intent filter parameters.
   * Returns maximum 8 verified database products.
   * Features smart fallback: broadens search progressively if strict search finds nothing.
   */
  async searchProductsByIntent(rawIntent, originalMessage = '') {
    const intent = this.validateIntent(rawIntent);
    const parsed = this._parseRawQuery(originalMessage);

    // Merge parsed raw query values into intent when Gemini intent is empty
    if (!rawIntent) {
      if (parsed.maxPrice && !intent.maxPrice) intent.maxPrice = parsed.maxPrice;
      if (parsed.color && !intent.color) intent.color = parsed.color;
      if (parsed.terms.length > 0 && intent.keywords.length === 0) intent.keywords = parsed.terms;
    }

    // === ATTEMPT 1: Full strict search with all filters ===
    let products = await this._searchWithFilters(intent);
    if (products.length > 0) return products;

    // === ATTEMPT 2: Drop color filter, keep keywords + price ===
    if (intent.color) {
      products = await this._searchWithFilters({ ...intent, color: null });
      if (products.length > 0) return products;
    }

    // === ATTEMPT 3: Use only primary keyword + price ===
    if (intent.keywords.length > 1) {
      products = await this._searchWithFilters({ ...intent, keywords: [intent.keywords[0]], color: null, occasion: null });
      if (products.length > 0) return products;
    }

    // === ATTEMPT 4: Keywords only, NO price filter (show what exists) ===
    if (intent.keywords.length > 0) {
      products = await this._searchWithFilters({ ...intent, maxPrice: null, minPrice: null, color: null, occasion: null });
      if (products.length > 0) return products;
    }

    // === ATTEMPT 5: Category-only search ===
    if (intent.category || intent.subcategory) {
      products = await this._searchWithFilters({ ...intent, keywords: [], color: null, occasion: null, maxPrice: null, minPrice: null });
      if (products.length > 0) return products;
    }

    // === ATTEMPT 6: Absolute fallback — newest products ===
    products = await prisma.product.findMany({
      where: { status: 'PUBLISHED', isVisible: true },
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 2 },
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } }
      }
    });

    return products;
  }

  /**
   * Internal: Execute a single search with the given intent filters.
   */
  async _searchWithFilters(intent) {
    let whereClause = {
      status: 'PUBLISHED',
      isVisible: true
    };
    const andConditions = [];

    // Price filtering — checks BOTH price and discountPrice
    if (intent.maxPrice !== null) {
      andConditions.push({
        OR: [
          { discountPrice: { gt: 0, lte: intent.maxPrice } },
          { AND: [{ OR: [{ discountPrice: 0 }, { discountPrice: null }] }, { price: { lte: intent.maxPrice } }] }
        ]
      });
    }
    if (intent.minPrice !== null) {
      andConditions.push({ price: { gte: intent.minPrice } });
    }

    // Category filtering
    if (intent.category) {
      const catVal = intent.category.toLowerCase();
      const catStem = catVal.replace(/s$/, '');
      andConditions.push({
        OR: [
          { category: { slug: { contains: catVal, mode: 'insensitive' } } },
          { category: { slug: { contains: catStem, mode: 'insensitive' } } },
          { category: { name: { contains: catVal, mode: 'insensitive' } } },
          { category: { name: { contains: catStem, mode: 'insensitive' } } }
        ]
      });
    }

    // Subcategory filtering
    if (intent.subcategory) {
      const subVal = intent.subcategory.toLowerCase();
      const subStem = subVal.replace(/s$/, '');
      andConditions.push({
        OR: [
          { subCategory: { slug: { contains: subVal, mode: 'insensitive' } } },
          { subCategory: { slug: { contains: subStem, mode: 'insensitive' } } },
          { subCategory: { name: { contains: subVal, mode: 'insensitive' } } },
          { subCategory: { name: { contains: subStem, mode: 'insensitive' } } }
        ]
      });
    }

    // Color filtering
    if (intent.color) {
      const colorVal = intent.color.toLowerCase();
      andConditions.push({
        OR: [
          { colors: { contains: colorVal, mode: 'insensitive' } },
          { name: { contains: colorVal, mode: 'insensitive' } },
          { description: { contains: colorVal, mode: 'insensitive' } }
        ]
      });
    }

    // Occasion filtering
    if (intent.occasion) {
      const occVal = intent.occasion.toLowerCase();
      andConditions.push({
        OR: [
          { occasion: { contains: occVal, mode: 'insensitive' } },
          { tags: { contains: occVal, mode: 'insensitive' } },
          { description: { contains: occVal, mode: 'insensitive' } },
          { name: { contains: occVal, mode: 'insensitive' } }
        ]
      });
    }

    // Keywords search — use OR (match ANY keyword) instead of AND (match ALL)
    if (intent.keywords.length > 0) {
      const keywordOrs = [];
      for (const term of intent.keywords) {
        const stem = term.toLowerCase().replace(/s$/, '');
        keywordOrs.push(
          { name: { contains: term, mode: 'insensitive' } },
          { name: { contains: stem, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { shortDesc: { contains: term, mode: 'insensitive' } },
          { tags: { contains: term, mode: 'insensitive' } },
          { category: { name: { contains: stem, mode: 'insensitive' } } },
          { subCategory: { name: { contains: stem, mode: 'insensitive' } } }
        );
      }
      andConditions.push({ OR: keywordOrs });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    // Sorting
    let orderBy = [{ displayOrder: 'asc' }, { createdAt: 'desc' }];
    if (intent.sort === 'price_asc') orderBy = { price: 'asc' };
    else if (intent.sort === 'price_desc') orderBy = { price: 'desc' };
    else if (intent.sort === 'newest') orderBy = { createdAt: 'desc' };

    return prisma.product.findMany({
      where: whereClause,
      take: 8,
      orderBy,
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 2 },
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } }
      }
    });
  }
}

module.exports = new ProductIntentService();
