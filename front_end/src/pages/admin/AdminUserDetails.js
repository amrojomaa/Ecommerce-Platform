import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/pages/admin/AdminUserDetails.css';

const AdminUserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);

  // Default profile image (same as Profile page)
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      fetchUserDetails();
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showImageModal]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const response = await http.get(buildUrl(USER_ENDPOINTS.BY_ID, { id }));
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error(tUi("ui.pages.admin.adminUserDetails.failedToFetchUserDetails_f6dd9f5e61"));
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const getProfileImageUrl = () => {
    if (!user) {
      return defaultProfileImage;
    }

    const profileImage = user.profile_image;
    if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
      return defaultProfileImage;
    }

    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      return profileImage;
    }

    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateTime(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'role-badge admin';
      case 'employee':
        return 'role-badge employee';
      case 'operations_manager':
        return 'role-badge operations_manager';
      case 'support_manager':
        return 'role-badge support_manager';
      case 'warehouse_manager':
        return 'role-badge warehouse_manager';
      case 'driver':
        return 'role-badge driver';
      case 'customer':
        return 'role-badge customer';
      case 'cashier':
        return 'role-badge cashier';
      default:
        return 'role-badge';
    }
  };

  if (loading) {
    return (
      <div className="admin-user-details-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  if (!user) {
    return null;
  }

  return (
    <div className="admin-user-details">
      <motion.button
        className="back-button"
        onClick={() => navigate('/admin/users')}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}>{tUi("ui.pages.admin.adminUserDetails.backToUsers_7540061aa2")}


      </motion.button>

      <motion.div
        className="user-details-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}>
        
        <div className="user-details-header">
          <h1>{tUi("ui.pages.admin.adminUserDetails.userAccountInformation_1a87059564")}</h1>
        </div>

        <div className="user-details-content">
          <div className="user-profile-section">
            <div className="profile-image-container">
              <img
                key={`user-${user.id}-${user.profile_image || 'default'}`}
                src={getProfileImageUrl()}
                alt={tUi("ui.pages.admin.adminUserDetails.valueValue_44af41b31d", { value0: user.first_name, value1: user.last_name })}
                className="profile-image-display"
                loading="eager"
                decoding="async"
                // onClick={() => setShowImageModal(true)}
                style={{ cursor: 'pointer' }}
                onError={(e) => {
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }} />
              
            </div>
            <div className="user-name-header">
              <h2>{user.first_name} {user.last_name}</h2>
              <span className={getRoleBadgeClass(user.role)}>
                {user.role}
              </span>
            </div>
          </div>

          <div className="user-info-section">
            <div className="info-group">
              <h3>{tUi("ui.pages.admin.adminUserDetails.personalInformation_fe29a51665")}</h3>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.email_13e9614207")}</label>
                <span>{user.email}</span>
              </div>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.fullName_66d0823b3a")}</label>
                <span>{user.first_name} {user.last_name}</span>
              </div>
              {user.phone &&
              <div className="info-item">
                  <label>{tUi("ui.pages.admin.adminUserDetails.phone_9225bd8c30")}</label>
                  <span>{user.phone}</span>
                </div>
              }
            </div>

            <div className="info-group">
              <h3>{tUi("ui.pages.admin.adminUserDetails.addressInformation_19f7089415")}</h3>
              {user.country &&
              <div className="info-item">
                  <label>{tUi("ui.pages.admin.adminUserDetails.country_40082871af")}</label>
                  <span>{user.country}</span>
                </div>
              }
              {user.city &&
              <div className="info-item">
                  <label>{tUi("ui.pages.admin.adminUserDetails.city_65c67192ed")}</label>
                  <span>{user.city}</span>
                </div>
              }
              {user.street &&
              <div className="info-item">
                  <label>{tUi("ui.pages.admin.adminUserDetails.street_406f2e314b")}</label>
                  <span>{user.street}</span>
                </div>
              }
              {!user.country && !user.city && !user.street &&
              <div className="info-item">
                  <label>{tUi("ui.pages.admin.adminUserDetails.address_99019633c4")}</label>
                  <span className="no-data">{tUi("ui.pages.admin.adminUserDetails.noAddressInformation_ada116b35b")}</span>
                </div>
              }
            </div>

            <div className="info-group">
              <h3>{tUi("ui.pages.admin.adminUserDetails.accountInformation_fcc50410da")}</h3>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.userId_6f1410a27e")}</label>
                <span>{user.id}</span>
              </div>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.role_3d4eb768fa")}</label>
                <span className={getRoleBadgeClass(user.role)}>
                  {user.role}
                </span>
              </div>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.verificationStatus_52adfe9a86")}</label>
                <span className={user.is_verified ? "verified" : "not-verified"}>
                  {user.is_verified ? tUi("ui.pages.admin.adminUserDetails.verified_ebcf9e3db7") : tUi("ui.pages.admin.adminUserDetails.notVerified_b491c0f754")}
                </span>
              </div>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.provider_7b822b516f")}</label>
                <span>{user.provider || tUi("ui.pages.admin.adminUserDetails.email_54eefb5d1b")}</span>
              </div>
              <div className="info-item">
                <label>{tUi("ui.pages.admin.adminUserDetails.accountCreated_5c0218c58d")}</label>
                <span>{formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {showImageModal &&
        <motion.div
          className="image-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowImageModal(false)}>
          
            <motion.div
            className="image-modal-content"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}>
            
              <button
              className="image-modal-close"
              onClick={() => setShowImageModal(false)}
              aria-label={tUi("ui.pages.admin.adminUserDetails.closeImage_e6ea38fce1")}>
              
                <FaTimes />
              </button>
              <img
              src={getProfileImageUrl()}
              alt={tUi("ui.pages.admin.adminUserDetails.valueValue_44af41b31d", { value0: user.first_name, value1: user.last_name })}
              className="image-modal-image"
              onError={(e) => {
                if (e.target.src !== defaultProfileImage) {
                  e.target.src = defaultProfileImage;
                }
              }} />
            
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

export default AdminUserDetails;
