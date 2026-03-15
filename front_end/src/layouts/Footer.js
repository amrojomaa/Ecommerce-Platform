import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import '../styles/layouts/Footer.css';

const Footer = () => {
  const { isDarkMode } = useTheme();
  const { isArabic, toggleLanguage, t } = useLanguage();

  return (
    <footer className={`footer ${isDarkMode ? 'dark' : ''}`}>
      <div className="footer-container">
        <div className="footer-section">
          <h3>{t('brand', 'E-Commerce')}</h3>
          <p>{t('footerTagline', 'Your trusted online shopping destination')}</p>
        </div>
        
        <div className="footer-section">
          <h4>{t('quickLinks', 'Quick Links')}</h4>
          <Link to="/products">{t('products', 'Products')}</Link>
          <Link to="/">{t('brand', 'E-Commerce')}</Link>
        </div>
        
        <div className="footer-section">
          <h4>{t('account', 'Account')}</h4>
          <Link to="/login">{t('login', 'Login')}</Link>
          <Link to="/signup">{t('signUp', 'Sign Up')}</Link>
        </div>
        
        <div className="footer-section">
          <h4>{t('contact', 'Contact')}</h4>
          <p>Email: support@ecommerce.com</p>
          <p>Phone: +1 (555) 123-4567</p>
          <button
            type="button"
            className="language-switch-btn"
            onClick={toggleLanguage}
            aria-label={t('language', 'Language')}
            title={t('language', 'Language')}
          >
            {isArabic ? 'EN' : 'AR'}
          </button>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()} {t('brand', 'E-Commerce')}. {t('allRightsReserved', 'All rights reserved.')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
