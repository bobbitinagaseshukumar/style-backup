import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL.replace(/\/$/, '');
    return url.endsWith('/api/v1') ? url : `${url}/api/v1`;
  }
  // Production fallback to live Render backend
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://style-backup.onrender.com/api/v1';
  }
  return '/api/v1';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // 30 second timeout — prevents infinite "Processing..." spinner
});

/* ─────────── Retry Logic for Network Failures ─────────── */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500; // 1.5s base delay (doubles each retry)

// Only retry on network errors or 5xx, not on 4xx client errors
const isRetryable = (error) => {
  if (!error.response) return true; // Network error / timeout
  return error.response.status >= 500; // Server errors
};

// Only auto-retry safe (idempotent) methods
const isSafeMethod = (config) => {
  const method = (config.method || 'get').toLowerCase();
  return ['get', 'head', 'options'].includes(method);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ─────────── Request Interceptor ─────────── */
api.interceptors.request.use(
  (config) => {
    // Initialize retry count
    if (config.__retryCount === undefined) {
      config.__retryCount = 0;
    }

    const adminToken = localStorage.getItem('adminToken');
    const token = localStorage.getItem('token');
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    // On Admin panel routes (/admin/*), use adminToken (fallback to token)
    // On Customer storefront routes, use token (fallback to adminToken only if token absent)
    const authHeader = isAdminPath ? (adminToken || token) : (token || adminToken);
    if (authHeader) {
      config.headers.Authorization = `Bearer ${authHeader}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ─────────── Response Interceptor with Retry ─────────── */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Auto-retry logic for safe GET requests on network/server errors
    if (
      config &&
      config.__retryCount < MAX_RETRIES &&
      isSafeMethod(config) &&
      isRetryable(error)
    ) {
      config.__retryCount += 1;
      const delay = RETRY_DELAY_MS * Math.pow(2, config.__retryCount - 1); // Exponential backoff
      console.info(`[API] Retry ${config.__retryCount}/${MAX_RETRIES} for ${config.url} in ${delay}ms`);
      await sleep(delay);
      return api(config);
    }

    // 401 Token handling — Clear invalid or dead tokens to prevent perpetual 401 loops
    if (error.response && error.response.status === 401) {
      const message = (error.response.data?.message || '').toLowerCase();
      const isTokenPermanentlyDead = message.includes('session has expired') ||
                                     message.includes('no token') ||
                                     message.includes('please log in') ||
                                     message.includes('token failed') ||
                                     message.includes('not authorized') ||
                                     message.includes('jwt') ||
                                     message.includes('invalid') ||
                                     message.includes('user belonging to this token no longer exists');
      if (isTokenPermanentlyDead) {
        const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
        if (isAdminPath) {
          localStorage.removeItem('adminToken');
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('adminToken');
        }
      }
    }

    // Enhance error message for user-friendly display
    if (!error.response && error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timed out. Please check your internet connection and try again.';
    } else if (!error.response) {
      error.userMessage = 'Network error. Please check your internet connection.';
    }

    return Promise.reject(error);
  }
);

export default api;
