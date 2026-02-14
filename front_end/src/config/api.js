// API Configuration - Centralized endpoint management
// Update these endpoints to match your FastAPI backend routes

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  LOGOUT: '/logout', // If implemented
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

// Order endpoints
export const ORDER_ENDPOINTS = {
  CHECKOUT: '/checkout',
  MY_ORDERS: '/orders/my',
  DELETE: '/orders/{order_id}',
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
  ALL: '/users/all',
  BY_ID: '/users/{id}',
  UPDATE: '/users/{id}',
  DELETE: '/users/{id}',
};

// Image upload endpoint
export const IMAGE_ENDPOINTS = {
  UPLOAD: '/image',
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
