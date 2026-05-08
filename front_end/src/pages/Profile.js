import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import API_BASE_URL, { USER_ENDPOINTS, FEEDBACK_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useConfirm } from '../hooks/useConfirm';
import { FaStar } from 'react-icons/fa';
import '../styles/pages/Profile.css';

const Profile = () => {
  const { user, fetchUserInfo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const fileInputRef = useRef(null);
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
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackUpdatedAt, setFeedbackUpdatedAt] = useState(null);
  const confirm = useConfirm();
  
  // Default profile image
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

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
      // Only reset preview if user's profile_image has actually changed
      // This prevents clearing the preview when user object updates for other reasons
      // We'll reset it manually after successful upload
    }
  }, [user?.email, user?.first_name, user?.last_name, user?.phone, user?.country, user?.city, user?.street]);

  useEffect(() => {
    if (user?.id) {
      fetchMyFeedback();
    }
  }, [user?.id]);

  const fetchMyFeedback = async () => {
    setFeedbackLoading(true);
    try {
      const response = await http.get(FEEDBACK_ENDPOINTS.ME);
      const payload = response.data;
      setFeedbackRating(payload?.rating || 0);
      setFeedbackComment(payload?.comment || '');
      setFeedbackUpdatedAt(payload?.updated_at || null);
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Failed to load your feedback');
      }
      setFeedbackRating(0);
      setFeedbackComment('');
      setFeedbackUpdatedAt(null);
    } finally {
      setFeedbackLoading(false);
    }
  };
  
  const getProfileImageUrl = () => {
    // If preview image exists (during upload), use it
    if (previewImage) {
      return previewImage;
    }
    
    // Return default if no user
    if (!user) {
      return defaultProfileImage;
    }
    
    // Check if profile_image exists and is not empty/null
    const profileImage = user.profile_image;
    
    if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
      return defaultProfileImage;
    }
    
    // Check if it's already a full URL (e.g., Google profile image)
    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      return profileImage;
    }
    
    // Normalize path - remove leading slash if present to avoid double slashes
    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage;
    // Construct full URL for uploaded images
    const imageUrl = `${API_BASE_URL}/${normalizedPath}`;
    return imageUrl;
  };
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        setHasSelectedFile(false);
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        setHasSelectedFile(false);
        return;
      }
      
      // Mark that a file has been selected
      setHasSelectedFile(true);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setHasSelectedFile(false);
    }
  };
  
  const handleImageUpload = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) {
      toast.error('Please select an image');
      return;
    }
    
    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      await http.post(USER_ENDPOINTS.UPLOAD_PROFILE_IMAGE, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success('Profile image updated successfully!');
      // Refresh user data
      await fetchUserInfo();
      setPreviewImage(null);
      setHasSelectedFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to upload image');
    } finally {
      setImageLoading(false);
    }
  };

  const handleDeleteImage = async () => {
    const confirmed = await confirm({
      title: 'Delete profile image',
      message: 'Are you sure you want to delete your profile image? It will be reset to default.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    setImageLoading(true);
    try {
      await http.delete(USER_ENDPOINTS.DELETE_PROFILE_IMAGE);
      
      toast.success('Profile image deleted successfully!');
      // Refresh user data
      await fetchUserInfo();
      setPreviewImage(null);
      setHasSelectedFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to delete image');
    } finally {
      setImageLoading(false);
    }
  };

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
      
      // Refresh user data
      await fetchUserInfo();
      
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

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();

    if (feedbackRating < 1 || feedbackRating > 5) {
      toast.error('Please choose a rating between 1 and 5 stars');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const response = await http.post(FEEDBACK_ENDPOINTS.ME, {
        rating: feedbackRating,
        comment: feedbackComment.trim() ? feedbackComment.trim() : null,
      });
      setFeedbackUpdatedAt(response?.data?.updated_at || null);
      setFeedbackComment(response?.data?.comment || '');
      toast.success('Your feedback has been saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
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
          
          <div className="profile-image-section">
            <div className="profile-image-container">
              <img 
                key={`profile-${user?.id || 'no-user'}-${user?.profile_image || 'default'}`}
                src={getProfileImageUrl()} 
                alt="Profile" 
                className="profile-image-display"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  console.error('Profile image failed to load. URL:', e.target.src, 'User profile_image field:', user?.profile_image);
                  // Always fallback to default image on error
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }}
              />
            </div>
            <div className="profile-image-upload">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="profile-image-input"
              />
              <label htmlFor="profile-image-input" className="image-upload-label">
                Choose Image
              </label>
              {hasSelectedFile && (
                <button
                  type="button"
                  onClick={handleImageUpload}
                  className="upload-image-btn"
                  disabled={imageLoading}
                >
                  {imageLoading ? (
                    <>
                      <LoadingSpinner size="small" />
                      Uploading...
                    </>
                  ) : (
                    'Update Image'
                  )}
                </button>
              )}
              {user?.profile_image && !hasSelectedFile && (
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  className="delete-image-btn"
                  disabled={imageLoading}
                >
                  {imageLoading ? (
                    <>
                      <LoadingSpinner size="small" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Image'
                  )}
                </button>
              )}
            </div>
          </div>
          
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

      <motion.div
        className="customer-feedback-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2>Customer Feedback</h2>
        <p className="customer-feedback-subtitle">
          Rate your overall experience from 1 to 5 stars and add an optional comment.
        </p>

        {feedbackLoading ? (
          <div className="customer-feedback-loading">
            <LoadingSpinner size="small" />
          </div>
        ) : (
          <form onSubmit={handleSubmitFeedback} className="customer-feedback-form">
            <div className="feedback-stars" onMouseLeave={() => setFeedbackHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((starValue) => {
                const activeRating = feedbackHoverRating || feedbackRating;
                const isActive = starValue <= activeRating;
                return (
                  <button
                    key={starValue}
                    type="button"
                    className={`feedback-star-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setFeedbackRating(starValue)}
                    onMouseEnter={() => setFeedbackHoverRating(starValue)}
                    aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
                  >
                    <FaStar />
                  </button>
                );
              })}
              <span className="feedback-rating-value">
                {feedbackRating ? `${feedbackRating}/5` : 'No rating selected'}
              </span>
            </div>

            <label htmlFor="feedback-comment">Comment (optional)</label>
            <textarea
              id="feedback-comment"
              className="feedback-comment-input"
              value={feedbackComment}
              onChange={(event) => setFeedbackComment(event.target.value)}
              placeholder="Share your feedback (optional)"
              maxLength={1000}
              rows={4}
            />

            <div className="feedback-form-footer">
              <span>{feedbackComment.length}/1000</span>
              <button
                type="submit"
                className="feedback-submit-btn"
                disabled={feedbackSubmitting || feedbackRating < 1}
              >
                {feedbackSubmitting ? 'Saving...' : 'Submit Feedback'}
              </button>
            </div>

            {feedbackUpdatedAt && (
              <p className="feedback-updated-at">
                Last updated: {formatDate(feedbackUpdatedAt)}
              </p>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Profile;
