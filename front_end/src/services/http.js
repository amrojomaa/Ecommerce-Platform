import axios from 'axios';
import API_BASE_URL, { AUTH_ENDPOINTS } from '../config/api';

const normalizeErrorDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        return null;
      })
      .filter(Boolean)
      .join(' | ');
  }
  if (typeof detail === 'object') {
    if (detail.msg) return String(detail.msg);
    return JSON.stringify(detail);
  }
  return String(detail);
};

const getRequestPath = (requestUrl) => {
  if (!requestUrl) return '';
  if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
    try {
      return new URL(requestUrl).pathname;
    } catch (_) {
      return requestUrl;
    }
  }
  return requestUrl.split('?')[0];
};

// Create axios instance
const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach token to requests
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
http.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const requestPath = getRequestPath(requestUrl);
      const authEndpoints = [
        AUTH_ENDPOINTS.LOGIN,
        AUTH_ENDPOINTS.SIGNUP,
        AUTH_ENDPOINTS.GOOGLE_AUTH,
        AUTH_ENDPOINTS.REFRESH_TOKEN,
        AUTH_ENDPOINTS.LOGOUT,
      ];
      const isAuthEndpoint = authEndpoints.some(
        (endpoint) => requestPath === endpoint || requestPath.endsWith(endpoint)
      );
      const hadToken = !!localStorage.getItem('token');
      const canUseRefreshToken = localStorage.getItem('auth_persistence') === 'persistent';
      const originalRequest = error.config || {};

      // Try to recover once by refreshing the access token via cookie.
      if (hadToken && canUseRefreshToken && !isAuthEndpoint && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshResponse = await axios.post(
            `${API_BASE_URL}${AUTH_ENDPOINTS.REFRESH_TOKEN}`,
            {},
            { withCredentials: true }
          );
          const newAccessToken = refreshResponse?.data?.access_token;
          if (newAccessToken) {
            localStorage.setItem('token', newAccessToken);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return http(originalRequest);
          }
        } catch (_) {
          // Fall through to the normal invalid-session handling.
        }
      }
      
      // Only handle token expiration (had token but got 401 on non-auth endpoints)
      // Don't interfere with login/signup attempts - let those errors pass through
      if (hadToken && !isAuthEndpoint) {
        // Token expired or invalid - clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth_persistence');
        sessionStorage.removeItem('session_auth_active');
        
        // Dispatch event to notify AuthContext about session invalidation
        window.dispatchEvent(new CustomEvent('session-invalidated', { 
          detail: { reason: 'Session expired or logged in from another device' } 
        }));
        
        // Only redirect if not already on auth pages
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/signup') {
          // Use setTimeout to allow event handlers to process first
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }
      }
      // If no token existed OR it's an auth endpoint, this is a login failure - let it pass through
    }
    
    // Unified error handling - preserve backend error messages
    const normalizedDetail = normalizeErrorDetail(error.response?.data?.detail);
    const fallbackMessage =
      typeof error.response?.data?.message === 'string' ? error.response.data.message : null;
    const errorMessage = normalizedDetail || fallbackMessage || error.message || 'An error occurred';
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
      response: error.response,
    });
  }
);

export default http;
