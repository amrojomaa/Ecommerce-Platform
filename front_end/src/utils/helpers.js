// Utility helper functions
import { getLocaleForLanguage, getStoredLanguage, normalizeLanguageCode } from '../i18n/constants';

export const CURRENCY_STORAGE_KEY = 'preferred_currency';
export const EXCHANGE_RATES_STORAGE_KEY = 'usd_exchange_rates';
export const EXCHANGE_RATES_UPDATED_AT_KEY = 'usd_exchange_rates_updated_at';
export const DEFAULT_CURRENCY = 'USD';

export const SUPPORTED_CURRENCIES = {
  USD: {
    code: 'USD',
    stripeCode: 'usd',
    label: 'Dollar (USD)',
  },
  JOD: {
    code: 'JOD',
    stripeCode: 'jod',
    label: 'Jordanian Dinar (JOD)',
  },
  ILS: {
    code: 'ILS',
    stripeCode: 'ils',
    label: 'Israeli Shekel (ILS)',
  },
};

export const DEFAULT_EXCHANGE_RATES = {
  USD: 1,
  JOD: 0.709,
  ILS: 3.65,
};

const safeLocalStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const safeLocalStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Ignore localStorage write errors (private mode, quota, etc.)
  }
};

const getActiveUserId = () => {
  const rawUser = safeLocalStorageGet('user');
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser);
    const userId = parsed?.id;
    if (userId === null || userId === undefined) {
      return null;
    }
    return String(userId);
  } catch (error) {
    return null;
  }
};

export const getCurrencyStorageKey = (userId = getActiveUserId()) => {
  if (userId === null || userId === undefined || userId === '') {
    return CURRENCY_STORAGE_KEY;
  }
  return `${CURRENCY_STORAGE_KEY}_${userId}`;
};

export const normalizeCurrencyCode = (currencyCode) => {
  const normalized = String(currencyCode || '').toUpperCase();
  if (SUPPORTED_CURRENCIES[normalized]) {
    return normalized;
  }
  return DEFAULT_CURRENCY;
};

export const getCurrentCurrency = (userId = getActiveUserId()) => {
  const hasUser = userId !== null && userId !== undefined && userId !== '';
  const storageKey = getCurrencyStorageKey(userId);
  const storedCurrency = safeLocalStorageGet(storageKey);

  if (storedCurrency) {
    return normalizeCurrencyCode(storedCurrency);
  }

  // Keep logged-in accounts isolated: do not inherit any global/guest currency.
  if (hasUser) {
    return DEFAULT_CURRENCY;
  }

  return normalizeCurrencyCode(safeLocalStorageGet(CURRENCY_STORAGE_KEY));
};

export const setCurrentCurrency = (currencyCode, userId = getActiveUserId()) => {
  const normalized = normalizeCurrencyCode(currencyCode);
  safeLocalStorageSet(getCurrencyStorageKey(userId), normalized);
  return normalized;
};

export const getStoredExchangeRates = () => {
  const rawRates = safeLocalStorageGet(EXCHANGE_RATES_STORAGE_KEY);
  if (!rawRates) {
    return { ...DEFAULT_EXCHANGE_RATES };
  }

  try {
    const parsed = JSON.parse(rawRates);
    return {
      ...DEFAULT_EXCHANGE_RATES,
      ...parsed,
    };
  } catch (error) {
    return { ...DEFAULT_EXCHANGE_RATES };
  }
};

export const setStoredExchangeRates = (rates) => {
  const mergedRates = {
    ...DEFAULT_EXCHANGE_RATES,
    ...(rates || {}),
  };
  safeLocalStorageSet(EXCHANGE_RATES_STORAGE_KEY, JSON.stringify(mergedRates));
  safeLocalStorageSet(EXCHANGE_RATES_UPDATED_AT_KEY, new Date().toISOString());
  return mergedRates;
};

export const getExchangeRatesUpdatedAt = () => {
  return safeLocalStorageGet(EXCHANGE_RATES_UPDATED_AT_KEY);
};

export const getStripeCurrencyCode = (currencyCode = getCurrentCurrency()) => {
  const normalized = normalizeCurrencyCode(currencyCode);
  return SUPPORTED_CURRENCIES[normalized].stripeCode;
};

const getCurrencyFractionDigits = (currencyCode) => {
  const normalized = normalizeCurrencyCode(currencyCode);
  // Keep USD with cents, but round converted currencies (JOD/ILS) to whole values.
  if (normalized === 'USD') {
    return 2;
  }
  return 0;
};

const toNumeric = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return numericValue;
};

export const convertFromUSD = (
  amount,
  currencyCode = getCurrentCurrency(),
  exchangeRates = getStoredExchangeRates()
) => {
  const numericAmount = toNumeric(amount);
  const normalized = normalizeCurrencyCode(currencyCode);
  const rate = Number(exchangeRates?.[normalized]);
  if (!Number.isFinite(rate) || rate <= 0) {
    return numericAmount;
  }
  return numericAmount * rate;
};

export const roundCurrencyAmount = (amount, currencyCode = getCurrentCurrency()) => {
  const numericAmount = toNumeric(amount);
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  return Number(numericAmount.toFixed(fractionDigits));
};

