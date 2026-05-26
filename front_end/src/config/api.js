// API Configuration - Centralized endpoint management
// Update these endpoints to match your FastAPI backend routes

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/login',
  REFRESH_SESSION: '/refresh-session',
  REFRESH_TOKEN: '/refresh-token',
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

// Seller endpoints
export const SELLER_ENDPOINTS = {
  ORDERS: '/orders/seller',
  UPDATE_STATUS: '/orders/{order_id}/status',
};

export const INSTALLMENT_ENDPOINTS = {
  CREATE_REQUEST: '/installments/requests',
  MY_REQUESTS: '/installments/my',
  MY_REQUEST_BY_ID: '/installments/my/{request_id}',
  MY_UPDATE_REQUEST: '/installments/my/{request_id}',
  MY_CANCEL: '/installments/my/{request_id}/cancel',
  MY_MARK_PAID: '/installments/my/{request_id}/schedules/{schedule_id}/pay',
  MY_PAY_REMAINING: '/installments/my/{request_id}/pay-remaining',
  MY_UPSERT_DOCUMENT: '/installments/my/{request_id}/documents/{document_type}',
  MY_DELETE_DOCUMENT: '/installments/my/{request_id}/documents/{document_id}',
  ADMIN_REQUESTS: '/installments/admin/requests',
  ADMIN_REQUEST_BY_ID: '/installments/admin/requests/{request_id}',
  ADMIN_REVIEW: '/installments/admin/requests/{request_id}/review',
  ADMIN_CANCEL: '/installments/admin/requests/{request_id}/cancel',
  ADMIN_MARK_PAID: '/installments/admin/requests/{request_id}/schedules/{schedule_id}/pay',
};

// Point of sale (cashier / admin / employee)
export const POS_ENDPOINTS = {
  PRODUCTS: '/pos/products',
  PROMOTION_PREVIEW: '/pos/promotion-preview',
  SALE: '/pos/sale',
  SALES_TODAY: '/pos/sales/today',
  SALES_ALL_TODAY: '/pos/sales/all/today',
};

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
  UPDATE_BLOCK: '/users/{id}/block',
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

// Hybrid recommendations (logged-in only)
export const RECOMMENDATION_ENDPOINTS = {
  EVENTS: '/recommendations/events',
  REALTIME: '/recommendations/realtime',
  BATCH: '/recommendations/batch',
  RESET: '/recommendations/reset',
};

// Ticket endpoints
export const TICKET_ENDPOINTS = {
  CREATE: '/tickets/create',
  MY: '/tickets/my',
  ALL: '/tickets/all',
  ASSIGNED: '/tickets/assigned',
  UNASSIGNED: '/tickets/unassigned',
  CLAIM: '/tickets/{ticket_id}/claim',
  BY_ID: '/tickets/{ticket_id}',
  UPDATE: '/tickets/{ticket_id}',
  ASSIGN: '/tickets/{ticket_id}/assign',
  UPDATE_STATUS: '/tickets/{ticket_id}/status',
  ADD_RESPONSE: '/tickets/{ticket_id}/response',
  UNREAD_COUNT: '/tickets/unread/count',
  REQUEST_DELETE: '/tickets/{ticket_id}/request-delete',
  DELETE: '/tickets/{ticket_id}',
  PENDING_DELETES: '/tickets/pending-deletes',
  APPROVE_DELETE: '/tickets/{ticket_id}/approve-delete',
  REJECT_DELETE: '/tickets/{ticket_id}/reject-delete',
  CHAT_LIST: '/tickets/chat-list',
  CHAT_TICKET: '/tickets/{ticket_id}/chat-ticket',
  WS_CHAT: '/tickets/{ticket_id}/ws/chat',
};

