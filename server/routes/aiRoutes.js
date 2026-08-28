const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/suggestions', aiController.getSearchSuggestions);
router.get('/personalized', optionalAuth, aiController.getPersonalized);
router.get('/cart-recommendations', optionalAuth, aiController.getCartRecommendations);
router.post('/stylist', optionalAuth, aiController.getPersonalStylist);
router.post('/visual-search', optionalAuth, aiController.searchByVisualImage);
router.post('/compare', optionalAuth, aiController.compareProducts);
router.get('/recommendations/:productId', aiController.getRecommendations);
router.post('/cart-optimizer', optionalAuth, aiController.optimizeCartBudget);
router.post('/offers', optionalAuth, aiController.getPersonalizedOffers);
router.get('/admin/search-analytics', aiController.getSearchAnalytics);

module.exports = router;
