import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiTag } from 'react-icons/fi';
import api from '../../config/api';

// Global in-memory cache for 0ms instant hover hydration
let megaMenuCache = null;
let inflightMegaFetch = null;

const fetchGlobalMegaData = async () => {
  if (megaMenuCache) return megaMenuCache;
  if (inflightMegaFetch) return inflightMegaFetch;

  inflightMegaFetch = (async () => {
    try {
      const [catsRes, subsRes] = await Promise.allSettled([
        api.get('/categories'),
        api.get('/subcategories?activeOnly=true')
      ]);

      const allCats = catsRes.status === 'fulfilled' ? (catsRes.value.data?.data || []) : [];
      const allSubs = subsRes.status === 'fulfilled' ? (subsRes.value.data?.data || []) : [];

      megaMenuCache = { allCats, allSubs };
      return megaMenuCache;
    } catch (err) {
      console.warn('Mega menu fetch warning:', err);
      return { allCats: [], allSubs: [] };
    } finally {
      inflightMegaFetch = null;
    }
  })();

  return inflightMegaFetch;
};

if (typeof window !== 'undefined') {
  window.addEventListener('kvlr:content-updated', () => {
    megaMenuCache = null;
    inflightMegaFetch = null;
  });
}

// Strict Category Matcher to avoid substring collisions like 'women'.includes('men')
const findMatchingCategory = (allCats, targetKey) => {
  if (!allCats || allCats.length === 0 || !targetKey) return null;
  const key = String(targetKey).toLowerCase().trim();

  // 1. Exact ID or Exact Slug match
  let exact = allCats.find(c =>
    String(c.id || '').toLowerCase() === key ||
    String(c.slug || '').toLowerCase() === key
  );
  if (exact) return exact;

  // 2. Strict Men matching (MUST NOT contain 'women')
  if (key === 'men') {
    const menCat = allCats.find(c => {
      const s = String(c.slug || '').toLowerCase();
      const n = String(c.name || '').toLowerCase();
      const isWomen = s.includes('women') || n.includes('women');
      if (isWomen) return false;
      return s.includes('men') || n.includes('men') || s.includes('gent') || n.includes('gent');
    });
    if (menCat) return menCat;
  }

  // 3. Strict Women matching
  if (key === 'women') {
    const womenCat = allCats.find(c => {
      const s = String(c.slug || '').toLowerCase();
      const n = String(c.name || '').toLowerCase();
      return s.includes('women') || n.includes('women') || s.includes('saree') || n.includes('saree') || s.includes('lehenga') || n.includes('lehenga');
    });
    if (womenCat) return womenCat;
  }

  // 4. Strict Kids matching
  if (key === 'kids' || key === 'kid') {
    const kidsCat = allCats.find(c => {
      const s = String(c.slug || '').toLowerCase();
      const n = String(c.name || '').toLowerCase();
      return s.includes('kid') || n.includes('kid') || s.includes('child') || n.includes('child') || s.includes('boy') || s.includes('girl');
    });
    if (kidsCat) return kidsCat;
  }

  // 5. Strict Jewellery matching
  if (key === 'jewellery' || key === 'jewelry') {
    const jewCat = allCats.find(c => {
      const s = String(c.slug || '').toLowerCase();
      const n = String(c.name || '').toLowerCase();
      return s.includes('jewel') || n.includes('jewel') || s.includes('kundan') || n.includes('kundan') || s.includes('necklace') || n.includes('necklace');
    });
    if (jewCat) return jewCat;
  }

  // 6. Word boundary matching
  const wordMatch = allCats.find(c => {
    const sWords = String(c.slug || '').toLowerCase().split(/[^a-z0-9]+/);
    const nWords = String(c.name || '').toLowerCase().split(/[^a-z0-9]+/);
    return sWords.includes(key) || nWords.includes(key);
  });

  return wordMatch || null;
};

// Strict Subcategory Filter
const getMatchingSubcategories = (parent, allSubs, targetKey) => {
  if (parent) {
    if (Array.isArray(parent.subcategories) && parent.subcategories.length > 0) {
      return parent.subcategories;
    }
    const matched = allSubs.filter(s =>
      s.categoryId === parent.id ||
      s.category?.id === parent.id ||
      (s.category?.slug && s.category.slug.toLowerCase() === parent.slug?.toLowerCase())
    );
    if (matched.length > 0) return matched;
  }

  const key = String(targetKey || '').toLowerCase();
  return allSubs.filter(s => {
    const cName = String(s.category?.name || '').toLowerCase();
    const cSlug = String(s.category?.slug || '').toLowerCase();
    const sName = String(s.name || '').toLowerCase();
    const sSlug = String(s.slug || '').toLowerCase();

    if (key === 'men') {
      const isWomen = cName.includes('women') || cSlug.includes('women') || sName.includes('women') || sSlug.includes('women') || sName.includes('saree');
      if (isWomen) return false;
      return cName.includes('men') || cSlug.includes('men') || sName.includes('men') || sSlug.includes('men') || sName.includes('kurta') || sName.includes('shirt');
    }

    if (key === 'women') {
      return cName.includes('women') || cSlug.includes('women') || sName.includes('saree') || sName.includes('lehenga') || sName.includes('kurti');
    }

    return cName.includes(key) || cSlug.includes(key) || sName.includes(key) || sSlug.includes(key);
  });
};

