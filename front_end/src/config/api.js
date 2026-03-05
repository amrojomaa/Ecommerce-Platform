// API Configuration - Centralized endpoint management
// Update these endpoints to match your FastAPI backend routes

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  VERIFY_EMAIL: '/verify-email',
  GOOGLE_AUTH: '/auth/google',
  LOGOUT: '/logout', // If implemented
  FORGOT_PASSWORD: '/forgot-password',
  VERIFY_RESET_CODE: '/verify-reset-code',
  RESET_PASSWORD: '/reset-password',
};

// Product endpoints
export const PRODUCT_ENDPOINTS = {
  ALL: '/products/all',
  ALL_ADMIN: '/products/alladmin',
  BY_NAME: '/products/name/byuser',
  BY_ID: '/products/{id}',
  FILTER: '/products/filter',
  FILTER_USER: '/products/filter/user',
  FILTER_ADMIN: '/products/filter/admin',
  CREATE: '/products/create',
  UPDATE: '/products/{id}',
  DELETE: '/products/{id}',
};

// Cart endpoints
export const CART_ENDPOINTS = {
  ADD: '/addtocart',
  GET: '/showmecart',
  UPDATE: '/updatecart/{item_id}',
  DELETE_ITEM: '/deletecart/{item_id}',
  CLEAR: '/clearcart/{Cart_id}',
};

// Wishlist endpoints
export const WISHLIST_ENDPOINTS = {
  ADD: '/addtowishlist',
  GET: '/showmewishlist',
  DELETE_ITEM: '/deletewishlist/{item_id}',
};

// Order endpoints
export const ORDER_ENDPOINTS = {
  CHECKOUT: '/checkout',
  MY_ORDERS: '/orders/my',
  ALL_ORDERS: '/orders/all',
  CANCEL: '/orders/{order_id}/cancel',
  UPDATE_STATUS: '/orders/{order_id}/status',
};

// Payment endpoints
export const PAYMENT_ENDPOINTS = {
  CREATE_INTENT: '/payment/create-intent',
  CONFIRM: '/payment/confirm',
};

// Category endpoints
export const CATEGORY_ENDPOINTS = {
  ALL: '/Categories/all',
  BY_NAME: '/Categories/name',
  BY_ID: '/Categories/{id}',
  CREATE: '/Categories/create',
  UPDATE: '/Categories/{id}',
  DELETE: '/Categories/{id}',
};

// User endpoints
export const USER_ENDPOINTS = {
  ME: '/users/me/information',
  UPDATE_ME: '/users/me',
  UPLOAD_PROFILE_IMAGE: '/users/me/profile-image',
  DELETE_PROFILE_IMAGE: '/users/me/profile-image',
  ALL: '/users/all',
  BY_ID: '/users/{id}',
  UPDATE: '/users/{id}',
  UPDATE_ROLE: '/users/{id}/role',
  DELETE: '/users/{id}',
};

// Image upload endpoint
export const IMAGE_ENDPOINTS = {
  UPLOAD: '/image',
};

// AI Assistant endpoints
export const AI_ASSISTANT_ENDPOINTS = {
  CHAT: '/ai-assistant/chat',
  CLEAR: '/ai-assistant/chat/clear',
};

// Ticket endpoints
export const TICKET_ENDPOINTS = {
  CREATE: '/tickets/create',
  MY: '/tickets/my',
  ALL: '/tickets/all',
  ASSIGNED: '/tickets/assigned',
  BY_ID: '/tickets/{ticket_id}',
  ASSIGN: '/tickets/{ticket_id}/assign',
  UPDATE_STATUS: '/tickets/{ticket_id}/status',
  ADD_RESPONSE: '/tickets/{ticket_id}/response',
  UNREAD_COUNT: '/tickets/unread/count',
  REQUEST_DELETE: '/tickets/{ticket_id}/request-delete',
  DELETE: '/tickets/{ticket_id}',
  PENDING_DELETES: '/tickets/pending-deletes',
  APPROVE_DELETE: '/tickets/{ticket_id}/approve-delete',
  REJECT_DELETE: '/tickets/{ticket_id}/reject-delete',
};

// Comment endpoints
export const COMMENT_ENDPOINTS = {
  GET_PRODUCT: '/products/{product_id}/comments',
  CREATE: '/products/{product_id}/comments',
  DELETE: '/comments/{comment_id}',
  ALL: '/comments/all', // Admin only
  SENTIMENT_ANALYTICS: '/products/{product_id}/sentiment-analytics', // Admin only
  BACKFILL_SENTIMENT: '/comments/backfill-sentiment', // Admin only
};

// Rating endpoints
export const RATING_ENDPOINTS = {
  GET_PRODUCT: '/products/{product_id}/rating',
  CREATE_OR_UPDATE: '/products/{product_id}/rating',
  DELETE: '/products/{product_id}/rating',
  ALL: '/ratings/all', // Admin only
};

// Admin Settings endpoints
export const ADMIN_SETTINGS_ENDPOINTS = {
  GET_LOW_STOCK_THRESHOLD: '/admin/settings/low-stock-threshold',
  UPDATE_LOW_STOCK_THRESHOLD: '/admin/settings/low-stock-threshold',
};

// Helper function to replace path parameters
export const buildUrl = (endpoint, params = {}) => {
  let url = endpoint;
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  return url;
};

export default API_BASE_URL;
