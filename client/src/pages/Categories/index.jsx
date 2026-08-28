import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiFilter, FiSliders, FiHeart, FiShoppingBag, FiStar, FiX, FiLayers, FiCheck } from 'react-icons/fi';
import api from '../../config/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';

/* ─── Module-level caches survive SPA navigation ─── */
let _categoriesCache = null;
let _productsCache = {};  // keyed by URL params
let _subcategoriesCache = {};

const Categories = () => {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState(_categoriesCache || []);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(!_categoriesCache);

  // Filter & Sort state
  const queryParams = new URLSearchParams(location.search);
  const initialSub = queryParams.get('sub') || '';

  const [selectedCategory, setSelectedCategory] = useState(slug || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialSub);
  const [sortOption, setSortOption] = useState('newest');
  const [maxPrice, setMaxPrice] = useState(20000);
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterTrending, setFilterTrending] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Synchronize category & subcategory state with URL params whenever route slug or search query changes!
  useEffect(() => {
    const newCat = slug || '';
    const q = new URLSearchParams(location.search);
    const newSub = q.get('sub') || '';

    setSelectedCategory(newCat);
    setSelectedSubcategory(newSub);

    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug, location.search]);

  // Helper to handle category selection via sidebar or drawer radio buttons
  const handleCategorySelect = (catSlug) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory('');
    if (catSlug) {
      navigate(`/categories/${catSlug}`);
    } else {
      navigate('/categories');
    }
  };

  // Helper to handle subcategory selection
  const handleSubcategorySelect = (subVal) => {
    setSelectedSubcategory(subVal);
    const catSlug = selectedCategory || slug || '';
    if (catSlug) {
      if (subVal) {
        navigate(`/categories/${catSlug}?sub=${encodeURIComponent(subVal)}`);
      } else {
        navigate(`/categories/${catSlug}`);
      }
    }
  };

  // Fetch Parent Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get('/categories');
        const cats = data.data || [];
        _categoriesCache = cats;
        setCategories(cats);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch Subcategories whenever selectedCategory changes
  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        let url = '/subcategories?activeOnly=true';
        if (selectedCategory) {
          const found = categories.find(c => c.slug === selectedCategory || c.id === selectedCategory);
          if (found) url += `&categoryId=${found.id}`;
        }
        // Check cache first
        const cacheKey = url;
        if (_subcategoriesCache[cacheKey]) {
          setSubcategories(_subcategoriesCache[cacheKey]);
        }
        const { data } = await api.get(url);
        const subs = data.data || [];
        _subcategoriesCache[cacheKey] = subs;
        setSubcategories(subs);
      } catch (err) {
        setSubcategories([]);
      }
    };
    fetchSubcategories();
  }, [selectedCategory, categories]);

  // Fetch Products - show cached data instantly, refresh in background
  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      let url = `/products?limit=50`;

      if (selectedCategory) {
        const foundCat = categories.find(c => c.slug === selectedCategory || c.id === selectedCategory);
        if (foundCat) {
          url += `&category=${foundCat.id}`;
        } else {
          url += `&category=${encodeURIComponent(selectedCategory)}`;
        }
      }

      if (selectedSubcategory) {
        url += `&subCategory=${encodeURIComponent(selectedSubcategory)}`;
      }

      if (filterFeatured) url += `&featured=true`;
      if (filterTrending) url += `&trending=true`;

      if (sortOption === 'price_asc') url += `&sort=price_asc`;
      else if (sortOption === 'price_desc') url += `&sort=price_desc`;

      const cacheKey = url;

      // Show cached products instantly (no loading spinner)
      if (_productsCache[cacheKey]) {
        if (isMounted) {
          setProducts(_productsCache[cacheKey]);
          setLoading(false);
        }
      }

      try {
        const { data } = await api.get(url);
        const prods = data.data?.products || (Array.isArray(data.data) ? data.data : []);
        _productsCache[cacheKey] = prods;
        if (isMounted) {
          setProducts(prods);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, selectedSubcategory, sortOption, filterFeatured, filterTrending, categories]);

  const filteredProducts = products.filter(p => (p.discountPrice || p.price) <= maxPrice);

  const activeCategoryObj = categories.find(c => c.slug === selectedCategory || c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-white">
      {/* Header Banner with Admin-Uploaded Photo & Description */}
      <div className="relative bg-gradient-to-r from-charcoal-900 via-charcoal-800 to-charcoal-900 text-white py-12 sm:py-16 px-4 text-center overflow-hidden">
        {(activeCategoryObj?.banner || activeCategoryObj?.image) && (
          <img
            src={formatImageUrl(activeCategoryObj.banner || activeCategoryObj.image)}
            alt={activeCategoryObj.name}
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
        )}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 relative z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white mb-2">
            {activeCategoryObj ? activeCategoryObj.name : 'Explore All Collections'}
          </h1>
          <p className="text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {activeCategoryObj?.shortDesc || activeCategoryObj?.description || 'Discover handcrafted jewellery, kids wear, men\'s wear, and women\'s wear'}
          </p>
        </div>
      </div>

      {/* ── Subcategories Carousel / Cards Showcase Grid ──────── */}
      {subcategories.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-100 py-6 px-4">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <FiLayers className="text-amber-500" /> Subcategory Collections ({subcategories.length})
              </h3>
              {selectedSubcategory && (
                <button
                  onClick={() => setSelectedSubcategory('')}
                  className="text-xs text-amber-600 font-bold hover:underline"
                >
                  Clear Subcategory Filter ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedSubcategory('')}
                className={`px-4 py-3 rounded-2xl border transition-all text-xs shrink-0 cursor-pointer text-left flex items-center gap-3 ${
                  !selectedSubcategory ? 'bg-amber-500 border-amber-500 text-black shadow-md font-black' : 'bg-white border-gray-200 text-gray-700 hover:border-amber-400'
                }`}
              >
                <div>
                  <p className="font-bold">All Subcategories</p>
                  <p className="text-[10px] opacity-80">Full Category View</p>
                </div>
              </button>

              {subcategories.map(sub => {
                const isSelected = selectedSubcategory === sub.id || selectedSubcategory === sub.slug;
                const prodCount = sub._count?.products || 0;

                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSubcategorySelect(isSelected ? '' : (sub.slug || sub.id))}
                    className={`p-2 pr-4 rounded-2xl border transition-all text-xs shrink-0 cursor-pointer flex items-center gap-3 ${
                      isSelected ? 'bg-amber-500 border-amber-500 text-black shadow-md font-black' : 'bg-white border-gray-200 text-gray-800 hover:border-amber-400'
                    }`}
                  >
                    <img
                      src={formatImageUrl(sub.image) || 'https://via.placeholder.com/80'}
                      alt={sub.name}
                      className="w-10 h-10 rounded-xl object-cover border border-amber-200"
                    />
                    <div className="text-left">
                      <p className="font-bold leading-tight">{sub.name}</p>
                      <p className="text-[10px] opacity-75">{prodCount} Product(s)</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Catalog Workspace */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="text-xs text-gray-500">
            Showing <strong className="text-charcoal-900">{filteredProducts.length}</strong> products
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold text-charcoal-900"
            >
              <FiFilter /> Filters
            </button>

            {/* Sort Dropdown */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-2 focus:ring-gold-500 focus:outline-none bg-white"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* DESKTOP FILTER SIDEBAR */}
          <div className="hidden lg:block bg-gray-50/50 border border-gray-200 rounded-3xl p-6 h-fit space-y-6">
            <div>
              <h3 className="font-serif font-bold text-sm text-charcoal-900 mb-3 uppercase tracking-wider">Parent Categories</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    checked={!selectedCategory}
                    onChange={() => handleCategorySelect('')}
                    className="text-gold-500 focus:ring-gold-500"
                  />
                  All Categories
                </label>
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === cat.slug || selectedCategory === cat.id}
                      onChange={() => handleCategorySelect(cat.slug || cat.id)}
                      className="text-gold-500 focus:ring-gold-500"
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Subcategories Filter inside Sidebar */}
            {subcategories.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <h3 className="font-serif font-bold text-sm text-charcoal-900 mb-3 uppercase tracking-wider">Subcategories</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="subcategory"
                      checked={!selectedSubcategory}
                      onChange={() => handleSubcategorySelect('')}
                      className="text-gold-500 focus:ring-gold-500"
                    />
                    All Subcategories
                  </label>
                  {subcategories.map((sub) => {
                    const isSubSelected = selectedSubcategory === sub.id || selectedSubcategory === sub.slug;
                    return (
                      <label key={sub.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="subcategory"
                          checked={isSubSelected}
                          onChange={() => handleSubcategorySelect(sub.slug || sub.id)}
                          className="text-gold-500 focus:ring-gold-500"
                        />
                        <span>{sub.name}</span>
                        <span className="text-[10px] text-gray-400">({sub._count?.products || 0})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Slider */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2 text-xs font-bold text-charcoal-900">
                <span>Max Price</span>
                <span className="text-gold-600">{formatCurrency(maxPrice)}</span>
              </div>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-gold-500 cursor-pointer"
              />
            </div>

            {/* Badges Toggle */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <h3 className="font-serif font-bold text-sm text-charcoal-900 mb-2 uppercase tracking-wider">Collection Badges</h3>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterFeatured}
                  onChange={(e) => setFilterFeatured(e.target.checked)}
                  className="rounded text-gold-500 focus:ring-gold-500"
                />
                Featured Products
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterTrending}
                  onChange={(e) => setFilterTrending(e.target.checked)}
                  className="rounded text-gold-500 focus:ring-gold-500"
                />
                Trending Now 🔥
              </label>
            </div>
          </div>

          {/* MOBILE FILTER MODAL */}
          {mobileFilterOpen && (
            <div className="fixed inset-0 z-[100] flex lg:hidden">
              <div className="fixed inset-0 bg-black/50" onClick={() => setMobileFilterOpen(false)} />
              <div className="relative w-[85%] max-w-sm bg-white h-full overflow-y-auto p-6 shadow-xl z-[101]">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h2 className="font-serif font-bold text-lg flex items-center gap-2"><FiFilter /> Filters</h2>
                  <button onClick={() => setMobileFilterOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-600">
                    <FiX size={18} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Copy of desktop filters for mobile */}
                  <div>
                    <h3 className="font-serif font-bold text-sm text-charcoal-900 mb-3 uppercase tracking-wider">Categories</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input type="radio" checked={!selectedCategory} onChange={() => handleCategorySelect('')} className="text-gold-500" />
                        All Categories
                      </label>
                      {categories.map((cat) => (
                        <label key={cat.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input type="radio" checked={selectedCategory === cat.slug || selectedCategory === cat.id} onChange={() => handleCategorySelect(cat.slug || cat.id)} className="text-gold-500" />
                          {cat.name}
                        </label>
                      ))}
                    </div>
                  </div>

                  {subcategories.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="font-serif font-bold text-sm text-charcoal-900 mb-3 uppercase tracking-wider">Subcategories</h3>
                      <div className="space-y-2">
                        {subcategories.map((sub) => {
                          const isSubSelected = selectedSubcategory === sub.id || selectedSubcategory === sub.slug;
                          return (
                            <label key={sub.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input type="radio" checked={isSubSelected} onChange={() => handleSubcategorySelect(sub.slug || sub.id)} className="text-gold-500" />
                              {sub.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2 text-xs font-bold text-charcoal-900">
                      <span>Max Price</span>
                      <span className="text-gold-600">{formatCurrency(maxPrice)}</span>
                    </div>
                    <input type="range" min={500} max={50000} step={500} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-gold-500" />
                  </div>

                  <div className="space-y-2 pt-4 border-t border-gray-200 pb-8">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterFeatured} onChange={(e) => setFilterFeatured(e.target.checked)} className="rounded text-gold-500" />
                      Featured Products
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterTrending} onChange={(e) => setFilterTrending(e.target.checked)} className="rounded text-gold-500" />
                      Trending Now 🔥
                    </label>
                  </div>
                </div>
                
                <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t">
                  <button onClick={() => setMobileFilterOpen(false)} className="w-full bg-charcoal-900 text-gold-400 py-3 rounded-xl font-bold text-sm">Apply Filters</button>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCT GRID */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-gray-200 rounded-2xl" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-3xl border border-gray-100">
                No products match your selected category or subcategory filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6">
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -6 }}
                    className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group"
                  >
                    <Link to={`/product/${product.slug}`}>
                      <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
                        <img
                          src={product.images?.[0]?.url || 'https://via.placeholder.com/300'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-400 font-bold uppercase">{product.category?.name || 'Category'}</p>
                        <h3 className="font-bold text-sm text-gray-900 group-hover:text-amber-600 transition truncate mt-0.5">{product.name}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <p className="font-black text-amber-600 text-sm">{formatCurrency(product.discountPrice || product.price)}</p>
                          {product.discountPrice && (
                            <p className="text-xs text-gray-400 line-through">{formatCurrency(product.price)}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Categories;
