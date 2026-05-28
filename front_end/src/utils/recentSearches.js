const RECENT_SEARCHES_PREFIX = 'recent_product_searches';
const MAX_RECENT_SEARCHES = 8;

const safeLocalStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write errors (private mode, quota, etc.)
  }
};

const getStorageKey = (userId) => `${RECENT_SEARCHES_PREFIX}:${userId || 'guest'}`;

const normalizeQuery = (query) => query.trim().replace(/\s+/g, ' ');

export const getRecentSearches = (userId) => {
  const raw = safeLocalStorageGet(getStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item === 'string' && item.trim());
  } catch {
    return [];
  }
};

export const addRecentSearch = (query, userId) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return;
  }

  const existing = getRecentSearches(userId).filter(
    (item) => item.toLowerCase() !== normalized.toLowerCase()
  );
  const next = [normalized, ...existing].slice(0, MAX_RECENT_SEARCHES);
  safeLocalStorageSet(getStorageKey(userId), JSON.stringify(next));
};

export const filterRecentSearches = (query, userId) => {
  const recent = getRecentSearches(userId);
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return recent;
  }

  const needle = normalized.toLowerCase();
  return recent.filter((item) => item.toLowerCase().includes(needle));
};
