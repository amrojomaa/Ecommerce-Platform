import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { validateEmail } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';

const Signup = () => {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useAuth();
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
  const [errors, setErrors] = useState({});

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
    // Clear error when user starts typing
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
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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
      street: formData.street || null,
    });
    
    if (result.success) {
      // toast.success(result.message || 'Account created successfully! Please login.');
      alert(result.message || 'Account created successfully! Please login.');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } else {
      // toast.error(result.error || 'Signup failed');
      alert(result.error || 'Signup failed');
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
        <h1>Sign Up</h1>
        <p>Create a new account to get started.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder="Enter your first name"
                className={errors.first_name ? 'error' : ''}
              />
              {errors.first_name && <span className="error-message">{errors.first_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Last Name</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder="Enter your last name"
                className={errors.last_name ? 'error' : ''}
              />
              {errors.last_name && <span className="error-message">{errors.last_name}</span>}
            </div>
          </div>

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
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone (Optional)</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="form-row form-row-three">
            <div className="form-group">
              <label htmlFor="country">Country (Optional)</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Enter your country"
              />
            </div>

            <div className="form-group">
              <label htmlFor="city">City (Optional)</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter your city"
              />
            </div>

            <div className="form-group">
              <label htmlFor="street">Street (Optional)</label>
              <input
                type="text"
                id="street"
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder="Enter your street address"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
              className={errors.confirmPassword ? 'error' : ''}
            />
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
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
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </motion.div>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
