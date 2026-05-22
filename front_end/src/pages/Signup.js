import { tUi } from "../i18n/uiText";
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import {
  validateEmail,
  isStrongPassword,
  getPasswordStrengthProgress,
  getStrongPasswordErrorMessage } from
'../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';
import PageHeader from '../components/PageHeader';

const Signup = () => {
  const navigate = useNavigate();
  const { signup, loginWithGoogle, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    city: '',
    street: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordStrengthProgress = getPasswordStrengthProgress(formData.password);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: ''
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.first_name) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isStrongPassword(formData.password)) {
      newErrors.password = getStrongPasswordErrorMessage();
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const result = await signup({
      email: formData.email,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone || null,
      country: formData.country || null,
      city: formData.city || null,
      street: formData.street || null
    });

    if (result.success) {
      // Redirect to email verification page
      navigate('/verify-email', {
        state: {
          email: result.email || formData.email,
          verification_code: result.verification_code || null
        }
      });
    } else {
      toast.error(result.error || 'Signup failed');
    }

    setLoading(false);
  };

  const handleGoogleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(tokenResponse.access_token);
        if (result?.success) {
          toast.success(tUi("ui.pages.signup.accountCreatedAndLoggedIn_ce5b7626b2"));
          navigate('/');
        } else {
          toast.error(result?.error || 'Google signup failed');
        }
      } catch (err) {
        console.error("GOOGLE SIGNUP ERROR:", err);
        toast.error(tUi("ui.pages.signup.somethingWentWrongWithGoogle_a4fe280b0f"));
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error(tUi("ui.pages.signup.googleSignupFailedPleaseTry_529ce3ad69"));
      setGoogleLoading(false);
    },
    scope: 'profile email' // Explicitly request profile and email scopes to get profile picture
  });

  return (
    <div className="page-shell signup-page auth-page-wrap">
      <motion.div
        className="auth-container page-form-panel auth-container--wide"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}>
        
        <PageHeader
          kicker={tUi("ui.pages.signup.signUp_31e879f853")}
          title={tUi("ui.pages.signup.signUp_31e879f853")}
          subtitle={tUi("ui.pages.signup.createANewAccountTo_acca247e59")}
          className="auth-page-header"
          animate={false}
        />

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">{tUi("ui.pages.signup.firstName_0115dc327f")}
                <span className="required-mark">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder={tUi("ui.pages.signup.enterYourFirstName_456883bf94")}
                className={errors.first_name ? "error" : ''} />
              
              {errors.first_name && <span className="error-message">{errors.first_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="last_name">{tUi("ui.pages.signup.lastName_d680d61780")}
                <span className="required-mark">*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder={tUi("ui.pages.signup.enterYourLastName_6449322e24")}
                className={errors.last_name ? "error" : ''} />
              
              {errors.last_name && <span className="error-message">{errors.last_name}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">{tUi("ui.pages.signup.email_4283f2f98d")}
              <span className="required-mark">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder={tUi("ui.pages.signup.enterYourEmail_1b36f3c709")}
              className={errors.email ? "error" : ''} />
            
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">{tUi("ui.pages.signup.phoneOptional_75c8e69b0d")}</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder={tUi("ui.pages.signup.enterYourPhoneNumber_28d611e3a3")} />
            
          </div>

          <div className="form-row form-row-three">
            <div className="form-group">
              <label htmlFor="country">{tUi("ui.pages.signup.countryOptional_5204ef7b72")}</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder={tUi("ui.pages.signup.enterYourCountry_b8ec420563")} />
              
            </div>

            <div className="form-group">
              <label htmlFor="city">{tUi("ui.pages.signup.cityOptional_a7da0fbc82")}</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder={tUi("ui.pages.signup.enterYourCity_592c44c282")} />
              
            </div>

            <div className="form-group">
              <label htmlFor="street">{tUi("ui.pages.signup.streetOptional_8c6d703abb")}</label>
              <input
                type="text"
                id="street"
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder={tUi("ui.pages.signup.enterYourStreetAddress_8a29161f56")} />
              
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">{tUi("ui.pages.signup.password_7084f01dbc")}
              <span className="required-mark">*</span>
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder={tUi("ui.pages.signup.enterYourPassword_13b5e3dee5")}
                className={errors.password ? "error" : ''} />
              
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? tUi("ui.pages.signup.hidePassword_ce0d2d6955") : tUi("ui.pages.signup.showPassword_72f22e7185")}>
                
                {showPassword ?
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg> :

                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                }
              </button>
            </div>
            <div className="password-strength-line" aria-hidden="true">
              <div
                className="password-strength-line-progress"
                style={{ width: `${passwordStrengthProgress}%` }} />
              
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{tUi("ui.pages.signup.confirmPassword_3222757f3c")}
              <span className="required-mark">*</span>
            </label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder={tUi("ui.pages.signup.confirmYourPassword_942a5af97c")}
                className={errors.confirmPassword ? "error" : ''} />
              
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? tUi("ui.pages.signup.hidePassword_ce0d2d6955") : tUi("ui.pages.signup.showPassword_72f22e7185")}>
                
                {showConfirmPassword ?
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg> :

                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                }
              </button>
            </div>
            {errors.confirmPassword &&
            <span className="error-message">{errors.confirmPassword}</span>
            }
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="page-btn-primary auth-full-width-btn"
              disabled={loading}>
              
              {loading ?
              <>
                  <LoadingSpinner size="small" />{tUi("ui.pages.signup.creatingAccount_294bb5a7e0")}

              </> : tUi("ui.pages.signup.signUp_31e879f853")


              }
            </button>
          </motion.div>
        </form>

        <div className="auth-divider">
          <span>{tUi('ui.common.or')}</span>
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="page-btn-secondary auth-full-width-btn google-sso-btn"
            disabled={googleLoading || loading}>
            
            {googleLoading ?
            <>
                <LoadingSpinner size="small" />{tUi("ui.pages.signup.signingUp_fb7acde66f")}

            </> :

            <>
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <g fill="#000" fillRule="evenodd">
                    <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335" />
                    <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.07-1.84 2.68l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.38z" fill="#4285F4" />
                    <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05" />
                    <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853" />
                  </g>
                </svg>{tUi("ui.pages.signup.continueWithGoogle_f632e5cb4c")}

            </>
            }
          </button>
        </motion.div>

        <p className="auth-link">{tUi("ui.pages.signup.alreadyHaveAnAccount_2afe32fcac")}
          <Link to="/login">{tUi("ui.pages.signup.login_fa9a00d8ad")}</Link>
        </p>
      </motion.div>
    </div>);

};

export default Signup;
