import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import API_BASE_URL, { AUTH_ENDPOINTS } from '../config/api';

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
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: true,
});

const authEndpoints = [
  AUTH_ENDPOINTS.LOGIN,
  AUTH_ENDPOINTS.SIGNUP,
  AUTH_ENDPOINTS.GOOGLE_AUTH,
  AUTH_ENDPOINTS.REFRESH_SESSION,
  AUTH_ENDPOINTS.REFRESH_TOKEN,
  AUTH_ENDPOINTS.LOGOUT,
];

const isAuthRequestPath = (requestPath) =>
  authEndpoints.some((endpoint) => requestPath === endpoint || requestPath.endsWith(endpoint));

const setAuthorizationHeader = (config, token) => {
  if (typeof config.headers?.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
  } else {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }
};

const refreshAccessToken = async (oldToken) => {
  let storedRefreshToken = null;
  try {
    storedRefreshToken = await SecureStore.getItemAsync('refresh_token');
  } catch (_) {}

  const attempts = [];

  if (storedRefreshToken) {
    attempts.push({
      url: AUTH_ENDPOINTS.REFRESH_TOKEN,
      config: {
        headers: { Authorization: `Bearer ${storedRefreshToken}` },
      },
    });
  }

  if (oldToken) {
    attempts.push({
      url: AUTH_ENDPOINTS.REFRESH_SESSION,
      config: {
        headers: { Authorization: `Bearer ${oldToken}` },
      },
    });
  }

  attempts.push({
    url: AUTH_ENDPOINTS.REFRESH_TOKEN,
    config: { withCredentials: true },
  });

  for (const attempt of attempts) {
    try {
      const response = await axios.post(`${API_BASE_URL}${attempt.url}`, {}, attempt.config);
      const nextToken = response.data?.access_token;
      const nextRefreshToken = response.data?.refresh_token;
      if (nextToken) {
        await SecureStore.setItemAsync('token', nextToken);
        if (nextRefreshToken) {
          await SecureStore.setItemAsync('refresh_token', nextRefreshToken);
        }
        return nextToken;
      }
    } catch (_) {}
  }

  return null;
};

// Request interceptor - attach token to requests
http.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const requestPath = getRequestPath(config.url || '');
      const isAuthEndpoint = isAuthRequestPath(requestPath);

      if (token && !isAuthEndpoint) {
        setAuthorizationHeader(config, token);
      }
    } catch (_) {
      // SecureStore might not be available
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestMethod = error.config?.method?.toUpperCase?.() || 'REQUEST';
    const requestUrl = error.config?.url || '';

    if (error.response?.status === 401) {
      const requestPath = getRequestPath(requestUrl);
      const isAuthEndpoint = isAuthRequestPath(requestPath);

      let hadToken = false;
      let currentToken = null;
      try {
        currentToken = await SecureStore.getItemAsync('token');
        hadToken = !!currentToken;
      } catch (_) {}

      if (hadToken && !isAuthEndpoint && !error.config?._retryAuth) {
        const nextToken = await refreshAccessToken(currentToken);
        if (nextToken) {
          const retryConfig = {
            ...error.config,
            _retryAuth: true,
          };
          setAuthorizationHeader(retryConfig, nextToken);
          return http.request(retryConfig);
        }
      }

      const shouldClearToken =
        hadToken &&
        !isAuthEndpoint &&
        (
          error.response?.data?.detail === 'Session expired. Please login again.' ||
          error.response?.data?.detail === 'Could not validate credentials'
        );

      if (shouldClearToken) {
        try {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('refresh_token');
          await SecureStore.deleteItemAsync('user');
        } catch (_) {}
      }
    }

    const isSilentAuth = Boolean(error.config?._silentAuth);

    // Unified error handling
    const detail = error.response?.data?.detail;
    let errorMessage;
    if (typeof detail === 'string') {
      errorMessage = detail;
    } else if (Array.isArray(detail)) {
      errorMessage = detail
        .map((item) => (typeof item === 'string' ? item : item?.msg))
        .filter(Boolean)
        .join(' | ');
    } else if (detail?.msg) {
      errorMessage = String(detail.msg);
    } else {
      errorMessage = error.message || 'An error occurred';
    }

    if (!isSilentAuth && __DEV__) {
      console.error(
        `[API] ${requestMethod} ${requestUrl || 'unknown URL'} failed:`,
        error.response?.status || 'network',
        errorMessage
      );
    }

    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
      response: error.response,
    });
  }
);

export default http;
