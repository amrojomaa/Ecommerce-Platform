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
import { formatDateTime, resolveProfileImageUrl, DEFAULT_PROFILE_IMAGE } from '../../utils/helpers';
import { getRoleLabel as translateRoleLabel } from '../../i18n/roles';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminUsers.css';
import '../../styles/pages/admin/AdminUserDetails.css';

const AVATAR_DISPLAY_SIZE = 112;

const ROLE_OPTIONS = [
  'admin',
  'support_manager',
  'support_agent',
  'operations_manager',
  'warehouse_manager',
  'seller',
  'warehouse_staff',
  'driver',
  'customer',
  'cashier',
];

const AdminUserDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentAuthUser } = useAuth();
  const confirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('customer');
  const [updating, setUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocking, setBlocking] = useState(false);

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

  const getProfileImageUrl = (displaySize = AVATAR_DISPLAY_SIZE) =>
    resolveProfileImageUrl(user?.profile_image, {
      apiBaseUrl: API_BASE_URL,
      defaultImage: DEFAULT_PROFILE_IMAGE,
      displaySize,
    });

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

  const getRoleLabel = (role) => translateRoleLabel(role);

  const getRoleBadgeClass = (role) => {
    const normalized = String(role || 'customer').toLowerCase();
    return `adm-udetail-role adm-udetail-role--${normalized}`;
  };

  const getUsersRoleBadgeClass = (role) => {
    const normalized = String(role || 'customer').toLowerCase();
    return `adm-users-role adm-users-role--${normalized}`;
  };

  const handleOpenRoleModal = () => {
    if (!user) return;
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const handleUpdateRole = async () => {
    if (!user || user.role === newRole) {
      setShowRoleModal(false);
      return;
    }

    setUpdating(true);
    try {
      await http.patch(buildUrl(USER_ENDPOINTS.UPDATE_ROLE, { id: user.id }), { role: newRole });
      setUser((prev) => (prev ? { ...prev, role: newRole } : prev));
      toast.success(
        tUi('ui.pages.admin.adminUsers.userRoleUpdatedToValue_65e151007e', {
          value0: getRoleLabel(newRole),
        })
      );
      setShowRoleModal(false);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(error.response?.data?.detail || 'Failed to update user role');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user || !currentAuthUser || user.id === currentAuthUser.id) return;

    const nextBlocked = !user.is_blocked;
    if (nextBlocked) {
      const agreed = await confirm({
        title: tUi('ui.pages.admin.adminUsers.suspendThisUser_753829cad1'),
        message: tUi('ui.pages.admin.adminUserDetails.suspendConfirm_8a9b0c1d2e', {
          value0: `${user.first_name} ${user.last_name}`,
          value1: user.email,
        }),
        confirmText: tUi('ui.pages.admin.adminUsers.suspend_b9bc672f89'),
        cancelText: tUi('ui.pages.admin.adminUsers.cancel_5783570289'),
      });
      if (!agreed) return;
    }

    setBlocking(true);
    try {
      const { data } = await http.patch(buildUrl(USER_ENDPOINTS.UPDATE_BLOCK, { id: user.id }), {
        is_blocked: nextBlocked,
      });
      setUser((prev) => (prev ? { ...prev, ...data } : prev));
      toast.success(
        nextBlocked
          ? tUi('ui.pages.admin.adminUserDetails.userSuspended_9b0c1d2e3f')
          : tUi('ui.pages.admin.adminUserDetails.userReactivated_0c1d2e3f4a')
      );
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Failed to update account';
      toast.error(typeof msg === 'string' ? msg : 'Failed to update account');
    } finally {
      setBlocking(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      await http.delete(buildUrl(USER_ENDPOINTS.DELETE, { id: user.id }));
      toast.success(
        tUi('ui.pages.admin.adminUserDetails.userDeleted_1d2e3f4a5b', {
          value0: `${user.first_name} ${user.last_name}`,
        })
      );
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const isSelf = currentAuthUser?.id === user?.id;

  const pageTitle = tUi('ui.pages.admin.adminUserDetails.userAccountInformation_1a87059564');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });

  return (
    <div className="admin-page-shell adm-page adm-udetail-page">
      <PageHeader
        kicker={panelKicker}
        title={pageTitle}
        subtitle={tUi('ui.pages.admin.adminUserDetails.subtitle_1a2b3c4d5i')}
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
            <div className="adm-udetail-hero-main">
              <div className="adm-udetail-avatar-wrap">
                <img
                  key={`user-${user.id}-${user.profile_image || 'default'}`}
                  src={getProfileImageUrl()}
                  alt={tUi('ui.pages.admin.adminUserDetails.valueValue_44af41b31d', {
                    value0: user.first_name,
                    value1: user.last_name,
                  })}
                  className="adm-udetail-avatar"
                  width={AVATAR_DISPLAY_SIZE}
                  height={AVATAR_DISPLAY_SIZE}
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onClick={() => setShowImageModal(true)}
                  onError={(e) => {
                    if (e.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                      e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
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

            <div className="adm-udetail-hero-actions" aria-label={tUi('ui.pages.admin.adminUserDetails.actions_7e8f9a0b1c')}>
              <div className="adm-udetail-actions">
                {!isSelf && (
                  <button
                    type="button"
                    className="adm-btn-primary adm-udetail-action-btn"
                    onClick={handleOpenRoleModal}
                    disabled={updating || deleting || blocking}
                  >
                    {tUi('ui.pages.admin.adminUsers.changeRole_3f89e37f4b')}
                  </button>
                )}
                {!isSelf && (
                  <button
                    type="button"
                    className={`adm-btn-secondary adm-udetail-action-btn ${user.is_blocked ? 'adm-udetail-action-btn--unblock' : 'adm-udetail-action-btn--block'}`}
                    onClick={handleToggleBlock}
                    disabled={updating || deleting || blocking}
                  >
                    {blocking
                      ? tUi('ui.pages.admin.adminUsers.updating_10c0262ea0')
                      : user.is_blocked
                        ? tUi('ui.pages.admin.adminUsers.unblock_6cbc50835c')
                        : tUi('ui.pages.admin.adminUsers.block_acca25213e')}
                  </button>
                )}
                <button
                  type="button"
                  className="adm-users-btn adm-users-btn--delete adm-udetail-action-btn adm-udetail-action-btn--delete"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={updating || deleting || blocking}
                >
                  {tUi('ui.pages.admin.adminUsers.delete_a6a9493a15')}
                </button>
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
                  <dt>{tUi('ui.pages.admin.adminUserDetails.created_6f7a8b9c0d')}</dt>
                  <dd>{formatDate(user.created_at)}</dd>
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
              </dl>
            </section>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showRoleModal && user && (
          <motion.div
            className="adm-users-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRoleModal(false)}
          >
            <motion.div
              className="adm-users-modal"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{tUi('ui.pages.admin.adminUsers.changeUserRole_086699c24a')}</h2>
              <div className="adm-users-modal-info">
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.user_47b8c7478c')}</strong>
                  {user.first_name} {user.last_name}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.email_9b95f1bdda')}</strong>
                  {user.email}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.currentRole_307a24331e')}</strong>
                  <span className={getUsersRoleBadgeClass(user.role)}>{getRoleLabel(user.role)}</span>
                </p>
              </div>
              <div className="adm-users-field">
                <label htmlFor="adm-udetail-new-role">
                  {tUi('ui.pages.admin.adminUsers.newRole_1fb198cad7')}
                </label>
                <select
                  id="adm-udetail-new-role"
                  className="adm-users-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={updating}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adm-users-modal-actions">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setShowRoleModal(false)}
                  disabled={updating}
                >
                  {tUi('ui.pages.admin.adminUsers.cancel_5783570289')}
                </button>
                <button
                  type="button"
                  className="adm-btn-primary"
                  onClick={handleUpdateRole}
                  disabled={updating || user.role === newRole}
                >
                  {updating
                    ? tUi('ui.pages.admin.adminUsers.updating_10c0262ea0')
                    : tUi('ui.pages.admin.adminUsers.updateRole_cfc1a123e5')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && user && (
          <motion.div
            className="adm-users-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              className="adm-users-modal"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{tUi('ui.pages.admin.adminUsers.deleteUser_e3ea89de3e')}</h2>
              <div className="adm-users-modal-info">
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.user_47b8c7478c')}</strong>
                  {user.first_name} {user.last_name}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.email_9b95f1bdda')}</strong>
                  {user.email}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.role_5bf17f27d3')}</strong>
                  <span className={getUsersRoleBadgeClass(user.role)}>{getRoleLabel(user.role)}</span>
                </p>
              </div>
              <div className="adm-users-modal-warning">
                <p>{tUi('ui.pages.admin.adminUsers.areYouSureYouWant_f9aef4fec1')}</p>
                <p>{tUi('ui.pages.admin.adminUsers.thisActionCannotBeUndone_c8a181f419')}</p>
              </div>
              <div className="adm-users-modal-actions">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  {tUi('ui.pages.admin.adminUsers.cancel_5783570289')}
                </button>
                <button
                  type="button"
                  className="adm-users-btn--delete-modal"
                  onClick={handleDeleteUser}
                  disabled={deleting}
                >
                  {deleting
                    ? tUi('ui.pages.admin.adminUsers.deleting_51d4fbc5d4')
                    : tUi('ui.pages.admin.adminUsers.deleteUser_e3ea89de3e')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                src={getProfileImageUrl(480)}
                alt={tUi('ui.pages.admin.adminUserDetails.valueValue_44af41b31d', {
                  value0: user.first_name,
                  value1: user.last_name,
                })}
                className="adm-udetail-image-full"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                    e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
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
