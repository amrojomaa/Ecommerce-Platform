import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdLanguage } from 'react-icons/md';
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
} from '../i18n/constants';
import '../styles/components/LanguageSwitcher.css';

const LanguageSwitcher = ({ compact = false, icon = false, className = '' }) => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  const handleLanguageChange = async (event) => {
    const nextLanguage = normalizeLanguageCode(event.target.value);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      // Ignore localStorage errors in restricted browsing mode.
    }
    await i18n.changeLanguage(nextLanguage);
  };

  const selectElement = (
    <select
      value={language}
      onChange={handleLanguageChange}
      aria-label={t('language.switcherAria')}
      className={`language-switcher-select ${icon ? 'language-switcher-select--icon' : ''}`.trim()}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {t(`language.option.${code}`)}
        </option>
      ))}
    </select>
  );

  if (icon) {
    return (
      <div className={`language-switcher language-switcher--icon ${className}`.trim()}>
        <span className="language-switcher-icon-shell" aria-hidden="true">
          <MdLanguage className="language-switcher-icon" />
        </span>
        {selectElement}
      </div>
    );
  }

  return (
    <div className={`language-switcher ${compact ? 'compact' : ''} ${className}`.trim()}>
      {!compact && <span className="language-switcher-label">{t('language.label')}</span>}
      {selectElement}
    </div>
  );
};

export default LanguageSwitcher;
