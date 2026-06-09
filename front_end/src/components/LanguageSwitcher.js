import React, { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  const handleLanguageChange = async (nextLanguage) => {
    const normalized = normalizeLanguageCode(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch (error) {
      // Ignore localStorage errors in restricted browsing mode.
    }
    await i18n.changeLanguage(normalized);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  if (icon) {
    return (
      <div
        ref={rootRef}
        className={`language-switcher language-switcher--icon ${menuOpen ? 'is-open' : ''} ${className}`.trim()}
      >
        <button
          type="button"
          className="language-switcher-icon-btn"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t('language.switcherAria')}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MdLanguage className="language-switcher-icon" aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="language-switcher-menu" role="menu">
            {SUPPORTED_LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={language === code}
                className={`language-switcher-option ${language === code ? 'is-active' : ''}`.trim()}
                onClick={() => handleLanguageChange(code)}
              >
                {t(`language.option.${code}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const handleSelectChange = async (event) => {
    await handleLanguageChange(event.target.value);
  };

  const selectElement = (
    <select
      value={language}
      onChange={handleSelectChange}
      aria-label={t('language.switcherAria')}
      className="language-switcher-select"
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {t(`language.option.${code}`)}
        </option>
      ))}
    </select>
  );

  return (
    <div className={`language-switcher ${compact ? 'compact' : ''} ${className}`.trim()}>
      {!compact && <span className="language-switcher-label">{t('language.label')}</span>}
      {selectElement}
    </div>
  );
};

export default LanguageSwitcher;
