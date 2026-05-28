import { tUi } from '../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import { FaHeart, FaShieldAlt, FaTag } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import {
  validateEmail,
  isStrongPassword,
  getPasswordStrengthProgress,
} from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthPageShell, {
  AuthDivider,
  AuthGoogleButton,
  AuthPasswordField,
} from '../components/AuthPageShell';
import '../styles/pages/Auth.css';

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
    street: '',
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
      [e.target.name]: e.target.value,
    });
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = tUi('ui.pages.signup.emailRequired_b4e8c2d510');
    } else if (!validateEmail(formData.email)) {
      newErrors.email = tUi('ui.pages.signup.emailInvalid_b4e8c2d511');
    }

    if (!formData.first_name) {
      newErrors.first_name = tUi('ui.pages.signup.firstNameRequired_b4e8c2d512');
    }

    if (!formData.last_name) {
      newErrors.last_name = tUi('ui.pages.signup.lastNameRequired_b4e8c2d513');
    }

    if (!formData.password) {
      newErrors.password = tUi('ui.pages.resetPassword.passwordRequired_b4e8a1c2d8');
    } else if (!isStrongPassword(formData.password)) {
      newErrors.password = tUi('ui.pages.resetPassword.passwordRequirements_c8f1a2b3dc');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = tUi('ui.pages.resetPassword.passwordsDoNotMatch_b4e8a1c2d9');
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
      street: formData.street || null,
    });

    if (result.success) {
      navigate('/verify-email', {
        state: {
          email: result.email || formData.email,
          verification_code: result.verification_code || null,
        },
      });
    } else {
      toast.error(result.error || tUi('ui.pages.signup.signupFailed_b4e8c2d516'));
    }

    setLoading(false);
  };

  const handleGoogleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(tokenResponse.access_token);
        if (result?.success) {
          toast.success(tUi('ui.pages.signup.accountCreatedAndLoggedIn_ce5b7626b2'));
          navigate('/');
        } else {
          toast.error(result?.error || tUi('ui.pages.signup.googleSignupFailedPleaseTry_529ce3ad69'));
        }
      } catch {
        toast.error(tUi('ui.pages.signup.somethingWentWrongWithGoogle_a4fe280b0f'));
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error(tUi('ui.pages.signup.googleSignupFailedPleaseTry_529ce3ad69'));
      setGoogleLoading(false);
    },
    scope: 'profile email',
  });

  return (
    <AuthPageShell
      pageClassName="auth-signup-page"
      wide
      hero={{
        kicker: tUi('ui.pages.signup.heroKicker_b4e8c2d508'),
        title: tUi('ui.pages.signup.heroTitle_b4e8c2d509'),
        subtitle: tUi('ui.pages.signup.heroSubtitle_b4e8c2d50a'),
        benefits: [
          {
            icon: <FaTag />,
            label: tUi('ui.pages.signup.benefitDeals_b4e8c2d50b'),
            description: tUi('ui.pages.signup.benefitDealsDesc_b4e8c2d50c'),
          },
          {
            icon: <FaHeart />,
            label: tUi('ui.pages.signup.benefitWishlist_b4e8c2d50d'),
            description: tUi('ui.pages.signup.benefitWishlistDesc_b4e8c2d50e'),
          },
          {
            icon: <FaShieldAlt />,
            label: tUi('ui.pages.signup.benefitSecure_b4e8c2d50f'),
            description: tUi('ui.pages.signup.benefitSecureDesc_b4e8c2d510'),
          },
        ],
      }}
      panel={{
        kicker: tUi('ui.pages.signup.signUp_31e879f853'),
        title: tUi('ui.pages.signup.panelTitle_b4e8c2d511'),
        subtitle: tUi('ui.pages.signup.createANewAccountTo_acca247e59'),
      }}
      footer={
        <p className="auth-split-switch">
          {tUi('ui.pages.signup.alreadyHaveAnAccount_2afe32fcac')}{' '}
          <Link to="/login">{tUi('ui.pages.signup.login_fa9a00d8ad')}</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="auth-split-form">
        <div className="auth-split-field-row">
          <div className="auth-split-field">
            <label htmlFor="first_name">
              {tUi('ui.pages.signup.firstName_0115dc327f')}
              <span className="auth-split-required">*</span>
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
              placeholder={tUi('ui.pages.signup.enterYourFirstName_456883bf94')}
              className={errors.first_name ? 'auth-split-input is-error' : 'auth-split-input'}
              autoComplete="given-name"
            />
            {errors.first_name ? <span className="auth-split-error">{errors.first_name}</span> : null}
          </div>

          <div className="auth-split-field">
            <label htmlFor="last_name">
              {tUi('ui.pages.signup.lastName_d680d61780')}
              <span className="auth-split-required">*</span>
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
              placeholder={tUi('ui.pages.signup.enterYourLastName_6449322e24')}
              className={errors.last_name ? 'auth-split-input is-error' : 'auth-split-input'}
              autoComplete="family-name"
            />
            {errors.last_name ? <span className="auth-split-error">{errors.last_name}</span> : null}
          </div>
        </div>

        <div className="auth-split-field">
          <label htmlFor="email">
            {tUi('ui.pages.signup.email_4283f2f98d')}
            <span className="auth-split-required">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder={tUi('ui.pages.signup.enterYourEmail_1b36f3c709')}
            className={errors.email ? 'auth-split-input is-error' : 'auth-split-input'}
            autoComplete="email"
          />
          {errors.email ? <span className="auth-split-error">{errors.email}</span> : null}
        </div>

        <div className="auth-split-field">
          <label htmlFor="phone">{tUi('ui.pages.signup.phoneOptional_75c8e69b0d')}</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder={tUi('ui.pages.signup.enterYourPhoneNumber_28d611e3a3')}
            className="auth-split-input"
            autoComplete="tel"
          />
        </div>

        <div className="auth-split-field-row auth-split-field-row--triple">
          <div className="auth-split-field">
            <label htmlFor="country">{tUi('ui.pages.signup.countryOptional_5204ef7b72')}</label>
            <input
              type="text"
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder={tUi('ui.pages.signup.enterYourCountry_b8ec420563')}
              className="auth-split-input"
              autoComplete="country-name"
            />
          </div>
          <div className="auth-split-field">
            <label htmlFor="city">{tUi('ui.pages.signup.cityOptional_a7da0fbc82')}</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder={tUi('ui.pages.signup.enterYourCity_592c44c282')}
              className="auth-split-input"
              autoComplete="address-level2"
            />
          </div>
          <div className="auth-split-field">
            <label htmlFor="street">{tUi('ui.pages.signup.streetOptional_8c6d703abb')}</label>
            <input
              type="text"
              id="street"
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder={tUi('ui.pages.signup.enterYourStreetAddress_8a29161f56')}
              className="auth-split-input"
              autoComplete="street-address"
            />
          </div>
        </div>

        <AuthPasswordField
          id="password"
          name="password"
          label={
            <>
              {tUi('ui.pages.signup.password_7084f01dbc')}
              <span className="auth-split-required">*</span>
            </>
          }
          value={formData.password}
          onChange={handleChange}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          error={errors.password}
          placeholder={tUi('ui.pages.signup.enterYourPassword_13b5e3dee5')}
          required
        >
          <div className="auth-split-strength" aria-hidden="true">
            <div className="auth-split-strength-bar" style={{ width: `${passwordStrengthProgress}%` }} />
          </div>
        </AuthPasswordField>

        <AuthPasswordField
          id="confirmPassword"
          name="confirmPassword"
          label={
            <>
              {tUi('ui.pages.signup.confirmPassword_3222757f3c')}
              <span className="auth-split-required">*</span>
            </>
          }
          value={formData.confirmPassword}
          onChange={handleChange}
          showPassword={showConfirmPassword}
          onTogglePassword={() => setShowConfirmPassword((prev) => !prev)}
          error={errors.confirmPassword}
          placeholder={tUi('ui.pages.signup.confirmYourPassword_942a5af97c')}
          required
        />

        <motion.button
          type="submit"
          className="page-btn-primary auth-split-submit"
          disabled={loading || googleLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <>
              <LoadingSpinner size="small" />
              {tUi('ui.pages.signup.creatingAccount_294bb5a7e0')}
            </>
          ) : (
            tUi('ui.pages.signup.signUp_31e879f853')
          )}
        </motion.button>
      </form>

      <AuthDivider />

      <AuthGoogleButton
        onClick={handleGoogleSignup}
        loading={googleLoading}
        disabled={loading}
        label={tUi('ui.pages.signup.continueWithGoogle_f632e5cb4c')}
        loadingLabel={tUi('ui.pages.signup.signingUp_fb7acde66f')}
      />
    </AuthPageShell>
  );
};

export default Signup;
