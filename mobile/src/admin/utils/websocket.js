import API_BASE_URL from '../../config/api';

export const buildWebSocketUrl = (path, queryParams = {}) => {
  const normalizedPath = path?.startsWith('/') ? path : `/${path || ''}`;
  const httpUrl = new URL(`${API_BASE_URL}${normalizedPath}`);
  httpUrl.protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      httpUrl.searchParams.set(key, String(value));
    }
  });

  return httpUrl.toString();
};
