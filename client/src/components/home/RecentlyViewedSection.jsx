import React, { useEffect, useState, useCallback } from 'react';
import { FiClock, FiTrash2 } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import api from '../../config/api';
import ProductCard from '../common/ProductCard';
import { getLocalRecentlyViewed, clearLocalRecentlyViewed } from '../../utils/recentlyViewed';

/**
 * RecentlyViewedSection — Recently viewed products for ALL users.
 * - Logged-in users: fetches from server database (per-account, synced across devices)
 * - Guest users: reads from localStorage (local-only tracking)
 * - Listens for 'kvlr:recently-viewed-updated' event to refresh after viewing a product
 */
const RecentlyViewedSection = ({ currentId }) => {
  const user = useSelector(state => state.auth?.user);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      if (user) {
        // Logged-in user: fetch from server
        const res = await api.get('/recently-viewed');
        if (res.data?.success && Array.isArray(res.data?.data)) {
          let items = res.data.data;
          if (currentId) items = items.filter(p => p.id !== currentId);
          setProducts(items);
        } else {
          // Fallback to localStorage
          const local = getLocalRecentlyViewed();
          if (currentId) setProducts(local.filter(p => (p.id || p._id) !== currentId));
          else setProducts(local);
        }
      } else {
        // Guest user: read from localStorage
        const local = getLocalRecentlyViewed();
        if (currentId) setProducts(local.filter(p => (p.id || p._id) !== currentId));
        else setProducts(local);
      }
    } catch (e) {
      // On any error, fall back to localStorage
      const local = getLocalRecentlyViewed();
      if (currentId) setProducts(local.filter(p => (p.id || p._id) !== currentId));
      else setProducts(local);
    }
    setLoaded(true);
  }, [user, currentId]);

  useEffect(() => {
    fetchProducts();

    // Listen for product view events to refresh the list
    const handleUpdate = () => {
      // Small delay to allow server to save the record first
      setTimeout(fetchProducts, 500);
    };
    window.addEventListener('kvlr:recently-viewed-updated', handleUpdate);
    return () => window.removeEventListener('kvlr:recently-viewed-updated', handleUpdate);
  }, [fetchProducts]);

  const handleClearHistory = async () => {
    try {
      if (user) {
        await api.delete('/recently-viewed');
      }
      clearLocalRecentlyViewed();
      setProducts([]);
    } catch (err) {
      clearLocalRecentlyViewed();
      setProducts([]);
    }
  };

  // Don't show section if not loaded yet or no products
  if (!loaded || products.length === 0) return null;

  return (
    <section className="my-12 py-8 bg-gray-50/80 rounded-3xl border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center justify-between border-b border-gray-200/60 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <FiClock className="w-5 h-5 text-gold-600" />
          <div>
            <h2 className="text-xl font-serif font-bold text-charcoal-900">Recently Viewed Products</h2>
            <p className="text-xs text-gray-500">Pick up right where you left off</p>
          </div>
        </div>
        <button
          onClick={handleClearHistory}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 font-semibold transition cursor-pointer"
        >
          <FiTrash2 size={13} /> Clear History
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
        {products.slice(0, 8).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export default RecentlyViewedSection;
