import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiTrash2, FiMinus, FiPlus, FiTag,
  FiArrowRight, FiZap, FiCheckCircle, FiRefreshCw, FiX, FiGift
} from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { updateQuantity, removeFromCart, applyCoupon, removeCoupon, syncServerCart } from '../../redux/cart/cartSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';
import { toast } from 'react-toastify';
import api from '../../config/api';

const Cart = () => {
  const { items, appliedCoupon, discountAmount, shippingFee, freeShippingThreshold } = useSelector((state) => state.cart);
  const user = useSelector((state) => state.auth?.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [validating, setValidating] = useState(false);

  // Phase 9 — Budget Optimizer state
  const [budgetInput, setBudgetInput] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [applyingOpt, setApplyingOpt] = useState(false);

  // Phase 10 — Offers state
  const [offersData, setOffersData] = useState(null);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const calculatedShipping = subtotal > freeShippingThreshold ? 0 : (items.length > 0 ? shippingFee : 0);
  const grandTotal = Math.max(0, subtotal - discountAmount + calculatedShipping);

  // Fetch Phase 10 recommended offers when subtotal changes
  useEffect(() => {
    if (subtotal > 0) {
      fetchRecommendedOffers();
    } else {
      setOffersData(null);
    }
  }, [subtotal]);

  const fetchRecommendedOffers = async () => {
    try {
      setLoadingOffers(true);
      const res = await api.post('/ai/offers', { cartTotal: subtotal });
      if (res.data?.success) {
        setOffersData(res.data.data);
      }
    } catch (err) {
      console.warn('[CartPage] Offers notice:', err.message);
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    try {
      setValidating(true);
      const { data } = await api.post('/coupons/validate', { code, cartTotal: subtotal });
      if (data?.success && data?.data) {
        const result = data.data;
        dispatch(applyCoupon({
          code: result.code,
          discountPercent: result.discountPercent || 0,
          discountFixed: result.discountAmount || 0
        }));
        toast.success(`🎉 ${data.message || 'Coupon applied!'} You save ${formatCurrency(result.amountSaved)}`);
        setCouponInput('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    } finally {
      setValidating(false);
    }
  };

  // Phase 9: Run AI Cart Budget Optimizer
  const handleOptimizeBudget = async (e) => {
    e.preventDefault();
    if (!budgetInput || parseFloat(budgetInput) <= 0) {
      toast.info('Please enter your target budget (e.g. 3500)');
      return;
    }

    try {
      setOptimizing(true);
      const guestItemsPayload = items.map(i => ({
        id: i.id || i.productId,
        quantity: i.quantity,
        size: i.size,
        color: i.color
      }));

      const res = await api.post('/ai/cart-optimizer', {
        maxBudget: parseFloat(budgetInput),
        guestCartItems: guestItemsPayload,
        userPrompt: `Keep my cart under ₹${budgetInput}`
      });

      if (res.data?.success) {
        setOptimizationResult(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to optimize cart budget');
    } finally {
      setOptimizing(false);
    }
  };

  // Phase 9: Apply Suggested Replacements to backend Cart
  const handleApplyOptimizationChanges = async () => {
    if (!optimizationResult || !optimizationResult.suggestedReplacements) return;

    if (!user) {
      toast.info('Please sign in to apply cart budget updates');
      navigate('/login');
      return;
    }

    try {
      setApplyingOpt(true);
      const replacementsPayload = optimizationResult.suggestedReplacements.map(rep => ({
        originalCartItemId: rep.originalItem.cartItemId,
        suggestedProductId: rep.suggestedProduct.productId,
        quantity: rep.quantity
      }));

      const res = await api.post('/cart/apply-optimization', { replacements: replacementsPayload });
      if (res.data?.success) {
        toast.success('Cart optimized successfully! 🎉');
        dispatch(syncServerCart());
        setOptimizationResult(null);
        setBudgetInput('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply cart changes');
    } finally {
      setApplyingOpt(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 space-y-8">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal-900">
              Shopping Cart ({items.length})
            </h1>
            <p className="text-xs text-gray-500 mt-1">Review items, set your shopping budget, or apply store discounts.</p>
          </div>

          {items.length > 0 && (
            <span className="text-xs font-bold text-gold-600 bg-gold-50 border border-gold-200 px-3 py-1.5 rounded-full self-start sm:self-auto">
              Subtotal: {formatCurrency(subtotal)}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-16 text-center bg-gray-50 rounded-3xl border border-gray-100 max-w-lg mx-auto space-y-4">
            <FiShoppingBag className="w-16 h-16 text-gray-300 mx-auto stroke-1" />
            <h2 className="text-xl font-serif font-bold text-charcoal-900">Your Cart is Empty</h2>
            <p className="text-xs text-gray-500">Explore our luxury sarees, jewellery, and festive wear.</p>
            <Link to="/categories" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold-500 text-white text-xs font-bold shadow-lg hover:bg-gold-600 transition">
              Explore Collections <FiArrowRight />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* LEFT COLUMN: ITEMS & BUDGET OPTIMIZER */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── PHASE 9: AI BUDGET OPTIMIZER BAR ───────────────────────────── */}
              <div className="bg-gradient-to-r from-charcoal-900 via-black to-charcoal-900 border border-gold-500/40 rounded-3xl p-5 text-white shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold">
                      <FiZap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-sm text-gold-400">AI Cart Budget Optimizer</h3>
                      <p className="text-[11px] text-gray-300">Set your target budget and AI will recommend lower-priced real alternatives.</p>
                    </div>
                  </div>

                  <form onSubmit={handleOptimizeBudget} className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      placeholder="Target Budget (₹)"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gold-400 flex-1 sm:w-36"
                      aria-label="Target budget input"
                    />
                    <button
                      type="submit"
                      disabled={optimizing}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                    >
                      {optimizing ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Optimize'}
                    </button>
                  </form>
                </div>

                {/* Optimization Results Panel */}
                <AnimatePresence>
                  {optimizationResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-2 space-y-3"
                    >
                      {optimizationResult.isAlreadyWithinBudget ? (
                        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                          <FiCheckCircle className="w-5 h-5 shrink-0" />
                          <span>{optimizationResult.message}</span>
                        </div>
                      ) : optimizationResult.hasReplacements ? (
                        <div className="p-4 rounded-2xl bg-gold-500/10 border border-gold-500/30 space-y-3 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                            <span className="font-bold text-amber-300">
                              Current: {formatCurrency(optimizationResult.currentTotal)} ➔ Budget: {formatCurrency(optimizationResult.maxBudget)}
                            </span>
                            <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
                              Save {formatCurrency(optimizationResult.totalSavings)} (New Total: {formatCurrency(optimizationResult.newTotal)})
                            </span>
                          </div>

                          <p className="text-gray-300 leading-relaxed">{optimizationResult.aiExplanation}</p>

                          {/* Side-by-side replacements list */}
                          <div className="space-y-2 pt-1">
                            {optimizationResult.suggestedReplacements.map((rep, idx) => (
                              <div key={idx} className="bg-black/50 border border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="text-gray-400 line-through text-[11px] block truncate">
                                    Replace: {rep.originalItem.name} ({formatCurrency(rep.originalItem.finalPrice)})
                                  </span>
                                  <span className="text-emerald-400 font-bold text-xs block truncate">
                                    With: {rep.suggestedProduct.name} ({formatCurrency(rep.suggestedProduct.finalPrice)})
                                  </span>
                                </div>
                                <span className="text-gold-400 font-bold text-xs shrink-0">
                                  Save {formatCurrency(rep.totalSavingsForItem)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              onClick={() => setOptimizationResult(null)}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
                            >
                              Keep Current Cart
                            </button>
                            <button
                              onClick={handleApplyOptimizationChanges}
                              disabled={applyingOpt}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition shadow-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {applyingOpt ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Apply Suggested Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-300">
                          {optimizationResult.message}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CART ITEMS LIST */}
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
                    <div className="flex gap-4 items-start w-full sm:w-auto">
                      <img src={formatImageUrl(item.image, item.name)} alt={item.name} className="w-24 h-32 object-cover rounded-2xl bg-gray-50 shrink-0 border border-gray-100" />
                      <button onClick={() => dispatch(removeFromCart({ ...item, index: idx }))} className="sm:hidden text-gray-400 hover:text-red-600 p-2 rounded-lg transition ml-auto">
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <h3 className="font-semibold text-sm sm:text-base text-charcoal-900 line-clamp-1 mb-1">{item.name}</h3>
                      <div className="flex gap-2 text-xs text-gray-500 mb-3">
                        {item.size && <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">Size: {item.size}</span>}
                        {item.color && <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">Color: {typeof item.color === 'object' ? item.color.name : item.color}</span>}
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Quantity counter */}
                        <div className="flex items-center border border-gray-200 rounded-full px-2 py-1 bg-gray-50">
                          <button
                            onClick={() => dispatch(updateQuantity({ ...item, quantity: Math.max(1, item.quantity - 1) }))}
                            className="p-2 sm:p-1 text-gray-500 hover:text-charcoal-900"
                          >
                            <FiMinus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-charcoal-900">{item.quantity}</span>
                          <button
                            onClick={() => dispatch(updateQuantity({ ...item, quantity: item.quantity + 1 }))}
                            className="p-2 sm:p-1 text-gray-500 hover:text-charcoal-900"
                          >
                            <FiPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="font-bold text-base text-charcoal-900">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    </div>

                    <button onClick={() => dispatch(removeFromCart({ ...item, index: idx }))} className="hidden sm:block text-gray-400 hover:text-red-600 p-2 rounded-lg transition">
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: OFFERS & SUMMARY */}
            <div className="space-y-6">

              {/* ── PHASE 10: RECOMMENDED OFFERS FOR YOU ───────────────────────── */}
              <div className="bg-gradient-to-br from-gold-50/80 via-white to-amber-50/50 border border-gold-200 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FiGift className="text-gold-600" /> Recommended Offers for You
                  </h3>
                  {loadingOffers && <FiRefreshCw className="w-3.5 h-3.5 animate-spin text-gold-600" />}
                </div>

                {offersData?.bestOffer && (
                  <div className="bg-white border border-gold-300 rounded-2xl p-3.5 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-gold-500 text-white font-mono font-bold text-xs uppercase">
                        {offersData.bestOffer.code}
                      </span>
                      <span className="font-black text-emerald-600 text-xs">
                        Save {formatCurrency(offersData.bestOffer.discountAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {offersData.bestOffer.description || `Save ${formatCurrency(offersData.bestOffer.discountAmount)} on orders above ${formatCurrency(offersData.bestOffer.minOrderAmount)}.`}
                    </p>
                    <button
                      onClick={() => {
                        setCouponInput(offersData.bestOffer.code);
                        dispatch(applyCoupon({
                          code: offersData.bestOffer.code,
                          discountPercent: offersData.bestOffer.discountPercent || 0,
                          discountFixed: offersData.bestOffer.discountAmount || 0
                        }));
                        toast.success(`🎉 Applied coupon ${offersData.bestOffer.code}!`);
                      }}
                      className="w-full py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      1-Click Apply Coupon
                    </button>
                  </div>
                )}

                {offersData?.upcomingOffers?.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 space-y-1">
                    <span className="font-bold block">💡 Unlock More Savings:</span>
                    <p>Add {formatCurrency(offersData.upcomingOffers[0].amountShort)} more to your cart to use coupon <strong>{offersData.upcomingOffers[0].code}</strong>!</p>
                  </div>
                )}
              </div>

              {/* Coupon Form Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 shadow-sm space-y-3">
                <label className="text-xs font-bold text-charcoal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiTag className="text-gold-600" /> Apply Discount Coupon
                </label>

                {appliedCoupon ? (
                  <div className="flex justify-between items-center bg-gold-50 border border-gold-300 p-3 rounded-2xl text-xs">
                    <span className="font-bold text-gold-800">COUPON: {appliedCoupon} (-{formatCurrency(discountAmount)})</span>
                    <button onClick={() => dispatch(removeCoupon())} className="text-red-600 font-bold hover:underline">Remove</button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. STYLE300"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono uppercase focus:ring-2 focus:ring-gold-500 focus:outline-none"
                    />
                    <button type="submit" disabled={validating} className="px-4 py-2.5 bg-charcoal-900 text-gold-400 text-xs font-bold rounded-xl hover:bg-charcoal-800 disabled:opacity-50">
                      {validating ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                    </button>
                  </form>
                )}
              </div>

              {/* Summary Box */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="font-serif font-bold text-lg text-charcoal-900 border-b pb-3">Order Summary</h3>

                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Bag Total ({items.length} items)</span>
                    <span className="font-semibold text-charcoal-900">{formatCurrency(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Coupon Discount</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Shipping Charge</span>
                    <span className="font-semibold text-charcoal-900">
                      {calculatedShipping === 0 ? <strong className="text-emerald-600">FREE</strong> : formatCurrency(calculatedShipping)}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-serif font-bold text-base text-charcoal-900">Grand Total</span>
                  <span className="font-bold text-xl text-charcoal-900">{formatCurrency(grandTotal)}</span>
                </div>

                <button
                  onClick={() => navigate('/checkout')}
                  className="w-full py-4 rounded-full bg-gold-500 hover:bg-gold-600 text-white font-semibold text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  Proceed to Checkout <FiArrowRight />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
