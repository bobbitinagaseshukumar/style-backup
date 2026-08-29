import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiChevronRight, FiHome, FiGrid, FiUser, FiShoppingBag, FiHeart, FiLogOut, FiPackage, FiClock } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';

const MobileMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { categories } = useSelector((state) => state.category);
  const { storeSettings } = useSelector((state) => state.settings);
  const { isAuthenticated, user, logout } = useAuth();
  const navRef = useRef(null);
  const menuScrollPos = useRef(0);
  const storeName = storeSettings?.storeName || 'Styleverse';

  const handleNavClick = (path) => {
    onClose();
    document.body.style.overflow = '';
    if (window.location.pathname !== path) {
      navigate(path);
    }
  };

  // Lock body scroll when open & restore drawer scroll position
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (navRef.current) {
        navRef.current.scrollTop = menuScrollPos.current;
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const mainLinks = [
    { name: 'Home', path: '/', icon: FiHome },
    { name: 'All Categories', path: '/categories', icon: FiGrid },
    { name: 'Recently Viewed', path: '/recently-viewed', icon: FiClock },
    { name: 'Wishlist', path: '/wishlist', icon: FiHeart },
    { name: 'Cart', path: '/cart', icon: FiShoppingBag },
  ];

  const accountLinks = isAuthenticated
    ? [
        { name: 'My Dashboard', path: '/dashboard', icon: FiUser },
        { name: 'My Orders', path: '/orders', icon: FiPackage },
        { name: 'Profile', path: '/profile', icon: FiUser },
      ]
    : [];

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden"
          />

          {/* Drawer */}
          <div
            className="fixed inset-y-0 left-0 w-[300px] max-w-[85vw] bg-[#0D0D0D] z-50 flex flex-col h-full lg:hidden shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-bold text-sm">
                  {storeName.charAt(0).toUpperCase()}
                </div>
                <span className="text-lg font-bold text-white font-serif">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 font-bold">{storeName}</span>
                </span>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav
              ref={navRef}
              onScroll={(e) => { menuScrollPos.current = e.target.scrollTop; }}
              className="flex-1 overflow-y-auto py-4 px-3 space-y-1"
            >
              {/* Main Links */}
              {mainLinks.map((link) => (
                <button
                  key={link.name}
                  type="button"
                  onClick={(e) => handleNavClick(link.path, e)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer touch-manipulation"
                >
                  <link.icon className="w-5 h-5 text-yellow-400/70 pointer-events-none" />
                  <span className="text-sm font-medium pointer-events-none">{link.name}</span>
                </button>
              ))}

              {/* Categories Section */}
              {categories?.length > 0 && (
                <div className="pt-4 mt-2 border-t border-white/10">
                  <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Shop by Category</p>
                  {categories.slice(0, 10).map((cat) => (
                    <button
                      key={cat.id || cat._id}
                      type="button"
                      onClick={(e) => handleNavClick(`/categories/${cat.slug}`, e)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer touch-manipulation"
                    >
                      <span className="text-sm pointer-events-none">{cat.name}</span>
                      <FiChevronRight className="h-3.5 w-3.5 text-white/20 pointer-events-none" />
                    </button>
                  ))}
                </div>
              )}

              {/* Account Links */}
              {accountLinks.length > 0 && (
                <div className="pt-4 mt-2 border-t border-white/10">
                  <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">My Account</p>
                  {accountLinks.map((link) => (
                    <button
                      key={link.name}
                      type="button"
                      onClick={(e) => handleNavClick(link.path, e)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer touch-manipulation"
                    >
                      <link.icon className="w-4 h-4 text-yellow-400/70 pointer-events-none" />
                      <span className="text-sm pointer-events-none">{link.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>

            {/* Bottom Auth Area */}
            <div className="p-4 border-t border-white/10 space-y-2">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black text-sm font-bold shrink-0">
                      {(user?.fullName?.trim()?.[0] || user?.name?.trim()?.[0] || 'S').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{user?.fullName || user?.name || 'Customer'}</p>
                      <p className="text-[11px] text-white/40 truncate">{user?.email}</p>
                    </div>
                  </div>
                  {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.isAdmin) && (
                    <Link
                      to="/admin/dashboard"
                      onClick={onClose}
                      className="block w-full py-2.5 text-center rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm font-bold hover:bg-amber-400/20 transition"
                    >
                      🔒 Super Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); onClose(); }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-red-400 text-sm font-medium hover:bg-red-500/10 transition cursor-pointer"
                  >
                    <FiLogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={onClose}
                    className="block w-full py-3 text-center rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-sm font-bold hover:from-yellow-400 transition shadow-lg"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login?mode=register"
                    onClick={onClose}
                    className="block w-full py-2.5 text-center rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition"
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileMenu;
