const prisma = require('../config/db');

class StylistService {
  /**
   * AI Occasion + Budget Personal Stylist
   * Combines real PostgreSQL products into budget-friendly outfit looks.
   * STRICT SAFETY: Uses exact database prices. Never fabricates products or AI math.
   */
  async buildOutfitRecommendations({
    occasion = 'wedding',
    maxBudget = 3000,
    minBudget = null,
    category = null,
    color = null,
    style = null,
    isSingleProduct = false
  }) {
    const budget = maxBudget && maxBudget > 0 ? Math.min(maxBudget, 1000000) : 3000;
    const cleanOccasion = (occasion || 'wedding').toLowerCase().trim();
    const cleanColor = color ? color.toLowerCase().trim() : null;
    const cleanCategory = category ? category.toLowerCase().trim() : null;

    // Build Prisma query condition
    const andConditions = [
      { status: 'PUBLISHED' },
      { isVisible: true },
      { price: { lte: budget } }
    ];

    if (cleanCategory) {
      andConditions.push({
        OR: [
          { category: { slug: { contains: cleanCategory, mode: 'insensitive' } } },
          { category: { name: { contains: cleanCategory, mode: 'insensitive' } } }
        ]
      });
    }

    if (cleanColor) {
      andConditions.push({
        OR: [
          { colors: { contains: cleanColor, mode: 'insensitive' } },
          { name: { contains: cleanColor, mode: 'insensitive' } },
          { description: { contains: cleanColor, mode: 'insensitive' } }
        ]
      });
    }

    // Occasion matching
    andConditions.push({
      OR: [
        { occasion: { contains: cleanOccasion, mode: 'insensitive' } },
        { tags: { contains: cleanOccasion, mode: 'insensitive' } },
        { description: { contains: cleanOccasion, mode: 'insensitive' } },
        { name: { contains: cleanOccasion, mode: 'insensitive' } },
        { category: { name: { contains: cleanOccasion, mode: 'insensitive' } } }
      ]
    });

    let candidates = await prisma.product.findMany({
      where: { AND: andConditions },
      take: 20,
      orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 2 },
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } }
      }
    });

    // Fallback: If strict occasion search has few items, broaden to category within budget
    if (candidates.length < 3) {
      const fallbackConditions = [
        { status: 'PUBLISHED' },
        { isVisible: true },
        { price: { lte: budget } }
      ];
      if (cleanCategory) {
        fallbackConditions.push({
          category: { slug: { contains: cleanCategory, mode: 'insensitive' } }
        });
      }

      candidates = await prisma.product.findMany({
        where: { AND: fallbackConditions },
        take: 20,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 2 },
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } }
        }
      });
    }

    // Single Product Mode: Return individual items
    if (isSingleProduct || candidates.length < 2) {
      return {
        success: true,
        type: 'SINGLE_PRODUCTS',
        occasion: cleanOccasion,
        maxBudget: budget,
        products: candidates.slice(0, 6)
      };
    }

    // Outfit Combination Mode: Combine items such that subtotal <= budget
    const looks = [];
    const usedCombinations = new Set();

    // Separate into clothing types (tops, bottoms, full-body dresses/sarees/kurtas)
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const prodA = candidates[i];
        const prodB = candidates[j];

        // Skip identical products
        if (prodA.id === prodB.id) continue;

        const priceA = prodA.discountPrice && prodA.discountPrice > 0 ? prodA.discountPrice : prodA.price;
        const priceB = prodB.discountPrice && prodB.discountPrice > 0 ? prodB.discountPrice : prodB.price;
        const subtotal = Math.round((priceA + priceB) * 100) / 100;

        if (subtotal <= budget) {
          const comboKey = [prodA.id, prodB.id].sort().join('_');
          if (!usedCombinations.has(comboKey)) {
            usedCombinations.add(comboKey);
            const remainingBudget = Math.round((budget - subtotal) * 100) / 100;

            looks.push({
              title: looks.length === 0 ? '✨ Option 1 — Best Match Look' : looks.length === 1 ? '👑 Option 2 — Premium Look' : '💡 Option 3 — Value Choice',
              items: [prodA, prodB],
              subtotal,
              remainingBudget,
              maxBudget: budget
            });

            if (looks.length >= 3) break;
          }
        }
      }
      if (looks.length >= 3) break;
    }

    // Fallback if no 2-item outfit fit under budget: return single best products under budget
    if (looks.length === 0) {
      return {
        success: true,
        type: 'SINGLE_PRODUCTS',
        occasion: cleanOccasion,
        maxBudget: budget,
        products: candidates.slice(0, 6),
        note: `No 2-piece combination fit under ₹${budget}, showing best individual items.`
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
