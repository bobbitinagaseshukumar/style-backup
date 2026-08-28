import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiShoppingBag, FiLayers, FiZap, FiHeart,
  FiAward, FiStar, FiRefreshCw, FiArrowRight, FiEye, FiSearch
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../config/api';
import { addToCart } from '../../redux/cart/cartSlice';
import { addToWishlist } from '../../redux/wishlist/wishlistSlice';
import { removeFromCompare, clearCompare } from '../../redux/compare/compareSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';
import { toast } from 'react-toastify';

/**
 * Phase 8 — AI Smart Product Comparison & Decision Assistant Page
 * Allows side-by-side comparison of 2-4 real products with AI decision analysis.
 * Uses authoritative database values ONLY — fetched from backend, NOT from Redux.
 */
const Compare = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const compareItems = useSelector(state => state.compare?.items || []);
  const user = useSelector(state => state.auth?.user);

  // Step 4: Authoritative product data from backend (NOT from Redux/frontend)
  const [dbProducts, setDbProducts] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeGoal, setActiveGoal] = useState('best_overall');
  const [activeOccasion, setActiveOccasion] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [colorInput, setColorInput] = useState('');

  // Step 41: NO auto AI call on page load. Only fetch authoritative product data.
  useEffect(() => {
    if (compareItems.length >= 2) {
      fetchAuthoritativeProducts();
    } else {
      setDbProducts([]);
      setComparisonData(null);
    }
  }, [compareItems.length]);

  // Step 4: Fetch authoritative product records from PostgreSQL through backend
  const fetchAuthoritativeProducts = useCallback(async () => {
    if (compareItems.length < 2) return;
    try {
      setLoadingProducts(true);
      const productIds = compareItems.map(p => p.id || p._id);
      const res = await api.post('/ai/compare', {
        productIds,
        criteria: { goal: 'best_overall' }
      });
      if (res.data?.success && res.data.data?.products) {
        setDbProducts(res.data.data.products);
        setComparisonData(res.data.data);
      }
    } catch (err) {
      console.warn('[ComparePage] Failed to fetch products:', err.message);
      toast.error('Could not load comparison data. Please try again.');
    } finally {
      setLoadingProducts(false);
    }
  }, [compareItems]);

  // Step 9: Run AI comparison with specific goal, occasion, budget, color
  const runAiComparison = async (goal = 'best_overall', occasion = '') => {
    if (compareItems.length < 2) return;
    try {
      setLoadingAi(true);
      const productIds = compareItems.map(p => p.id || p._id);
      const maxBudget = budgetInput ? parseFloat(budgetInput) : undefined;
      const preferredColor = colorInput || undefined;

      const res = await api.post('/ai/compare', {
        productIds,
        criteria: {
          goal,
          occasion,
          maxBudget,
          preferredColor,
          userPrompt: `Which item is best ${goal.replace(/_/g, ' ')}${occasion ? ' for ' + occasion : ''}${maxBudget ? ' under ₹' + maxBudget : ''}?`
        }
      });

      if (res.data?.success) {
        setComparisonData(res.data.data);
        setDbProducts(res.data.data.products || dbProducts);
      }
    } catch (err) {
      console.warn('[ComparePage] AI comparison notice:', err.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGoalChange = (goal, occasion = '') => {
    setActiveGoal(goal);
    setActiveOccasion(occasion);
    runAiComparison(goal, occasion);
  };

  // Step 19: Add to Cart using existing cart system
  const handleAddToCart = (product) => {
    if (!user) {
      toast.info('Please sign in to add items to your cart');
      navigate('/login');
      return;
    }
    if (product.stock <= 0 || !product.isAvailable) {
      toast.error('This product is currently out of stock.');
      return;
    }
    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: product.finalPrice || product.discountPrice || product.price,
      image: formatImageUrl(product.image),
      quantity: 1,
    }));
    toast.success(`Added '${product.name}' to cart!`);
  };

  // Step 21: Add to Wishlist using existing wishlist system
  const handleAddToWishlist = (product) => {
    if (!user) {
      toast.info('Please sign in to add items to your wishlist');
      navigate('/login');
      return;
    }
    dispatch(addToWishlist({
      id: product.id,
      name: product.name,
      price: product.finalPrice || product.discountPrice || product.price,
      image: formatImageUrl(product.image),
    }));
    toast.success(`Added '${product.name}' to wishlist ♥`);
  };

  const recProduct = comparisonData?.recommendation?.product;

  // Step 6: Use authoritative backend data for display, NOT Redux frontend data
  const displayProducts = dbProducts.length >= 2 ? dbProducts : compareItems;

  return (
    <div className="min-h-screen bg-charcoal-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              <FiZap className="w-3.5 h-3.5" /> AI Decision Assistant
            </span>
            <h1 className="text-2xl sm:text-4xl font-serif font-bold text-white flex items-center gap-2">
              <FiLayers className="text-gold-400" /> Smart Product Comparison
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Objective side-by-side comparison powered by real database facts & AI recommendation scoring.
            </p>
          </div>

          {compareItems.length > 0 && (
            <button
              onClick={() => dispatch(clearCompare())}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10 text-xs font-bold transition self-start sm:self-auto cursor-pointer"
              aria-label="Clear all compared products"
            >
              Clear All Items
            </button>
          )}
        </div>

        {/* Step 31: NOT ENOUGH PRODUCTS STATE */}
        {compareItems.length < 2 ? (
          <div className="py-16 px-6 text-center bg-white/5 border border-white/10 rounded-3xl max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 flex items-center justify-center mx-auto text-2xl">
              ⚖️
            </div>
            <h3 className="text-xl font-serif font-bold text-white">Select at least two products to compare.</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Use the ⚖️ Compare button on product cards across the store to add items here.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/categories')}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition cursor-pointer shadow-lg inline-flex items-center gap-2"
                aria-label="Browse catalog to find products to compare"
              >
                Browse Catalog <FiArrowRight />
              </button>
            </div>
          </div>
        ) : loadingProducts ? (
          <div className="py-16 text-center">
            <FiRefreshCw className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Loading product comparison data...</p>
          </div>
        ) : (
          <>
            {/* ── AI DECISION ASSISTANT ─────────────────────── */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-charcoal-900 via-black to-charcoal-900 border border-gold-500/30 relative overflow-hidden shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-500/50 text-gold-400 flex items-center justify-center text-xl shrink-0">
                    <FiAward />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-300">AI Decision Recommendation</h3>
                    <p className="text-xs text-gray-400">Click a goal below or enter budget/color to get AI trade-off analysis:</p>
                  </div>
                </div>

                {/* Step 9: Interactive Decision Goal Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'best_overall', label: '👑 Best Overall', oc: '' },
                    { key: 'best_overall', label: '✨ Wedding', oc: 'wedding' },
                    { key: 'cheapest', label: '💡 Cheapest', oc: '' },
                    { key: 'highest_rated', label: '⭐ Highest Rated', oc: '' },
                    { key: 'best_value', label: '💎 Best Value', oc: '' },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      onClick={() => handleGoalChange(btn.key, btn.oc)}
                      aria-label={`Find ${btn.label}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        activeGoal === btn.key && activeOccasion === btn.oc
                          ? 'bg-amber-400 text-black border-amber-400'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 10: Budget & Color Filter Inputs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    placeholder="Max budget (₹)"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                    aria-label="Maximum budget filter"
                  />
                  <input
                    type="text"
                    placeholder="Preferred color"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                    aria-label="Preferred color filter"
                  />
                  <button
                    onClick={() => runAiComparison(activeGoal, activeOccasion)}
                    disabled={loadingAi}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    aria-label="Apply filters and run AI comparison"
                  >
                    <FiSearch className="w-3.5 h-3.5" /> Analyze
                  </button>
                </div>
              </div>

              {/* AI Explanation Box */}
              {loadingAi ? (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 text-xs text-gray-400 animate-pulse">
                  <FiRefreshCw className="w-4 h-4 animate-spin text-gold-400" />
                  <span>Evaluating product trade-offs & calculating decision scores...</span>
                </div>
              ) : comparisonData?.recommendation ? (
                <div className="p-4 rounded-2xl bg-gold-500/10 border border-gold-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-gold-400 text-black font-black text-[10px] uppercase">
                          Top Pick
                        </span>
                        <h4 className="font-bold text-white text-sm">
                          {recProduct?.name} — {formatCurrency(recProduct?.finalPrice)}
                        </h4>
                        {recProduct && !recProduct.isAvailable && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/30 text-red-400 text-[9px] font-bold">Out of Stock</span>
                        )}
                      </div>
                      <p className="text-gray-300 leading-relaxed pt-1">
                        {comparisonData.recommendation.aiExplanation}
                      </p>
                    </div>

                    {recProduct && recProduct.isAvailable && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleAddToCart(recProduct)}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition shadow-lg flex items-center gap-1.5 cursor-pointer"
                          aria-label={`Add ${recProduct.name} to cart`}
                        >
                          <FiShoppingBag /> Add Best to Cart
                        </button>
                        <button
                          onClick={() => handleAddToWishlist(recProduct)}
                          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-red-400 transition cursor-pointer"
                          aria-label={`Add ${recProduct.name} to wishlist`}
                        >
                          <FiHeart className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Step 10: Budget violation message */}
                  {budgetInput && comparisonData.recommendation.product.finalPrice > parseFloat(budgetInput) && (
                    <p className="text-[10px] text-red-400 font-bold">
                      ⚠️ Note: The recommended product exceeds your ₹{budgetInput} budget. None of the compared products may be within this range.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {/* ── COMPARISON MATRIX TABLE ─────────────────────────── */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs text-left" role="table" aria-label="Product comparison table">
                  <thead className="bg-charcoal-900 border-b border-white/10">
                    <tr>
                      <th className="p-4 w-44 font-bold text-amber-400 uppercase text-[11px]" scope="col">Feature</th>
                      {displayProducts.map(p => {
                        const isRecommended = recProduct?.id === p.id;
                        const imgUrl = p.image || p.images?.[0]?.url || (Array.isArray(p.images) ? p.images[0] : null);
                        const formattedImg = formatImageUrl(imgUrl);

                        return (
                          <th key={p.id} className="p-4 min-w-[200px] relative border-l border-white/5" scope="col">
                            {isRecommended && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-black font-black text-[9px] uppercase shadow">
                                👑 Recommended
                              </span>
                            )}
                            <button
                              onClick={() => dispatch(removeFromCompare(p.id))}
                              className="absolute top-2 right-2 text-gray-400 hover:text-red-400 p-1 rounded-lg"
                              title="Remove from comparison"
                              aria-label={`Remove ${p.name} from comparison`}
                            >
                              <FiX className="w-4 h-4" />
                            </button>

                            <img
                              src={formattedImg}
                              alt={p.name}
                              className="w-24 h-32 object-cover rounded-2xl bg-white/5 mb-2 mx-auto border border-white/10 mt-4"
                            />
                            <span className="font-bold text-sm text-white block text-center line-clamp-2">{p.name}</span>
                            <span className="font-black text-gold-400 block text-center text-sm mt-1">
                              {formatCurrency(p.finalPrice || p.discountPrice || p.price)}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {/* Step 7: Price — original + discount + final */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Price</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          <span className="font-black text-emerald-400 text-sm block">
                            {formatCurrency(p.finalPrice || p.discountPrice || p.price)}
                          </span>
                          {p.discountPercent > 0 && (
                            <>
                              <span className="text-[10px] text-gray-400 line-through block">
                                MRP: {formatCurrency(p.price)}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-bold block">
                                {p.discountPercent}% off
                              </span>
                            </>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Step 8: Rating & Reviews — show both rating AND review count */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Rating & Reviews</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.reviewsCount > 0 ? (
                            <>
                              <span className="font-bold text-amber-400 flex items-center gap-1">
                                <FiStar className="fill-amber-400" /> {p.rating} / 5
                              </span>
                              <span className="text-[10px] text-gray-400 block">
                                {p.reviewsCount} review{p.reviewsCount !== 1 ? 's' : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-500 text-[10px]">No reviews yet</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Category */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Category</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.category || 'Not specified'}
                          {p.subCategory && <span className="text-gray-500 text-[10px] block">{p.subCategory}</span>}
                        </td>
                      ))}
                    </tr>

                    {/* Fabric & Material */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Fabric / Material</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.material || 'Not specified'}
                        </td>
                      ))}
                    </tr>

                    {/* Occasion */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Occasion</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.occasion || 'Not specified'}
                        </td>
                      ))}
                    </tr>

                    {/* Gender */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Gender</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.gender || 'Unisex'}
                        </td>
                      ))}
                    </tr>

                    {/* Step 33: Stock Availability */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Availability</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.isAvailable !== false && p.stock > 0
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {p.isAvailable !== false && p.stock > 0 ? `In Stock (${p.stock})` : 'Out of Stock'}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Step 19/21/22: Actions — View, Cart, Wishlist */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Actions</td>
                      {displayProducts.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => navigate(`/product/${p.slug || p.id}`)}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1"
                              aria-label={`View ${p.name} product page`}
                            >
                              <FiEye className="w-3 h-3" /> View Product
                            </button>
                            <button
                              onClick={() => handleAddToCart(p)}
                              disabled={p.isAvailable === false || p.stock <= 0}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-[10px] hover:from-gold-400 transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label={`Add ${p.name} to cart`}
                            >
                              <FiShoppingBag className="w-3 h-3" /> Add to Cart
                            </button>
                            <button
                              onClick={() => handleAddToWishlist(p)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-red-400 font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1"
                              aria-label={`Add ${p.name} to wishlist`}
                            >
                              <FiHeart className="w-3 h-3" /> Wishlist
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Compare;
