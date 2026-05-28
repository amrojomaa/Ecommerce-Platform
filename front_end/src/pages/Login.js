import { tUi } from '../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import { FaHeart, FaShieldAlt, FaTruck } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import { getRoleDashboardPath } from '../utils/roleDashboard';
import AuthPageShell, {
  AuthDivider,
  AuthGoogleButton,
  AuthPasswordField,
} from '../components/AuthPageShell';
import '../styles/pages/Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isAuthenticated, user } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.role) {
      return;
    }

    const homePath = getRoleDashboardPath(user.role) || '/';
    navigate(homePath, { replace: true });
  }, [isAuthenticated, user, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password, formData.rememberMe);

      if (result?.success) {
        toast.success(tUi('ui.pages.login.loginSuccessful_e6d02ef027'));
      } else {
        toast.error(result?.error || tUi('ui.pages.login.loginFailed_b4e8c2d51c'));
      }
    } catch {
      toast.error(tUi('ui.pages.login.somethingWentWrong_fbd74f86ef'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(tokenResponse.access_token);
        if (result?.success) {
          toast.success(tUi('ui.pages.login.loginSuccessful_e6d02ef027'));
        } else {
          toast.error(result?.error || tUi('ui.pages.login.googleLoginFailedPleaseTry_8d8fedd536'));
        }
      } catch {
        toast.error(tUi('ui.pages.login.somethingWentWrongWithGoogle_a82072ed9d'));
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error(tUi('ui.pages.login.googleLoginFailedPleaseTry_8d8fedd536'));
      setGoogleLoading(false);
    },
    scope: 'profile email',
  });

  return (
    <AuthPageShell
      pageClassName="auth-login-page"
      hero={{
        kicker: tUi('ui.pages.login.heroKicker_b4e8c2d501'),
        title: tUi('ui.pages.login.heroTitle_b4e8c2d502'),
        subtitle: tUi('ui.pages.login.heroSubtitle_b4e8c2d503'),
        benefits: [
          {
            icon: <FaHeart />,
            label: tUi('ui.pages.login.benefitWishlist_b4e8c2d504'),
            description: tUi('ui.pages.login.benefitWishlistDesc_b4e8c2d505'),
          },
          {
            icon: <FaTruck />,
            label: tUi('ui.pages.login.benefitDelivery_b4e8c2d506'),
            description: tUi('ui.pages.login.benefitDeliveryDesc_b4e8c2d507'),
          },
          {
            icon: <FaShieldAlt />,
            label: tUi('ui.pages.login.benefitSecure_b4e8c2d508'),
            description: tUi('ui.pages.login.benefitSecureDesc_b4e8c2d509'),
          },
        ],
        cta: {
          to: '/products',
          label: tUi('ui.pages.login.browseStore_b4e8c2d50a'),
        },
      }}
      panel={{
        kicker: tUi('ui.pages.login.login_4b4596ebf5'),
        title: tUi('ui.pages.login.panelTitle_b4e8c2d50b'),
        subtitle: tUi('ui.pages.login.welcomeBackPleaseLoginTo_2f667109f5'),
      }}
      footer={
        <p className="auth-split-switch">
          {tUi('ui.pages.login.donTHaveAnAccount_5c2496a86e')}{' '}
          <Link to="/signup">{tUi('ui.pages.login.signUp_8e16000dc0')}</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="auth-split-form">
        <div className="auth-split-field">
          <label htmlFor="email">{tUi('ui.pages.login.email_2f2d1d3b03')}</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder={tUi('ui.pages.login.enterYourEmail_94997e7f2c')}
            className="auth-split-input"
            autoComplete="email"
          />
        </div>

        <AuthPasswordField
          id="password"
          name="password"
          label={tUi('ui.pages.login.password_c9fb7b6316')}
          labelExtra={
            <Link to="/forgot-password" className="auth-split-inline-link">
              {tUi('ui.pages.login.forgotYourPassword_7484c9cd8e')}
            </Link>
          }
          value={formData.password}
          onChange={handleChange}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          placeholder={tUi('ui.pages.login.enterYourPassword_4257b32a43')}
          required
        />

        <label className="auth-split-checkbox" htmlFor="rememberMe">
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
          />
          <span>{tUi('ui.pages.login.rememberMe_399aa1dfc4')}</span>
        </label>

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
              {tUi('ui.pages.login.loggingIn_7d068b432f')}
            </>
          ) : (
            tUi('ui.pages.login.login_4b4596ebf5')
          )}
        </motion.button>
      </form>

      <AuthDivider />

      <AuthGoogleButton
        onClick={handleGoogleLogin}
        loading={googleLoading}
        disabled={loading}
        label={tUi('ui.pages.login.continueWithGoogle_3b1c8480ac')}
        loadingLabel={tUi('ui.pages.login.signingIn_5c57a8b55c')}
      />
    </AuthPageShell>
  );
};

export default Login;
