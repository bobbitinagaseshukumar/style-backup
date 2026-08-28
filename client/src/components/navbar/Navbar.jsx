import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiHeart, FiUser, FiMenu, FiSearch,
  FiBell, FiChevronDown, FiX, FiLogOut, FiSettings,
  FiPackage, FiGrid, FiMapPin, FiStar, FiGift, FiBookmark, FiClock, FiRefreshCw
} from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import SearchBar from './SearchBar';
import MegaMenu from './MegaMenu';
import MobileMenu from './MobileMenu';
import MiniCart from '../cart/MiniCart';
import SearchOverlay from './SearchOverlay';
import AuthDrawer from '../auth/AuthDrawer';
import api from '../../config/api';

const DEFAULT_NAV_ITEMS = [
  { title: 'Home', link: '/' },
  { title: 'Women', link: '/categories/women', megaKey: 'women' },
  { title: 'Men', link: '/categories/men', megaKey: 'men' },
  { title: 'Kids', link: '/categories/kids', megaKey: 'kids' },
];

const Navbar = () => {
  const { storeSettings } = useSelector((state) => state.settings);
  const { isAuthenticated, user, logout } = useAuth();
  const cartItems = useSelector((state) => state.cart?.items || []);
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const notificationsCount = useSelector((state) => state.notification?.unreadCount || 0);

  // Overlay state — Single Drawer Guarantee
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  // Dynamic Header Navigation & Settings
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);
  const [headerSettings, setHeaderSettings] = useState(null);
  const [storeName, setStoreName] = useState('KVLR Styles');

  const navigate = useNavigate();
  const location = useLocation();
  const cartCount = cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const megaMenuTimeout = useRef(null);

  // Helper to open a specific drawer and close all others
  const openDrawer = (drawerName) => {
    setIsMobileMenuOpen(drawerName === 'mobile');
    setIsSearchOpen(drawerName === 'search');
    setIsAuthOpen(drawerName === 'auth');
    setIsMiniCartOpen(drawerName === 'cart');
    setIsUserMenuOpen(false);
    setActiveMegaMenu(null);
  };

  /* ── Auto-close all drawers & unlock body scroll on route change ── */
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
    setIsAuthOpen(false);
    setIsMiniCartOpen(false);
    setIsUserMenuOpen(false);
    setActiveMegaMenu(null);
    document.body.style.overflow = '';
  }, [location.pathname]);

  /* ── Scroll detection ──────────────────────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Fetch Dynamic Header Navigation & Settings ────────────── */
  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        const [menusRes, settingsRes, storeSettingsRes] = await Promise.allSettled([
          api.get('/cms/header-menus/public'),
          api.get('/cms/header-settings'),
          api.get('/cms/settings')
        ]);

        if (menusRes.status === 'fulfilled' && menusRes.value.data?.data?.length > 0) {
          const formatted = menusRes.value.data.data.map(m => ({
            id: m.id,
            title: m.title,
            link: m.link || `/categories/${m.slug}`,
            megaKey: m.slug,
            subcategories: m.subcategories || []
          }));
          setNavItems([{ title: 'Home', link: '/' }, ...formatted]);
        }

        if (settingsRes.status === 'fulfilled' && settingsRes.value.data?.data) {
          setHeaderSettings(settingsRes.value.data.data);
        }

        if (storeSettingsRes.status === 'fulfilled' && storeSettingsRes.value.data?.data?.storeName) {
          setStoreName(storeSettingsRes.value.data.data.storeName);
        }
      } catch (err) {
        console.error('Failed to load dynamic header data:', err);
      }
    };
    fetchHeaderData();

    window.addEventListener('kvlr:content-updated', fetchHeaderData);
    return () => window.removeEventListener('kvlr:content-updated', fetchHeaderData);
  }, []);



  /* ── Close user menu on outside click/tap & escape key ─────── */
  const userBtnRef = useRef(null);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeOutside = (e) => {
      // Skip if clicking the toggle button (it handles its own toggle)
      if (userBtnRef.current && userBtnRef.current.contains(e.target)) return;
      // Skip if clicking inside the dropdown (menu items close themselves)
      if (userDropdownRef.current && userDropdownRef.current.contains(e.target)) return;
      // Anything else = outside = close now
      setIsUserMenuOpen(false);
      setActiveMegaMenu(null);
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setActiveMegaMenu(null);
      }
    };

    // mousedown + touchstart = works on ALL devices instantly
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('touchstart', closeOutside, { passive: true });
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('touchstart', closeOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  /* ── Close MegaMenu on outside click/tap anywhere ──────────── */
  const navbarRef = useRef(null);

  useEffect(() => {
    if (!activeMegaMenu) return;

    const closeOutsideMega = (e) => {
      if (navbarRef.current && !navbarRef.current.contains(e.target)) {
        setActiveMegaMenu(null);
      }
    };

    document.addEventListener('mousedown', closeOutsideMega);
    document.addEventListener('touchstart', closeOutsideMega, { passive: true });

    return () => {
      document.removeEventListener('mousedown', closeOutsideMega);
      document.removeEventListener('touchstart', closeOutsideMega);
    };
  }, [activeMegaMenu]);

  /* ── Mega Menu hover handlers ──────────────────────────────── */
  const openMega = (name) => {
    clearTimeout(megaMenuTimeout.current);
    setActiveMegaMenu(name);
  };
  const closeMega = () => {
    megaMenuTimeout.current = setTimeout(() => setActiveMegaMenu(null), 150);
  };
  const keepMega = () => clearTimeout(megaMenuTimeout.current);

  const announcementText = headerSettings?.announcementText;
  const announcementEnabled = Boolean(headerSettings?.announcementEnabled && announcementText && announcementText.trim() && showAnnouncement);

  const userName = (user?.fullName || user?.name || user?.email?.split('@')[0] || 'Customer').trim();
  const firstWord = userName.split(' ')[0] || userName;
  const rawAvatar = user?.avatar || user?.photo;
  const isDefaultAvatarUrl = rawAvatar && (rawAvatar.includes('googleusercontent.com') || rawAvatar.includes('ui-avatars.com'));
  const userAvatar = isDefaultAvatarUrl ? null : rawAvatar;
  const userInitial = firstWord.charAt(0).toUpperCase() || 'C';

  return (
    <>
      {/* ── STICKY HEADER WRAPPER (Guarantees zero overlap on mobile/desktop) ── */}
      <header ref={navbarRef} className="sticky top-0 z-50 w-full transition-all duration-300">
        {/* Top Announcement Banner (Only rendered if admin published an active announcement) */}
        <AnimatePresence>
          {announcementEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                backgroundColor: headerSettings?.announcementBgColor || '#0A0A0E',
                color: headerSettings?.announcementTextColor || '#FBBF24'
              }}
              className="w-full px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-center flex items-center justify-between border-b border-amber-500/20 shadow-sm"
            >
              <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
                <FiStar className="w-3.5 h-3.5 animate-pulse shrink-0 text-amber-400" />
                <span className="truncate text-amber-200">{announcementText}</span>
              </div>
              <button
                onClick={() => setShowAnnouncement(false)}
                className="p-1 rounded-full hover:bg-white/10 transition text-current opacity-70 hover:opacity-100 cursor-pointer ml-2 shrink-0"
                aria-label="Dismiss Announcement"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Navbar Bar */}
        <nav
          className={`
            w-full transition-all duration-300
            ${scrolled
              ? 'bg-[#0D0D12]/95 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.6)] border-b border-white/10'
              : 'bg-[#0D0D12]/90 backdrop-blur-xl border-b border-white/5'
            }
          `}
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-18 transition-all duration-300">

              {/* Mobile Hamburger Menu Button */}
              <button
                className="lg:hidden text-white/80 hover:text-amber-400 transition-colors p-2 -ml-1.5 rounded-xl hover:bg-white/5 cursor-pointer shrink-0"
                onClick={() => openDrawer('mobile')}
                aria-label="Open menu"
              >
                <FiMenu className="w-6 h-6" />
              </button>

              {/* Logo (Dynamic Store Name) */}
              <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group relative py-1 shrink-0">
                <motion.div
                  whileHover={{ rotate: 12, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center text-black font-black text-base shadow-lg shadow-amber-500/20 shrink-0"
                >
                  {storeName.charAt(0).toUpperCase()}
                </motion.div>
                <motion.span
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.2 }}
                  className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center shrink-0 leading-none"
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 font-bold">
                    {storeName}
                  </span>
                </motion.span>
              </Link>

              {/* Desktop Navigation Links */}
              <div className="hidden lg:flex items-center gap-1.5 self-center">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.link;
                  return (
                    <div
                      key={item.title}
                      className="relative flex items-center"
                      onMouseEnter={() => item.megaKey ? openMega(item.megaKey) : null}
                      onMouseLeave={() => item.megaKey ? closeMega() : null}
                    >
                      <Link
                        to={item.link}
                        onClick={() => setActiveMegaMenu(null)}
                        className={`
                          relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 group
                          ${activeMegaMenu === item.megaKey || isActive
                            ? 'text-amber-400 font-bold'
                            : 'text-white/80 hover:text-white'}
                        `}
                      >
                        <span>{item.title}</span>
                        {item.subcategories?.length > 0 && (
                          <motion.span
                            animate={{ rotate: activeMegaMenu === item.megaKey ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <FiChevronDown size={12} className="opacity-70 group-hover:text-amber-400 transition-colors" />
                          </motion.span>
                        )}
                        
                        {/* Animated Gold Underline */}
                        {(isActive || activeMegaMenu === item.megaKey) && (
                          <motion.div
                            layoutId="navbar-underline"
                            className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Right Action Icons & Auth */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">

                {/* Search Button */}
                {headerSettings?.searchVisible !== false && (
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => openDrawer('search')}
                    className="p-2 sm:p-2 rounded-xl text-white/70 hover:text-amber-400 hover:bg-white/5 transition-all cursor-pointer shrink-0 flex items-center justify-center h-9 w-9"
                    aria-label="Search"
                  >
                    <FiSearch className="w-5 h-5 sm:w-[18px] sm:h-[18px]" />
                  </motion.button>
                )}

                {/* Wishlist Button */}
                {headerSettings?.wishlistVisible !== false && (
                  <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="shrink-0 flex items-center">
                    <Link
                      to={isAuthenticated ? "/wishlist" : "/login"}
                      className="relative p-2 sm:p-2 rounded-xl text-white/70 hover:text-red-400 hover:bg-white/5 transition-all flex items-center justify-center h-9 w-9"
                      aria-label="Wishlist"
                    >
                      <FiHeart className="w-5 h-5 sm:w-[18px] sm:h-[18px]" />
                      <AnimatePresence>
                        {wishlistItems.length > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-lg"
                          >
                            {wishlistItems.length > 9 ? '9+' : wishlistItems.length}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </motion.div>
                )}

                {/* Cart Drawer Button */}
                {headerSettings?.cartVisible !== false && (
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                      } else {
                        openDrawer('cart');
                      }
                    }}
                    className="relative p-2 sm:p-2 rounded-xl text-white/70 hover:text-amber-400 hover:bg-white/5 transition-all cursor-pointer shrink-0 flex items-center justify-center h-9 w-9"
                    aria-label="Cart"
                  >
                    <FiShoppingBag className="w-5 h-5 sm:w-[18px] sm:h-[18px]" />
                    <AnimatePresence>
                      {cartCount > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-lg"
                        >
                          {cartCount > 9 ? '9+' : cartCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )}

                {/* Notifications Button (Desktop only) */}
                {isAuthenticated && headerSettings?.notificationVisible !== false && (
                  <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="hidden md:flex items-center shrink-0">
                    <Link
                      to="/notifications"
                      className="relative p-2 sm:p-2 rounded-xl text-white/70 hover:text-amber-400 hover:bg-white/5 transition-all flex items-center justify-center h-9 w-9"
                      aria-label="Notifications"
                    >
                      <FiBell className="w-5 h-5 sm:w-[18px] sm:h-[18px]" />
                      {notificationsCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-amber-400 text-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                          {notificationsCount}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                )}

                {/* User Account Button & Dropdown */}
                {headerSettings?.profileVisible !== false && (
                  <div className="relative shrink-0 ml-1 flex items-center">
                    {isAuthenticated ? (
                      <motion.button
                        ref={userBtnRef}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setIsUserMenuOpen(!isUserMenuOpen);
                          setActiveMegaMenu(null);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-amber-400/40 hover:border-amber-400 shadow-sm shrink-0 h-9 justify-center"
                        aria-label="Account menu"
                      >
                        {userAvatar ? (
                          <img
                            src={userAvatar}
                            alt={userName}
                            className="w-6 h-6 rounded-lg object-cover border border-amber-400/50 shadow shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black text-[11px] font-black shadow shrink-0">
                            {userInitial}
                          </div>
                        )}
                        <span className="hidden md:inline text-xs font-bold text-white/90 max-w-[80px] truncate leading-none">
                          {firstWord}
                        </span>
                        <FiChevronDown size={12} className={`hidden sm:block text-white/60 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => navigate('/login')}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black text-xs font-extrabold shadow-md transition-all cursor-pointer border border-amber-300/50 shrink-0 min-h-[34px] sm:min-h-[36px]"
                        aria-label="Sign In"
                      >
                        <FiUser size={14} className="shrink-0" />
                        <span className="hidden sm:inline">Sign In</span>
                      </motion.button>
                    )}

                    {/* USER PROFILE DROPDOWN MENU — No AnimatePresence to avoid click blocking */}
                    {isAuthenticated && isUserMenuOpen && (
                      <div
                        ref={userDropdownRef}
                        className="absolute right-0 top-full mt-2 w-64 bg-[#111116] border border-white/10 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.8)] overflow-hidden z-[100] text-xs"
                        style={{ animation: 'fadeInDropdown 0.12s ease-out' }}
                      >
                        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                          <p className="text-sm font-bold text-white truncate">{userName}</p>
                          <p className="text-xs text-white/50 truncate">{user?.email}</p>
                          <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-400/10 text-amber-400 border border-amber-400/30">
                            {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? '⚡ ADMIN' : '⭐ CUSTOMER'}
                          </div>
                        </div>

                        <div className="py-1">
                          {[
                            { label: 'Dashboard', icon: FiGrid, path: '/dashboard' },
                            { label: 'My Orders', icon: FiPackage, path: '/orders' },
                            { label: 'Recently Viewed', icon: FiClock, path: '/recently-viewed' },
                            { label: 'Address Book', icon: FiMapPin, path: '/address-book' },
                            { label: 'Wishlist', icon: FiHeart, path: '/wishlist' },
                            { label: 'Profile Settings', icon: FiUser, path: '/profile' },
                            { label: 'Notifications', icon: FiBell, path: '/notifications' },
                          ].map((item) => (
                            <div
                              key={item.label}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                setActiveMegaMenu(null);
                                navigate(item.path);
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 text-white/80 hover:text-white hover:bg-white/5 transition-colors cursor-pointer select-none"
                            >
                              <item.icon size={14} className="text-amber-400/80 shrink-0" />
                              <span className="font-semibold">{item.label}</span>
                            </div>
                          ))}
                        </div>

                        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.isAdmin) && (
                          <div className="border-t border-white/10 py-1">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                setActiveMegaMenu(null);
                                navigate('/admin/dashboard');
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 text-amber-400 hover:bg-amber-400/10 font-bold transition-colors cursor-pointer select-none"
                            >
                              <FiSettings size={14} className="shrink-0" />
                              Super Admin Panel
                            </div>
                          </div>
                        )}

                        <div className="border-t border-white/10 p-1 space-y-1">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              logout();
                              navigate('/login?switch=true');
                            }}
                            className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-400/10 font-bold text-xs transition-colors cursor-pointer select-none"
                          >
                            <FiRefreshCw size={14} className="shrink-0" />
                            Switch Account
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              logout();
                            }}
                            className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 font-bold text-xs transition-colors cursor-pointer select-none"
                          >
                            <FiLogOut size={14} className="shrink-0" />
                            Sign Out
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Mega Menu Panel ───────────────────────────────────── */}
      <AnimatePresence>
        {activeMegaMenu && (
          <MegaMenu
            category={activeMegaMenu}
            onMouseEnter={keepMega}
            onMouseLeave={closeMega}
            onClose={() => setActiveMegaMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* Backdrop when mega menu is open */}
      <AnimatePresence>
        {activeMegaMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            style={{ top: scrolled ? '64px' : '80px' }}
            onClick={() => setActiveMegaMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Auth Drawer (Sign In & Register) ── */}
      <AuthDrawer isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* ── Predictive Live Search Overlay ── */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* ── MiniCart Drawer ── */}
      <MiniCart isOpen={isMiniCartOpen} onClose={() => setIsMiniCartOpen(false)} />

      {/* ── Mobile Drawer ── */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
};

export default Navbar;
