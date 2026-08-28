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
      return Math.min(val, 1000000); // 1 Million max boundary
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
      sort: ['price_asc', 'price_desc', 'newest'].includes(intentObj.sort) ? intentObj.sort : 'relevance'
    };
  }

  /**
   * Execute real database search using validated AI intent filter parameters.
   * Returns maximum 8 verified database products.
   */
  async searchProductsByIntent(rawIntent, originalMessage = '') {
    const intent = this.validateIntent(rawIntent);

    let whereClause = {
      status: 'PUBLISHED',
      isVisible: true
    };
    const andConditions = [];

    // Price filtering
    if (intent.maxPrice !== null) {
      andConditions.push({ price: { lte: intent.maxPrice } });
    }
    if (intent.minPrice !== null) {
      andConditions.push({ price: { gte: intent.minPrice } });
    }

    // Category filtering
    if (intent.category) {
      const catVal = intent.category.toLowerCase();
      andConditions.push({
        OR: [
          { category: { slug: { contains: catVal, mode: 'insensitive' } } },
          { category: { name: { contains: catVal, mode: 'insensitive' } } }
        ]
      });
    }

    // Subcategory filtering
    if (intent.subcategory) {
      const subVal = intent.subcategory.toLowerCase();
      andConditions.push({
        OR: [
          { subCategory: { slug: { contains: subVal, mode: 'insensitive' } } },
          { subCategory: { name: { contains: subVal, mode: 'insensitive' } } }
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

    // Keywords search
    if (intent.keywords.length > 0 || originalMessage) {
      const terms = intent.keywords.length > 0 ? intent.keywords : originalMessage.split(' ').filter(w => w.length > 2);
      if (terms.length > 0) {
        const keywordOrs = terms.map(term => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { shortDesc: { contains: term, mode: 'insensitive' } },
            { tags: { contains: term, mode: 'insensitive' } }
          ]
        }));
        andConditions.push(...keywordOrs);
      }
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    // Sorting
    let orderBy = [{ displayOrder: 'asc' }, { createdAt: 'desc' }];
    if (intent.sort === 'price_asc') orderBy = { price: 'asc' };
    else if (intent.sort === 'price_desc') orderBy = { price: 'desc' };
    else if (intent.sort === 'newest') orderBy = { createdAt: 'desc' };

    let products = await prisma.product.findMany({
      where: whereClause,
      take: 8,
      orderBy,
      include: {
        images: {
          orderBy: { isPrimary: 'desc' },
          take: 2
        },
        category: {
          select: { id: true, name: true, slug: true }
        },
        subCategory: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    // Fallback: If strict search returns 0 items, broaden the search to category or general catalog
    if (products.length === 0 && (intent.category || intent.color || intent.maxPrice)) {
      const fallbackConditions = [{ status: 'PUBLISHED' }, { isVisible: true }];
      if (intent.maxPrice) fallbackConditions.push({ price: { lte: intent.maxPrice } });

      products = await prisma.product.findMany({
        where: { AND: fallbackConditions },
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 2 },
          category: { select: { id: true, name: true, slug: true } }
        }
      });
    }

    return products;
  }
}

module.exports = new ProductIntentService();
