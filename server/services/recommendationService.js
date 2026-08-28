const prisma = require('../config/db');

class RecommendationService {
  /**
   * Personalized recommendations algorithm based on PostgreSQL customer preference signals.
   * STRICT SAFETY: Only returns verified database products. Zero fake items or hallucinated prices.
   */
  async getPersonalizedRecommendations({ userId = null, limit = 8 }) {
    // If no userId, return Cold Start popular picks
    if (!userId) {
      return await this.getColdStartRecommendations(limit);
    }

    try {
      // 1. Retrieve user preference signals from PostgreSQL
      const [recentlyViewed, wishlistItems, cartItems, pastOrders, searchLogs] = await Promise.all([
        prisma.recentlyViewed.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          include: { product: { include: { category: true, subCategory: true } } }
        }),
        prisma.wishlistItem.findMany({
          where: { wishlist: { userId } },
          take: 10,
          include: { product: { include: { category: true, subCategory: true } } }
        }),
        prisma.cartItem.findMany({
          where: { cart: { userId } },
          take: 10,
          include: { product: { include: { category: true, subCategory: true } } }
        }),
        prisma.orderItem.findMany({
          where: { order: { userId, orderStatus: { in: ['DELIVERED', 'COMPLETED', 'PAID', 'PROCESSING', 'SHIPPED'] } } },
          take: 10,
          include: { product: { include: { category: true, subCategory: true } } }
        }),
        prisma.searchLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
      ]);

      const categoryScores = {};
      const subCategoryScores = {};
      const colorScores = {};
      const prices = [];
      const interactedProductIds = new Set();

      // Aggregate Recently Viewed signals (+20 weight)
      recentlyViewed.forEach(rv => {
        if (!rv.product) return;
        interactedProductIds.add(rv.product.id);
        const catId = rv.product.categoryId;
        if (catId) categoryScores[catId] = (categoryScores[catId] || 0) + 20;
        if (rv.product.subCategoryId) subCategoryScores[rv.product.subCategoryId] = (subCategoryScores[rv.product.subCategoryId] || 0) + 15;
        if (rv.product.price) prices.push(rv.product.price);
      });

      // Aggregate Wishlist signals (+25 weight)
      wishlistItems.forEach(wi => {
        if (!wi.product) return;
        interactedProductIds.add(wi.product.id);
        const catId = wi.product.categoryId;
        if (catId) categoryScores[catId] = (categoryScores[catId] || 0) + 25;
        if (wi.product.subCategoryId) subCategoryScores[wi.product.subCategoryId] = (subCategoryScores[wi.product.subCategoryId] || 0) + 20;
        if (wi.product.price) prices.push(wi.product.price);
      });

      // Aggregate Cart signals (+20 weight)
      cartItems.forEach(ci => {
        if (!ci.product) return;
        interactedProductIds.add(ci.product.id);
        const catId = ci.product.categoryId;
        if (catId) categoryScores[catId] = (categoryScores[catId] || 0) + 20;
        if (ci.product.price) prices.push(ci.product.price);
      });

      // Aggregate Past Orders signals (+15 weight)
      pastOrders.forEach(oi => {
        if (!oi.product) return;
        interactedProductIds.add(oi.product.id);
        const catId = oi.product.categoryId;
        if (catId) categoryScores[catId] = (categoryScores[catId] || 0) + 15;
      });

      // Cold Start fallback if 0 preference signals found
      const topCatIds = Object.keys(categoryScores);
      if (topCatIds.length === 0) {
        return await this.getColdStartRecommendations(limit);
      }

      // Calculate average price range preference
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

