import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminUserDetails.css';

const ROLE_LABEL_KEYS = {
  admin: 'ui.pages.admin.adminUsers.admin_9b8c8c337f',
  support_manager: 'ui.pages.admin.adminUsers.supportManager_2a7bb3b941',
  support_agent: 'ui.pages.admin.adminUsers.supportAgent_5f7e6a1b2c',
  operations_manager: 'ui.pages.admin.adminUsers.operationsManager_e7f7834cf9',
  warehouse_manager: 'ui.pages.admin.adminUsers.warehouseManager_3e9668a875',
  seller: 'roles.seller',
  warehouse_staff: 'roles.warehouse_staff',
  driver: 'ui.pages.admin.adminUsers.driver_533424916e',
  customer: 'ui.pages.admin.adminUsers.customer_68c8b84985',
  cashier: 'ui.pages.admin.adminUsers.cashier_29b35eadb9',
};

const AdminUserDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);

  const defaultProfileImage =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  useEffect(() => {
    if (id) {
      fetchUserDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleEscape);
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
      toast.error(tUi('ui.pages.admin.adminUserDetails.failedToFetchUserDetails_f6dd9f5e61'));
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
      minute: '2-digit',
    });
  };

  const getRoleLabel = (role) => {
    const normalized = String(role || '').toLowerCase();
    const key = ROLE_LABEL_KEYS[normalized];
    if (!key) return normalized.replace(/_/g, ' ');
    if (key.startsWith('roles.')) return t(key);
    return tUi(key);
  };

  const getRoleBadgeClass = (role) => {
    const normalized = String(role || 'customer').toLowerCase();
    return `adm-udetail-role adm-udetail-role--${normalized}`;
  };

  const pageTitle = tUi('ui.pages.admin.adminUserDetails.userAccountInformation_1a87059564');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });

  return (
    <div className="admin-page-shell adm-page adm-udetail-page">
      <PageHeader
        kicker={panelKicker}
        title={pageTitle}
        subtitle={
          user
            ? tUi('ui.pages.admin.adminUserDetails.subtitleUser_2c3d4e5f6a', {
                value0: `${user.first_name} ${user.last_name}`.trim(),
                value1: user.email,
                value2: user.id,
              })
            : tUi('ui.pages.admin.adminUserDetails.subtitle_1a2b3c4d5i')
        }
        actions={
          <button
            type="button"
            className="adm-btn-secondary"
        onClick={() => navigate('/admin/users')}
          >
            {tUi('ui.pages.admin.adminUserDetails.backToUsers_7540061aa2')}
          </button>
        }
      />

      {loading ? (
        <div className="adm-udetail-loading">
          <LoadingSpinner size="large" />
        </div>
      ) : !user ? null : (
        <motion.div
          className="adm-udetail-section"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="adm-udetail-hero">
            <div className="adm-udetail-avatar-wrap">
              <img
                key={`user-${user.id}-${user.profile_image || 'default'}`}
                src={getProfileImageUrl()}
                alt={tUi('ui.pages.admin.adminUserDetails.valueValue_44af41b31d', {
                  value0: user.first_name,
                  value1: user.last_name,
                })}
                className="adm-udetail-avatar"
                loading="eager"
                decoding="async"
                onClick={() => setShowImageModal(true)}
                onError={(e) => {
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }}
              />
            </div>
            <div className="adm-udetail-hero-copy">
              <h2 className="adm-udetail-hero-name">
                {user.first_name} {user.last_name}
              </h2>
              <p className="adm-udetail-hero-email">{user.email}</p>
              <div className="adm-udetail-hero-badges">
                <span className={getRoleBadgeClass(user.role)}>{getRoleLabel(user.role)}</span>
                <span className={`adm-udetail-verified ${user.is_verified ? 'is-yes' : 'is-no'}`}>
                  {user.is_verified
                    ? tUi('ui.pages.admin.adminUserDetails.verified_ebcf9e3db7')
                    : tUi('ui.pages.admin.adminUserDetails.notVerified_b491c0f754')}
                </span>
                <span
                  className={`adm-udetail-account ${user.is_blocked ? 'is-suspended' : 'is-active'}`}
                >
                  {user.is_blocked
                    ? tUi('ui.pages.admin.adminUsers.suspended_d2685f367b')
                    : tUi('ui.pages.admin.adminUsers.active_b157924ea3')}
              </span>
              </div>
            </div>
          </div>

          <div className="adm-udetail-grid">
            <section className="adm-udetail-card" aria-labelledby="adm-udetail-personal">
              <h3 id="adm-udetail-personal" className="adm-udetail-card-title">
                {tUi('ui.pages.admin.adminUserDetails.personalInformation_fe29a51665')}
              </h3>
              <dl className="adm-udetail-rows">
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.email_13e9614207')}</dt>
                  <dd>{user.email}</dd>
                </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.fullName_66d0823b3a')}</dt>
                  <dd>
                    {user.first_name} {user.last_name}
                  </dd>
                </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.phone_9225bd8c30')}</dt>
                  <dd className={user.phone ? '' : 'is-empty'}>
                    {user.phone || tUi('ui.pages.admin.adminUserDetails.notProvided_3d4e5f6a7b')}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="adm-udetail-card" aria-labelledby="adm-udetail-address">
              <h3 id="adm-udetail-address" className="adm-udetail-card-title">
                {tUi('ui.pages.admin.adminUserDetails.addressInformation_19f7089415')}
              </h3>
              <dl className="adm-udetail-rows">
                {user.country || user.city || user.street ? (
                  <>
                    {user.country && (
                      <div className="adm-udetail-row">
                        <dt>{tUi('ui.pages.admin.adminUserDetails.country_40082871af')}</dt>
                        <dd>{user.country}</dd>
                      </div>
                    )}
                    {user.city && (
                      <div className="adm-udetail-row">
                        <dt>{tUi('ui.pages.admin.adminUserDetails.city_65c67192ed')}</dt>
                        <dd>{user.city}</dd>
                      </div>
                    )}
                    {user.street && (
                      <div className="adm-udetail-row">
                        <dt>{tUi('ui.pages.admin.adminUserDetails.street_406f2e314b')}</dt>
                        <dd>{user.street}</dd>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="adm-udetail-row">
                    <dt>{tUi('ui.pages.admin.adminUserDetails.address_99019633c4')}</dt>
                    <dd className="is-empty">
                      {tUi('ui.pages.admin.adminUserDetails.noAddressInformation_ada116b35b')}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="adm-udetail-card" aria-labelledby="adm-udetail-account">
              <h3 id="adm-udetail-account" className="adm-udetail-card-title">
                {tUi('ui.pages.admin.adminUserDetails.accountInformation_fcc50410da')}
              </h3>
              <dl className="adm-udetail-rows">
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.userId_6f1410a27e')}</dt>
                  <dd>{user.id}</dd>
                </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.role_3d4eb768fa')}</dt>
                  <dd>
                    <span className={getRoleBadgeClass(user.role)}>{getRoleLabel(user.role)}</span>
                  </dd>
                </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.verificationStatus_52adfe9a86')}</dt>
                  <dd>
                    <span className={`adm-udetail-verified ${user.is_verified ? 'is-yes' : 'is-no'}`}>
                      {user.is_verified
                        ? tUi('ui.pages.admin.adminUserDetails.verified_ebcf9e3db7')
                        : tUi('ui.pages.admin.adminUserDetails.notVerified_b491c0f754')}
                </span>
                  </dd>
              </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.accountStatus_4e5f6a7b8c')}</dt>
                  <dd>
                    <span
                      className={`adm-udetail-account ${user.is_blocked ? 'is-suspended' : 'is-active'}`}
                    >
                      {user.is_blocked
                        ? tUi('ui.pages.admin.adminUsers.suspended_d2685f367b')
                        : tUi('ui.pages.admin.adminUsers.active_b157924ea3')}
                </span>
                  </dd>
              </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.provider_7b822b516f')}</dt>
                  <dd>{user.provider || tUi('ui.pages.admin.adminUserDetails.email_54eefb5d1b')}</dd>
              </div>
                <div className="adm-udetail-row">
                  <dt>{tUi('ui.pages.admin.adminUserDetails.accountCreated_5c0218c58d')}</dt>
                  <dd>{formatDate(user.created_at)}</dd>
              </div>
              </dl>
            </section>
        </div>
      </motion.div>
      )}

      <AnimatePresence>
        {showImageModal && user && (
        <motion.div
            className="adm-udetail-image-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              className="adm-udetail-image-panel"
              initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="adm-udetail-image-close"
              onClick={() => setShowImageModal(false)}
                aria-label={tUi('ui.pages.admin.adminUserDetails.closeImage_e6ea38fce1')}
              >
                <FaTimes />
              </button>
              <img
              src={getProfileImageUrl()}
                alt={tUi('ui.pages.admin.adminUserDetails.valueValue_44af41b31d', {
                  value0: user.first_name,
                  value1: user.last_name,
                })}
                className="adm-udetail-image-full"
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