// Comment endpoints
export const COMMENT_ENDPOINTS = {
  GET_PRODUCT: '/products/{product_id}/comments',
  CREATE: '/products/{product_id}/comments',
  UPDATE: '/comments/{comment_id}',
  DELETE: '/comments/{comment_id}',
  ALL: '/comments/all', // Admin only
  REPORT: '/comments/{comment_id}/report',
  APPROVE: '/comments/{comment_id}/approve',
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

// Customer feedback endpoints
export const FEEDBACK_ENDPOINTS = {
  ME: '/feedback/me',
  ALL: '/feedback/all', // Admin/Support Manager
};

// Admin Settings endpoints
export const ADMIN_SETTINGS_ENDPOINTS = {
  GET_LOW_STOCK_THRESHOLD: '/admin/settings/low-stock-threshold',
  UPDATE_LOW_STOCK_THRESHOLD: '/admin/settings/low-stock-threshold',
  GET_WAREHOUSE_ADDRESS: '/admin/settings/warehouse-address',
  UPDATE_WAREHOUSE_ADDRESS: '/admin/settings/warehouse-address',
};

// Warehouse endpoints (staff + manager)
export const WAREHOUSE_ENDPOINTS = {
  PREPARING_ORDERS: '/warehouse/orders/preparing',
  PACKED_ORDERS: '/warehouse/orders/packed',
  PACKED_REVIEW: '/warehouse/orders/packed-review',
  VERIFY_ITEM: '/warehouse/orders/{order_id}/verify',
  GET_VERIFICATIONS: '/warehouse/orders/{order_id}/verifications',
  PACK_ORDER: '/warehouse/orders/{order_id}/pack',
  APPROVE_ORDER: '/warehouse/orders/{order_id}/approve',
  REPORT_ISSUE: '/warehouse/orders/{order_id}/report-issue',
  ALL_ISSUES: '/warehouse/issues',
  RESOLVE_ISSUE: '/warehouse/issues/{issue_id}/resolve',
  UPDATE_STOCK: '/warehouse/products/{product_id}/stock',
};

// Delivery / Driver endpoints
export const DELIVERY_ENDPOINTS = {
  AVAILABLE_JOBS: '/delivery/available-jobs',
  ACCEPT_JOB: '/delivery/jobs/{job_id}/accept',
  DECLINE_JOB: '/delivery/jobs/{job_id}/decline',
  PICKUP_JOB: '/delivery/jobs/{job_id}/pickup',
  DELIVER_JOB: '/delivery/jobs/{job_id}/deliver',
  UPLOAD_PHOTO: '/delivery/jobs/{job_id}/photo',
  DELETE_PHOTO: '/delivery/jobs/{job_id}/photo',
  REVIEW_PHOTO: '/delivery/jobs/{job_id}/photo-review',
  REPORT_ISSUE: '/delivery/jobs/{job_id}/report-issue',
  ISSUE_MESSAGES: '/delivery/jobs/{job_id}/issue-messages',
  RESOLVE_ISSUE: '/delivery/jobs/{job_id}/issue/resolve',
  UPDATE_LOCATION: '/delivery/location',
  GET_LOCATION: '/delivery/location/{driver_id}',
  ACTIVE_JOBS: '/delivery/jobs/active',
  JOB_HISTORY: '/delivery/jobs/history',
  EARNINGS: '/delivery/earnings',
  EARNINGS_HISTORY: '/delivery/earnings/history',
  PAYOUT: '/delivery/earnings/payout',
  CREATE_JOB: '/delivery/create-job',
  ALL_JOBS: '/delivery/all-jobs',
  DRIVERS: '/delivery/drivers',
  ASSIGN_DRIVER: '/delivery/jobs/{job_id}/assign-driver',
  JOB_DETAILS: '/delivery/jobs/{job_id}/details',
  GET_CHAT: '/delivery/jobs/{job_id}/chat',
  SEND_CHAT: '/delivery/jobs/{job_id}/chat',
  CHAT_TICKET: '/delivery/jobs/{job_id}/chat-ticket',
  REACT_CHAT: '/delivery/jobs/{job_id}/chat/{message_id}/reactions',
  WS_CHAT: '/delivery/jobs/{job_id}/ws/chat',
  GET_JOB_BY_ORDER: '/delivery/jobs/by-order/{order_id}',
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
