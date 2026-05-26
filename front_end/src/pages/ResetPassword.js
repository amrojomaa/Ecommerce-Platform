import { tUi } from '../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import {
  isStrongPassword,
  getStrongPasswordErrorMessage,
  getPasswordStrengthProgress,
} from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import '../styles/pages/Auth.css';

const RESET_SESSION_KEY = 'password_reset_session';

const readResetSession = () => {
  try {
    const raw = sessionStorage.getItem(RESET_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveResetSession = (email, verificationCode) => {
  sessionStorage.setItem(
    RESET_SESSION_KEY,
    JSON.stringify({ email, verification_code: verificationCode })
  );
};

const clearResetSession = () => {
  sessionStorage.removeItem(RESET_SESSION_KEY);
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword } = useAuth();

  const sessionData = readResetSession();
  const email = location.state?.email || sessionData?.email || '';
  const verificationCode = location.state?.verification_code || sessionData?.verification_code || '';

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordStrengthProgress = getPasswordStrengthProgress(formData.newPassword);

  useEffect(() => {
    if (!email || !verificationCode) {
      navigate('/forgot-password', { replace: true });
      return;
    }

    saveResetSession(email, verificationCode);
  }, [email, verificationCode, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
    if (errors.form) {
      setErrors((prev) => ({
        ...prev,
        form: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = {};

    if (!formData.newPassword) {
      nextErrors.newPassword = tUi('ui.pages.resetPassword.passwordRequired_b4e8a1c2d8');
    } else if (!isStrongPassword(formData.newPassword)) {
      nextErrors.newPassword = getStrongPasswordErrorMessage();
    }

    if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = tUi('ui.pages.resetPassword.passwordsDoNotMatch_b4e8a1c2d9');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(email, verificationCode, formData.newPassword);

      if (result?.success) {
        clearResetSession();
        toast.success(result.message || tUi('ui.pages.resetPassword.passwordResetSuccess_b4e8a1c2da'));
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        const message = result?.error || tUi('ui.pages.resetPassword.failedToResetPassword_b4e8a1c2db');
        setErrors({ form: message });
        toast.error(message);
      }
    } catch (err) {
      console.error('RESET PASSWORD ERROR:', err);
      const message = tUi('ui.pages.resetPassword.somethingWentWrongPleaseTry_97ae3887cf');
      setErrors({ form: message });
      toast.error(message);
    }

    setLoading(false);
  };

  if (!email || !verificationCode) {
    return (
      <div className="page-shell reset-password-page auth-page-wrap">
        <div className="page-loading">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell reset-password-page auth-page-wrap">
      <div className="auth-container page-form-panel auth-reset-panel">
        <PageHeader
          kicker={tUi('ui.pages.resetPassword.kicker_c8f1a2b3d4')}
          title={tUi('ui.pages.resetPassword.pageTitle_c8f1a2b3d5')}
          subtitle={tUi('ui.pages.resetPassword.enterYourNewPasswordBelow_cabc85c425')}
          className="auth-page-header auth-reset-header"
          animate={false}
        />

        <form onSubmit={handleSubmit} className="auth-form auth-reset-form">
          <div className="form-group">
            <label htmlFor="newPassword">{tUi('ui.pages.resetPassword.newPassword_f79bf0add5')}</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                placeholder={tUi('ui.pages.resetPassword.enterNewPassword_39a115514b')}
                disabled={loading}
                className={errors.newPassword ? 'error' : ''}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? tUi('ui.pages.signup.hidePassword_ce0d2d6955') : tUi('ui.pages.signup.showPassword_72f22e7185')}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            <div className="password-strength-line" aria-hidden="true">
              <div
                className="password-strength-line-progress"
                style={{ width: `${passwordStrengthProgress}%` }}
              />
            </div>
            {errors.newPassword && <span className="error-message">{errors.newPassword}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{tUi('ui.pages.resetPassword.confirmPassword_5f9f1e8060')}</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder={tUi('ui.pages.resetPassword.confirmNewPassword_4cf60e82ad')}
                disabled={loading}
                className={errors.confirmPassword ? 'error' : ''}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? tUi('ui.pages.signup.hidePassword_ce0d2d6955') : tUi('ui.pages.signup.showPassword_72f22e7185')}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
          </div>

          {errors.form && <div className="error-message">{errors.form}</div>}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="page-btn-primary auth-full-width-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  {tUi('ui.pages.resetPassword.savingPassword_c8f1a2b3d7')}
                </>
              ) : (
                tUi('ui.pages.resetPassword.submitButton_c8f1a2b3d6')
              )}
            </button>
          </motion.div>
        </form>

        <p className="auth-link">
          {tUi('ui.pages.resetPassword.rememberYourPassword_d9b1edb381')}
          <Link to="/login">{tUi('ui.pages.resetPassword.login_9c9e61f5aa')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
