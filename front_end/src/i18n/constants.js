export const LANGUAGE_STORAGE_KEY = 'preferred_language';
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
export const RTL_LANGUAGES = ['ar'];

export const LANGUAGE_LOCALES = {
  en: 'en-US',
  fr: 'fr-FR',
  // Keep Arabic UI/date names, but render digits as 0-9.
  ar: 'ar-SA-u-nu-latn',
};

const safeGetLocalStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

export const normalizeLanguageCode = (languageCode) => {
  const normalized = String(languageCode || '').toLowerCase().split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(normalized)) {
    return normalized;
  }
  return DEFAULT_LANGUAGE;
};

export const getStoredLanguage = () => {
  const stored = safeGetLocalStorage(LANGUAGE_STORAGE_KEY);
  return normalizeLanguageCode(stored);
};

export const getLocaleForLanguage = (languageCode = getStoredLanguage()) => {
  const normalized = normalizeLanguageCode(languageCode);
  return LANGUAGE_LOCALES[normalized] || LANGUAGE_LOCALES[DEFAULT_LANGUAGE];
};

export const isRtlLanguage = (languageCode = getStoredLanguage()) => {
  return RTL_LANGUAGES.includes(normalizeLanguageCode(languageCode));
};
