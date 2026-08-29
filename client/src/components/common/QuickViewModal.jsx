import React, { useState } from 'react';
import Modal from './Modal';
import { FiShoppingBag, FiStar, FiZap, FiTruck, FiShield, FiCheck, FiHeart } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../redux/cart/cartSlice';
import { formatCurrency } from '../../utils/formatCurrency';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { formatImageUrl } from '../../utils/formatImageUrl';

const colorHexMap = {
  black: '#121212',
  blue: '#1E40AF',
  navy: '#1E3A8A',
  red: '#DC2626',
  maroon: '#800000',
  white: '#FFFFFF',
  green: '#15803D',
  emerald: '#059669',
  gold: '#D4AF37',
  yellow: '#EAB308',
  pink: '#EC4899',
  purple: '#7E22CE',
  grey: '#6B7280',
  gray: '#6B7280',
};

const getColorString = (c) => {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') return c.name || c.hex || c.color || '';
  return String(c);
};

const QuickViewModal = ({ isOpen, onClose, product }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (!product) return null;

  const rawImages = (() => {
    const list = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      product.images.forEach(img => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u) list.push(u);
      });
    }
    if (product.image) list.push(product.image);
    try {
      const parsed = typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors;
      if (Array.isArray(parsed)) {
        parsed.forEach(c => {
          if (Array.isArray(c?.images)) {
            c.images.forEach(img => {
              const u = typeof img === 'string' ? img : img?.url;
              if (u) list.push(u);
            });
          }
        });
      }
    } catch {}
    const unique = [...new Set(list)].map(url => formatImageUrl(url, product.name));
    if (unique.length > 0) return unique;
    return ['https://images.unsplash.com/photo-1542272604-780c36856d67?w=800'];
  })();

  const [selectedImg, setSelectedImg] = useState(rawImages[0]);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  const sizes = (() => {
    try {
      if (typeof product.sizes === 'string') return JSON.parse(product.sizes);
      return Array.isArray(product.sizes) ? product.sizes : [];
    } catch {
      return [];
    }
  })();

  const colors = (() => {
    try {
      if (typeof product.colors === 'string') return JSON.parse(product.colors);
      return Array.isArray(product.colors) ? product.colors : [];
    } catch {
      return [];
    }
  })();

  const firstColorStr = colors.length > 0 ? getColorString(colors[0]) : '';
  const activeColorDisplay = selectedColor || firstColorStr;

  const price = product.price || 0;
  const discountPrice = product.discountPrice || 0;
  const discountPercent = product.discountPercent || 0;
  const finalPrice = discountPrice > 0 ? discountPrice : price;

  const handleAddToCart = () => {
    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: finalPrice,
      image: selectedImg,
      size: selectedSize || (sizes[0] || ''),
      color: activeColorDisplay,
      quantity: 1,
      shippingFee: product.shippingFee || 0,
      freeShipping: product.freeShipping || false,
    }));
    toast.success(`"${product.name}" added to cart! 🛍️`);
    onClose();
  };

  const handleBuyNow = () => {
    // Store Buy Now item in sessionStorage — does NOT touch the cart
    sessionStorage.setItem('__KVLR_BUY_NOW_ITEM__', JSON.stringify({
      id: product.id,
      name: product.name,
      price: finalPrice,
      image: selectedImg,
      size: selectedSize || (sizes[0] || ''),
      color: activeColorDisplay,
      quantity: 1,
      shippingFee: product.shippingFee || 0,
      freeShipping: product.freeShipping || false,
    }));
    onClose();
    navigate('/checkout?buyNow=true');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick View Product Experience">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs p-2">
        {/* Gallery Area */}
        <div className="space-y-3">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 relative">
            <img src={selectedImg} alt={product.name} className="w-full h-full object-cover" />
            {discountPercent > 0 && (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase">
                -{discountPercent}% OFF
              </span>
            )}
          </div>

          {rawImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {rawImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImg(img)}
                  className={`w-14 h-16 rounded-xl overflow-hidden border-2 transition ${
                    selectedImg === img ? 'border-amber-500 scale-105' : 'border-gray-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details Area */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest block">
                {product.brand?.name || 'Styleverse'}
              </span>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h2>
            </div>

            {/* Ratings */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <FiStar key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <span className="font-black text-gray-900">4.8</span>
              <span className="text-gray-400">(128 reviews)</span>
            </div>

            {/* Pricing */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl font-black text-gray-900">{formatCurrency(finalPrice)}</span>
              {discountPercent > 0 && (
                <span className="text-sm text-gray-400 line-through">{formatCurrency(price)}</span>
              )}
            </div>

            {/* Short Description */}
            <p className="text-gray-600 line-clamp-3 leading-relaxed">
              {product.shortDesc || product.description || 'Luxury tailored craftsmanship built for supreme comfort and distinction.'}
            </p>

            {/* Color Selector */}
            {colors.length > 0 && (
              <div>
                <span className="font-bold text-gray-700 block mb-1.5 uppercase text-[10px]">
                  Colors: <span className="text-amber-600">{activeColorDisplay}</span>
                </span>
                <div className="flex gap-2">
                  {colors.map((c, i) => {
                    const cStr = getColorString(c);
                    const cLower = cStr.toLowerCase();
                    const hex = (typeof c === 'object' && c?.hex) ? c.hex : (colorHexMap[cLower] || (cLower.startsWith('#') ? cLower : '#6B7280'));
                    return (
                      <button
                        key={cStr + i}
                        onClick={() => setSelectedColor(cStr)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          activeColorDisplay === cStr ? 'ring-2 ring-amber-500 scale-110' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={cStr}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {sizes.length > 0 && (
              <div>
                <span className="font-bold text-gray-700 block mb-1.5 uppercase text-[10px]">
                  Select Size
                </span>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={typeof s === 'object' ? (s.size || s.name) : s}
                      onClick={() => setSelectedSize(typeof s === 'object' ? (s.size || s.name) : s)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                        selectedSize === (typeof s === 'object' ? (s.size || s.name) : s)
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {typeof s === 'object' ? (s.size || s.name || '') : String(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock & Delivery badges */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-semibold text-gray-600">
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 border border-gray-100">
                <FiTruck className="text-emerald-600 w-4 h-4" />
                <span>Free Express Delivery</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 border border-gray-100">
                <FiShield className="text-amber-600 w-4 h-4" />
                <span>100% Original Product</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
            <button
              onClick={handleAddToCart}
              className="py-3 rounded-xl bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <FiShoppingBag className="w-4 h-4" /> Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              className="py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold hover:from-amber-400 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <FiZap className="w-4 h-4" /> Buy Now
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default QuickViewModal;
