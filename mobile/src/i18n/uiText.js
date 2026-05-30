import { useCallback } from 'react';
import { DEFAULT_LANGUAGE, normalizeLanguageCode } from './constants';
import { useLanguage } from '../context/LanguageContext';
import en from './locales/en';
import ar from './locales/ar';
import fr from './locales/fr';

const LOCALES = { en, ar, fr };

const interpolate = (value, options = {}) => {
  if (!value || !options || typeof value !== 'string') {
    return value;
  }

  let result = value;
  Object.entries(options).forEach(([token, tokenValue]) => {
    result = result.replace(new RegExp(`\\{\\{${token}\\}\\}`, 'g'), String(tokenValue));
    result = result.replace(new RegExp(`\\{${token}\\}`, 'g'), String(tokenValue));
  });
  return result;
};

export const tUi = (key, languageCode = DEFAULT_LANGUAGE, options) => {
  const language = normalizeLanguageCode(languageCode);
  const strings = LOCALES[language] || LOCALES.en;
  const value = strings[key] ?? LOCALES.en[key] ?? key;
  return interpolate(value, options);
};

export const useTUi = () => {
  const { language } = useLanguage();
  return useCallback((key, options) => tUi(key, language, options), [language]);
};
