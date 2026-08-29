import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../config/api';

const DEFAULT_BRANDS = [
  { id: 'b1', name: 'Styleverse Couture', logoUrl: '👑' },
  { id: 'b2', name: 'Royal Heritage', logoUrl: '💎' },
  { id: 'b3', name: 'Silk Weavers Guild', logoUrl: '🥻' },
  { id: 'b4', name: 'Kundan Artisan House', logoUrl: '✨' },
  { id: 'b5', name: 'Imperial Jewels', logoUrl: '🏆' },
];

const BrandShowcase = () => {
  const [brands, setBrands] = useState([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandRes, setRes] = await Promise.allSettled([
          api.get('/cms/heritage-brands/public'),
          api.get('/cms/settings'),
        ]);

        if (setRes.status === 'fulfilled') {
          const cfg = setRes.value.data?.data || {};
          if (cfg.enableHeritageBrands === false) {
            setEnabled(false);
            return;
          }
        }

        if (brandRes.status === 'fulfilled' && brandRes.value.data?.success) {
          setBrands(brandRes.value.data.data || []);
        }
      } catch (err) {
        console.error('Brand showcase error:', err);
      }
    };
    fetchData();
  }, []);

  if (!enabled || brands.length === 0) return null;

  return (
    <section className="py-12 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-black mb-2 border border-amber-200">
            👑 LUXURY HERITAGE & ARTISANS
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal-900">
            Featured Heritage Brands
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {brands.map((brand) => (
            <motion.a
              key={brand.id}
              href={brand.website || '#'}
              whileHover={{ y: -4 }}
              className="bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {brand.bannerUrl && (
                  <div className="aspect-[2/1] rounded-xl overflow-hidden mb-3 bg-gray-900 border">
                    <img src={brand.bannerUrl} alt={brand.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  {brand.logoUrl ? (
                    <img src={brand.logoUrl} alt={brand.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-cover border bg-white shrink-0" />
                  ) : (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center text-base shrink-0">👑</div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors">{brand.name}</h3>
                    {brand.category && <p className="text-[10px] text-amber-700 font-semibold">{brand.category}</p>}
                  </div>
                </div>

                {brand.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{brand.description}</p>}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200/60 text-right">
                <span className="text-xs font-extrabold text-amber-600 group-hover:underline">
                  {brand.buttonText || 'Shop Now'} →
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandShowcase;
