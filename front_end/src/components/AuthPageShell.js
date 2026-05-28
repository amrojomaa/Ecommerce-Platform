import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { FaArrowRight } from 'react-icons/fa';
import LoadingSpinner from './LoadingSpinner';
import { tUi } from '../i18n/uiText';

const GoogleIcon = () => (
  <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="#000" fillRule="evenodd">
      <path
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
        fill="#EA4335"
      />
      <path
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.07-1.84 2.68l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.38z"
        fill="#4285F4"
      />
      <path
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
        fill="#FBBC05"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z"
        fill="#34A853"
      />
    </g>
  </svg>
);

export const AuthDivider = () => (
  <div className="auth-split-divider" role="separator">
    <span>{tUi('ui.common.or')}</span>
  </div>
);

export const AuthGoogleButton = ({ onClick, loading, disabled, label, loadingLabel }) => (
  <motion.button
    type="button"
    onClick={onClick}
    className="page-btn-secondary auth-split-google-btn"
    disabled={disabled || loading}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    {loading ? (
      <>
        <LoadingSpinner size="small" />
        {loadingLabel}
      </>
    ) : (
      <>
        <GoogleIcon />
        {label}
      </>
    )}
  </motion.button>
);

export const AuthPasswordField = ({
  id,
  name,
  label,
  labelExtra,
  value,
  onChange,
  showPassword,
  onTogglePassword,
  error,
  placeholder,
  required = false,
  children,
}) => (
  <div className="auth-split-field">
    {labelExtra ? (
      <div className="auth-split-field-label-row">
        <label htmlFor={id}>{label}</label>
        {labelExtra}
      </div>
    ) : (
      <label htmlFor={id}>{label}</label>
    )}
    <div className="auth-split-password-wrap">
      <input
        type={showPassword ? 'text' : 'password'}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className={error ? 'auth-split-input is-error' : 'auth-split-input'}
        autoComplete={name === 'confirmPassword' ? 'new-password' : name === 'password' ? 'new-password' : 'current-password'}
      />
      <button
        type="button"
        className="auth-split-password-toggle"
        onClick={onTogglePassword}
        aria-label={
          showPassword
            ? tUi('ui.pages.login.hidePassword_34503b95bb')
            : tUi('ui.pages.login.showPassword_e3faa6cab8')
        }
      >
        {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
      </button>
    </div>
    {children}
    {error ? <span className="auth-split-error">{error}</span> : null}
  </div>
);

const AuthPageShell = ({
  pageClassName,
  wide = false,
  hero,
  panel,
  children,
  footer,
}) => (
  <div className={`page-shell page-shell--storefront auth-split-page ${pageClassName || ''}`}>
    <motion.div
      className={`auth-split-layout${wide ? ' auth-split-layout--wide' : ''}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <aside className="auth-split-hero" aria-label={hero.title}>
        <div className="auth-split-hero-inner">
          <span className="auth-split-hero-kicker">{hero.kicker}</span>
          <h1 className="auth-split-hero-title">{hero.title}</h1>
          <p className="auth-split-hero-subtitle">{hero.subtitle}</p>
          {hero.benefits?.length ? (
            <ul className="auth-split-benefits">
              {hero.benefits.map((benefit) => (
                <li key={benefit.label}>
                  <span className="auth-split-benefit-icon" aria-hidden="true">
                    {benefit.icon}
                  </span>
                  <div className="auth-split-benefit-copy">
                    <strong>{benefit.label}</strong>
                    {benefit.description ? <span>{benefit.description}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {hero.cta ? (
            <Link to={hero.cta.to} className="auth-split-hero-cta">
              {hero.cta.label}
              <FaArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </aside>

      <section className={`auth-split-panel${wide ? ' auth-split-panel--wide' : ''}`}>
        <header className="auth-split-panel-header">
          <span className="page-kicker">{panel.kicker}</span>
          <h2 className="auth-split-panel-title">{panel.title}</h2>
          {panel.subtitle ? <p className="auth-split-panel-subtitle">{panel.subtitle}</p> : null}
        </header>

        <div className="auth-split-panel-body">{children}</div>

        {footer ? <footer className="auth-split-panel-footer">{footer}</footer> : null}
      </section>
    </motion.div>
  </div>
);

export default AuthPageShell;
