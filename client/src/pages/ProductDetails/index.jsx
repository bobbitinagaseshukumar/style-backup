import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiStar, FiHeart, FiShoppingBag, FiTruck, FiShield, FiRefreshCw,
  FiChevronRight, FiChevronLeft, FiMinus, FiPlus, FiMapPin, FiX,
  FiShare2, FiMaximize2, FiCheck, FiAlertCircle, FiBell,
  FiMessageSquare, FiThumbsUp, FiPackage, FiTag, FiInfo,
  FiHelpCircle, FiClock, FiSearch, FiArrowLeft
} from 'react-icons/fi';
import {
  FaWhatsapp, FaFacebook, FaTelegram, FaTwitter
} from 'react-icons/fa';
import api from '../../config/api';
import { addToCart } from '../../redux/cart/cartSlice';
import { addToWishlist, removeFromWishlist } from '../../redux/wishlist/wishlistSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import ReviewSection from '../../components/reviews/ReviewSection';
import WriteReviewModal from '../../components/reviews/WriteReviewModal';
import StarRating from '../../components/reviews/StarRating';
import ProductCard from '../../components/common/ProductCard';
import RecentlyViewedSection from '../../components/home/RecentlyViewedSection';
import { saveToRecentlyViewed } from '../../utils/recentlyViewed';
import { toast } from 'react-toastify';

/* ═══ HELPER: SAFE JSON PARSER ═══ */
const safeJSON = (val, fallback = []) => {
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val || '[]'); } catch { return fallback; }
};

/* ═══ STAR RATING ═══ */
const Stars = ({ rating = 0, size = 14, showEmpty = true }) => (
  <div className="flex gap-0.5 items-center">
    {[1, 2, 3, 4, 5].map(n => (
      <FiStar
        key={n}
        size={size}
        className={n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : showEmpty ? 'text-gray-200' : 'text-gray-300'}
      />
    ))}
  </div>
);

/* ═══ TRUST BADGES ═══ */
const TrustBadges = () => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {[
      { icon: FiShield, label: '100% Original', sub: 'Verified products' },
      { icon: FiRefreshCw, label: 'Easy Returns', sub: '7-day return policy' },
      { icon: FiTruck, label: 'Fast Delivery', sub: '2-5 business days' },
      { icon: FiPackage, label: 'Secure Packing', sub: 'Quality guaranteed' },
    ].map(b => (
      <div key={b.label} className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 rounded-2xl border border-gray-100 text-center">
        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
          <b.icon size={15} className="text-amber-600" />
        </div>
        <p className="text-xs font-bold text-gray-800">{b.label}</p>
        <p className="text-[10px] text-gray-400">{b.sub}</p>
      </div>
    ))}
  </div>
);

/* ═══ FULLSCREEN LIGHTBOX GALLERY ═══ */
const FullscreenGallery = ({ images, initialIdx, onClose }) => {
  const [idx, setIdx] = useState(initialIdx);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };
  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 500) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button onClick={onClose} className="absolute top-5 right-5 text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition">
        <FiX size={24} />
      </button>
      <div className="relative w-full max-w-4xl px-4 flex items-center justify-center">
        <button onClick={prev} className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition">
          <FiChevronLeft size={24} />
        </button>
        <motion.img
          key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          src={images[idx]?.url || images[idx]} alt=""
          className="max-h-[82vh] object-contain rounded-2xl pointer-events-none"
          draggable={false}
        />
        <button onClick={next} className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition">
          <FiChevronRight size={24} />
        </button>
      </div>
      <div className="flex gap-2 mt-5 overflow-x-auto px-4 pb-2">
        {images.map((img, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`w-14 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition ${i === idx ? 'border-amber-400' : 'border-white/10 opacity-50 hover:opacity-80'}`}>
            <img src={img?.url || img} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <p className="text-white/40 text-xs mt-2">{idx + 1} / {images.length}</p>
    </motion.div>
  );
};

