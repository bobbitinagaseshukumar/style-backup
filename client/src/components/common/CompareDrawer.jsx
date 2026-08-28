import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLayers, FiX, FiArrowRight, FiTrash2 } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { removeFromCompare, clearCompare } from '../../redux/compare/compareSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';

/**
 * Floating Compare Drawer Component
 * Appears at the bottom of the screen when products are selected for side-by-side comparison.
 * Max 4 items. Mobile responsive with 1-tap navigation to /compare.
 */
const CompareDrawer = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const compareItems = useSelector(state => state.compare?.items || []);

  if (compareItems.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-4xl bg-charcoal-950/95 border border-gold-500/30 backdrop-blur-2xl rounded-2xl p-3 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.8)] text-white flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        {/* Left Info & Thumbnails */}
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-white/10">
            <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/40 text-gold-400 flex items-center justify-center">
              <FiLayers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white whitespace-nowrap">Compare Products</h4>
              <span className="text-[10px] text-amber-400 font-semibold">{compareItems.length}/4 Selected</span>
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex items-center gap-2">
            {compareItems.map(item => {
              const imgUrl = item.images?.[0]?.url || item.image || (Array.isArray(item.images) ? item.images[0] : null);
              const formattedImg = formatImageUrl(imgUrl);
              const displayPrice = item.discountPrice || item.price;

              return (
                <div key={item.id} className="relative group shrink-0">
                  <img
                    src={formattedImg}
                    alt={item.name}
                    className="w-10 h-12 object-cover rounded-lg border border-white/20 bg-white/5"
                  />
                  <button
                    onClick={() => dispatch(removeFromCompare(item.id))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] shadow"
                    title="Remove"
                  >
                    <FiX />
                  </button>
                  <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-[9px] text-white px-2 py-1 rounded whitespace-nowrap z-50">
                    {item.name} ({formatCurrency(displayPrice)})
                  </div>
                </div>
              );
            })}

            {/* Empty slots placeholders */}
            {Array.from({ length: 4 - compareItems.length }).map((_, idx) => (
              <div
                key={idx}
                className="w-10 h-12 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-gray-500 text-[10px] shrink-0"
              >
                +{idx + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={() => dispatch(clearCompare())}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
          >
            <FiTrash2 className="w-3.5 h-3.5" /> Clear
          </button>

          <button
            onClick={() => navigate('/compare')}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-xs hover:from-gold-400 transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Compare Now ({compareItems.length})</span>
            <FiArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CompareDrawer;
