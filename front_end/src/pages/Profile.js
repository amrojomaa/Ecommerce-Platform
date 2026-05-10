import { tUi } from "../i18n/uiText";import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import API_BASE_URL, { USER_ENDPOINTS, FEEDBACK_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import {
  formatDate,
  isStrongPassword,
  getStrongPasswordErrorMessage,
  getPasswordStrengthProgress } from
'../utils/helpers';
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
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackUpdatedAt, setFeedbackUpdatedAt] = useState(null);
  const [isUpdateProfileOpen, setIsUpdateProfileOpen] = useState(false);
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
        confirmPassword: ''
      });
      // Only reset preview if user's profile_image has actually changed
      // This prevents clearing the preview when user object updates for other reasons
      // We'll reset it manually after successful upload
    }
  }, [user, user?.email, user?.first_name, user?.last_name, user?.phone, user?.country, user?.city, user?.street]);

  useEffect(() => {
    if (user?.id) {
      fetchMyFeedback();
    }
  }, [user?.id]);

  const hasProfileChanges = useMemo(() => {
    if (!user) {
      return false;
    }

    const baseFirstName = user.first_name || '';
    const baseLastName = user.last_name || '';
    const basePhone = user.phone || '';
    const baseCountry = user.country || '';
    const baseCity = user.city || '';
    const baseStreet = user.street || '';

    return (
      formData.first_name !== baseFirstName ||
      formData.last_name !== baseLastName ||
      formData.phone !== basePhone ||
      formData.country !== baseCountry ||
      formData.city !== baseCity ||
      formData.street !== baseStreet ||
      formData.password.trim() !== '');

  }, [formData, user]);

  const passwordStrengthProgress = useMemo(
    () => getPasswordStrengthProgress(formData.password),
    [formData.password]
  );

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
        toast.error(tUi("ui.pages.profile.failedToLoadYourFeedback_03e5c154fd"));
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
        toast.error(tUi("ui.pages.profile.pleaseSelectAnImageFile_a2f34abd3a"));
        setHasSelectedFile(false);
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(tUi("ui.pages.profile.imageSizeShouldBeLess_50201ed3d3"));
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
      toast.error(tUi("ui.pages.profile.pleaseSelectAnImage_63903ead53"));
      return;
    }

    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      await http.post(USER_ENDPOINTS.UPLOAD_PROFILE_IMAGE, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(tUi("ui.pages.profile.profileImageUpdatedSuccessfully_f93a151243"));
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
      title: tUi("ui.pages.profile.deleteProfileImage_c852fb558a"),
      message: tUi("ui.pages.profile.areYouSureYouWant_02753c98df"),
      confirmText: tUi("ui.pages.profile.delete_b417f7abe5"),
      cancelText: tUi("ui.pages.profile.cancel_1ce51b317b")
    });
    if (!confirmed) {
      return;
    }

    setImageLoading(true);
    try {
      await http.delete(USER_ENDPOINTS.DELETE_PROFILE_IMAGE);

      toast.success(tUi("ui.pages.profile.profileImageDeletedSuccessfully_298d13f7a3"));
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
      [e.target.name]: e.target.value
    });
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: ''
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.password && !isStrongPassword(formData.password)) {
      newErrors.password = getStrongPasswordErrorMessage();
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasProfileChanges) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        email: user.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
        country: formData.country || null,
        city: formData.city || null,
        street: formData.street || null
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      await http.put(USER_ENDPOINTS.UPDATE_ME, updateData);
      toast.success(tUi("ui.pages.profile.profileUpdatedSuccessfully_3e174b238c"));

      // Refresh user data
      await fetchUserInfo();

      // Clear password fields
      setFormData({
        ...formData,
        password: '',
        confirmPassword: ''
      });
      setErrors({});
      setIsUpdateProfileOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();

    if (feedbackRating < 1 || feedbackRating > 5) {
      toast.error(tUi("ui.pages.profile.pleaseChooseARatingBetween_36f06942a7"));
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const response = await http.post(FEEDBACK_ENDPOINTS.ME, {
        rating: feedbackRating,
        comment: feedbackComment.trim() ? feedbackComment.trim() : null
      });
      setFeedbackUpdatedAt(response?.data?.updated_at || null);
      setFeedbackComment(response?.data?.comment || '');
      toast.success(tUi("ui.pages.profile.yourFeedbackHasBeenSaved_2583336bab"));
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
      </div>);

  }

  return (
    <div className="profile-page">
      <h1>{tUi("ui.pages.profile.myProfile_bfb22c6292")}</h1>
      
      <motion.div
        className={`profile-container ${isUpdateProfileOpen ? 'with-update-form' : 'without-update-form'}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
        <div className="profile-info">
          <h2>{tUi("ui.pages.profile.accountInformation_d02e627c43")}</h2>
          
          <div className="profile-image-section">
            <div className="profile-image-container">
              <img
                key={`profile-${user?.id || 'no-user'}-${user?.profile_image || 'default'}`}
                src={getProfileImageUrl()}
                alt={tUi("ui.pages.profile.profile_dbda19498d")}
                className="profile-image-display"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  console.error("Profile image failed to load. URL:", e.target.src, "User profile_image field:", user?.profile_image);
                  // Always fallback to default image on error
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }} />
              
            </div>
            <div className="profile-image-upload">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="profile-image-input" />
              
              <label htmlFor="profile-image-input" className="image-upload-label">{tUi("ui.pages.profile.chooseImage_2cc5e489af")}

              </label>
              {hasSelectedFile &&
              <button
                type="button"
                onClick={handleImageUpload}
                className="upload-image-btn"
                disabled={imageLoading}>
                
                  {imageLoading ?
                <>
                      <LoadingSpinner size="small" />{tUi("ui.pages.profile.uploading_3ee6446e17")}

                </> : tUi("ui.pages.profile.updateImage_822e5effb4")


                }
                </button>
              }
              {user?.profile_image && !hasSelectedFile &&
              <button
                type="button"
                onClick={handleDeleteImage}
                className="delete-image-btn"
                disabled={imageLoading}>
                
                  {imageLoading ?
                <>
                      <LoadingSpinner size="small" />{tUi("ui.pages.profile.deleting_e2b0801133")}

                </> : tUi("ui.pages.profile.deleteImage_280009a1bc")


                }
                </button>
              }
            </div>
          </div>
          
          <div className="info-item">
            <label>{tUi("ui.pages.profile.email_8ba28bf444")}</label>
            <span>{user.email}</span>
          </div>
          <div className="info-item">
            <label>{tUi("ui.pages.profile.name_d5d6a26537")}</label>
            <span>{user.first_name} {user.last_name}</span>
          </div>
          {user.phone &&
          <div className="info-item">
              <label>{tUi("ui.pages.profile.phone_d1e28f5b49")}</label>
              <span>{user.phone}</span>
            </div>
          }
          {(user.country || user.city || user.street) &&
          <div className="info-item">
              <label>{tUi("ui.pages.profile.address_fe584a84b3")}</label>
              <span>
                {[user.street, user.city, user.country].filter(Boolean).join(', ') || tUi("ui.pages.profile.notProvided_2f1bb337cb")}
              </span>
            </div>
          }
          <div className="info-item">
            <label>{tUi("ui.pages.profile.role_b31d4e1e69")}</label>
            <span className={`role-badge ${user.role}`}>{user.role}</span>
          </div>
          <div className="info-item">
            <label>{tUi("ui.pages.profile.memberSince_857076558e")}</label>
            <span>{formatDate(user.created_at)}</span>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="open-update-profile-btn"
              onClick={() => setIsUpdateProfileOpen(true)}>{tUi("ui.pages.profile.updateProfile_830cf82737")}


            </button>
          </div>
        </div>

        {isUpdateProfileOpen &&
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="profile-form-header">
            <h2>{tUi("ui.pages.profile.updateProfile_830cf82737")}</h2>
            <button
              type="button"
              className="close-update-profile-btn"
              onClick={() => setIsUpdateProfileOpen(false)}>{tUi("ui.pages.profile.close_2bcc546846")}


            </button>
          </div>
          
          <div className="form-group">
            <label htmlFor="first_name">{tUi("ui.pages.profile.firstName_cfb6df3262")}</label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required />
            
          </div>

          <div className="form-group">
            <label htmlFor="last_name">{tUi("ui.pages.profile.lastName_c11422a22c")}</label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required />
            
          </div>

          <div className="form-group">
            <label htmlFor="phone">{tUi("ui.pages.profile.phone_1f9e3f72ab")}</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder={tUi("ui.pages.profile.enterYourPhoneNumber_5a25e81c05")} />
            
          </div>

          <div className="form-group">
            <label htmlFor="country">{tUi("ui.pages.profile.country_8577532ab0")}</label>
            <input
              type="text"
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder={tUi("ui.pages.profile.enterYourCountry_8656218a23")} />
            
          </div>

          <div className="form-group">
            <label htmlFor="city">{tUi("ui.pages.profile.city_68610182e6")}</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder={tUi("ui.pages.profile.enterYourCity_a7bcc3b51d")} />
            
          </div>

          <div className="form-group">
            <label htmlFor="street">{tUi("ui.pages.profile.street_f8ea56af9b")}</label>
            <input
              type="text"
              id="street"
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder={tUi("ui.pages.profile.enterYourStreetAddress_537516d64c")} />
            
          </div>

          <div className="form-group">
            <label htmlFor="password">{tUi("ui.pages.profile.newPasswordLeaveBlankTo_8d251c688c")}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={tUi("ui.pages.profile.enterNewPassword_a88f41c56f")}
              className={errors.password ? "error" : ''} />
            
            <div className="profile-password-strength-line" aria-hidden="true">
              <div
                className="profile-password-strength-line-progress"
                style={{ width: `${passwordStrengthProgress}%` }} />
              
            </div>
            {errors.password &&
            <span className="error-message">{errors.password}</span>
            }
          </div>

          {formData.password &&
          <div className="form-group">
              <label htmlFor="confirmPassword">{tUi("ui.pages.profile.confirmNewPassword_007a703a2f")}</label>
              <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={tUi("ui.pages.profile.confirmNewPassword_63cf1219b5")}
              className={errors.confirmPassword ? "error" : ''} />
            
              {errors.confirmPassword &&
            <span className="error-message">{errors.confirmPassword}</span>
            }
            </div>
          }

          {hasProfileChanges &&
          <motion.button
            type="submit"
            className="update-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}>
            
              {loading ?
            <>
                  <LoadingSpinner size="small" />{tUi("ui.pages.profile.updating_76a601c4c0")}

            </> : tUi("ui.pages.profile.updateProfile_830cf82737")


            }
            </motion.button>
          }
        </form>
        }
      </motion.div>

      <motion.div
        className="customer-feedback-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
        <h2>{tUi("ui.pages.profile.customerFeedback_707542c247")}</h2>
        <p className="customer-feedback-subtitle">{tUi("ui.pages.profile.rateYourOverallExperienceFrom_b590884205")}

        </p>

        {feedbackLoading ?
        <div className="customer-feedback-loading">
            <LoadingSpinner size="small" />
          </div> :

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
                  aria-label={tUi("ui.pages.profile.rateValueStarValue_1a48721219", { value0: starValue, value1: starValue > 1 ? 's' : '' })}>
                  
                    <FaStar />
                  </button>);

            })}
              <span className="feedback-rating-value">
                {feedbackRating ? tUi("ui.pages.profile.value5_77f612a774", { value0: feedbackRating }) : tUi("ui.pages.profile.noRatingSelected_cfab02f97d")}
              </span>
            </div>

            <label htmlFor="feedback-comment">{tUi("ui.pages.profile.commentOptional_91cb37b0f9")}</label>
            <textarea
            id="feedback-comment"
            className="feedback-comment-input"
            value={feedbackComment}
            onChange={(event) => setFeedbackComment(event.target.value)}
            placeholder={tUi("ui.pages.profile.shareYourFeedbackOptional_1e9b66d587")}
            maxLength={1000}
            rows={4} />
          

            <div className="feedback-form-footer">
              <span>{feedbackComment.length}/1000</span>
              <button
              type="submit"
              className="feedback-submit-btn"
              disabled={feedbackSubmitting || feedbackRating < 1}>
              
                {feedbackSubmitting ? tUi("ui.pages.profile.saving_944600e80a") : tUi("ui.pages.profile.submitFeedback_86e110a0e0")}
              </button>
            </div>

            {feedbackUpdatedAt &&
          <p className="feedback-updated-at">{tUi("ui.pages.profile.lastUpdated_9589c4356b")}
            {formatDate(feedbackUpdatedAt)}
              </p>
          }
          </form>
        }
      </motion.div>
    </div>);

};

export default Profile;
