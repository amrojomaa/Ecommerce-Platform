import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import arTranslation from '../locales/ar/common.json';
import enTranslation from '../locales/en/common.json';
import frTranslation from '../locales/fr/common.json';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
} from './constants';
import { patchToastTranslations } from './patchToastTranslations';

const resources = {
  en: { translation: enTranslation },
  fr: { translation: frTranslation },
  ar: { translation: arTranslation },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    load: 'languageOnly',
    defaultNS: 'translation',
    keySeparator: false,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

const activeLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
if (activeLanguage !== i18n.language) {
  i18n.changeLanguage(activeLanguage);
}

patchToastTranslations();

export default i18n;
