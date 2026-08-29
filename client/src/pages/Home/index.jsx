import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

import { FiArrowRight, FiTruck, FiShield, FiRefreshCw, FiHeadphones, FiZap } from 'react-icons/fi';
import api from '../../config/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';
import ProductCard from '../../components/common/ProductCard';
import RecommendedForYou from '../../components/home/RecommendedForYou';
import RecentlyViewedSection from '../../components/home/RecentlyViewedSection';
import FlashSaleSection from '../../components/home/FlashSaleSection';
import CollectionShowcase from '../../components/home/CollectionShowcase';
import BrandShowcase from '../../components/home/BrandShowcase';
import TestimonialsSection from '../../components/home/TestimonialsSection';
import InstagramGallery from '../../components/home/InstagramGallery';
import FAQPreview from '../../components/home/FAQPreview';
import NewsletterSubscribe from '../../components/common/NewsletterSubscribe';

// Luxury Fallbacks
const DEFAULT_HERO_SLIDERS = [
  {
    id: 'hero-1',
    title: 'Royal Kanjeevaram & Silk Sarees',
    subtitle: 'Handcrafted timeless weaves for grand celebrations.',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=1600&auto=format&fit=crop',
    linkUrl: '/categories/womens-sarees',
    isActive: true,
    type: 'HERO_SLIDER'
  },
  {
    id: 'hero-2',
    title: 'Imperial Temple & Kundan Jewellery',
    subtitle: 'Certified 22K gold-plated bridal & festive collections.',
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1600&auto=format&fit=crop',
    linkUrl: '/categories/jewellery',
    isActive: true,
    type: 'HERO_SLIDER'
  },
  {
    id: 'hero-3',
    title: 'Festive Men’s Heritage Kurtas & Shirts',
    subtitle: 'Royal elegance redefined for modern gentlemen.',
    imageUrl: 'https://images.unsplash.com/photo-1597983073493-88cd35cf03b0?q=80&w=1600&auto=format&fit=crop',
    linkUrl: '/categories/mens-wear',
    isActive: true,
    type: 'HERO_SLIDER'
  }
];

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: "Women's Sarees", slug: 'womens-sarees', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80' },
  { id: 'cat-3', name: "Men's Wear", slug: 'mens-wear', image: 'https://images.unsplash.com/photo-1597983073493-88cd35cf03b0?w=800&auto=format&fit=crop&q=80' },
  { id: 'cat-4', name: 'Kids Wear', slug: 'kids-wear', image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800&auto=format&fit=crop&q=80' },
];

// Smart Category Thumbnail Resolver: uses admin-uploaded cropped photo or high-clarity category image
const getCategoryThumbnail = (cat) => {
  if (!cat) return 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80';
  
  // High priority: Always use the exact admin uploaded/cropped photo if present!
  const rawImage = cat.image || cat.imageUrl || cat.coverImage || cat.banner || cat.thumbnail;
  if (rawImage && typeof rawImage === 'string' && rawImage.trim().length > 5) {
    return formatImageUrl(rawImage.trim());
  }

  const slug = String(cat.slug || '').toLowerCase();
  const name = String(cat.name || '').toLowerCase();

  if (slug.includes('saree') || name.includes('saree') || slug.includes('women') || name.includes('women') || slug.includes('lehenga') || name.includes('lehenga')) {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80';
  }
  if (slug.includes('men') || name.includes('men') || slug.includes('kurta') || name.includes('kurta') || slug.includes('shirt') || name.includes('shirt')) {
    return 'https://images.unsplash.com/photo-1597983073493-88cd35cf03b0?w=800&auto=format&fit=crop&q=80';
  }
  if (slug.includes('kid') || name.includes('kid') || slug.includes('child') || name.includes('child') || slug.includes('baby') || name.includes('baby')) {
    return 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80';
};

// ─── PERSISTENT CACHE KEY (must match the one in authSlice.js) ─────
const PERSISTENT_CACHE_KEY = '__KVLR_HOME_PERSISTENT_CACHE_V3__';
const SESSION_CACHE_KEY = '__KVLR_HOME_CACHE__';

// ─── MODULE-LEVEL MEMORY CACHE ─────────────────────────────────────
// Survives component unmount/remount during SPA navigation.
// Zero JSON parsing — products never disappear when navigating back.
let _memoryCache = null;

// Read cached homepage data — memory first (instant), then localStorage (fast)
const getCachedHomeData = () => {
  // 1st priority: in-memory (instant, 0ms, survives route changes)
  if (_memoryCache) return _memoryCache;
  // 2nd priority: localStorage/sessionStorage
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY) || localStorage.getItem(PERSISTENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const prods = parsed.products;
    if (!prods) return null;
    const hasProducts = (prods.allPublished?.length > 0) || (prods.featured?.length > 0) || (prods.trending?.length > 0);
    if (!hasProducts) return null;
    // Warm up memory cache for next mount
    _memoryCache = parsed;
    return parsed;
  } catch { return null; }
};

