const prisma = require('../config/db');
const geminiService = require('./geminiService');

class CartOptimizerService {
  /**
   * Helper to get effective price of a product
   */
  _getEffectivePrice(product) {
    return product.discountPrice && product.discountPrice > 0
      ? product.discountPrice
      : product.price;
  }

  /**
   * Phase 9 — AI Smart Cart & Budget Optimizer
   * Inspects current cart, calculates authoritative totals, finds real database replacement items,
   * optimizes combinations to achieve target budget with minimal replacements, and generates AI explanations.
   */
  async optimizeCart({ userId, guestCartItems = [], maxBudget, userPrompt = '' }) {
    if (!maxBudget || isNaN(maxBudget) || maxBudget <= 0) {
      return {
        success: false,
        error: 'Please specify a valid positive budget amount (e.g. ₹3500).'
      };
    }

    const numericBudget = parseFloat(maxBudget);

    // Step 33: Extreme Budget Check (unrealistic target)
    if (numericBudget < 100) {
      return {
        success: false,
        error: `A budget of ₹${numericBudget} is too low to find suitable clothing/jewellery replacements in our catalog. Please try a higher budget.`
      };
    }

    // Step 2 & 4: Retrieve authoritative cart items from DB or guest payload
    let rawItems = [];
    if (userId) {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: { orderBy: { isPrimary: 'desc' }, take: 1 },
                  category: { select: { id: true, name: true } },
                  subCategory: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      });
      rawItems = cart?.items || [];
    } else if (Array.isArray(guestCartItems) && guestCartItems.length > 0) {
      // Re-verify guest items against DB
      const pIds = guestCartItems.map(i => i.id || i.productId).filter(Boolean);
      const dbProducts = await prisma.product.findMany({
        where: { id: { in: pIds }, status: 'PUBLISHED', isVisible: true },
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 1 },
          category: { select: { id: true, name: true } },
          subCategory: { select: { id: true, name: true } }
        }
      });

      const pMap = new Map(dbProducts.map(p => [p.id, p]));
      rawItems = guestCartItems
        .filter(gi => pMap.has(gi.id || gi.productId))
        .map(gi => ({
          id: gi.cartItemId || gi.id,
          productId: gi.id || gi.productId,
          quantity: Math.max(1, parseInt(gi.quantity || 1, 10)),
          size: gi.size || '',
          color: gi.color || '',
          product: pMap.get(gi.id || gi.productId)
        }));
    }

    // Step 34: Empty Cart Check
    if (!rawItems || rawItems.length === 0) {
      return {
        success: false,
        error: 'You do not have any items in your cart yet. Add some products first to use the AI Budget Optimizer!'
      };
    }

    // Format current cart items with authoritative DB prices
    const cartItems = rawItems.map(ci => {
      const p = ci.product;
      const finalPrice = this._getEffectivePrice(p);
      const qty = Math.max(1, parseInt(ci.quantity || 1, 10));
      return {
        cartItemId: ci.id,
        productId: p.id,
        name: p.name,
        slug: p.slug,
        image: p.images?.[0]?.url || null,
        price: p.price,
        discountPrice: p.discountPrice,
        finalPrice,
        quantity: qty,
        itemTotal: finalPrice * qty,
        categoryId: p.categoryId,
        categoryName: p.category?.name || 'Fashion',
        subCategoryId: p.subCategoryId,
        subCategoryName: p.subCategory?.name || null,
        gender: p.gender || 'Unisex',
        material: p.material || null,
        stock: p.stock
      };
    });

    const currentTotal = cartItems.reduce((sum, item) => sum + item.itemTotal, 0);

    // Step 6: Already within budget check
    if (currentTotal <= numericBudget) {
      const remaining = Math.round(numericBudget - currentTotal);
      return {
        success: true,
        isAlreadyWithinBudget: true,
        currentTotal,
        maxBudget: numericBudget,
        remainingBudget: remaining,
        message: `Your current cart total (₹${currentTotal}) is already within your ₹${numericBudget} budget! You have ₹${remaining} remaining in your budget.`,
        items: cartItems,
        suggestions: []
      };
    }

    const overBudget = Math.round(currentTotal - numericBudget);

    // Step 7, 8, 9, 10: Find candidate lower-priced replacements from real database
    const cartProductIds = cartItems.map(i => i.productId);
    const replacementCandidatesMap = new Map(); // cartItemId -> candidate products

    for (const item of cartItems) {
      // Find products in same category/subcategory with lower price and stock > 0
      const candidates = await prisma.product.findMany({
        where: {
          id: { notIn: cartProductIds },
          status: 'PUBLISHED',
          isVisible: true,
          stock: { gt: 0 },
          categoryId: item.categoryId,
          price: { lt: item.finalPrice }
        },
        include: {
          images: { orderBy: { isPrimary: 'desc' }, take: 1 },
          category: { select: { id: true, name: true } }
        },
        orderBy: { discountPrice: 'asc' },
        take: 10
      });

      // Filter and score candidates by effective price and similarity
      const validCandidates = candidates
        .map(c => {
          const cFinalPrice = this._getEffectivePrice(c);
          if (cFinalPrice >= item.finalPrice) return null; // Must be strictly cheaper
          const savingPerUnit = item.finalPrice - cFinalPrice;
          const totalSavingForItem = savingPerUnit * item.quantity;
          return {
            id: c.id,
            name: c.name,
            slug: c.slug,
            image: c.images?.[0]?.url || null,
            price: c.price,
            discountPrice: c.discountPrice,
            finalPrice: cFinalPrice,
            savingPerUnit,
            totalSavingForItem,
            stock: c.stock,
            material: c.material,
            categoryName: c.category?.name || 'Fashion'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.totalSavingForItem - a.totalSavingForItem); // Max savings first

      replacementCandidatesMap.set(item.cartItemId, validCandidates);
    }

    // Step 11, 12, 13: Greedy/Combination Optimizer
    // Find combination of replacements that minimizes number of item changes while achieving newTotal <= maxBudget
    let bestCombination = null;
    let bestNewTotal = Infinity;
    let bestTotalSavings = 0;
    let fewestReplacements = Infinity;

    // Generate possible replacement scenarios
    // 1-item replacement scenarios first, then 2-item, etc.
    const itemIds = cartItems.map(i => i.cartItemId);
    const allScenarios = [];

    // Single item replacement options
    for (const itemId of itemIds) {
      const candidates = replacementCandidatesMap.get(itemId) || [];
      for (const cand of candidates) {
        allScenarios.push([{ cartItemId: itemId, replacement: cand }]);
      }
    }

    // Multi-item replacement combinations (if more than 1 item in cart)
    if (cartItems.length > 1) {
      for (let i = 0; i < itemIds.length; i++) {
        for (let j = i + 1; j < itemIds.length; j++) {
          const candA = replacementCandidatesMap.get(itemIds[i]) || [];
          const candB = replacementCandidatesMap.get(itemIds[j]) || [];
          for (const ca of candA) {
            for (const cb of candB) {
              allScenarios.push([
                { cartItemId: itemIds[i], replacement: ca },
                { cartItemId: itemIds[j], replacement: cb }
              ]);
            }
          }
        }
      }
    }

    // Evaluate all scenarios
    for (const scenario of allScenarios) {
      let scenarioTotal = 0;
      let scenarioSavings = 0;

      for (const item of cartItems) {
        const rep = scenario.find(s => s.cartItemId === item.cartItemId);
        if (rep) {
          scenarioTotal += rep.replacement.finalPrice * item.quantity;
          scenarioSavings += rep.replacement.totalSavingForItem;
        } else {
          scenarioTotal += item.itemTotal;
        }
      }

      const isWithinBudget = scenarioTotal <= numericBudget;
      const numReplacements = scenario.length;

      if (isWithinBudget) {
        // Prefer fewer replacements, then maximum savings
        if (
          numReplacements < fewestReplacements ||
          (numReplacements === fewestReplacements && scenarioTotal < bestNewTotal)
        ) {
          fewestReplacements = numReplacements;
          bestNewTotal = scenarioTotal;
          bestTotalSavings = scenarioSavings;
          bestCombination = scenario;
        }
      } else if (!bestCombination) {
        // Track closest partial optimization if exact budget target unreachable
        if (scenarioTotal < bestNewTotal) {
          bestNewTotal = scenarioTotal;
          bestTotalSavings = scenarioSavings;
          bestCombination = scenario;
        }
      }
    }

    // Step 31: No suitable alternatives found
    if (!bestCombination || bestTotalSavings <= 0) {
      return {
        success: true,
        hasReplacements: false,
        currentTotal,
        maxBudget: numericBudget,
        overBudget,
        message: `I searched our entire catalog, but couldn't find suitable lower-priced in-stock replacements for the items currently in your cart.`
      };
    }

    // Format proposed replacements
    const suggestedReplacements = bestCombination.map(sc => {
      const original = cartItems.find(i => i.cartItemId === sc.cartItemId);
      return {
        originalItem: {
          cartItemId: original.cartItemId,
          productId: original.productId,
          name: original.name,
          image: original.image,
          finalPrice: original.finalPrice,
          quantity: original.quantity,
          itemTotal: original.itemTotal
        },
        suggestedProduct: {
          productId: sc.replacement.id,
          name: sc.replacement.name,
          image: sc.replacement.image,
          finalPrice: sc.replacement.finalPrice,
          savingPerUnit: sc.replacement.savingPerUnit,
          totalSavingForItem: sc.replacement.totalSavingForItem
        },
        quantity: original.quantity,
        totalSavingsForItem: sc.replacement.totalSavingForItem
      };
    });

    const isFullyWithinBudget = bestNewTotal <= numericBudget;
    const finalDiff = Math.abs(numericBudget - bestNewTotal);

    // Step 15: AI Explanation via Gemini or Fallback
    let aiExplanation = null;
    if (geminiService.isConfigured()) {
      try {
        const repsText = suggestedReplacements.map(r =>
          `- Replace '${r.originalItem.name}' (₹${r.originalItem.finalPrice}) with '${r.suggestedProduct.name}' (₹${r.suggestedProduct.finalPrice}) -> Save ₹${r.totalSavingsForItem}`
        ).join('\n');

        const prompt = `Cart Total: ₹${currentTotal}
Target Budget: ₹${numericBudget}
Over Budget: ₹${overBudget}
New Total with Alternatives: ₹${bestNewTotal}
Total Savings: ₹${bestTotalSavings}

Suggested Replacements:
${repsText}

Write a helpful, polite 2-sentence summary explaining how these suggested product replacements bring the cart ${isFullyWithinBudget ? 'within' : 'closer to'} the customer's ₹${numericBudget} budget.
STRICT RULE: Use ONLY the exact numbers above. Do NOT invent prices or discounts.`;

        const res = await geminiService.generateWithFallback([{ role: 'user', parts: [{ text: prompt }] }], {
          temperature: 0.2,
          maxOutputTokens: 250
        });
        if (res?.text) {
          aiExplanation = res.text.trim();
        }
      } catch (err) {
        console.warn('[CartOptimizerService] Gemini explanation fallback:', err.message);
      }
    }

    // Step 32: Partial Optimization fallback message
    if (!aiExplanation) {
      if (isFullyWithinBudget) {
        aiExplanation = `Your cart is ₹${overBudget} over budget. By swapping ${suggestedReplacements.length} item${suggestedReplacements.length > 1 ? 's' : ''} for high-quality, lower-priced alternatives from our store, your new total will be ₹${bestNewTotal} (saving ₹${bestTotalSavings}).`;
      } else {
        aiExplanation = `I couldn't bring the cart strictly below ₹${numericBudget} using suitable available products. The closest option I found reduces your total to ₹${bestNewTotal} (saving ₹${bestTotalSavings}).`;
      }
    }

    return {
      success: true,
      hasReplacements: true,
      isFullyWithinBudget,
      currentTotal,
      maxBudget: numericBudget,
      overBudget,
      newTotal: bestNewTotal,
      totalSavings: bestTotalSavings,
      suggestedReplacements,
      aiExplanation
    };
  }
}

module.exports = new CartOptimizerService();
