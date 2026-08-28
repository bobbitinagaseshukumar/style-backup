const prisma = require('../config/db');

class StylistService {
  /**
   * AI Occasion + Budget Personal Stylist
   * Combines real PostgreSQL products into budget-friendly outfit looks.
   * STRICT SAFETY: Uses exact database prices. Never fabricates products or AI math.
   * 
   * Supports: stock validation, 3-item outfits, gender filtering,
   * budget suggestions, negative budget rejection, absurd value caps.
   */

  /** Get effective sale price from database — never AI-calculated */
  _getPrice(product) {
    return product.discountPrice && product.discountPrice > 0
      ? product.discountPrice
      : product.price;
  }

  async buildOutfitRecommendations({
    occasion = 'wedding',
    maxBudget = 3000,
    minBudget = null,
    category = null,
    color = null,
    style = null,
    gender = null,
    isSingleProduct = false
  }) {
    // Step 3: Budget validation — reject negative, cap absurd values
    let budget = maxBudget && maxBudget > 0 ? Math.min(maxBudget, 1000000) : 3000;
    if (budget <= 0) budget = 3000;
    const cleanOccasion = (occasion || 'wedding').toLowerCase().trim();
    const cleanColor = color ? color.toLowerCase().trim() : null;
    const cleanCategory = category ? category.toLowerCase().trim() : null;
    const cleanGender = gender ? gender.toLowerCase().trim() : null;
    const cleanStyle = style ? style.toLowerCase().trim() : null;

    // ─── Build Prisma WHERE conditions ───
    const andConditions = [
      { status: 'PUBLISHED' },
      { isVisible: true },
      { price: { lte: budget } },
      { stock: { gt: 0 } }  // Step 24: Respect inventory — never recommend out-of-stock
    ];

    // Category filter
    if (cleanCategory) {
      andConditions.push({
        OR: [
          { category: { slug: { contains: cleanCategory, mode: 'insensitive' } } },
          { category: { name: { contains: cleanCategory, mode: 'insensitive' } } }
        ]
      });
    }

    // Step 12: Gender filter — use actual Product.gender field
    if (cleanGender) {
      andConditions.push({
        OR: [
          { gender: { contains: cleanGender, mode: 'insensitive' } },
          { category: { name: { contains: cleanGender, mode: 'insensitive' } } }
        ]
      });
    }

    // Step 11: Color preference
    if (cleanColor) {
      andConditions.push({
        OR: [
          { colors: { contains: cleanColor, mode: 'insensitive' } },
          { name: { contains: cleanColor, mode: 'insensitive' } },
          { description: { contains: cleanColor, mode: 'insensitive' } }
        ]
      });
    }

    // Style filter
    if (cleanStyle) {
      andConditions.push({
        OR: [
          { tags: { contains: cleanStyle, mode: 'insensitive' } },
          { description: { contains: cleanStyle, mode: 'insensitive' } }
        ]
      });
    }

    // Step 2: Occasion matching — search across occasion, tags, description, name, category
    andConditions.push({
      OR: [
        { occasion: { contains: cleanOccasion, mode: 'insensitive' } },
        { tags: { contains: cleanOccasion, mode: 'insensitive' } },
        { description: { contains: cleanOccasion, mode: 'insensitive' } },
        { name: { contains: cleanOccasion, mode: 'insensitive' } },
        { category: { name: { contains: cleanOccasion, mode: 'insensitive' } } }
      ]
    });

    const productInclude = {
      images: { orderBy: { isPrimary: 'desc' }, take: 2 },
      category: { select: { id: true, name: true, slug: true } },
      subCategory: { select: { id: true, name: true, slug: true } }
    };

    let candidates = await prisma.product.findMany({
      where: { AND: andConditions },
      take: 30,
      orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
      include: productInclude
    });

    // Fallback 1: If strict occasion search has few items, broaden (drop occasion, keep category + budget + stock)
    if (candidates.length < 3) {
      const fallbackConditions = [
        { status: 'PUBLISHED' },
        { isVisible: true },
        { price: { lte: budget } },
        { stock: { gt: 0 } }
      ];
      if (cleanCategory) {
        fallbackConditions.push({
          OR: [
            { category: { slug: { contains: cleanCategory, mode: 'insensitive' } } },
            { category: { name: { contains: cleanCategory, mode: 'insensitive' } } }
          ]
        });
      }
      if (cleanGender) {
        fallbackConditions.push({
          OR: [
            { gender: { contains: cleanGender, mode: 'insensitive' } },
            { category: { name: { contains: cleanGender, mode: 'insensitive' } } }
          ]
        });
      }
      if (cleanColor) {
        fallbackConditions.push({
          OR: [
            { colors: { contains: cleanColor, mode: 'insensitive' } },
            { name: { contains: cleanColor, mode: 'insensitive' } }
          ]
        });
      }

      candidates = await prisma.product.findMany({
        where: { AND: fallbackConditions },
        take: 30,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        include: productInclude
      });
    }

    // Fallback 2: If still too few, broadest — just budget + stock + published
    if (candidates.length < 2) {
      candidates = await prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          isVisible: true,
          price: { lte: budget },
          stock: { gt: 0 }
        },
        take: 20,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        include: productInclude
      });
    }

    // Step 18: No results — suggest increasing budget, never fabricate
    if (candidates.length === 0) {
      const suggestedBudget = Math.ceil(budget * 1.5 / 500) * 500;
      return {
        success: true,
        type: 'NO_RESULTS',
        occasion: cleanOccasion,
        maxBudget: budget,
        products: [],
        note: `I couldn't find products within ₹${budget} for a ${cleanOccasion} from our current collection.`,
        suggestion: `Would you like me to try ₹${suggestedBudget}?`
      };
    }

    // Step 10: Single Product Mode — return individual items, not outfit
    if (isSingleProduct || candidates.length < 2) {
      return {
        success: true,
        type: 'SINGLE_PRODUCTS',
        occasion: cleanOccasion,
        maxBudget: budget,
        products: candidates.slice(0, 6)
      };
    }

    // ─── Step 7: Outfit Combination Mode ───
    // Try 3-item combinations first, then fall back to 2-item
    const looks = [];
    const usedCombinations = new Set();

    // Attempt 3-item outfits (top + bottom/dress + accessory)
    for (let i = 0; i < candidates.length && looks.length < 3; i++) {
      for (let j = i + 1; j < candidates.length && looks.length < 3; j++) {
        for (let k = j + 1; k < candidates.length && looks.length < 3; k++) {
          const items = [candidates[i], candidates[j], candidates[k]];
          const ids = items.map(p => p.id).sort().join('_');
          if (usedCombinations.has(ids)) continue;

          const prices = items.map(p => this._getPrice(p));
          const subtotal = Math.round(prices.reduce((a, b) => a + b, 0) * 100) / 100;

          if (subtotal <= budget) {
            usedCombinations.add(ids);
            const remainingBudget = Math.round((budget - subtotal) * 100) / 100;
            const title = looks.length === 0
              ? '✨ Option 1 — Best Match Look'
              : looks.length === 1
                ? '👑 Option 2 — Premium Look'
                : '💡 Option 3 — Value Choice';

            looks.push({ title, items, subtotal, remainingBudget, maxBudget: budget });
          }
        }
      }
    }

    // If no 3-item combos, try 2-item combos
    if (looks.length === 0) {
      for (let i = 0; i < candidates.length && looks.length < 3; i++) {
        for (let j = i + 1; j < candidates.length && looks.length < 3; j++) {
          const prodA = candidates[i];
          const prodB = candidates[j];

          const priceA = this._getPrice(prodA);
          const priceB = this._getPrice(prodB);
          const subtotal = Math.round((priceA + priceB) * 100) / 100;

          if (subtotal <= budget) {
            const comboKey = [prodA.id, prodB.id].sort().join('_');
            if (!usedCombinations.has(comboKey)) {
              usedCombinations.add(comboKey);
              const remainingBudget = Math.round((budget - subtotal) * 100) / 100;
              const title = looks.length === 0
                ? '✨ Option 1 — Best Match Look'
                : looks.length === 1
                  ? '👑 Option 2 — Premium Look'
                  : '💡 Option 3 — Value Choice';

              looks.push({ title, items: [prodA, prodB], subtotal, remainingBudget, maxBudget: budget });
            }
          }
        }
      }
    }

    // Step 19: Partial match — show individual items if no outfit fits
    if (looks.length === 0) {
      const suggestedBudget = Math.ceil(budget * 1.5 / 500) * 500;
      return {
        success: true,
        type: 'SINGLE_PRODUCTS',
        occasion: cleanOccasion,
        maxBudget: budget,
        products: candidates.slice(0, 6),
        note: `I found suitable items within your budget, but couldn't build a complete outfit combination under ₹${budget}.`,
        suggestion: `Would you like me to try ₹${suggestedBudget}?`
      };
    }

    return {
      success: true,
      type: 'OUTFIT_LOOKS',
      occasion: cleanOccasion,
      maxBudget: budget,
      looks
    };
  }
}

module.exports = new StylistService();
