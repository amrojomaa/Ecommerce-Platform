import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await forgotPassword(email);
      
      if (result?.success) {
        // toast.success(result.message || 'Verification code sent to your email');
        alert(result.message || 'Verification code sent to your email');
        // Navigate to verify reset code page with email
        navigate('/verify-reset-code', {
          state: {
            email: result.email || email,
            verification_code: result.verification_code || null
          }
        });
      } else {
        setError(result?.error || 'Failed to send verification code');
        // toast.error(result?.error || 'Failed to send verification code');
        alert(result?.error || 'Failed to send verification code');
      }
    } catch (err) {
      console.error("FORGOT PASSWORD ERROR:", err);
      setError('Something went wrong. Please try again.');
      // toast.error('Something went wrong. Please try again.');
      alert('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>Forgot Password</h1>
        <p>Enter your email address and we'll send you a verification code to reset your password.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              required
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  Sending...
                </>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </motion.div>
        </form>

        <p className="auth-link">
          Remember your password? <Link to="/login">Login</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
