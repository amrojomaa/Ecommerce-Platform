import * as Linking from 'expo-linking';

// API Configuration - Centralized endpoint management.
// In Expo Go, use the same LAN host as Metro and switch only the port to FastAPI.
const getExpoLanHost = () => {
  try {
    const expoUrl = Linking.createURL('');
    const host = expoUrl.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/:]+)/)?.[1];
    if (host && !['localhost', '127.0.0.1'].includes(host)) {
      return host;
    }
  } catch (_) {}
  return null;
};

const API_HOST = getExpoLanHost() || '192.168.1.8';
const API_BASE_URL = `http://${API_HOST}:8000`;

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/login',
  REFRESH_SESSION: '/refresh-session',
  REFRESH_TOKEN: '/refresh-token',
  SIGNUP: '/signup',
  VERIFY_EMAIL: '/verify-email',
  GOOGLE_AUTH: '/auth/google',
  LOGOUT: '/logout',
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
  UPDATE_DISCOUNT: '/products/{id}/discount',
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
  UPDATE_BLOCK: '/users/{id}/block',
  DELETE: '/users/{id}',
};

// Image upload endpoint
export const IMAGE_ENDPOINTS = {
  UPLOAD: '/image',
};

// Admin Settings endpoints
export const ADMIN_SETTINGS_ENDPOINTS = {
  GET_LOW_STOCK_THRESHOLD: '/admin/settings/low-stock-threshold',
  UPDATE_LOW_STOCK_THRESHOLD: '/admin/settings/low-stock-threshold',
  GET_WAREHOUSE_ADDRESS: '/admin/settings/warehouse-address',
  UPDATE_WAREHOUSE_ADDRESS: '/admin/settings/warehouse-address',
};

// Delivery / Driver endpoints
export const DELIVERY_ENDPOINTS = {
  AVAILABLE_JOBS: '/delivery/available-jobs',
  ALL_JOBS: '/delivery/all-jobs',
  DRIVERS: '/delivery/drivers',
  CREATE_JOB: '/delivery/create-job',
  ISSUE_MESSAGES: '/delivery/jobs/{job_id}/issue-messages',
  RESOLVE_ISSUE: '/delivery/jobs/{job_id}/issue/resolve',
  REVIEW_PHOTO: '/delivery/jobs/{job_id}/photo-review',
  ASSIGN_DRIVER: '/delivery/jobs/{job_id}/assign-driver',
};

// Installment endpoints
export const INSTALLMENT_ENDPOINTS = {
  ADMIN_REQUESTS: '/installments/admin/requests',
  ADMIN_REQUEST_BY_ID: '/installments/admin/requests/{request_id}',
  ADMIN_REVIEW: '/installments/admin/requests/{request_id}/review',
  ADMIN_CANCEL: '/installments/admin/requests/{request_id}/cancel',
  ADMIN_MARK_PAID: '/installments/admin/requests/{request_id}/schedules/{schedule_id}/pay',
};

// Promotion endpoints
export const PROMOTION_ENDPOINTS = {
  LIST: '/promotions',
  ACTIVE: '/promotions/active',
  CREATE: '/promotions',
  UPDATE: '/promotions/{promotion_id}',
  DELETE: '/promotions/{promotion_id}',
  SET_ACTIVE: '/promotions/{promotion_id}/active',
  PRODUCT_OPTIONS: '/promotions/products/options',
  CATEGORY_OPTIONS: '/promotions/categories/options',
};

// Discount endpoints
export const DISCOUNT_ENDPOINTS = {
  UPDATE: '/products/{id}/discount',
};

// Ticket endpoints
export const TICKET_ENDPOINTS = {
  ALL: '/tickets/all',
  BY_ID: '/tickets/{ticket_id}',
  ASSIGN: '/tickets/{ticket_id}/assign',
  UPDATE_STATUS: '/tickets/{ticket_id}/status',
  ADD_RESPONSE: '/tickets/{ticket_id}/response',
  DELETE: '/tickets/{ticket_id}',
  REQUEST_DELETE: '/tickets/{ticket_id}/request-delete',
  PENDING_DELETES: '/tickets/pending-deletes',
  APPROVE_DELETE: '/tickets/{ticket_id}/approve-delete',
  REJECT_DELETE: '/tickets/{ticket_id}/reject-delete',
  UNREAD_COUNT: '/tickets/unread/count',
};

// Comment endpoints
export const COMMENT_ENDPOINTS = {
  ALL: '/comments/all',
  GET_PRODUCT: '/products/{product_id}/comments',
  APPROVE: '/comments/{comment_id}/approve',
  DELETE: '/comments/{comment_id}',
  SENTIMENT_ANALYTICS: '/products/{product_id}/sentiment-analytics',
};

export const RATING_ENDPOINTS = {
  GET_PRODUCT: '/products/{product_id}/rating',
};

// Feedback endpoints
export const FEEDBACK_ENDPOINTS = {
  ALL: '/feedback/all',
};

// POS endpoints
export const POS_ENDPOINTS = {
  SALES_ALL_TODAY: '/pos/sales/all/today',
};

// Helper function to replace path parameters
export const buildUrl = (endpoint, params = {}) => {
  let url = endpoint;
  Object.keys(params).forEach((key) => {
    url = url.replace(`{${key}}`, params[key]);
  });
  return url;
};

export default API_BASE_URL;
