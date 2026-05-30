import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_LANGUAGE, normalizeLanguageCode, SUPPORTED_LANGUAGES } from '../i18n/constants';

const LANGUAGE_STORAGE_KEY = 'app_language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          setLanguageState(normalizeLanguageCode(stored));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const shouldUseRtl = language === 'ar';
    if (I18nManager.isRTL !== shouldUseRtl) {
      I18nManager.allowRTL(shouldUseRtl);
      I18nManager.forceRTL(shouldUseRtl);
    }
  }, [language]);

  const setLanguage = useCallback(async (languageCode) => {
    const normalized = normalizeLanguageCode(languageCode);
    setLanguageState(normalized);
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, normalized);
    } catch (_) {}
  }, []);

  const value = useMemo(
    () => ({
      language,
      isRtl: language === 'ar',
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
