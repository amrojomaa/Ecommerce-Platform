import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminUserDetails.css';

const AdminUserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);

  // Default profile image (same as Profile page)
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  useEffect(() => {
    if (id) {
      fetchUserDetails();
    }
  }, [id]);

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
      toast.error('Failed to fetch user details');
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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
      case 'customer':
        return 'role-badge customer';
      default:
        return 'role-badge';
    }
  };

  if (loading) {
    return (
      <div className="admin-user-details-loading">
        <LoadingSpinner size="large" />
      </div>
    );
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
        whileTap={{ scale: 0.95 }}
      >
        ← Back to Users
      </motion.button>

      <motion.div
        className="user-details-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="user-details-header">
          <h1>User Account Information</h1>
        </div>

        <div className="user-details-content">
          <div className="user-profile-section">
            <div className="profile-image-container">
              <img
                key={`user-${user.id}-${user.profile_image || 'default'}`}
                src={getProfileImageUrl()}
                alt={`${user.first_name} ${user.last_name}`}
                className="profile-image-display"
                loading="eager"
                decoding="async"
                // onClick={() => setShowImageModal(true)}
                style={{ cursor: 'pointer' }}
                onError={(e) => {
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }}
              />
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
              <h3>Personal Information</h3>
              <div className="info-item">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
              <div className="info-item">
                <label>Full Name:</label>
                <span>{user.first_name} {user.last_name}</span>
              </div>
              {user.phone && (
                <div className="info-item">
                  <label>Phone:</label>
                  <span>{user.phone}</span>
                </div>
              )}
            </div>

            <div className="info-group">
              <h3>Address Information</h3>
              {user.country && (
                <div className="info-item">
                  <label>Country:</label>
                  <span>{user.country}</span>
                </div>
              )}
              {user.city && (
                <div className="info-item">
                  <label>City:</label>
                  <span>{user.city}</span>
                </div>
              )}
              {user.street && (
                <div className="info-item">
                  <label>Street:</label>
                  <span>{user.street}</span>
                </div>
              )}
              {!user.country && !user.city && !user.street && (
                <div className="info-item">
                  <label>Address:</label>
                  <span className="no-data">No address information</span>
                </div>
              )}
            </div>

            <div className="info-group">
              <h3>Account Information</h3>
              <div className="info-item">
                <label>User ID:</label>
                <span>{user.id}</span>
              </div>
              <div className="info-item">
                <label>Role:</label>
                <span className={getRoleBadgeClass(user.role)}>
                  {user.role}
                </span>
              </div>
              <div className="info-item">
                <label>Verification Status:</label>
                <span className={user.is_verified ? 'verified' : 'not-verified'}>
                  {user.is_verified ? '✓ Verified' : '✗ Not Verified'}
                </span>
              </div>
              <div className="info-item">
                <label>Provider:</label>
                <span>{user.provider || 'email'}</span>
              </div>
              <div className="info-item">
                <label>Account Created:</label>
                <span>{formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {showImageModal && (
          <motion.div
            className="image-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              className="image-modal-content"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="image-modal-close"
                onClick={() => setShowImageModal(false)}
                aria-label="Close image"
              >
                <FaTimes />
              </button>
              <img
                src={getProfileImageUrl()}
                alt={`${user.first_name} ${user.last_name}`}
                className="image-modal-image"
                onError={(e) => {
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUserDetails;
