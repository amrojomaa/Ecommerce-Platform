import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { DEFAULT_LANGUAGE, normalizeLanguageCode, SUPPORTED_LANGUAGES } from '../i18n/constants';
import { tUi } from '../i18n/uiText';

const LANGUAGE_STORAGE_KEY = 'app_language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const didHydrateRef = useRef(false);
  const userChangedLanguageRef = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          setLanguageState(normalizeLanguageCode(stored));
        }
        didHydrateRef.current = true;
      })
      .catch(() => {
        didHydrateRef.current = true;
      });
  }, []);

  useEffect(() => {
    const shouldUseRtl = language === 'ar';
    if (I18nManager.isRTL !== shouldUseRtl) {
      I18nManager.allowRTL(shouldUseRtl);
      I18nManager.forceRTL(shouldUseRtl);
      if (didHydrateRef.current && userChangedLanguageRef.current) {
        Toast.show({
          type: 'info',
          text1: tUi('ui.mobile.language.restartRequired', language),
        });
      }
    }
  }, [language]);

  const setLanguage = useCallback(async (languageCode) => {
    const normalized = normalizeLanguageCode(languageCode);
    userChangedLanguageRef.current = true;
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
