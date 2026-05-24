import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminUsers.css';

const ROLE_FILTER_OPTIONS = [
  'all',
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

const ROLE_LABEL_KEYS = {
  all: 'ui.pages.admin.adminUsers.all_934fce7d68',
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


const AdminUsers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: currentAuthUser, loading: authLoading } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('customer');
  const [updating, setUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [blockingId, setBlockingId] = useState(null);

  // Default profile image (same as Profile page and Navbar)
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  const getProfileImageUrl = (profileImage) => {
    // Return default if profile image is null, undefined, or empty string
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
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let list = roleFilter === 'all' ? [...users] : users.filter((u) => u.role === roleFilter);
    const q = userSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().trim();
        const email = (u.email || '').toLowerCase();
        return fullName.includes(q) || email.includes(q);
      });
    }
    setFilteredUsers(list);
  }, [roleFilter, users, userSearch]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await http.get(USER_ENDPOINTS.ALL);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(tUi("ui.pages.admin.adminUsers.failedToFetchUsers_1d4b3f45e4"));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    if (selectedUser.role === newRole) {
      setShowRoleModal(false);
      return;
    }

    setUpdating(true);
    try {
      await http.patch(
        buildUrl(USER_ENDPOINTS.UPDATE_ROLE, { id: selectedUser.id }),
        { role: newRole }
      );

      toast.success(tUi("ui.pages.admin.adminUsers.userRoleUpdatedToValue_65e151007e", { value0: getRoleLabel(newRole) }));

      setUsers((prevUsers) =>
      prevUsers.map((user) =>
      user.id === selectedUser.id ? { ...user, role: newRole } : user
      )
      );

      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating role:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to update user role';
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleToggleBlock = async (user) => {
    if (!currentAuthUser || user.id === currentAuthUser.id) return;

    const nextBlocked = !user.is_blocked;
    if (nextBlocked) {
      const agreed = await confirm({
        title: tUi("ui.pages.admin.adminUsers.suspendThisUser_753829cad1"),
        message: `This will sign out ${user.first_name} ${user.last_name} (${user.email}) and block sign-in until you unblock them.`,
        confirmText: tUi("ui.pages.admin.adminUsers.suspend_b9bc672f89"),
        cancelText: tUi("ui.pages.admin.adminUsers.cancel_5783570289")
      });
      if (!agreed) return;
    }

    setBlockingId(user.id);
    try {
      const { data } = await http.patch(
        buildUrl(USER_ENDPOINTS.UPDATE_BLOCK, { id: user.id }),
        { is_blocked: nextBlocked }
      );
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...data } : u));
      toast.success(nextBlocked ? 'User suspended' : 'User reactivated');
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Failed to update account';
      toast.error(typeof msg === 'string' ? msg : 'Failed to update account');
    } finally {
      setBlockingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      await http.delete(
        buildUrl(USER_ENDPOINTS.DELETE, { id: userToDelete.id })
      );

      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userToDelete.id));

      toast.success(`User ${userToDelete.first_name} ${userToDelete.last_name} deleted successfully`);
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const countForRoleFilter = (value) =>
  value === 'all' ? users.length : users.filter((u) => u.role === value).length;

  const getRoleLabel = (role) => {
    const normalizedRole = String(role || '').toLowerCase();
    const key = ROLE_LABEL_KEYS[normalizedRole];
    if (!key) return normalizedRole.replace(/_/g, ' ');
    if (key.startsWith('roles.')) return t(key);
    return tUi(key);
  };

  const getRoleBadgeClass = (role) => {
    const normalized = String(role || 'customer').toLowerCase();
    return `adm-users-role adm-users-role--${normalized}`;
  };

  const manageUsersTitle = tUi('ui.pages.admin.adminUsers.manageUsers_eac32c061d');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });
  const userCountLabel =
    filteredUsers.length === 1
      ? tUi('ui.pages.admin.adminUsers.user_8f2a1b9c4d')
      : tUi('ui.pages.admin.adminUsers.users_7e1a0b8c3d');

  return (
    <div className="admin-page-shell adm-page adm-users-page">
      <PageHeader
        kicker={panelKicker}
        title={manageUsersTitle}
        subtitle={tUi('ui.pages.admin.adminUsers.subtitle_1a2b3c4d5h')}
        actions={
          <div className="adm-users-header-filter">
            <div className="adm-users-filter-row">
              <label className="adm-users-filter-label" htmlFor="adm-users-role-filter">
                {tUi('ui.pages.admin.adminUsers.filterByRole_9bb6e611f0')}
              </label>
              <select
                id="adm-users-role-filter"
                className="adm-users-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                {ROLE_FILTER_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {getRoleLabel(value)} ({countForRoleFilter(value)})
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-users-header-meta" aria-live="polite">
              <strong>{filteredUsers.length}</strong> {userCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-users-section">
        <div className="adm-users-toolbar">
          <label className="adm-users-search" htmlFor="admin-users-search">
            <FaMagnifyingGlass className="adm-users-search-icon" aria-hidden />
            <input
              id="admin-users-search"
              type="search"
              placeholder={tUi('ui.pages.admin.adminUsers.nameOrEmail_0be30e7013')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              autoComplete="off"
            />
            {userSearch.trim() !== '' && (
            <button
              type="button"
                className="adm-users-search-clear"
              onClick={() => setUserSearch('')}
                aria-label={tUi('ui.pages.admin.adminUsers.clearSearch_2e1d2ddc8e')}
              >
                {tUi('ui.pages.admin.adminUsers.clear_7ef332b212')}
            </button>
          )}
          </label>
        </div>

        {loading ? (
          <div className="adm-users-loading">
            <LoadingSpinner size="large" />
      </div>
        ) : (
          <div className="adm-users-data-panel" role="region" aria-label={manageUsersTitle}>
            <table className="adm-users-table">
          <thead>
            <tr>
              <th className="adm-users-col-id" scope="col">
                {tUi('ui.common.id')}
              </th>
              <th className="adm-users-col-name" scope="col">
                {tUi('ui.pages.admin.adminUsers.name_219118e2b5')}
              </th>
              <th className="adm-users-col-email" scope="col">
                {tUi('ui.pages.admin.adminUsers.email_2753725b15')}
              </th>
              <th className="adm-users-col-role" scope="col">
                {tUi('ui.pages.admin.adminUsers.role_da88828778')}
              </th>
              <th className="adm-users-col-verified" scope="col">
                {tUi('ui.pages.admin.adminUsers.verified_e1f19650a1')}
              </th>
              <th className="adm-users-col-actions" scope="col">
                {tUi('ui.pages.admin.adminUsers.actions_eeeaafac64')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="adm-users-empty">
                  {users.length === 0
                    ? tUi('ui.pages.admin.adminUsers.noUsersFound_53cddce410')
                    : userSearch.trim()
                      ? tUi('ui.pages.admin.adminUsers.noUsersMatchYourSearch_afa1ee1f27')
                      : tUi('ui.pages.admin.adminUsers.noUsersMatchTheSelected_6abe98d630')}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
            <motion.tr
              key={user.id}
                  initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`adm-users-row${user.is_blocked ? ' is-blocked' : ''}`}
              onClick={() => navigate(`/admin/users/${user.id}`)}
                >
                  <td className="adm-users-col-id adm-users-id">{user.id}</td>
                  <td className="adm-users-col-name">
                    <div className="adm-users-name-cell">
                      <img
                    src={getProfileImageUrl(user.profile_image)}
                        alt={tUi('ui.pages.admin.adminUsers.valueValue_e33c0a89f9', {
                          value0: user.first_name,
                          value1: user.last_name
                        })}
                        className="adm-users-avatar"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      if (e.target.src !== defaultProfileImage) {
                        e.target.src = defaultProfileImage;
                      }
                        }}
                      />
                      <span>
                        {user.first_name} {user.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="adm-users-col-email">{user.email}</td>
                  <td className="adm-users-col-role">
                    <span className={getRoleBadgeClass(user.role)}>{getRoleLabel(user.role)}</span>
                  </td>
                  <td className="adm-users-col-verified">
                    <span className={`adm-users-verified ${user.is_verified ? 'is-yes' : 'is-no'}`}>
                      {user.is_verified
                        ? tUi('ui.pages.admin.adminUsers.verified_e00687bf61')
                        : tUi('ui.pages.admin.adminUsers.notVerified_b97e561e2a')}
                    </span>
                  </td>
                  <td className="adm-users-col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="adm-users-actions">
                      {authLoading ? (
                        <span className="adm-users-actions-placeholder">…</span>
                      ) : currentAuthUser?.id === user.id ? (
                        <span
                          className="adm-users-actions-placeholder"
                          title={tUi('ui.pages.admin.adminUsers.youCannotBlockYourOwn_b9b05a483d')}
                        >
                          —
                        </span>
                      ) : (
                  <button
                    type="button"
                          className={`adm-users-btn ${user.is_blocked ? 'adm-users-btn--unblock' : 'adm-users-btn--block'}`}
                          onClick={() => handleToggleBlock(user)}
                          disabled={updating || deleting || blockingId === user.id}
                        >
                          {blockingId === user.id
                            ? '…'
                            : user.is_blocked
                              ? tUi('ui.pages.admin.adminUsers.unblock_6cbc50835c')
                              : tUi('ui.pages.admin.adminUsers.block_acca25213e')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="adm-users-btn adm-users-btn--role"
                        onClick={() => handleRoleChange(user)}
                        disabled={updating || deleting}
                      >
                        {tUi('ui.pages.admin.adminUsers.changeRole_3f89e37f4b')}
                  </button>
                      <button
                        type="button"
                        className="adm-users-btn adm-users-btn--delete"
                        onClick={() => handleDeleteClick(user)}
                        disabled={updating || deleting}
                      >
                        {tUi('ui.pages.admin.adminUsers.delete_a6a9493a15')}
                  </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        )}
      </section>

      <AnimatePresence>
        {showRoleModal && selectedUser && (
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
                  {selectedUser.first_name} {selectedUser.last_name}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.email_9b95f1bdda')}</strong>
                  {selectedUser.email}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.currentRole_307a24331e')}</strong>
                  <span className={getRoleBadgeClass(selectedUser.role)}>
                    {getRoleLabel(selectedUser.role)}
                  </span>
                </p>
              </div>
              <div className="adm-users-field">
                <label htmlFor="adm-users-new-role">
                  {tUi('ui.pages.admin.adminUsers.newRole_1fb198cad7')}
                </label>
                <select
                  id="adm-users-new-role"
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
                  disabled={updating || selectedUser.role === newRole}
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
        {showDeleteModal && userToDelete && (
        <motion.div
            className="adm-users-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
            onClick={() => {
              setShowDeleteModal(false);
              setUserToDelete(null);
            }}
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
                  {userToDelete.first_name} {userToDelete.last_name}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.email_9b95f1bdda')}</strong>
                  {userToDelete.email}
                </p>
                <p>
                  <strong>{tUi('ui.pages.admin.adminUsers.role_5bf17f27d3')}</strong>
                  <span className={getRoleBadgeClass(userToDelete.role)}>
                    {getRoleLabel(userToDelete.role)}
                  </span>
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
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
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
    </div>
  );

};

export default AdminUsers;