      // Query candidate products matching customer preferences
      const candidates = await prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          isVisible: true,
          categoryId: { in: topCatIds }
        },
        take: 30,
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 2 },
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } }
        }
      });

      // Score each candidate product dynamically
      const scoredCandidates = candidates.map(prod => {
        let score = 0;
        if (categoryScores[prod.categoryId]) score += categoryScores[prod.categoryId];
        if (prod.subCategoryId && subCategoryScores[prod.subCategoryId]) score += subCategoryScores[prod.subCategoryId];
        if (avgPrice && Math.abs(prod.price - avgPrice) <= avgPrice * 0.35) score += 10;
        if (prod.featured) score += 5;
        if (prod.trending) score += 5;
        if (prod.bestSeller) score += 5;
        return { ...prod, _score: score };
      });

      // Sort by score descending
      scoredCandidates.sort((a, b) => b._score - a._score);

      // Return top N recommendations
      const finalProducts = scoredCandidates.slice(0, limit).map(({ _score, ...p }) => p);

      if (finalProducts.length === 0) {
        return await this.getColdStartRecommendations(limit);
      }

      return {
        type: 'personalized',
        reason: 'Recommended for You based on your recent shopping activity & preferences',
        products: finalProducts
      };
    } catch (err) {
      console.warn('[RecommendationService] Personalized lookup fallback:', err.message);
      return await this.getColdStartRecommendations(limit);
    }
  }

  /**
   * Product page recommendations ("You May Also Like")
   */
  async getProductPageRecommendations({ productId, limit = 6 }) {
    if (!productId) {
      return await this.getColdStartRecommendations(limit);
    }

    try {
      const currentProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: { category: true, subCategory: true }
      });

      if (!currentProduct) {
        return await this.getColdStartRecommendations(limit);
      }

      // Query products in same category or subcategory
      let similarProducts = await prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          isVisible: true,
          id: { not: productId },
          OR: [
            { categoryId: currentProduct.categoryId },
            ...(currentProduct.subCategoryId ? [{ subCategoryId: currentProduct.subCategoryId }] : [])
          ]
        },
        take: limit,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 2 },
          category: { select: { id: true, name: true, slug: true } }
        }
      });

      // Fallback if not enough similar products in exact category
      if (similarProducts.length < limit) {
        const extraProducts = await prisma.product.findMany({
          where: {
            status: 'PUBLISHED',
            isVisible: true,
            id: { notIn: [productId, ...similarProducts.map(p => p.id)] }
          },
          take: limit - similarProducts.length,
          orderBy: { createdAt: 'desc' },
          include: {
            images: { orderBy: { isPrimary: 'desc' }, take: 2 },
            category: { select: { id: true, name: true, slug: true } }
          }
        });
        similarProducts = [...similarProducts, ...extraProducts];
      }

      return {
        type: 'similar',
        reason: 'You May Also Like',
        currentProduct: { id: currentProduct.id, name: currentProduct.name },
        products: similarProducts
      };
    } catch (err) {
      console.warn('[RecommendationService] Product page lookup fallback:', err.message);
      return await this.getColdStartRecommendations(limit);
    }
  }

  /**
   * Cart page recommendations ("Complete Your Look" cross-sell)
   */
  async getCartRecommendations({ userId = null, limit = 4 }) {
    try {
      let cartCategoryIds = [];
      let cartProductIds = [];

      if (userId) {
        const cartItems = await prisma.cartItem.findMany({
          where: { cart: { userId } },
          include: { product: true }
        });
        cartProductIds = cartItems.map(ci => ci.productId);
        cartCategoryIds = cartItems.map(ci => ci.product.categoryId).filter(Boolean);
      }

      const products = await prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          isVisible: true,
          id: { notIn: cartProductIds },
          ...(cartCategoryIds.length > 0 ? { categoryId: { notIn: cartCategoryIds } } : {})
        },
        take: limit,
        orderBy: [{ trending: 'desc' }, { createdAt: 'desc' }],
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 2 },
          category: { select: { id: true, name: true, slug: true } }
        }
      });

      return {
        type: 'cart_cross_sell',
        reason: 'Complete Your Look',
        products
      };
    } catch (err) {
      console.warn('[RecommendationService] Cart cross-sell fallback:', err.message);
      return await this.getColdStartRecommendations(limit);
    }
  }

  /**
   * Cold Start fallback recommendations using trending/featured products
   */
  async getColdStartRecommendations(limit = 8) {
    const products = await prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        isVisible: true
      },
      take: limit,
      orderBy: [{ featured: 'desc' }, { trending: 'desc' }, { createdAt: 'desc' }],
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 2 },
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    return {
      type: 'popular',
      reason: 'Trending & Popular Luxury Picks',
      products
    };
  }
}

module.exports = new RecommendationService();
