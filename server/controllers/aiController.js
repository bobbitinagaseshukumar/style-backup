const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// ==================== AUTO-SUGGEST & SEARCH ANALYTICS ====================
exports.getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.status(200).json({ success: true, data: { suggestions: [], products: [] } });
  }

  const query = q.trim();

  // Log search query
  try {
    await prisma.searchLog.create({
      data: { query: query.toLowerCase(), userId: req.user?.id || null },
    });
  } catch (err) {
    console.error('Search log error:', err);
  }

  // Fetch matching products
  const products = await prisma.product.findMany({
    where: {
      isVisible: true,
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
      ],
    },
    select: { id: true, name: true, slug: true, price: true, discountPrice: true, images: true, category: { select: { name: true } } },
    take: 5,
  });

  // Fetch matching categories
  const categories = await prisma.category.findMany({
    where: { isVisible: true, name: { contains: query } },
    select: { name: true, slug: true },
    take: 3,
  });

  res.status(200).json({
    success: true,
    data: {
      query,
      suggestions: categories.map(c => c.name),
      products,
    },
  });
});

const recommendationService = require('../services/recommendationService');
const stylistService = require('../services/stylistService');
const visualSearchService = require('../services/visualSearchService');
const comparisonService = require('../services/comparisonService');

// ==================== SMART PRODUCT COMPARISON ====================
exports.compareProducts = asyncHandler(async (req, res, next) => {
  const { productIds, criteria } = req.body;
  if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
    return next(new ApiError(400, 'Please select at least 2 products to compare (up to 4)'));
  }
  const result = await comparisonService.compareProducts({
    productIds,
    criteria: criteria || {}
  });
  if (!result.success) {
    return next(new ApiError(400, result.error || 'Failed to compare products'));
  }
  res.status(200).json({ success: true, data: result });
});

// ==================== OCCASION + BUDGET PERSONAL STYLIST ====================
exports.getPersonalStylist = asyncHandler(async (req, res) => {
  const { occasion, maxBudget, minBudget, category, color, style, gender, isSingleProduct } = req.body;
  const result = await stylistService.buildOutfitRecommendations({
    occasion,
    maxBudget,
    minBudget,
    category,
    color,
    style,
    gender,
    isSingleProduct
  });
  res.status(200).json({ success: true, data: result });
});

// ==================== VISUAL PRODUCT DISCOVERY ====================
exports.searchByVisualImage = asyncHandler(async (req, res, next) => {
  const { imageBase64, mimeType, textPrompt, maxBudget } = req.body;
  if (!imageBase64) {
    return next(new ApiError(400, 'Image file is required for visual search'));
  }

  // Server-side image validation
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const safeMimeType = allowedMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

  // Reject oversized payloads (~5MB raw = ~6.7MB base64)
  if (typeof imageBase64 === 'string' && imageBase64.length > 7 * 1024 * 1024) {
    return next(new ApiError(400, 'Image is too large. Please upload an image under 5MB.'));
  }

  const result = await visualSearchService.searchByImage({
    imageBase64,
    mimeType: safeMimeType,
    textPrompt: textPrompt || '',
    maxBudget: maxBudget ? parseFloat(maxBudget) : null
  });
  res.status(200).json({ success: true, data: result });
});

// ==================== PERSONALIZED RECOMMENDATION ENGINE ====================
exports.getPersonalized = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const limit = parseInt(req.query.limit || '8', 10);
  const result = await recommendationService.getPersonalizedRecommendations({ userId, limit });
  res.status(200).json({ success: true, data: result });
});

// ==================== CART CROSS-SELL RECOMMENDATIONS ====================
exports.getCartRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const limit = parseInt(req.query.limit || '4', 10);
  const result = await recommendationService.getCartRecommendations({ userId, limit });
  res.status(200).json({ success: true, data: result });
});

// ==================== PRODUCT PAGE RECOMMENDATIONS ====================
exports.getRecommendations = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  const limit = parseInt(req.query.limit || '6', 10);
  const result = await recommendationService.getProductPageRecommendations({ productId, limit });
  res.status(200).json({ success: true, data: result });
});

// ==================== BACK IN STOCK SUBSCRIPTION ====================
exports.subscribeBackInStock = asyncHandler(async (req, res, next) => {
  const { productId, email } = req.body;

  if (!productId || !email) {
    return next(new ApiError(400, 'Product ID and Email are required'));
  }

  const existing = await prisma.backInStockSubscription.findFirst({
    where: { productId, email: email.toLowerCase() },
  });

  if (existing) {
    return res.status(200).json({
      success: true,
      message: 'You are already subscribed for stock alerts on this item!',
    });
  }

  const sub = await prisma.backInStockSubscription.create({
    data: { productId, email: email.toLowerCase() },
  });

  res.status(201).json({
    success: true,
    message: 'Stock alert set! We will email you as soon as this item is restocked.',
    data: sub,
  });
});

// ==================== SEARCH ANALYTICS (ADMIN) ====================
exports.getSearchAnalytics = asyncHandler(async (req, res) => {
  const topSearches = await prisma.searchLog.groupBy({
    by: ['query'],
    _count: { query: true },
    orderBy: { _count: { query: 'desc' } },
    take: 10,
  });

  res.status(200).json({
    success: true,
    data: topSearches.map(s => ({ query: s.query, count: s._count.query })),
  });
});