// Write cache to memory + sessionStorage + localStorage
const writeCacheData = (data) => {
  try {
    const prods = data?.products;
    if (!prods || (!prods.allPublished?.length && !prods.featured?.length)) return;
    const cacheObj = { ...data, savedAt: Date.now() };
    // Always save to memory first (instant on next mount)
    _memoryCache = cacheObj;
    const payload = JSON.stringify(cacheObj);
    sessionStorage.setItem(SESSION_CACHE_KEY, payload);
    localStorage.setItem(PERSISTENT_CACHE_KEY, payload);
  } catch {}
};

// Inline SkeletonCard for loading state
const SkeletonCard = () => (
  <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
    <div className="aspect-[3/4] bg-gray-200" />
    <div className="p-3">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
      <div className="h-5 bg-gray-200 rounded w-1/3" />
    </div>
  </div>
);

const EMPTY_PRODUCTS = { featured: [], trending: [], newArrivals: [], todaysDeals: [], allPublished: [] };

const Home = () => {
  // ── SWR: Hydrate initial state from memory/localStorage so products are INSTANT ──
  const cached = React.useMemo(() => getCachedHomeData(), []);
  const hasCachedProducts = !!cached;

  const [banners, setBanners] = useState(cached?.banners?.length > 0 ? cached.banners : DEFAULT_HERO_SLIDERS);
  const [categories, setCategories] = useState(cached?.categories?.length > 0 ? cached.categories : DEFAULT_CATEGORIES);
  const [products, setProducts] = useState(() => {
    if (hasCachedProducts) {
      return {
        featured: cached.products.featured || [],
        trending: cached.products.trending || [],
        newArrivals: cached.products.newArrivals || [],
        todaysDeals: cached.products.todaysDeals || [],
        allPublished: cached.products.allPublished || []
      };
    }
    return EMPTY_PRODUCTS;
  });
  const [trendingData, setTrendingData] = useState(cached?.trendingData || null);
  const [enableTrending, setEnableTrending] = useState(true);
  const [dynamicSections, setDynamicSections] = useState(cached?.dynamicSections || []);
  // Show skeleton ONLY on very first visit (no cached data at all)
  const [isLoading, setIsLoading] = useState(!hasCachedProducts);

  // Use refs to avoid stale closures when writing cache from inside callbacks
  const bannersRef = React.useRef(banners);
  const categoriesRef = React.useRef(categories);
  const trendingDataRef = React.useRef(trendingData);
  const dynamicSectionsRef = React.useRef(dynamicSections);
  bannersRef.current = banners;
  categoriesRef.current = categories;
  trendingDataRef.current = trendingData;
  dynamicSectionsRef.current = dynamicSections;

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        // Fast path: Fetch consolidated homepage bundle in 1 single optimized request
        let bundleSuccess = false;
        try {
          const bundleRes = await api.get('/cms/homepage-bundle');
          if (bundleRes.data?.success && bundleRes.data?.data) {
            const bundle = bundleRes.data.data;
            if (!isMounted) return;

            if (bundle.banners?.length > 0) setBanners(bundle.banners);
            if (Array.isArray(bundle.categories) && bundle.categories.length > 0) setCategories(bundle.categories);
            if (bundle.products) {
              const bProds = bundle.products;
              const newProducts = {
                featured: bProds.featured || [],
                trending: bProds.trending || [],
                newArrivals: bProds.newArrivals || [],
                todaysDeals: bProds.todaysDeals || [],
                allPublished: bProds.allPublished || []
              };
              setProducts(newProducts);
            }
            if (bundle.trendingData !== undefined) setTrendingData(bundle.trendingData);
            if (bundle.dynamicSections) setDynamicSections(bundle.dynamicSections);
            if (bundle.settings?.enableTrendingProducts === false) setEnableTrending(false);

            setIsLoading(false);
            // Only mark bundle as fully successful if it actually returned products
            const bundleProds = bundle.products || {};
            const hasAnyProducts = (bundleProds.allPublished?.length > 0) || (bundleProds.featured?.length > 0);
            bundleSuccess = hasAnyProducts;

            // Persist for instant loading on next mount / back navigation
            if (hasAnyProducts) {
              writeCacheData({
                banners: bundle.banners || [],
                categories: bundle.categories || [],
                products: bundle.products || {},
                trendingData: bundle.trendingData || null,
                dynamicSections: bundle.dynamicSections || [],
              });
            }
          }
        } catch (bundleErr) {
          bundleSuccess = false;
        }

        // Fetch direct products if bundle failed OR returned empty products
        if (!bundleSuccess) {
          try {
            const directProdsRes = await api.get('/products?limit=50&sort=newest');
            const liveProds = directProdsRes.data?.data?.products || directProdsRes.data?.data || [];
            if (Array.isArray(liveProds) && liveProds.length > 0 && isMounted) {
              const feat = liveProds.filter(p => p.featured);
              const newArr = liveProds.filter(p => p.newArrival || p.isNew);
              const trend = liveProds.filter(p => p.trending);
              const deals = liveProds.filter(p => p.todaysDeal || p.bestSeller);

              setProducts({
                featured: feat,
                trending: trend,
                newArrivals: newArr,
                todaysDeals: deals,
                allPublished: liveProds
              });

              // Persist using refs (avoids stale closure)
              writeCacheData({
                banners: bannersRef.current,
                categories: categoriesRef.current,
                products: {
                  featured: feat,
                  trending: trend,
                  newArrivals: newArr,
                  todaysDeals: deals,
                  allPublished: liveProds
                },
                trendingData: trendingDataRef.current,
                dynamicSections: dynamicSectionsRef.current,
              });
            }
          } catch (directErr) {}
          if (isMounted) setIsLoading(false);
        }

      } catch (err) {
        console.error('Home page data fetch error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHomeData();

    const handleContentUpdate = () => {
      try {
        _memoryCache = null;
        localStorage.removeItem(PERSISTENT_CACHE_KEY);
        sessionStorage.removeItem(SESSION_CACHE_KEY);
      } catch (e) {}
      fetchHomeData();
    };

    window.addEventListener('kvlr:content-updated', handleContentUpdate);
    window.addEventListener('storage', handleContentUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('kvlr:content-updated', handleContentUpdate);
      window.removeEventListener('storage', handleContentUpdate);
    };
  }, []);

  const getBannerRedirectUrl = (banner) => {
    let link = (banner.buttonLink || banner.linkUrl || '').trim();

    // 1. If explicit link set by admin (and not '#'), use it directly
    if (link && link !== '#') {
      if (!link.startsWith('http://') && !link.startsWith('https://') && !link.startsWith('/')) {
        return '/' + link;
      }
      return link;
    }

    // 2. If no explicit link set, match title/subtitle against database categories
    const bannerTitle = (banner.title || '').toLowerCase().trim();
    const bannerSub = (banner.subtitle || '').toLowerCase().trim();

    if (bannerTitle || bannerSub) {
      const matchedCat = categories.find(c => {
        const catName = (c.name || '').toLowerCase().trim();
        const catSlug = (c.slug || '').toLowerCase().trim();
        return (
          (catName && (bannerTitle.includes(catName) || catName.includes(bannerTitle) || bannerSub.includes(catName))) ||
          (catSlug && (bannerTitle.includes(catSlug) || catSlug.includes(bannerTitle)))
        );
      });

      if (matchedCat) {
        return `/categories/${matchedCat.slug}`;
      }
    }

    // 3. Fallback
    return '/categories';
  };

  const heroSliders = banners.filter(b => 
    (b.position === 'HOMEPAGE_HERO' || b.bannerType === 'SLIDER' || b.type === 'HERO_SLIDER' || !b.position) && 
    (b.isActive !== false)
  );

  return (
    <div className="min-h-screen bg-white">
      {/* 4. HERO BANNER SLIDER */}
      {heroSliders.length > 0 && (
        <section className="relative">
          <Swiper modules={[Autoplay, Pagination, EffectFade]} effect="fade" autoplay={{ delay: 5000, disableOnInteraction: false }}
            pagination={{ clickable: true }} loop className="w-full h-[260px] sm:h-[420px] lg:h-[560px]">
            {heroSliders.map((banner) => {
              const targetUrl = getBannerRedirectUrl(banner);
              const btnText = banner.buttonText || 'Shop Collection';

              return (
                <SwiperSlide key={banner.id || banner.title}>
                  <div className="relative w-full h-full group">
                    <Link to={targetUrl} className="block w-full h-full">
                      <img src={banner.imageUrl} alt={banner.title || 'Banner'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                    </Link>
                    <div className="absolute inset-0 flex items-center pointer-events-none">
                      <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full">
                        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="pointer-events-auto">
                          {banner.title && <h2 className="text-2xl sm:text-3xl lg:text-5xl font-serif font-bold text-white mb-2 max-w-xl drop-shadow-lg">{banner.title}</h2>}
                          {banner.subtitle && <p className="text-xs sm:text-base lg:text-lg text-white/90 mb-5 max-w-md drop-shadow">{banner.subtitle}</p>}
                          <Link to={targetUrl} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-600 hover:to-gold-600 text-white px-5 py-2.5 sm:px-7 sm:py-3.5 text-xs sm:text-base rounded-full font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 cursor-pointer">
                            {btnText} <FiArrowRight className="w-4 h-4" />
                          </Link>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </section>
      )}

      {/* 20. STORE FEATURES / BADGES */}
      <section className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: FiTruck, label: 'Free Shipping', desc: 'On orders above ₹999' },
              { icon: FiShield, label: '100% Authentic', desc: 'Certified purity & quality' },
              { icon: FiRefreshCw, label: '7-Day Easy Returns', desc: 'Hassle-free refunds' },
              { icon: FiHeadphones, label: '24/7 Support', desc: 'Dedicated helpline' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gold-50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-gold-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. FEATURED CATEGORIES GRID */}
      {categories.length > 0 && (
        <section className="py-12 lg:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl lg:text-3xl font-serif font-bold text-charcoal-900 mb-2">Shop by Category</h2>
              <p className="text-gray-500">Explore our handcrafted luxury collections</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {categories
                .filter(cat => (cat.status || 'PUBLISHED') === 'PUBLISHED' && cat.isVisible !== false && cat.showOnHomepage !== false)
                .map((cat) => (
                <div key={cat.id}>
                  <Link to={`/categories/${cat.slug}`}
                    className="group relative block aspect-[4/5] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-charcoal-900">
                    <img
                      src={getCategoryThumbnail(cat)}
                      alt={cat.name}
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = getCategoryThumbnail({ slug: cat.slug, name: cat.name });
                      }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-lg font-serif font-bold text-white mb-0.5">{cat.name}</h3>
                      {Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
                        <p className="text-[11px] text-gold-300/90 font-medium truncate mb-1">
                          {cat.subcategories.filter(s => s.isVisible !== false).map(s => s.name).join(' • ')}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-gold-400 text-xs font-semibold group-hover:gap-2 transition-all">
                        Explore <FiArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. MAIN PUBLISHED PRODUCTS CATALOG — Renders immediately below Categories */}
      {(() => {
        const allList = products.allPublished || [];
        if (allList.length === 0 && !isLoading) return null;

        return (
          <section className="py-12 lg:py-16 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl lg:text-3xl font-serif font-bold text-charcoal-900">Explore Our Catalog 🛍️</h2>
                  <p className="text-gray-500 mt-1">Discover all our published luxury creations</p>
                </div>
                <Link to="/categories" className="hidden sm:inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 font-bold text-sm">
                  View All <FiArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {allList.length > 0 ? (
                  allList.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))
                ) : (
                  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SkeletonCard key={n} />
                  ))
                )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* 6. FLASH SALE */}
      <FlashSaleSection />

      {/* 7. FEATURED PRODUCTS & PUBLISHED CATALOG */}
      {isLoading ? (
        <section className="py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="h-8 bg-gray-200 rounded-lg w-56 animate-pulse mb-2" />
                <div className="h-4 bg-gray-100 rounded w-40 animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SkeletonCard key={n} />
              ))}
            </div>
          </div>
        </section>
      ) : products.featured.length > 0 ? (
        <section className="py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl lg:text-3xl font-serif font-bold text-charcoal-900">Featured Collection</h2>
                <p className="text-gray-500 mt-1">Handpicked luxury creations curated for you</p>
              </div>
              <Link to="/categories" className="hidden sm:inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 font-bold text-sm">
                View All <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {products.featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 15. TODAY'S DEAL */}
      {products.todaysDeals.length > 0 && (
        <section className="py-12 bg-amber-50/50 border-y border-amber-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="flex items-center gap-2 mb-6">
              <FiZap className="w-6 h-6 text-amber-600 fill-amber-600" />
              <h2 className="text-2xl font-serif font-bold text-charcoal-900">Today&apos;s Special Deals</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {products.todaysDeals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. TRENDING PRODUCTS */}
      {(() => {
        const trendList = (trendingData?.products && trendingData.products.length > 0)
          ? trendingData.products
          : (products.trending || []);
        if (!enableTrending || trendList.length === 0) return null;

        return (
          <section className="py-12 lg:py-16 bg-gray-50 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl lg:text-3xl font-serif font-bold text-charcoal-900">{trendingData?.title || 'Trending Styles'} 🔥</h2>
                  <p className="text-gray-500 mt-1">Handpicked trending styles curated by our fashion editors</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {trendList.slice(0, trendingData?.limit || 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* 9. NEW ARRIVALS & LATEST PUBLISHED CREATIONS */}
      {products.newArrivals.length > 0 && (
        <section className="py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl lg:text-3xl font-serif font-bold text-charcoal-900">New Arrivals ✨</h2>
                <p className="text-gray-500 mt-1">Freshly published additions to our catalog</p>
              </div>
              <Link to="/categories" className="hidden sm:inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 font-bold text-sm">
                Explore All <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {products.newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DYNAMIC DATABASE-DRIVEN HOMEPAGE SECTIONS */}
      {dynamicSections.map((sec) => {
        if (!sec.products || sec.products.length === 0) return null;

        const gridCols = sec.productsPerRow === 2
          ? 'grid-cols-2'
          : sec.productsPerRow === 3
          ? 'grid-cols-2 md:grid-cols-3'
          : sec.productsPerRow === 5
          ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
          : sec.productsPerRow === 6
          ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

        return (
          <section
            key={sec.id}
            style={{ backgroundColor: sec.bgColor || '#FFFFFF', color: sec.textColor || '#111827' }}
            className="py-12 lg:py-16 border-t border-gray-100 transition-colors"
          >
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              {/* Optional Section Banner */}
              {sec.bannerUrl && (
                <div className="relative rounded-2xl overflow-hidden mb-8 h-48 sm:h-64 shadow-md">
                  <img src={formatImageUrl(sec.bannerUrl)} alt={sec.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent flex items-center p-6 lg:p-10">
                    <div className="max-w-lg text-white">
                      <span className="text-xs font-bold text-gold-400 uppercase tracking-widest">SPECIAL COLLECTION</span>
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold mt-1">{sec.title}</h2>
                      {sec.subtitle && <p className="text-sm text-gray-200 mt-1">{sec.subtitle}</p>}
                      {sec.description && <p className="text-xs text-gray-300 mt-2 line-clamp-2 leading-relaxed">{sec.description}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Section Header */}
              {!sec.bannerUrl && (
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-serif font-bold" style={{ color: sec.textColor || '#111827' }}>
                      {sec.title}
                    </h2>
                    {sec.subtitle && <p className="text-gray-500 text-sm mt-1">{sec.subtitle}</p>}
                  </div>
                  {sec.buttonText && (
                    <Link
                      to={sec.buttonLink || '/categories'}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-700 transition"
                    >
                      {sec.buttonText} <FiArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              )}

              {/* Products Grid */}
              <div className={`grid ${gridCols} gap-3 sm:gap-4 lg:gap-6`}>
                {sec.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* 15. AI PERSONALIZED RECOMMENDATIONS */}
      <RecommendedForYou />

      {/* 16. BRAND SHOWCASE */}
      <BrandShowcase />

      {/* 17. CUSTOMER TESTIMONIALS */}
      <TestimonialsSection />

      {/* 18. INSTAGRAM GALLERY */}
      <InstagramGallery />

      {/* 21. FAQ PREVIEW */}
      <FAQPreview />

      {/* 22. RECENTLY VIEWED PRODUCTS (PLACED AT THE BOTTOM OF HOMEPAGE) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <RecentlyViewedSection />
      </div>

      {/* 19. NEWSLETTER SECTION */}
      <section className="py-14 lg:py-20 bg-[#0c0c10] border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="max-w-2xl mx-auto px-4 text-center relative z-10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400 font-serif mb-2 inline-block">Exclusive Access</span>
            <h2 className="text-2xl lg:text-4xl font-serif font-bold text-white mb-3 tracking-tight">Stay in Style</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-7 max-w-md mx-auto leading-relaxed">
              Subscribe to receive instant alerts when new collections drop, private festive sale access, and curated style recommendations.
            </p>
            <NewsletterSubscribe variant="section" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
