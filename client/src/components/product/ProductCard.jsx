import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiShoppingBag, FiStar, FiCheck, FiTruck } from 'react-icons/fi';
import { addToWishlist, removeFromWishlist } from '../../redux/wishlist/wishlistSlice';
import { addToCart } from '../../redux/cart/cartSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import { toast } from 'react-toastify';
import StarRating from '../reviews/StarRating';

/**
 * Clean Premium Product Card (used by ProductGrid)
 * Apple/Zara/Nike inspired — image-first, no badge clutter
 */
const ProductCard = ({ product }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(state => state.auth?.user);
  const wishlistItems = useSelector(state => state.wishlist?.items || []);
  const productId = product.id || product._id;
  const isWishlisted = wishlistItems.some(item => (item._id || item.id) === productId);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info('Please sign in to add items to your wishlist');
      navigate('/login');
      return;
    }
    if (isWishlisted) {
      dispatch(removeFromWishlist(productId));
      toast.info('Removed from wishlist');
    } else {
      dispatch(addToWishlist(product));
      toast.success('Added to wishlist ♥');
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info('Please sign in to add items to your cart');
      navigate('/login');
      return;
    }
    dispatch(addToCart({
      id: productId,
      name: product.name,
      price: product.discountPrice || product.salePrice || product.price,
      image: product.images?.[0]?.url || product.image,
      quantity: 1,
    }));
    setAddedToCart(true);
    toast.success('Added to cart');
    setTimeout(() => setAddedToCart(false), 2200);
  };

  const price = product.price || 0;
  const salePrice = product.discountPrice || product.salePrice || 0;
  const finalPrice = salePrice > 0 && salePrice < price ? salePrice : price;
  const discountPercent = product.discountPercent || (salePrice > 0 && price > salePrice 
    ? Math.round(((price - salePrice) / price) * 100) 
    : 0);
  const savingsAmount = price > finalPrice ? price - finalPrice : 0;
  const rating = product.ratings || product.rating || 0;

  return (
    <div 
      className="group bg-white rounded-[20px] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.10)] transition-all duration-500 flex flex-col h-full border border-gray-100/80"
    >
      {/* ── Product Image (70-75% of card, NO badges) ─────── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[#FAFAFA]">
        <Link to={`/product/${product.slug}`}>
          {/* Primary Image */}
          <img 
            src={product.images?.[0]?.url || 'https://via.placeholder.com/400x533'} 
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-100 transition-transform duration-700 ease-out group-hover:scale-105"
          />

          {/* Hover Secondary Image */}
          {product.images?.[1] && (
            <img 
              src={product.images[1].url} 
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
          )}
        </Link>
        
        {/* Wishlist Glass Button — ONLY element on image */}
        <motion.button 
          onClick={handleWishlist}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.88 }}
          className={`absolute top-3 right-3 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-300 shadow-lg z-10 ${
            isWishlisted
              ? 'bg-red-500 border-red-400 text-white shadow-red-500/30'
              : 'bg-white/70 border-white/40 text-gray-600 hover:text-red-500 hover:bg-white/90 shadow-black/5'
          }`}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <FiHeart className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${isWishlisted ? 'fill-white' : ''}`} />
        </motion.button>
      </div>

      {/* ── Product Info ─────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-grow">
        {/* Brand */}
        {product.category?.name && (
          <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-[0.12em] mb-1">
            {product.category.name}
          </span>
        )}

        {/* Product Name */}
        <Link to={`/product/${product.slug}`} className="flex-grow">
          <h3 className="text-[13px] sm:text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors line-clamp-2 leading-[1.4] mb-1.5">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {rating > 0 && (
          <div className="mb-2">
            <StarRating rating={rating} showNumber size="sm" />
          </div>
        )}
        
        {/* Price */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(finalPrice)}</span>
            {discountPercent > 0 && (
              <>
                <span className="text-xs text-gray-400 line-through">{formatCurrency(price)}</span>
                <span className="text-[11px] font-semibold text-emerald-600">{discountPercent}% off</span>
              </>
            )}
          </div>
          {savingsAmount > 0 && (
            <p className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5">
              You save {formatCurrency(savingsAmount)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-3 mt-2 border-t border-gray-100/80">
          <motion.button
            onClick={handleAddToCart}
            whileTap={{ scale: 0.9 }}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all duration-300 ${
              addedToCart
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 shadow-sm'
            }`}
            title={addedToCart ? 'Added!' : 'Add to Cart'}
          >
            <AnimatePresence mode="wait">
              {addedToCart ? (
                <motion.div key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                  <FiCheck className="w-5 h-5" strokeWidth={3} />
                </motion.div>
              ) : (
                <motion.div key="bag" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <FiShoppingBag className="w-[18px] h-[18px]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <Link
            to={`/product/${product.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-gray-900 font-semibold text-[11px] sm:text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/15 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-[1px] text-center"
          >
            View Product
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
