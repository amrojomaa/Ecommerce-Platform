import { tUi } from "../i18n/uiText";import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/Footer.css';

const Footer = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();

  return (
    <footer className={`footer ${isDarkMode ? 'dark' : ''}`}>
      <div className="footer-container">
        <div className="footer-section">
          <h3>{t("app.brand")}</h3>
          <p>{t("footer.tagline")}</p>
        </div>
        
        <div className="footer-section">
          <h4>{t("footer.quickLinks")}</h4>
          <Link to="/products">{t("footer.products")}</Link>
          <Link to="/">{t("footer.home")}</Link>
        </div>
        
        <div className="footer-section">
          <h4>{t("footer.account")}</h4>
          <Link to="/login">{t("footer.login")}</Link>
          <Link to="/signup">{t("footer.signup")}</Link>
        </div>
        
        <div className="footer-section">
          <h4>{t("footer.contact")}</h4>
          <p>{tUi("ui.layouts.footer.emailSupportEcommerceCom_16f807ab9c")}</p>
          <p>{tUi("ui.layouts.footer.phone15551234567_edaa809632")}</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()} {t("app.brand")}. {t("footer.rights")}
        </p>
      </div>
    </footer>);

};

export default Footer;
