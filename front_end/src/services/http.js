import axios from 'axios';
import API_BASE_URL from '../config/api';

// Create axios instance
const http = axios.create({
  baseURL: API_BASE_URL,
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
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/login') || requestUrl.includes('/signup');
      const hadToken = !!localStorage.getItem('token');
      
      // Only handle token expiration (had token but got 401 on non-auth endpoints)
      // Don't interfere with login/signup attempts - let those errors pass through
      if (hadToken && !isAuthEndpoint) {
        // Token expired or invalid - clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Only redirect if not already on auth pages
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/signup') {
          window.location.href = '/login';
        }
      }
      // If no token existed OR it's an auth endpoint, this is a login failure - let it pass through
    }
    
    // Unified error handling - preserve backend error messages
    const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
      response: error.response,
    });
  }
);

export default http;