export const formatPrice = (
  price,
  currencyCode = getCurrentCurrency(),
  exchangeRates = getStoredExchangeRates(),
  languageCode = getStoredLanguage()
) => {
  const normalized = normalizeCurrencyCode(currencyCode);
  const normalizedLanguage = normalizeLanguageCode(languageCode);
  const fractionDigits = getCurrencyFractionDigits(normalized);
  const convertedPrice = convertFromUSD(price, normalized, exchangeRates);
  const locale = getLocaleForLanguage(languageCode);

  // Arabic currency display overrides requested by product requirements:
  // USD => ($), JOD => (دينار)
  if (normalizedLanguage === 'ar') {
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(convertedPrice);

    if (normalized === 'USD') {
      return `${formattedNumber} $`;
    }
    if (normalized === 'JOD') {
      return `${formattedNumber} دينار`;
    }
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(convertedPrice);
};

export const getCurrentLocale = (languageCode = getStoredLanguage()) => {
  return getLocaleForLanguage(languageCode);
};

export const formatNumber = (value, options = {}, languageCode = getStoredLanguage()) => {
  const numericValue = toNumeric(value);
  return new Intl.NumberFormat(getCurrentLocale(languageCode), options).format(numericValue);
};

export const fetchLatestExchangeRates = async () => {
  const apiKey = (process.env.REACT_APP_EXCHANGE_RATE_API_KEY || '').trim();
  const endpoint = apiKey
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    : 'https://open.er-api.com/v6/latest/USD';

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('Unable to fetch exchange rates');
  }

  const payload = await response.json();
  const sourceRates = payload?.conversion_rates || payload?.rates;
  if (!sourceRates) {
    throw new Error('Invalid exchange rates response');
  }

  const normalizedRates = {
    USD: 1,
    JOD: Number(sourceRates.JOD) || DEFAULT_EXCHANGE_RATES.JOD,
    ILS: Number(sourceRates.ILS) || DEFAULT_EXCHANGE_RATES.ILS,
  };

  return {
    rates: normalizedRates,
    updatedAt: new Date().toISOString(),
  };
};

export const formatDate = (dateString, options = {}, languageCode = getStoredLanguage()) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(getCurrentLocale(languageCode), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(date);
};

export const formatDateTime = (dateString, options = {}, languageCode = getStoredLanguage()) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(getCurrentLocale(languageCode), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
};

export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const STRONG_PASSWORD_MIN_LENGTH = 9; // More than 8 characters

export const getPasswordValidationChecks = (password) => {
  const value = password || '';
  return {
    hasMinLength: value.length >= STRONG_PASSWORD_MIN_LENGTH,
    hasUpperAndLower: /[A-Z]/.test(value) && /[a-z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value),
  };
};

export const getPasswordStrengthProgress = (password) => {
  const checks = getPasswordValidationChecks(password);
  const completedRules = Object.values(checks).filter(Boolean).length;
  return completedRules * 25;
};

export const isStrongPassword = (password) => {
  const checks = getPasswordValidationChecks(password);
  return Object.values(checks).every(Boolean);
};

export const getStrongPasswordErrorMessage = () =>
  'Password does not satisfy the required security requirements.';

export const getApiBaseUrl = () => {
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000').trim();
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

export const getImageUrl = (imagePath) => {
  if (!imagePath) return '/placeholder-image.jpg';
  // If it's already a full URL, return it
  if (imagePath.startsWith('http')) return imagePath;
  // Otherwise, construct URL from API base
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
};

export const buildWebSocketUrl = (path, queryParams = {}) => {
  const apiBase = getApiBaseUrl();
  const normalizedPath = path?.startsWith('/') ? path : `/${path || ''}`;
  const httpUrl = new URL(`${apiBase}${normalizedPath}`);
  httpUrl.protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      httpUrl.searchParams.set(key, String(value));
    }
  });

  return httpUrl.toString();
};

export const PROFILE_AVATAR_DISPLAY_SIZE = 160;

export const DEFAULT_PROFILE_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMjQwIiB2aWV3Qm94PSIwIDAgMjQwIDI0MCIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMTIwIiBjeT0iMTIwIiByPSIxMjAiIGZpbGw9IiNlMmU4ZjAiLz48Y2lyY2xlIGN4PSIxMjAiIGN5PSI5MiIgcj0iMzYiIGZpbGw9IiM5NGE3YjgiLz48cGF0aCBkPSJNNDggMTg4YzgtMzYgNDAtNTYgNzItNTZzNjQgMjAgNzIgNTZIMzZDMzYgMTg4IDQ0IDE4OCA0OCAxODhaIiBmaWxsPSIjOTRhN2I4Ii8+PC9zdmc+';

export const enhanceRemoteProfileImageUrl = (url, displaySize = PROFILE_AVATAR_DISPLAY_SIZE) => {
  if (!url || typeof url !== 'string' || !url.includes('googleusercontent.com')) {
    return url;
  }

  const targetSize = Math.min(512, Math.max(160, Math.round(displaySize * 2)));

  if (/=s\d+(-c)?/.test(url)) {
    return url.replace(/=s\d+(-c)?/, `=s${targetSize}-c`);
  }

  if (/([?&])sz=\d+/.test(url)) {
    return url.replace(/([?&]sz=)\d+/, `$1${targetSize}`);
  }

  return url.includes('?') ? `${url}&sz=${targetSize}` : `${url}?sz=${targetSize}`;
};

export const resolveProfileImageUrl = (profileImage, options = {}) => {
  const {
    apiBaseUrl = getApiBaseUrl(),
    defaultImage = DEFAULT_PROFILE_IMAGE,
    displaySize = PROFILE_AVATAR_DISPLAY_SIZE,
    previewUrl = null,
  } = options;

  if (previewUrl) {
    return previewUrl;
  }

  if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
    return defaultImage;
  }

  if (profileImage.startsWith('data:')) {
    return profileImage;
  }

  if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
    return enhanceRemoteProfileImageUrl(profileImage, displaySize);
  }

  const normalizedPath = profileImage.startsWith('/') ? profileImage : `/${profileImage}`;
  return `${apiBaseUrl}${normalizedPath}`;
};
