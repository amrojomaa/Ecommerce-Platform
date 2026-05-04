import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        navigate(u.role === 'cashier' ? '/cashier' : '/');
      } catch {
        navigate('/');
      }
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      console.log("LOGIN RESULT:", result);
  
      if (result?.success) {
        toast.success('Login successful');
      } else {
        toast.error(result?.error || 'Login failed');
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      toast.error("Something went wrong");
    }
  
    setLoading(false);
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(tokenResponse.access_token);
        if (result?.success) {
          toast.success('Login successful');
        } else {
          toast.error(result?.error || 'Google login failed');
        }
      } catch (err) {
        console.error("GOOGLE LOGIN ERROR:", err);
        toast.error("Something went wrong with Google login");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login failed. Please try again.');
      setGoogleLoading(false);
    },
    scope: 'profile email', // Explicitly request profile and email scopes to get profile picture
  });

  return (
    <div className="auth-page">
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>Login</h1>
        <p>Welcome back! Please login to your account.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <div className="password-header">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="forgot-password-link">
                Forgot your password?
              </Link>
            </div>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </motion.div>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="auth-button google-button"
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <>
                <LoadingSpinner size="small" />
                Signing in...
              </>
            ) : (
              <>
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <g fill="#000" fillRule="evenodd">
                    <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"/>
                    <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.07-1.84 2.68l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.38z" fill="#4285F4"/>
                    <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"/>
                    <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"/>
                  </g>
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </motion.div>

        <p className="auth-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