const formatCategoryTitle = (category, parentCat) => {
  if (parentCat?.name) return parentCat.name;
  const raw = String(category || '').trim();
  if (raw.toLowerCase() === 'men') return "Men's Wear";
  if (raw.toLowerCase() === 'women') return "Women's Collection";
  if (raw.toLowerCase() === 'kids') return "Kids' Collection";
  if (raw.toLowerCase() === 'jewellery') return "Royal Jewellery";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const getCategorySlug = (catKey, parentCatObj) => {
  if (parentCatObj?.slug) return parentCatObj.slug;
  const k = String(catKey || '').toLowerCase().trim();
  if (k.includes('men') && !k.includes('women')) return 'mens-wear';
  if (k.includes('women')) return 'womens-wear';
  if (k.includes('kid')) return 'kids-wear';
  if (k.includes('jewel')) return 'jewellery';
  return k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const MegaMenu = ({ category, onMouseEnter, onMouseLeave, onClose }) => {
  const [subcategories, setSubcategories] = useState(() => {
    if (megaMenuCache) {
      const p = findMatchingCategory(megaMenuCache.allCats, category);
      return getMatchingSubcategories(p, megaMenuCache.allSubs, category);
    }
    return [];
  });
  const [parentCat, setParentCat] = useState(() => {
    if (megaMenuCache) {
      return findMatchingCategory(megaMenuCache.allCats, category);
    }
    return null;
  });
  const [loading, setLoading] = useState(!megaMenuCache);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const data = await fetchGlobalMegaData();
      if (!isMounted) return;

      const parent = findMatchingCategory(data.allCats, category);
      const subs = getMatchingSubcategories(parent, data.allSubs, category);

      setParentCat(parent);
      setSubcategories(subs);
      setLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [category]);

  const displayTitle = formatCategoryTitle(category, parentCat);
  const targetSlug = getCategorySlug(category, parentCat);

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const containerVariants = {
    hidden: { opacity: 0, y: -6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.15, ease: 'easeOut' },
    },
    exit: { opacity: 0, y: -6, transition: { duration: 0.1 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed left-0 right-0 z-50 bg-[#0D0D12]/98 backdrop-blur-2xl border-b border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] select-none"
      style={{ top: '64px' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="py-6 flex items-center justify-center gap-3 text-xs font-bold text-amber-400">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading {displayTitle}...</span>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            {/* Dynamic Subcategories Column */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
                <FiTag className="text-amber-400 w-3.5 h-3.5" />
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 font-serif">
                  {displayTitle}
                </h4>
              </div>

              {subcategories.length === 0 ? (
                <div className="py-4">
                  <p className="text-xs text-white/50 mb-3">Explore the full range of designer products in this collection.</p>
                  <Link
                    to={`/categories/${targetSlug}`}
                    onClick={handleLinkClick}
                    className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Browse All {displayTitle} Products <FiArrowRight size={12} />
                  </Link>
                </div>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {subcategories.map((sub) => (
                    <li key={sub.id || sub.slug}>
                      <Link
                        to={`/categories/${targetSlug}?sub=${sub.slug}`}
                        onClick={handleLinkClick}
                        className="group flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-all duration-150"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/40 group-hover:bg-amber-400 group-hover:scale-125 transition-all" />
                        <span className="truncate">{sub.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quick CTA Box */}
            <div className="w-full md:w-60 shrink-0 flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 shadow-inner">
              <div>
                <p className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider mb-1">Curated Luxury</p>
                <p className="text-sm font-bold text-white mb-2">{displayTitle}</p>
                <p className="text-[11px] text-white/50 leading-relaxed">Handcrafted elegance and premium styles tailored for you.</p>
              </div>
              <Link
                to={`/categories/${targetSlug}`}
                onClick={handleLinkClick}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs transition-all shadow-md cursor-pointer"
              >
                <span>View All {displayTitle}</span>
                <FiArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MegaMenu;

