import { tUi } from '../i18n/uiText';
import { getRoleLabel } from '../i18n/roles';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import API_BASE_URL, { USER_ENDPOINTS, FEEDBACK_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import {
  formatDate,
  isStrongPassword,
  getStrongPasswordErrorMessage,
  getPasswordStrengthProgress,
  DEFAULT_PROFILE_IMAGE,
  resolveProfileImageUrl,
} from
'../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { useConfirm } from '../hooks/useConfirm';
import { FaStar } from 'react-icons/fa';
import '../styles/pages/Profile.css';

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthKeyFromDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

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
  const feedbackLastSubmittedMonth = useMemo(
    () => getMonthKeyFromDate(feedbackUpdatedAt),
    [feedbackUpdatedAt]
  );
  const hasSubmittedFeedbackThisMonth = useMemo(
    () => feedbackLastSubmittedMonth === getCurrentMonthKey(),
    [feedbackLastSubmittedMonth]
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

  const getProfileImageUrl = () =>
    resolveProfileImageUrl(user?.profile_image, {
      apiBaseUrl: API_BASE_URL,
      defaultImage: DEFAULT_PROFILE_IMAGE,
      previewUrl: previewImage,
    });

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

    if (hasSubmittedFeedbackThisMonth) {
      toast.info(tUi("ui.pages.profile.feedbackAlreadySubmittedThisMonth_b1a12a9a77"));
      return;
    }

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
      <div className="page-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="page-shell profile-page">
      <PageHeader
        kicker={tUi('ui.pages.profile.profile_dbda19498d')}
        title={tUi('ui.pages.profile.myProfile_bfb22c6292')}
        subtitle={tUi('ui.pages.profile.pageSubtitle')}
      />

      <motion.section
        className="profile-section profile-section--overview"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="profile-overview-card">
          <div className="profile-overview-avatar-wrap">
            <img
              key={`profile-${user?.id || 'no-user'}-${user?.profile_image || 'default'}`}
              src={getProfileImageUrl()}
              alt={tUi('ui.pages.profile.profile_dbda19498d')}
              className="profile-image-display"
              loading="eager"
              decoding="async"
              onError={(e) => {
                if (e.target.src !== DEFAULT_PROFILE_IMAGE) {
                  e.target.src = DEFAULT_PROFILE_IMAGE;
                }
              }}
            />
            <div className="profile-image-actions">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="profile-image-input"
              />
              <label htmlFor="profile-image-input" className="page-btn-primary profile-image-btn">
                {tUi('ui.pages.profile.chooseImage_2cc5e489af')}
              </label>
              {hasSelectedFile && (
                <button type="button" onClick={handleImageUpload} className="page-btn-primary profile-image-btn profile-image-btn--success" disabled={imageLoading}>
                  {imageLoading ? (
                    <>
                      <LoadingSpinner size="small" />
                      {tUi('ui.pages.profile.uploading_3ee6446e17')}
                    </>
                  ) : (
                    tUi('ui.pages.profile.updateImage_822e5effb4')
                  )}
                </button>
              )}
              {user?.profile_image && !hasSelectedFile && (
                <button type="button" onClick={handleDeleteImage} className="page-btn-danger profile-image-btn" disabled={imageLoading}>
                  {imageLoading ? (
                    <>
                      <LoadingSpinner size="small" />
                      {tUi('ui.pages.profile.deleting_e2b0801133')}
                    </>
                  ) : (
                    tUi('ui.pages.profile.deleteImage_280009a1bc')
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="profile-overview-copy">
            <h2>{user.first_name} {user.last_name}</h2>
            <p className="profile-overview-email">{user.email}</p>
            <div className="profile-overview-meta">
              <span className={`role-badge ${user.role}`}>{getRoleLabel(user.role)}</span>
              <p className="profile-member-since">
                {tUi('ui.pages.profile.memberSince_857076558e')} {formatDate(user.created_at)}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="profile-content-columns">
        <div className="profile-main-column">
      <section className="profile-section profile-section--account">
        <div className="profile-section-header">
          <h2>{tUi('ui.pages.profile.accountInformation_d02e627c43')}</h2>
        </div>
        <div className="profile-details-grid">
          <div className="profile-detail-card">
            <label>{tUi('ui.pages.profile.email_8ba28bf444')}</label>
            <span>{user.email}</span>
          </div>
          <div className="profile-detail-card">
            <label>{tUi('ui.pages.profile.name_d5d6a26537')}</label>
            <span>{user.first_name} {user.last_name}</span>
          </div>
          <div className="profile-detail-card">
            <label>{tUi('ui.pages.profile.phone_d1e28f5b49')}</label>
            <span>{user.phone || tUi('ui.pages.profile.notProvided_2f1bb337cb')}</span>
          </div>
          <div className="profile-detail-card">
            <label>{tUi('ui.pages.profile.address_fe584a84b3')}</label>
            <span>
              {[user.street, user.city, user.country].filter(Boolean).join(', ') || tUi('ui.pages.profile.notProvided_2f1bb337cb')}
            </span>
          </div>
          <div className="profile-detail-card">
            <label>{tUi('ui.pages.profile.role_b31d4e1e69')}</label>
            <span className={`role-badge ${user.role}`}>{getRoleLabel(user.role)}</span>
          </div>
          <div className="profile-detail-card">
            <label>{tUi('ui.pages.profile.memberSince_857076558e')}</label>
            <span>{formatDate(user.created_at)}</span>
          </div>
        </div>
        {!isUpdateProfileOpen && (
          <div className="profile-section-actions">
            <button type="button" className="page-btn-primary" onClick={() => setIsUpdateProfileOpen(true)}>
              {tUi('ui.pages.profile.updateProfile_830cf82737')}
            </button>
          </div>
        )}
      </section>

      {isUpdateProfileOpen && (
        <motion.section
          className="profile-section profile-section--update"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <form onSubmit={handleSubmit} className="profile-form-panel">
            <div className="profile-form-header">
              <h2>{tUi('ui.pages.profile.updateProfile_830cf82737')}</h2>
              <button type="button" className="profile-btn-ghost" onClick={() => setIsUpdateProfileOpen(false)}>
                {tUi('ui.pages.profile.close_2bcc546846')}
              </button>
            </div>

            <div className="profile-form-grid">
              <div className="form-group">
                <label htmlFor="first_name">{tUi('ui.pages.profile.firstName_cfb6df3262')}</label>
                <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">{tUi('ui.pages.profile.lastName_c11422a22c')}</label>
                <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="phone">{tUi('ui.pages.profile.phone_1f9e3f72ab')}</label>
                <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder={tUi('ui.pages.profile.enterYourPhoneNumber_5a25e81c05')} />
              </div>
              <div className="form-group">
                <label htmlFor="country">{tUi('ui.pages.profile.country_8577532ab0')}</label>
                <input type="text" id="country" name="country" value={formData.country} onChange={handleChange} placeholder={tUi('ui.pages.profile.enterYourCountry_8656218a23')} />
              </div>
              <div className="form-group">
                <label htmlFor="city">{tUi('ui.pages.profile.city_68610182e6')}</label>
                <input type="text" id="city" name="city" value={formData.city} onChange={handleChange} placeholder={tUi('ui.pages.profile.enterYourCity_a7bcc3b51d')} />
              </div>
              <div className="form-group">
                <label htmlFor="street">{tUi('ui.pages.profile.street_f8ea56af9b')}</label>
                <input type="text" id="street" name="street" value={formData.street} onChange={handleChange} placeholder={tUi('ui.pages.profile.enterYourStreetAddress_537516d64c')} />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="password">{tUi('ui.pages.profile.newPasswordLeaveBlankTo_8d251c688c')}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={tUi('ui.pages.profile.enterNewPassword_a88f41c56f')}
                  className={errors.password ? 'error' : ''}
                />
                <div className="profile-password-strength-line" aria-hidden="true">
                  <div className="profile-password-strength-line-progress" style={{ width: `${passwordStrengthProgress}%` }} />
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>
              {formData.password && (
                <div className="form-group form-group--full">
                  <label htmlFor="confirmPassword">{tUi('ui.pages.profile.confirmNewPassword_007a703a2f')}</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={tUi('ui.pages.profile.confirmNewPassword_63cf1219b5')}
                    className={errors.confirmPassword ? 'error' : ''}
                  />
                  {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
                </div>
              )}
            </div>

            {hasProfileChanges && (
              <div className="profile-form-footer">
                <motion.button type="submit" className="page-btn-primary" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {loading ? (
                    <>
                      <LoadingSpinner size="small" />
                      {tUi('ui.pages.profile.updating_76a601c4c0')}
                    </>
                  ) : (
                    tUi('ui.pages.profile.updateProfile_830cf82737')
                  )}
                </motion.button>
              </div>
            )}
          </form>
        </motion.section>
      )}

        </div>

        <div className="profile-side-column">
      <motion.section
        className="profile-section profile-section--feedback"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <div className="profile-section-header">
          <h2>{tUi('ui.pages.profile.customerFeedback_707542c247')}</h2>
          <p>{tUi('ui.pages.profile.rateYourOverallExperienceFrom_b590884205')}</p>
        </div>
        <div className="profile-feedback-panel">
          {feedbackLoading ? (
            <div className="profile-feedback-loading">
              <LoadingSpinner size="small" />
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback} className="profile-feedback-form">
              <div className="profile-feedback-stars" onMouseLeave={() => setFeedbackHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const activeRating = feedbackHoverRating || feedbackRating;
                  const isActive = starValue <= activeRating;
                  return (
                    <button
                      key={starValue}
                      type="button"
                      className={`profile-feedback-star-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setFeedbackRating(starValue)}
                      onMouseEnter={() => setFeedbackHoverRating(starValue)}
                      aria-label={tUi('ui.pages.profile.rateValueStarValue_1a48721219', { value0: starValue, value1: starValue > 1 ? 's' : '' })}
                    >
                      <FaStar />
                    </button>
                  );
                })}
                <span className="profile-feedback-rating-value">
                  {feedbackRating ? tUi('ui.pages.profile.value5_77f612a774', { value0: feedbackRating }) : tUi('ui.pages.profile.noRatingSelected_cfab02f97d')}
                </span>
              </div>

              <label htmlFor="feedback-comment">{tUi('ui.pages.profile.commentOptional_91cb37b0f9')}</label>
              <textarea
                id="feedback-comment"
                className="profile-feedback-comment"
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                placeholder={tUi('ui.pages.profile.shareYourFeedbackOptional_1e9b66d587')}
                maxLength={1000}
                rows={4}
              />

              <div className="profile-feedback-footer">
                <span>{feedbackComment.length}/1000</span>
                <button type="submit" className="page-btn-primary" disabled={feedbackSubmitting || feedbackRating < 1 || hasSubmittedFeedbackThisMonth}>
                  {feedbackSubmitting ? tUi('ui.pages.profile.saving_944600e80a') : tUi('ui.pages.profile.submitFeedback_86e110a0e0')}
                </button>
              </div>
              {hasSubmittedFeedbackThisMonth && (
                <p className="profile-feedback-note">{tUi('ui.pages.profile.feedbackAlreadySubmittedThisMonth_b1a12a9a77')}</p>
              )}
              {feedbackUpdatedAt && (
                <p className="profile-feedback-updated">
                  {tUi('ui.pages.profile.lastUpdated_9589c4356b')} {formatDate(feedbackUpdatedAt)}
                </p>
              )}
            </form>
          )}
        </div>
      </motion.section>
        </div>
      </div>
    </div>
  );

};

export default Profile;
