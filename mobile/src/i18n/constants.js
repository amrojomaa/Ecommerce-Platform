export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];

export const normalizeLanguageCode = (languageCode) => {
  const normalized = String(languageCode || '').toLowerCase().split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(normalized)) {
    return normalized;
  }
  return DEFAULT_LANGUAGE;
};
