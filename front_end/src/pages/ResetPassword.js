import { tUi } from "../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { isStrongPassword, getStrongPasswordErrorMessage } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword } = useAuth();

  // Get email and verification code from location state
  const email = location.state?.email || '';
  const verificationCode = location.state?.verification_code || '';

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Redirect if no email or code provided
    if (!email || !verificationCode) {
      navigate('/forgot-password');
      return;
    }
  }, [email, verificationCode, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validatePassword = (password) => {
    if (!isStrongPassword(password)) {
      return getStrongPasswordErrorMessage();
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(formData.newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(email, verificationCode, formData.newPassword);

      if (result?.success) {
        toast.success(result.message || 'Password reset successfully!');
        // Navigate to login page after successful reset
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setError(result?.error || 'Failed to reset password');
        toast.error(result?.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      setError('Something went wrong. Please try again.');
      toast.error(tUi("ui.pages.resetPassword.somethingWentWrongPleaseTry_97ae3887cf"));
    }

    setLoading(false);
  };

  if (!email || !verificationCode) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="auth-page">
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}>
        
        <h1>{tUi("ui.pages.resetPassword.resetPassword_3e8e15d37c")}</h1>
        <p>{tUi("ui.pages.resetPassword.enterYourNewPasswordBelow_cabc85c425")}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">{tUi("ui.pages.resetPassword.newPassword_f79bf0add5")}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                placeholder={tUi("ui.pages.resetPassword.enterNewPassword_39a115514b")}
                disabled={loading}
                minLength={9} />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#666'
                }}>
                
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{tUi("ui.pages.resetPassword.confirmPassword_5f9f1e8060")}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder={tUi("ui.pages.resetPassword.confirmNewPassword_4cf60e82ad")}
                disabled={loading}
                minLength={9} />
              
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#666'
                }}>
                
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="auth-button"
              disabled={loading}>
              
              {loading ?
              <>
                  <LoadingSpinner size="small" />{tUi("ui.pages.resetPassword.resetting_fdf446c9b3")}

              </> : tUi("ui.pages.resetPassword.resetPassword_3e8e15d37c")


              }
            </button>
          </motion.div>
        </form>

        <p className="auth-link">{tUi("ui.pages.resetPassword.rememberYourPassword_d9b1edb381")}
          <Link to="/login">{tUi("ui.pages.resetPassword.login_9c9e61f5aa")}</Link>
        </p>
      </motion.div>
    </div>);

};

export default ResetPassword;