/* ═══ MAIN IMAGE GALLERY WITH HOVER MAGNIFIER + TOUCH SWIPE ═══ */
const ImageGallery = ({ images, selectedIdx, onChange, videoUrl }) => {
  const [zoom, setZoom] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [fullscreen, setFullscreen] = useState(false);
  const imgRef = useRef();
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  const onMouseMove = useCallback((e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  }, []);

  const allImages = images?.length > 0 ? images : [{ url: 'https://placehold.co/600x800/f3f4f6/9ca3af?text=No+Image' }];
  const mainImg = allImages[selectedIdx]?.url || allImages[selectedIdx] || allImages[0]?.url;

  /* ── Touch swipe handlers for mobile ── */
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Only treat as swipe if horizontal distance > 40px, more horizontal than vertical, and within 500ms
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 500 && allImages.length > 1) {
      if (dx < 0) {
        // Swipe left → next image
        onChange((selectedIdx + 1) % allImages.length);
      } else {
        // Swipe right → previous image
        onChange((selectedIdx - 1 + allImages.length) % allImages.length);
      }
    }
  }, [allImages.length, selectedIdx, onChange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Main image card */}
      <div
        ref={imgRef}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 cursor-zoom-in group shadow-sm touch-pan-y"
      >
        <motion.img
          key={mainImg}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
          src={mainImg} alt=""
          className="w-full h-full object-cover pointer-events-none"
          style={zoom ? {
            transform: 'scale(2.4)',
            transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
            transition: 'transform 0.08s ease',
          } : { transition: 'transform 0.3s ease' }}
          draggable={false}
        />

        {/* Action icons overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => setFullscreen(true)} title="Expand Fullscreen"
            className="p-2.5 rounded-xl bg-white/90 shadow-md text-gray-700 hover:bg-white transition">
            <FiMaximize2 size={15} />
          </button>
        </div>

        {/* Navigation Arrows */}
        {allImages.length > 1 && (
          <>
            <button onClick={() => onChange((selectedIdx - 1 + allImages.length) % allImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/80 shadow-md text-gray-700 hover:bg-white transition opacity-0 group-hover:opacity-100">
              <FiChevronLeft size={18} />
            </button>
            <button onClick={() => onChange((selectedIdx + 1) % allImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/80 shadow-md text-gray-700 hover:bg-white transition opacity-0 group-hover:opacity-100">
              <FiChevronRight size={18} />
            </button>
          </>
        )}

        {/* Swipe indicator dots (mobile-only, visible always) */}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:hidden">
            {allImages.map((_, i) => (
              <button key={i} onClick={() => onChange(i)}
                className={`rounded-full transition-all duration-300 ${i === selectedIdx ? 'w-6 h-2 bg-amber-400' : 'w-2 h-2 bg-white/60'}`}
              />
            ))}
          </div>
        )}

        {/* Counter (desktop) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-[11px] px-3 py-1 rounded-full font-semibold tracking-wide hidden md:block">
          {selectedIdx + 1} / {allImages.length}
        </div>
      </div>

      {/* Thumbnails Strip */}
      {allImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {allImages.map((img, i) => (
            <button key={i} onClick={() => onChange(i)}
              className={`w-16 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition ${i === selectedIdx ? 'border-amber-400 shadow-md shadow-amber-100' : 'border-gray-200 opacity-60 hover:opacity-100'}`}>
              <img src={img?.url || img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {fullscreen && (
          <FullscreenGallery images={allImages} initialIdx={selectedIdx} onClose={() => setFullscreen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};


/* ═══ FLASH SALE COUNTDOWN TIMER CARD ═══ */
const FlashSaleTimer = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = endDate ? new Date(endDate).getTime() : Date.now() + 18 * 3600 * 1000;
    const interval = setInterval(() => {
      const diff = Math.max(0, target - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-2xl p-4 text-white shadow-md mb-4 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <div>
          <p className="font-black text-sm tracking-wide uppercase">Flash Sale Active</p>
          <p className="text-xs text-white/80">Limited time offer — ends soon!</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 font-mono text-center">
        {[
          { label: 'HRS', val: String(timeLeft.hours).padStart(2, '0') },
          { label: 'MIN', val: String(timeLeft.minutes).padStart(2, '0') },
          { label: 'SEC', val: String(timeLeft.seconds).padStart(2, '0') },
        ].map((t, idx) => (
          <React.Fragment key={t.label}>
            {idx > 0 && <span className="font-bold text-white/60">:</span>}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg px-2.5 py-1">
              <span className="block font-black text-base leading-tight">{t.val}</span>
              <span className="block text-[9px] text-white/60 font-sans uppercase">{t.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/* ═══ RATING BREAKDOWN ═══ */
const RatingBreakdown = ({ reviews }) => {
  const counts = [5, 4, 3, 2, 1].map(n => ({
    n,
    count: reviews.filter(r => r.rating === n).length,
  }));
  const total = reviews.length || 1;
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0';
  return (
    <div className="flex gap-6 items-center flex-wrap sm:flex-nowrap bg-gray-50 p-5 rounded-2xl border border-gray-100">
      <div className="text-center flex-shrink-0 mx-auto sm:mx-0">
        <p className="text-5xl font-black text-gray-900">{avg}</p>
        <Stars rating={parseFloat(avg)} size={16} />
        <p className="text-xs text-gray-400 mt-1">{reviews.length} customer review{reviews.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 space-y-1.5 w-full">
        {counts.map(({ n, count }) => (
          <div key={n} className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600 w-3">{n}</span>
            <FiStar size={11} className="fill-amber-400 text-amber-400 flex-shrink-0" />
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(8, (count / total) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400 w-6 text-right font-medium">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══ MINI PRODUCT CARD ═══ */
const MiniProductCard = ({ product }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const img = product.images?.[0]?.url || product.images?.[0] || 'https://placehold.co/300x400/f3f4f6/9ca3af?text=Product';
  return (
    <div className="group cursor-pointer flex-shrink-0 w-44 sm:w-48 bg-white rounded-2xl border border-gray-100 p-2 hover:shadow-lg transition duration-300"
      onClick={() => navigate(`/product/${product.slug || product.id}`)}>
      <div className="relative rounded-xl overflow-hidden bg-gray-50 aspect-[3/4] mb-2">
        <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        {product.discountPercent > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
            -{product.discountPercent}%
          </span>
        )}
        <button
          onClick={e => {
            e.stopPropagation();
            dispatch(addToCart({ id: product.id, name: product.name, price: product.discountPrice || product.price, image: img, quantity: 1 }));
            toast.success(`"${product.name}" added to cart!`);
          }}
          className="absolute bottom-2 inset-x-2 py-2 bg-gray-900/90 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 shadow-md"
        >
          <FiShoppingBag size={12} /> Quick Add
        </button>
      </div>
      <p className="text-xs font-bold text-gray-800 truncate px-1">{product.name}</p>
      <div className="flex items-center gap-1.5 mt-1 px-1">
        <span className="text-sm font-black text-gray-900">{formatCurrency(product.discountPrice || product.price)}</span>
        {product.discountPercent > 0 && (
          <span className="text-[10px] text-gray-400 line-through">{formatCurrency(product.price)}</span>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN PRODUCT DETAILS PAGE
═══════════════════════════════════════════════════════════════ */
export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const wishlistItems = useSelector(s => s.wishlist?.items || []);
  const user = useSelector(s => s.auth?.user);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [relatedProducts, setRelatedProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [qaList, setQaList] = useState([]);

  // Variant Selection
  const [colorVariants, setColorVariants] = useState([]);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [availableSizes, setAvailableSizes] = useState([]);

  // UI state
  const [pincode, setPincode] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('description');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showQAForm, setShowQAForm] = useState(false);
  const [reviewSort, setReviewSort] = useState('newest');
  const [qaForm, setQaForm] = useState({ question: '' });
  const [stickyVisible, setStickyVisible] = useState(false);
  
  // For external review modal
  const [reviewOrderData, setReviewOrderData] = useState(null);

  // Auto-trigger review from email link (?review=true)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('review') === 'true' && product && user && !showReviewForm) {
      setActiveTab('reviews');
      // Auto-trigger review after a brief delay for tab to render
      const timer = setTimeout(() => handleWriteReviewClick(), 600);
      return () => clearTimeout(timer);
    }
  }, [product, user, location.search]);

  /* ── Derived Variant State ── */
  const selectedColor = colorVariants[selectedColorIdx] || {};
  const colorImages = selectedColor.images?.length > 0
    ? selectedColor.images.map(u => ({ url: u }))
    : product?.images || [];

  const currentPrice = selectedColor.price ? parseFloat(selectedColor.price) : (product?.price || 0);
  const currentDiscount = selectedColor.discountPercent ? parseFloat(selectedColor.discountPercent) : (product?.discountPercent || 0);
  const currentDiscountPrice = currentDiscount > 0 ? +(currentPrice * (1 - currentDiscount / 100)).toFixed(2) : (product?.discountPrice || currentPrice);
  const savedAmount = currentPrice - currentDiscountPrice;

  const currentStock = (() => {
    if (selectedSize && selectedColor.sizes?.length > 0) {
      const s = selectedColor.sizes.find(sz => sz.size === selectedSize);
      return parseInt(s?.stock || 0);
    }
    return parseInt(selectedColor.stock || product?.stock || 0);
  })();

  const isWishlisted = product && wishlistItems.some(i => i.id === product.id);

  /* ── Fetch Product ── */
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const { data } = await api.get(`/products/${slug}`);
        const prod = data?.data;

        if (!prod) {
          setNotFound(true);
          return;
        }

        setProduct(prod);

        // Parse colors & sizes JSON
        const colors = safeJSON(prod.colors, []);
        const sizes = safeJSON(prod.sizes, []);
        setColorVariants(colors);
        setAvailableSizes(sizes);
        if (sizes.length > 0) setSelectedSize(sizes[0]);
        setSelectedImgIdx(0);

        // Save to Recently Viewed locally & via server API
        try {
          saveToRecentlyViewed(prod);
          api.post('/recently-viewed', { productId: prod.id }).catch(() => {});
        } catch {}

        // Fetch Related & Recommended
        Promise.all([
          api.get(`/products?category=${prod.categoryId}&limit=10`).catch(() => null),
          api.get(`/products?trending=true&limit=8`).catch(() => null),
          api.get(`/reviews/product/${prod.id}`).catch(() => null),
        ]).then(([relRes, recRes, revRes]) => {
          const rel = relRes?.data?.data?.products?.filter(p => p.id !== prod.id) || [];
          const rec = recRes?.data?.data?.products?.filter(p => p.id !== prod.id) || [];
          setRelatedProducts(rel);
          setRecommendedProducts(rec);
          setReviews(revRes?.data?.data?.reviews || prod.reviews || []);
        });

      } catch (e) {
        console.error('ProductDetails fetch error:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
    window.scrollTo(0, 0);
  }, [slug]);

  /* ── Sticky bar on scroll ── */
  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 450);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setSelectedImgIdx(0), [selectedColorIdx]);

  /* ── Actions ── */
  const handleAddToCart = () => {
    if (!product) return;
    if (!user) {
      toast.info('Please sign in to add items to your cart');
      navigate('/login');
      return;
    }
    if (availableSizes.length > 0 && !selectedSize) { toast.error('Please select a size'); return; }
    if (currentStock === 0) { toast.error('Out of stock'); return; }
    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: currentDiscountPrice,
      image: colorImages[0]?.url || colorImages[0],
      size: selectedSize,
      color: selectedColor.name || '',
      quantity,
      shippingFee: product.shippingFee || 0,
      freeShipping: product.freeShipping || false,
    }));
    toast.success(`"${product.name}" added to cart!`);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!user) {
      toast.info('Please sign in to purchase items');
      navigate('/login');
      return;
    }
    if (availableSizes.length > 0 && !selectedSize) { toast.error('Please select a size'); return; }
    if (currentStock === 0) { toast.error('Out of stock'); return; }
    // Store Buy Now item in sessionStorage — does NOT touch the cart
    sessionStorage.setItem('__KVLR_BUY_NOW_ITEM__', JSON.stringify({
      id: product.id,
      name: product.name,
      price: currentDiscountPrice,
      image: colorImages[0]?.url || colorImages[0],
      size: selectedSize,
      color: selectedColor.name || '',
      quantity,
      shippingFee: product.shippingFee || 0,
      freeShipping: product.freeShipping || false,
    }));
    sessionStorage.setItem('__KVLR_LAST_PRODUCT_PAGE__', window.location.pathname);
    navigate('/checkout?buyNow=true');
  };

  const [notifiedMe, setNotifiedMe] = useState(false);
  const handleNotifyMe = async () => {
    if (!product) return;
    if (!user) {
      toast.info('Please sign in to get stock alerts');
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/products/${product.id}/notify-me`);
      setNotifiedMe(true);
      toast.success(res.data?.message || 'You will be notified when this product is back in stock!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to subscribe. Please try again.');
    }
  };

  const handleWishlist = () => {
    if (!product) return;
    if (!user) {
      toast.info('Please sign in to add items to your wishlist');
      navigate('/login');
      return;
    }
    if (isWishlisted) {
      dispatch(removeFromWishlist(product.id));
      toast.info('Removed from wishlist');
    } else {
      dispatch(addToWishlist({ id: product.id, name: product.name, price: currentDiscountPrice, image: colorImages[0]?.url, slug: product.slug }));
      toast.success('Added to wishlist!');
    }
  };

  const handlePincodeCheck = (e) => {
    e.preventDefault();
    if (pincode.length !== 6 || isNaN(pincode)) { toast.error('Please enter a valid 6-digit PIN code'); return; }
    const estDate = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    setDeliveryInfo({ date: estDate, free: currentDiscountPrice > 499, cod: true });
  };

  const handleWriteReviewClick = async () => {
    if (!user) {
      return toast.info('Please log in to write a review');
    }
    try {
      const { data } = await api.get('/orders/my-orders');
      const orders = data?.data || [];
      const deliveredOrder = orders.find(o => 
        o.orderStatus === 'DELIVERED' && 
        o.items?.some(item => item.productId === product.id)
      );

      if (deliveredOrder) {
        const item = deliveredOrder.items.find(i => i.productId === product.id);
        setReviewOrderData({ order: deliveredOrder, item });
        setShowReviewForm(true);
      } else {
        toast.error('Only customers with a delivered order for this product can write a review.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not verify purchase history.');
    }
  };

  const onReviewSubmitted = async () => {
    try {
      const { data } = await api.get(`/reviews/product/${product.id}`);
      setReviews(data?.data?.reviews || []);
    } catch {}
  };

  const shareUrl = window.location.href;

  /* ═══ 404 NOT FOUND STATE ═══ */
  if (notFound) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <FiAlertCircle size={36} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Product Not Found</h1>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          The product you are looking for does not exist, may have been removed, or is currently unavailable.
        </p>
        <Link to="/" className="px-6 py-3 bg-gray-900 text-amber-400 font-bold rounded-2xl hover:bg-gray-800 transition shadow-lg flex items-center gap-2">
          <FiArrowLeft size={16} /> Continue Shopping
        </Link>
      </div>
    );
  }

  /* ═══ LOADING SKELETON ═══ */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-10 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12">
          <div className="aspect-[3/4] rounded-3xl bg-gray-100" />
          <div className="space-y-5 pt-4">
            <div className="h-4 w-24 bg-gray-100 rounded-full" />
            <div className="h-8 w-3/4 bg-gray-100 rounded-lg" />
            <div className="h-5 w-1/2 bg-gray-100 rounded-lg" />
            <div className="h-24 bg-gray-100 rounded-2xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Breadcrumbs ──────────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-100 py-3">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
          <Link to="/" className="hover:text-amber-600 transition font-medium">Home</Link>
          <FiChevronRight size={10} />
          <Link to="/categories" className="hover:text-amber-600 transition font-medium">{product.category?.name || 'Store'}</Link>
          {product.subCategory && (
            <>
              <FiChevronRight size={10} />
              <span className="hover:text-amber-600 transition font-medium">{product.subCategory.name}</span>
            </>
          )}
          <FiChevronRight size={10} />
          <span className="text-gray-800 font-bold truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-8 lg:py-12">

        {/* ═══════════════════════════════════════════════════
            TOP SECTION: GALLERY + PRODUCT INFO
        ═══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-14">

          {/* ── LEFT: Product Image Gallery ──────────────────────── */}
          <div>
            <ImageGallery
              images={colorImages}
              selectedIdx={selectedImgIdx}
              onChange={setSelectedImgIdx}
              videoUrl={product.videoUrl}
            />
          </div>

          {/* ── RIGHT: Product Details & Actions ────────────────── */}
          <div className="space-y-5">

            {/* Section Badges */}
            <div className="flex flex-wrap gap-2">
              {product.newArrival && <span className="px-3 py-1 text-[10px] font-black bg-emerald-500 text-white rounded-full uppercase tracking-wider">New Arrival</span>}
              {product.trending && <span className="px-3 py-1 text-[10px] font-black bg-orange-500 text-white rounded-full uppercase tracking-wider">🔥 Trending</span>}
              {product.bestSeller && <span className="px-3 py-1 text-[10px] font-black bg-purple-600 text-white rounded-full uppercase tracking-wider">🏆 Best Seller</span>}
              {product.featured && <span className="px-3 py-1 text-[10px] font-black bg-amber-400 text-black rounded-full uppercase tracking-wider">⭐ Featured</span>}
              {currentStock > 0 && currentStock <= 5 && <span className="px-3 py-1 text-[10px] font-black bg-red-500 text-white rounded-full uppercase tracking-wider animate-pulse">Only {currentStock} Left!</span>}
            </div>

            {/* Brand + Name */}
            <div>
              {product.brand && <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">{product.brand?.name || product.brand}</p>}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">{product.name}</h1>
              <p className="text-xs text-gray-400 font-mono mt-1">SKU: {product.sku}</p>
            </div>

            {/* Rating row */}
            <div className="flex items-center gap-3 flex-wrap">
              {reviews.length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full">
                  <StarRating 
                    rating={reviews.reduce((s, r) => s + r.rating, 0) / reviews.length} 
                    size="sm" 
                    showNumber
                  />
                </div>
              )}
              <button onClick={() => setActiveTab('reviews')} className="text-xs text-gray-500 hover:text-amber-600 hover:underline transition">
                {reviews.length > 0 ? `${reviews.length} review${reviews.length !== 1 ? 's' : ''}` : 'No reviews yet'}
              </button>
              <span className={`text-xs font-bold ${currentStock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {currentStock > 0 ? `✓ In Stock (${currentStock} available)` : '✗ Currently Out of Stock'}
              </span>
            </div>

            {/* Flash Sale Countdown (if active) */}
            {(product.flashSale || product.todaysDeal) && (
              <FlashSaleTimer endDate={product.updatedAt} />
            )}

            {/* Price Block */}
            <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/60 border border-amber-100/80 rounded-2xl px-5 py-4">
              <div className="flex items-end gap-3 flex-wrap">
                <span className="text-3xl font-black text-gray-900">{formatCurrency(currentDiscountPrice)}</span>
                {currentDiscount > 0 && (
                  <>
                    <span className="text-base text-gray-400 line-through pb-0.5">{formatCurrency(currentPrice)}</span>
                    <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-black rounded-full">-{currentDiscount}% OFF</span>
                  </>
                )}
              </div>
              {savedAmount > 0 && (
                <p className="text-xs text-emerald-600 font-bold mt-1.5">You Save {formatCurrency(savedAmount)} 🎉</p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Inclusive of all taxes. Free shipping on orders above ₹499.</p>
            </div>

            {/* Color Swatches */}
            {colorVariants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Color:</span>
                  <span className="text-xs font-extrabold text-amber-700">{selectedColor.name || colorVariants[selectedColorIdx]?.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorVariants.map((c, i) => {
                    const oos = parseInt(c.stock || 0) === 0;
                    return (
                      <button
                        key={i}
                        onClick={() => { if (!oos) { setSelectedColorIdx(i); setSelectedSize(''); } }}
                        disabled={oos}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition
                          ${i === selectedColorIdx ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}
                          ${oos ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: c.hex || '#ccc' }} />
                        <span className="text-gray-700">{c.name}</span>
                        {i === selectedColorIdx && <FiCheck size={12} className="text-amber-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {availableSizes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Size: <span className="text-amber-700">{selectedSize}</span></span>
                  <button onClick={() => setShowSizeGuide(true)} className="text-xs text-amber-700 font-bold hover:underline flex items-center gap-1">
                    <FiInfo size={12} /> Size Chart
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((sz) => {
                    const szData = selectedColor.sizes?.find(s => s.size === sz);
                    const oos = szData && parseInt(szData.stock || 0) === 0;
                    return (
                      <button
                        key={sz}
                        onClick={() => { if (!oos) setSelectedSize(sz); }}
                        disabled={oos}
                        className={`min-w-[50px] px-3.5 py-2.5 rounded-xl text-xs font-black border-2 transition
                          ${selectedSize === sz ? 'border-amber-400 bg-amber-400 text-black shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-300'}
                          ${oos ? 'opacity-35 cursor-not-allowed line-through' : ''}`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + Main Cart Actions */}
            {currentStock > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3.5 py-2.5 text-gray-600 hover:bg-gray-100 transition">
                      <FiMinus size={14} />
                    </button>
                    <span className="px-4 py-2.5 font-black text-gray-900 text-sm min-w-[40px] text-center">{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(currentStock, q + 1))} className="px-3.5 py-2.5 text-gray-600 hover:bg-gray-100 transition">
                      <FiPlus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{currentStock} items in stock</span>
                </div>

                {/* Primary CTA Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentStock === 0 ? (
                    <button onClick={handleNotifyMe} disabled={notifiedMe}
                      className={`col-span-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition ${
                        notifiedMe
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 text-white hover:shadow-lg hover:-translate-y-[1px]'
                      }`}>
                      {notifiedMe ? '✅ Subscribed — We\'ll email you!' : '🔔 Notify Me When Available'}
                    </button>
                  ) : (
                    <>
                      <button onClick={handleAddToCart}
                        className="py-4 rounded-2xl border-2 border-amber-400 bg-amber-50 text-amber-900 font-black text-sm hover:bg-amber-400 hover:text-black transition flex items-center justify-center gap-2 shadow-sm">
                        <FiShoppingBag size={18} /> Add to Cart
                      </button>
                      <button onClick={handleBuyNow}
                        className="py-4 rounded-2xl bg-gray-900 text-amber-400 font-black text-sm hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-lg">
                        ⚡ Buy Now
                      </button>
                    </>
                  )}
                </div>

                {/* Secondary Wishlist & Share */}
                <div className="flex gap-3">
                  <button onClick={handleWishlist}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-xs font-bold transition
                      ${isWishlisted ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600 hover:border-red-200'}`}>
                    <FiHeart size={14} className={isWishlisted ? 'fill-current' : ''} />
                    {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                  </button>
                  <button onClick={() => setShowShare(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-xs font-bold hover:border-gray-300 transition">
                    <FiShare2 size={14} /> Share
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                  <p className="font-bold text-red-600 text-sm">Currently Out of Stock</p>
                  <p className="text-xs text-gray-500 mt-1">This product is temporarily unavailable</p>
                </div>
                <button onClick={() => toast.info('We will email you when this product is back in stock!')}
                  className="w-full py-3.5 rounded-2xl bg-gray-900 text-amber-400 font-black text-sm hover:bg-gray-800 transition flex items-center justify-center gap-2">
                  <FiBell size={16} /> Notify Me When Restocked
                </button>
              </div>
            )}

            {/* Delivery Pincode Checker */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                <FiMapPin size={14} className="text-amber-600" /> Check Delivery & Serviceability
              </p>
              <form onSubmit={handlePincodeCheck} className="flex gap-2">
                <input
                  type="text" maxLength={6} value={pincode} onChange={e => setPincode(e.target.value)}
                  placeholder="Enter 6-digit PIN code" inputMode="numeric"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none bg-white"
                />
                <button type="submit" className="px-4 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition">
                  Check PIN
                </button>
              </form>
              {deliveryInfo && (
                <div className="text-xs space-y-1.5 pt-1 border-t border-gray-200/60">
                  <p className="text-emerald-700 font-bold">✓ Guaranteed Delivery by {deliveryInfo.date}</p>
                  <p className={`font-semibold ${deliveryInfo.free ? 'text-emerald-700' : 'text-gray-600'}`}>
                    {deliveryInfo.free ? '✓ Free Shipping eligible' : '₹49 Shipping fee applies'}
                  </p>
                  <p className="text-gray-600">✓ Cash on Delivery (COD) available for this location</p>
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <TrustBadges />

          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            PRODUCT DESCRIPTION & SPECIFICATION TABS
        ═══════════════════════════════════════════════════ */}
        <div className="mt-16">
          <div className="flex gap-0 border-b border-gray-200 overflow-x-auto scrollbar-none">
            {[
              { id: 'description', label: 'Description' },
              { id: 'specs', label: 'Specifications' },
              { id: 'materials', label: 'Materials & Care' },
              { id: 'shipping', label: 'Shipping & Returns' },
              { id: 'reviews', label: `Reviews (${reviews.length})` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 pb-3 pt-1 px-5 text-sm font-bold border-b-2 transition
                  ${activeTab === tab.id ? 'border-amber-400 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="py-8">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* Description Tab */}
                {activeTab === 'description' && (
                  <div className="space-y-6 max-w-3xl">
                    {product.shortDesc && (
                      <p className="text-base text-gray-700 font-semibold leading-relaxed">{product.shortDesc}</p>
                    )}
                    {product.description && (
                      <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
                        {product.description}
                      </div>
                    )}
                    {/* Key Attributes */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      {[
                        { label: 'Material', val: product.material },
                        { label: 'Occasion', val: product.occasion },
                        { label: 'Gender', val: product.gender },
                        { label: 'Wash Care', val: product.washCare },
                      ].filter(f => f.val).map(f => (
                        <div key={f.label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</p>
                          <p className="text-xs font-bold text-gray-800 mt-1">{f.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specifications Tab */}
                {activeTab === 'specs' && (
                  <div className="max-w-2xl overflow-hidden rounded-2xl border border-gray-200">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        {[
                          { label: 'Brand', val: product.brand?.name || product.brand },
                          { label: 'SKU Code', val: product.sku },
                          { label: 'Barcode', val: product.barcode },
                          { label: 'Category', val: product.category?.name },
                          { label: 'Subcategory', val: product.subCategory?.name },
                          { label: 'Material', val: product.material },
                          { label: 'Fabric', val: product.fabric },
                          { label: 'Pattern', val: product.pattern },
                          { label: 'Fit', val: product.fit },
                          { label: 'Sleeve', val: product.sleeve },
                          { label: 'Neckline', val: product.neck },
                          { label: 'Occasion', val: product.occasion },
                          { label: 'Gender', val: product.gender },
                          { label: 'Sizes Available', val: availableSizes.join(', ') },
                          { label: 'Country of Origin', val: product.countryOfOrigin || 'India' },
                          { label: 'Wash Care', val: product.washCare },
                        ].filter(r => r.val).map((row, idx) => (
                          <tr key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                            <td className="px-5 py-3 font-bold text-gray-500 w-44">{row.label}</td>
                            <td className="px-5 py-3 text-gray-800 font-semibold">{row.val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Materials & Care Tab */}
                {activeTab === 'materials' && (
                  <div className="max-w-2xl space-y-4">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <h4 className="font-bold text-gray-900 text-sm mb-2">Fabric Composition</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{product.material || product.fabric || '100% Premium Quality Cotton'}</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <h4 className="font-bold text-gray-900 text-sm mb-2">Care Instructions</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{product.washCare || 'Machine wash cold with like colors. Tumble dry low. Do not bleach. Cool iron if needed.'}</p>
                    </div>
                  </div>
                )}

                {/* Shipping & Returns Tab */}
                {activeTab === 'shipping' && (
                  <div className="max-w-2xl space-y-4">
                    {[
                      { icon: FiTruck, title: 'Free Express Shipping', desc: 'Complimentary shipping on all orders over ₹499. Standard delivery within 2–5 business days across India.' },
                      { icon: FiRefreshCw, title: '7-Day Easy Returns', desc: 'Hassle-free 7-day return policy. Items must be unused, unwashed, and in original packaging with all tags attached.' },
                      { icon: FiShield, title: '100% Secure Checkout', desc: 'Encrypted payment processing via Razorpay & PayU. Cash on Delivery (COD) supported nationwide.' },
                    ].map(item => (
                      <div key={item.title} className="flex gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <item.icon size={18} className="text-amber-700" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reviews Tab */}
                {activeTab === 'reviews' && (
                  <div className="space-y-6 max-w-3xl">
                    <RatingBreakdown reviews={reviews} />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex gap-2">
                        {['newest', 'highest', 'lowest'].map(s => (
                          <button key={s} onClick={() => setReviewSort(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition
                              ${reviewSort === s ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                      <button onClick={handleWriteReviewClick}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 text-amber-400 text-xs font-bold hover:bg-gray-800 transition">
                        <FiMessageSquare size={13} /> Write a Review
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* VERIFIED CUSTOMER REVIEWS COMPONENT */}
        <ReviewSection productId={product.id} />

        {/* ═══════════════════════════════════════════════════
            SIMILAR PRODUCTS ("You May Also Like")
        ═══════════════════════════════════════════════════ */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 border-t border-gray-100 pt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900">Similar Products</h2>
              <Link to="/categories" className="text-xs text-amber-700 font-bold hover:underline flex items-center gap-1">
                View All <FiChevronRight size={14} />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
              {relatedProducts.map(p => <MiniProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            SIMILAR STYLES YOU MAY LIKE (SAME CATEGORY)
        ═══════════════════════════════════════════════════ */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 border-t border-gray-100 pt-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif font-bold text-gray-900">Similar Styles You May Like</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
              {relatedProducts.slice(0, 4).map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            RECOMMENDED FOR YOU / TRENDING
        ═══════════════════════════════════════════════════ */}
        {recommendedProducts.length > 0 && (
          <div className="mt-12 border-t border-gray-100 pt-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif font-bold text-gray-900">Recommended For You</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
              {recommendedProducts.slice(0, 4).map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            RECENTLY VIEWED
        ═══════════════════════════════════════════════════ */}
        <RecentlyViewedSection currentId={product.id} />

      </div>

      {/* ═══════════════════════════════════════════════════
          STICKY PRODUCT BOTTOM BAR (On Scroll)
      ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {stickyVisible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl px-4 py-3"
          >
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <img src={colorImages[0]?.url || colorImages[0]} alt="" className="w-12 h-14 object-cover rounded-xl bg-gray-100 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {selectedColor.name && <span>{selectedColor.name}</span>}
                  {selectedSize && <><span>·</span><span>Size: {selectedSize}</span></>}
                </div>
              </div>
              <div className="flex-shrink-0 hidden sm:block">
                <p className="font-black text-gray-900 text-lg">{formatCurrency(currentDiscountPrice)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {currentStock === 0 ? (
                  <button onClick={handleNotifyMe} disabled={notifiedMe}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition ${
                      notifiedMe ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}>
                    {notifiedMe ? '✅ Subscribed' : '🔔 Notify Me'}
                  </button>
                ) : (
                  <>
                    <button onClick={handleAddToCart}
                      className="px-4 py-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-900 text-xs font-black hover:bg-amber-400 hover:text-black transition whitespace-nowrap">
                      + Cart
                    </button>
                    <button onClick={handleBuyNow}
                      className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-gray-800 transition whitespace-nowrap">
                      Buy Now
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          SHARE MODAL
      ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showShare && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
            onClick={() => setShowShare(false)}>
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900">Share Product</h3>
                <button onClick={() => setShowShare(false)} className="p-2 rounded-xl hover:bg-gray-100 transition"><FiX size={16}/></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'WhatsApp', icon: FaWhatsapp, color: 'bg-green-500', url: `https://wa.me/?text=${encodeURIComponent(product.name + ' - ' + shareUrl)}` },
                  { label: 'Facebook', icon: FaFacebook, color: 'bg-blue-600', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
                  { label: 'Telegram', icon: FaTelegram, color: 'bg-sky-500', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}` },
                  { label: 'Twitter', icon: FaTwitter, color: 'bg-gray-900', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.name)}` },
                ].map(s => (
                  <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${s.color} text-white font-bold text-xs transition hover:opacity-90`}>
                    <s.icon size={18} /> {s.label}
                  </a>
                ))}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied to clipboard!'); setShowShare(false); }}
                className="mt-3 w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition">
                📋 Copy Product Link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          SIZE GUIDE MODAL
      ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSizeGuide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setShowSizeGuide(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 text-lg">Size Chart & Measurement Guide</h3>
                <button onClick={() => setShowSizeGuide(false)} className="p-2 rounded-xl hover:bg-gray-100 transition"><FiX size={16}/></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center">
                  <thead className="bg-gray-900 text-white">
                    <tr>{['Size', 'Chest (in)', 'Waist (in)', 'Hip (in)', 'Length (in)'].map(h => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[['XS','32-34','26-28','34-36','25'],['S','34-36','28-30','36-38','25.5'],['M','36-38','30-32','38-40','26'],['L','38-40','32-34','40-42','26.5'],['XL','40-42','34-36','42-44','27'],['XXL','42-44','36-38','44-46','27.5'],['3XL','44-46','38-40','46-48','28']].map(row => (
                      <tr key={row[0]} className="even:bg-gray-50">
                        {row.map((cell, i) => (
                          <td key={i} className={`px-3 py-2.5 ${i === 0 ? 'font-black text-gray-900' : 'text-gray-600'}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 mt-4 text-center">All measurements are in inches. Measure around the fullest part of your body for exact fit.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          WRITE REVIEW MODAL
      ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showReviewForm && (
          <WriteReviewModal
            order={reviewOrderData?.order}
            item={reviewOrderData?.item || { product }}
            onClose={() => setShowReviewForm(false)}
            onReviewSubmitted={onReviewSubmitted}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
