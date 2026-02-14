import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { USER_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Profile.css';

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    city: '',
    street: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        country: user.country || '',
        city: user.city || '',
        street: user.street || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [user]);

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

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
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
    try {
      const updateData = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
        country: formData.country || null,
        city: formData.city || null,
        street: formData.street || null,
      };
      
      if (formData.password) {
        updateData.password = formData.password;
      }

      await http.put(USER_ENDPOINTS.UPDATE_ME, updateData);
      toast.success('Profile updated successfully!');
      
      // Reload page to refresh user data
      window.location.reload();
      
      // Clear password fields
      setFormData({
        ...formData,
        password: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h1>My Profile</h1>
      
      <motion.div
        className="profile-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="profile-info">
          <h2>Account Information</h2>
          <div className="info-item">
            <label>Email:</label>
            <span>{user.email}</span>
          </div>
          <div className="info-item">
            <label>Name:</label>
            <span>{user.first_name} {user.last_name}</span>
          </div>
          {user.phone && (
            <div className="info-item">
              <label>Phone:</label>
              <span>{user.phone}</span>
            </div>
          )}
          {(user.country || user.city || user.street) && (
            <div className="info-item">
              <label>Address:</label>
              <span>
                {[user.street, user.city, user.country].filter(Boolean).join(', ') || 'Not provided'}
              </span>
            </div>
          )}
          <div className="info-item">
            <label>Role:</label>
            <span className={`role-badge ${user.role}`}>{user.role}</span>
          </div>
          <div className="info-item">
            <label>Member Since:</label>
            <span>{formatDate(user.created_at)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <h2>Update Profile</h2>
          
          <div className="form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
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
            />
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
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="country">Country</label>
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
            <label htmlFor="city">City</label>
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
            <label htmlFor="street">Street</label>
            <input
              type="text"
              id="street"
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder="Enter your street address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">New Password (leave blank to keep current)</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter new password"
              className={errors.password ? 'error' : ''}
            />
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {formData.password && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                className={errors.confirmPassword ? 'error' : ''}
              />
              {errors.confirmPassword && (
                <span className="error-message">{errors.confirmPassword}</span>
              )}
            </div>
          )}

          <motion.button
            type="submit"
            className="update-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                Updating...
              </>
            ) : (
              'Update Profile'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Profile;
