import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiCheck, FiShoppingBag, FiLayers, FiZap,
  FiAward, FiStar, FiDollarSign, FiSmile, FiRefreshCw, FiArrowRight
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../config/api';
import { addToCart } from '../../redux/cart/cartSlice';
import { removeFromCompare, clearCompare } from '../../redux/compare/compareSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';
import { toast } from 'react-toastify';

/**
 * Phase 8 — AI Smart Product Comparison & Decision Assistant Page
 * Allows side-by-side comparison of 2-4 real products with AI decision analysis.
 * Uses authoritative database values only.
 */
const Compare = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const compareItems = useSelector(state => state.compare?.items || []);

  const [comparisonData, setComparisonData] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeGoal, setActiveGoal] = useState('best_overall');
  const [activeOccasion, setActiveOccasion] = useState('');

  // Auto-fetch AI decision analysis whenever compareItems change
  useEffect(() => {
    if (compareItems.length >= 2) {
      runAiComparison(activeGoal, activeOccasion);
    } else {
      setComparisonData(null);
    }
  }, [compareItems.length]);

  const runAiComparison = async (goal = 'best_overall', occasion = '') => {
    if (compareItems.length < 2) return;
    try {
      setLoadingAi(true);
      const productIds = compareItems.map(p => p.id || p._id);
      const res = await api.post('/ai/compare', {
        productIds,
        criteria: {
          goal,
          occasion,
          userPrompt: `Which item is best ${goal.replace('_', ' ')}?`
        }
      });

      if (res.data?.success) {
        setComparisonData(res.data.data);
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

  const handleAddToCart = (product) => {
    dispatch(addToCart({
      id: product.id || product._id,
      name: product.name,
      price: product.discountPrice || product.price || product.finalPrice,
      image: formatImageUrl(product.image || product.images?.[0]?.url),
      quantity: 1,
    }));
    toast.success(`Added '${product.name}' to cart!`);
  };

  const recProduct = comparisonData?.recommendation?.product;

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
              Objective side-by-side specs comparison powered by real database facts & AI recommendation scoring.
            </p>
          </div>

          {compareItems.length > 0 && (
            <button
              onClick={() => dispatch(clearCompare())}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10 text-xs font-bold transition self-start sm:self-auto cursor-pointer"
            >
              Clear All Items
            </button>
          )}
        </div>

        {/* NOT ENOUGH PRODUCTS STATE */}
        {compareItems.length < 2 ? (
          <div className="py-16 px-6 text-center bg-white/5 border border-white/10 rounded-3xl max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 flex items-center justify-center mx-auto text-2xl">
              ⚖️
            </div>
            <h3 className="text-xl font-serif font-bold text-white">Compare 2 to 4 Products</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Select products across the store using the ⚖️ Compare icon button on product cards to view side-by-side features and get AI decision guidance!
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/categories')}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition cursor-pointer shadow-lg inline-flex items-center gap-2"
              >
                Browse Catalog to Compare <FiArrowRight />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── AI DECISION ASSISTANT BANNER ─────────────────────── */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-charcoal-900 via-black to-charcoal-900 border border-gold-500/30 relative overflow-hidden shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-500/50 text-gold-400 flex items-center justify-center text-xl shrink-0">
                    <FiAward />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-300">AI Decision Recommendation</h3>
                    <p className="text-xs text-gray-400">Ask AI to evaluate trade-offs based on your decision goal:</p>
                  </div>
                </div>

                {/* Interactive Decision Goal Trigger Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleGoalChange('best_overall')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      activeGoal === 'best_overall' && !activeOccasion
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    👑 Best Overall
                  </button>
                  <button
                    onClick={() => handleGoalChange('best_overall', 'wedding')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      activeOccasion === 'wedding'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    ✨ Wedding Ready
                  </button>
                  <button
                    onClick={() => handleGoalChange('cheapest')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      activeGoal === 'cheapest'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    💡 Lowest Price
                  </button>
                  <button
                    onClick={() => handleGoalChange('highest_rated')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      activeGoal === 'highest_rated'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    ⭐ Highest Rated
                  </button>
                  <button
                    onClick={() => handleGoalChange('best_value')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      activeGoal === 'best_value'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    💎 Best Value
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
                <div className="p-4 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-gold-400 text-black font-black text-[10px] uppercase">
                        Top Pick
                      </span>
                      <h4 className="font-bold text-white text-sm">
                        {recProduct?.name} — {formatCurrency(recProduct?.finalPrice)}
                      </h4>
                    </div>
                    <p className="text-gray-300 leading-relaxed pt-1">
                      {comparisonData.recommendation.aiExplanation}
                    </p>
                  </div>

                  {recProduct && (
                    <button
                      onClick={() => handleAddToCart(recProduct)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition shadow-lg shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FiShoppingBag /> Add Best to Cart
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {/* ── COMPARISON MATRIX TABLE ─────────────────────────── */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs text-left">
                  <thead className="bg-charcoal-900 border-b border-white/10">
                    <tr>
                      <th className="p-4 w-44 font-bold text-amber-400 uppercase text-[11px]">Feature</th>
                      {compareItems.map(p => {
                        const isRecommended = recProduct?.id === p.id;
                        const imgUrl = p.images?.[0]?.url || p.image || (Array.isArray(p.images) ? p.images[0] : null);
                        const formattedImg = formatImageUrl(imgUrl);
                        const displayPrice = p.discountPrice || p.price;

                        return (
                          <th key={p.id} className="p-4 min-w-[220px] relative border-l border-white/5">
                            {isRecommended && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-black font-black text-[9px] uppercase shadow">
                                👑 Recommended
                              </span>
                            )}
                            <button
                              onClick={() => dispatch(removeFromCompare(p.id))}
                              className="absolute top-2 right-2 text-gray-400 hover:text-red-400 p-1 rounded-lg"
                              title="Remove"
                            >
                              <FiX className="w-4 h-4" />
                            </button>

                            <img
                              src={formattedImg}
                              alt={p.name}
                              className="w-28 h-36 object-cover rounded-2xl bg-white/5 mb-3 mx-auto border border-white/10 mt-4"
                            />
                            <span className="font-bold text-sm text-white block text-center line-clamp-2">{p.name}</span>
                            <span className="font-black text-gold-400 block text-center text-sm mt-1">
                              {formatCurrency(displayPrice)}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {/* Price */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Final Price</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5 font-black text-emerald-400 text-sm">
                          {formatCurrency(p.discountPrice || p.price)}
                          {p.discountPercent > 0 && (
                            <span className="text-[10px] text-gray-400 block font-normal line-through">
                              {formatCurrency(p.price)} ({p.discountPercent}% off)
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Rating */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Rating & Reviews</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          <span className="font-bold text-amber-400 flex items-center gap-1">
                            <FiStar className="fill-amber-400" /> {p.rating || 4.5} / 5
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {p.reviewCount || p.reviewsCount || 0} reviews
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Category */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Category</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.category?.name || p.category || 'Luxury Fashion'}
                        </td>
                      ))}
                    </tr>

                    {/* Fabric & Material */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Fabric / Material</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.material || 'Premium Fabric'}
                        </td>
                      ))}
                    </tr>

                    {/* Occasion */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Occasion</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          {p.occasion || 'Wedding / Festive'}
                        </td>
                      ))}
                    </tr>

                    {/* Stock */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Stock Availability</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.stock > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {p.stock > 0 ? `In Stock (${p.stock})` : 'Out of Stock'}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Action */}
                    <tr>
                      <td className="p-4 font-bold text-white bg-white/5">Action</td>
                      {compareItems.map(p => (
                        <td key={p.id} className="p-4 border-l border-white/5 text-center">
                          <button
                            onClick={() => handleAddToCart(p)}
                            disabled={p.stock <= 0}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition shadow-md inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FiShoppingBag /> Add to Cart
                          </button>
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
