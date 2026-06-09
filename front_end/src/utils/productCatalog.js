import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';

const CACHE_TTL_MS = 60 * 1000;
const catalogCache = new Map();

const buildCacheKey = (endpoint, params = {}) =>
  `${endpoint}:${JSON.stringify(params)}`;

export const fetchProductCatalogPage = async ({ page = 1, pageSize = 12 } = {}) => {
  const params = { page, page_size: pageSize };
  const cacheKey = buildCacheKey(PRODUCT_ENDPOINTS.CATALOG, params);
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const response = await http.get(PRODUCT_ENDPOINTS.CATALOG, { params });
  catalogCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
};

export const fetchAllCatalogProducts = async () => {
  const cacheKey = buildCacheKey(PRODUCT_ENDPOINTS.ALL, { catalog_only: true });
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const response = await http.get(PRODUCT_ENDPOINTS.ALL, {
    params: { catalog_only: true },
  });
  catalogCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
};

export const invalidateProductCatalogCache = () => {
  catalogCache.clear();
};
