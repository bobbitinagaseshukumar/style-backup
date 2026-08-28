const prisma = require('../config/db');
const geminiService = require('./geminiService');

class PersonalizedOfferService {
  /**
   * Phase 10 — AI Personalized Offers & Smart Deals
   * Identifies, evaluates, ranks, and explains existing valid admin coupons & flash sales for customer.
   * STRICT SAFETY: Admin controls all offers. AI never invents codes, discounts, or terms.
   */
  async getPersonalizedOffers({ userId = null, cartTotal = 0, categoryId = null, productId = null, userPrompt = '' }) {
    const now = new Date();

    // Step 2 & 15: Fetch active, published coupons from DB
    const dbCoupons = await prisma.coupon.findMany({
      where: {
        status: 'PUBLISHED',
        isActive: true,
        expiresAt: { gt: now },
        startDate: { lte: now }
      },
      orderBy: { priority: 'desc' }
    });

    // Step 21: Fetch active flash sales from DB
    const dbFlashSales = await prisma.flashSale.findMany({
      where: {
        status: 'PUBLISHED',
        isActive: true,
        endDate: { gt: now },
        startDate: { lte: now }
      }
    });

    // Check customer order history for coupon usage limits if userId supplied
    let userUsedCouponCodes = new Set();
    if (userId) {
      const userOrders = await prisma.order.findMany({
        where: { userId, couponCode: { not: null } },
        select: { couponCode: true }
      });
      userOrders.forEach(o => {
        if (o.couponCode) userUsedCouponCodes.add(o.couponCode.toUpperCase());
      });
    }

    const currentCartTotal = parseFloat(cartTotal || 0);

    // Evaluate and validate coupon eligibility
    const eligibleCoupons = [];
    const upcomingCoupons = [];

    for (const c of dbCoupons) {
      // Step 16: Check per-customer usage limit
      if (userId && c.perCustomerLimit && userUsedCouponCodes.has(c.code)) {
        continue; // Already used by customer
      }

      // Check total usage limit
      if (c.totalUsageLimit && c.currentUsageCount >= c.totalUsageLimit) {
        continue; // Fully redeemed
      }

      // Step 17: Minimum order check
      const meetsMinOrder = currentCartTotal >= c.minOrderAmount;

      // Calculate potential discount amount
      let discountAmount = 0;
      if (c.discountType === 'PERCENTAGE' && c.discountPercent) {
        discountAmount = Math.round((currentCartTotal * c.discountPercent) / 100);
        if (c.maxDiscount && discountAmount > c.maxDiscount) {
          discountAmount = c.maxDiscount;
        }
      } else if (c.discountType === 'FIXED' && c.discountAmount) {
        discountAmount = c.discountAmount;
      }

      // Don't allow discount greater than cart total
      if (currentCartTotal > 0) {
        discountAmount = Math.min(discountAmount, currentCartTotal);
      }

      const offerObj = {
        id: c.id,
        code: c.code,
        name: c.name || c.code,
        description: c.description || '',
        discountType: c.discountType,
        discountPercent: c.discountPercent,
        discountAmount,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        expiresAt: c.expiresAt,
        colorTheme: c.colorTheme || '#D4AF37',
        meetsMinOrder,
        amountShort: meetsMinOrder ? 0 : Math.round(c.minOrderAmount - currentCartTotal),
        finalTotal: currentCartTotal > 0 ? Math.max(0, currentCartTotal - discountAmount) : 0
      };

      if (meetsMinOrder) {
        eligibleCoupons.push(offerObj);
      } else if (currentCartTotal > 0 && offerObj.amountShort <= 1000) {
        upcomingCoupons.push(offerObj); // Near minimum order threshold
      }
    }

    // Sort eligible offers by actual savings desc (Step 12: Smart Offer Ranking)
    eligibleCoupons.sort((a, b) => b.discountAmount - a.discountAmount);

    const bestOffer = eligibleCoupons.length > 0 ? eligibleCoupons[0] : null;

    // Format active flash sales summary
    const activeFlashSales = dbFlashSales.map(fs => ({
      id: fs.id,
      name: fs.name || 'Midnight Flash Sale',
      discountValue: fs.discountValue,
      discountType: fs.discountType,
      endDate: fs.endDate
    }));

    // Step 39: Empty offers state
    if (eligibleCoupons.length === 0 && upcomingCoupons.length === 0 && activeFlashSales.length === 0) {
      return {
        success: true,
        hasOffers: false,
        bestOffer: null,
        eligibleOffers: [],
        upcomingOffers: [],
        flashSales: [],
        message: 'There are no additional promotional offers currently available for this purchase.'
      };
    }

    // Step 14: AI Explanation via Gemini or Fallback
    let aiExplanation = null;
    if (geminiService.isConfigured()) {
      try {
        const prompt = `Customer Cart Total: ₹${currentCartTotal}
Available Best Coupon: ${bestOffer ? `${bestOffer.code} (Save ₹${bestOffer.discountAmount}, Min Order ₹${bestOffer.minOrderAmount})` : 'None eligible yet'}
Near Threshold Coupon: ${upcomingCoupons[0] ? `${upcomingCoupons[0].code} (Add ₹${upcomingCoupons[0].amountShort} more to save)` : 'None'}

Write a 2-sentence recommendation explaining the best available coupon offer for the customer's current cart.
STRICT RULE: Use ONLY the exact coupon codes and numbers listed above. Do NOT invent codes or percentages.`;

        const res = await geminiService.generateWithFallback([{ role: 'user', parts: [{ text: prompt }] }], {
          temperature: 0.2,
          maxOutputTokens: 250
        });
        if (res?.text) {
          aiExplanation = res.text.trim();
        }
      } catch (err) {
        console.warn('[PersonalizedOfferService] Gemini explanation fallback:', err.message);
      }
    }

    if (!aiExplanation) {
      if (bestOffer && currentCartTotal > 0) {
        aiExplanation = `🎉 You have an eligible offer! Use coupon **${bestOffer.code}** to save ₹${bestOffer.discountAmount} on your current cart total of ₹${currentCartTotal} (bringing your total down to ₹${bestOffer.finalTotal}).`;
      } else if (upcomingCoupons.length > 0) {
        const up = upcomingCoupons[0];
        aiExplanation = `You are just ₹${up.amountShort} away from unlocking coupon **${up.code}** (Min order ₹${up.minOrderAmount}).`;
      } else {
        aiExplanation = `Check out our active store coupons below for instant discounts on your order.`;
      }
    }

    return {
      success: true,
      hasOffers: true,
      bestOffer,
      eligibleOffers: eligibleCoupons,
      upcomingOffers: upcomingCoupons,
      flashSales: activeFlashSales,
      aiExplanation
    };
  }
}

module.exports = new PersonalizedOfferService();
