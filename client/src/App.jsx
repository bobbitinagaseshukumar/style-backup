import React, { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NetworkStatus from './components/common/NetworkStatus';
import { getMe, logoutUser } from './redux/auth/authSlice';
import { fetchStoreSettings } from './redux/settings/settingsSlice';
import { fetchServerCart } from './redux/cart/cartSlice';
import { fetchServerWishlist } from './redux/wishlist/wishlistSlice';

// Session expires after 90 days of total INACTIVITY (never while actively using the site)
const SESSION_MAX_INACTIVE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const ACTIVITY_KEY = 'kvlr_last_activity';
const ADMIN_ACTIVITY_KEY = 'kvlr_admin_last_activity';

const App = () => {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const retryCount = useRef(0);

  // Track user activity — update timestamp on meaningful interactions
  const updateActivity = useCallback(() => {
    const now = Date.now().toString();
    localStorage.setItem(ACTIVITY_KEY, now);
    if (localStorage.getItem('adminToken')) {
      localStorage.setItem(ADMIN_ACTIVITY_KEY, now);
    }
  }, []);

  // Check if session has been inactive for more than 4 days
  const checkInactivityLogout = useCallback(() => {
    const isAdminPath = window.location.pathname.startsWith('/admin');
    const activityKey = isAdminPath ? ADMIN_ACTIVITY_KEY : ACTIVITY_KEY;
    const lastActivity = localStorage.getItem(activityKey);

    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > SESSION_MAX_INACTIVE_MS) {
        console.info('[Session] Auto-logout: inactive for', Math.round(elapsed / 86400000), 'days');
        if (isAdminPath) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem(ADMIN_ACTIVITY_KEY);
          window.location.href = '/admin/login';
        } else {
          dispatch(logoutUser());
        }
        return true; // session expired
      }
    } else {
      updateActivity();
    }
    return false; // session still valid
  }, [dispatch, updateActivity]);

  // Fetch user profile with retry on failure
  useEffect(() => {
    const activeToken = token || localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (!activeToken) {
      retryCount.current = 0;
      return;
    }

    // Check 4-day inactivity first
    if (checkInactivityLogout()) return;

    // Update activity timestamp (user is actively loading the app)
    updateActivity();

    const fetchProfile = async () => {
      const result = await dispatch(getMe());
      if (getMe.rejected.match(result) && retryCount.current < 2) {
        // Retry after a short delay (server might be waking up on Render)
        retryCount.current += 1;
        console.info(`[Auth] getMe failed, retrying (${retryCount.current}/2)...`);
        setTimeout(() => {
          dispatch(getMe());
        }, retryCount.current * 2000); // 2s, then 4s
      } else if (getMe.fulfilled.match(result)) {
        retryCount.current = 0;
      }
    };

    fetchProfile();
    dispatch(fetchServerCart());
    dispatch(fetchServerWishlist());
  }, [dispatch, token, checkInactivityLogout, updateActivity]);

  // Re-validate session when user returns to the tab (window focus)
  useEffect(() => {
    const handleFocus = () => {
      if (checkInactivityLogout()) return;
      // User is back — refresh their profile and update activity
      const currentToken = localStorage.getItem('token') || localStorage.getItem('adminToken');
      if (currentToken) {
        updateActivity();
        dispatch(getMe());
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [dispatch, checkInactivityLogout, updateActivity]);

  // Track user activity on meaningful interactions (throttled)
  useEffect(() => {
    let lastUpdate = 0;
    const throttledActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) { // Update at most once per minute
        lastUpdate = now;
        updateActivity();
      }
    };

    window.addEventListener('click', throttledActivity);
    window.addEventListener('keydown', throttledActivity);
    window.addEventListener('scroll', throttledActivity, { passive: true });

    return () => {
      window.removeEventListener('click', throttledActivity);
      window.removeEventListener('keydown', throttledActivity);
      window.removeEventListener('scroll', throttledActivity);
    };
  }, [updateActivity]);

  const { storeSettings } = useSelector((state) => state.settings || {});

  // Fetch global store settings on app boot and sync dynamically
  useEffect(() => {
    dispatch(fetchStoreSettings());

    const handleSettingsUpdate = () => {
      dispatch(fetchStoreSettings());
    };

    window.addEventListener('settings_updated', handleSettingsUpdate);
    window.addEventListener('kvlr:content-updated', handleSettingsUpdate);

    // Pre-warm live backend instance in background
    try {
      fetch('https://style-backup.onrender.com/api/v1/health', { mode: 'no-cors' }).catch(() => {});
    } catch (e) {}

    return () => {
      window.removeEventListener('settings_updated', handleSettingsUpdate);
      window.removeEventListener('kvlr:content-updated', handleSettingsUpdate);
    };
  }, [dispatch]);

  // Synchronize document title, meta tags, and custom SEO tags when storeSettings update
  useEffect(() => {
    if (storeSettings?.metaTitle) {
      document.title = storeSettings.metaTitle;
    } else if (storeSettings?.storeName) {
      document.title = `${storeSettings.storeName} | Luxury Fashion & Jewellery`;
    }

    // Dynamic Meta Description
    if (storeSettings?.metaDescription) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = storeSettings.metaDescription;
    }

    // Dynamic Meta Keywords
    if (storeSettings?.metaKeywords) {
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.name = 'keywords';
        document.head.appendChild(metaKeywords);
      }
      metaKeywords.content = storeSettings.metaKeywords;
    }

    // Dynamic Custom SEO Tags
    if (storeSettings?.customSeoTags) {
      try {
        const tags = typeof storeSettings.customSeoTags === 'string'
          ? JSON.parse(storeSettings.customSeoTags)
          : storeSettings.customSeoTags;
        if (Array.isArray(tags)) {
          // Remove previously injected custom tags
          document.querySelectorAll('[data-kvlr-custom-seo]').forEach(el => el.remove());

          tags.filter(t => t.enabled).forEach(tag => {
            const meta = document.createElement('meta');
            meta.setAttribute(tag.type || 'name', tag.key);
            meta.content = tag.value;
            meta.setAttribute('data-kvlr-custom-seo', 'true');
            document.head.appendChild(meta);
          });
        }
      } catch (e) {}
    }
  }, [storeSettings]);

  return (
    <ErrorBoundary>
      <NetworkStatus />
      <AppRoutes />
    </ErrorBoundary>
  );
};

export default App;
