import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiArrowRight } from 'react-icons/fi';
import api from '../../config/api';
import ProductCard from '../common/ProductCard';

/**
 * RecommendedForYou Component
 * Renders personalized AI product recommendations on the homepage.
 * Uses real PostgreSQL product data only. Fallbacks seamlessly to popular picks if new user.
 */
const RecommendedForYou = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [reason, setReason] = useState('Recommended for You');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRecommendations = async () => {
      try {
        const res = await api.get('/ai/personalized?limit=8');
        if (isMounted && res.data?.success && res.data?.data?.products) {
          setRecommendations(res.data.data.products);
          if (res.data.data.reason) {
            setReason(res.data.data.reason);
          }
        }
      } catch (err) {
        console.warn('[RecommendedForYou] Fetch notice:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <section className="py-12 bg-black/40 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-48 bg-white/10 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-64 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="py-14 bg-gradient-to-b from-charcoal-950 to-black relative overflow-hidden border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              <FiZap className="w-3.5 h-3.5" /> AI Personalization
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Recommended For You
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {reason}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {recommendations.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecommendedForYou;
