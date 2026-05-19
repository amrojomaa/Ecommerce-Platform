import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import { formatDate as formatLocalizedDate } from '../../utils/helpers';
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

const ROLE_LABEL_KEYS = {
  all: 'ui.pages.admin.adminUsers.all_934fce7d68',
  admin: 'ui.pages.admin.adminUsers.admin_9b8c8c337f',
  support_manager: 'ui.pages.admin.adminUsers.supportManager_2a7bb3b941',
  support_agent: 'ui.pages.admin.adminUsers.supportAgent_5f7e6a1b2c',
  operations_manager: 'ui.pages.admin.adminUsers.operationsManager_e7f7834cf9',
  warehouse_manager: 'ui.pages.admin.adminUsers.warehouseManager_3e9668a875',
  seller: null,
  warehouse_staff: null,
  driver: 'ui.pages.admin.adminUsers.driver_533424916e',
  customer: 'ui.pages.admin.adminUsers.customer_68c8b84985',
  cashier: 'ui.pages.admin.adminUsers.cashier_29b35eadb9',
};


const AdminUsers = () => {
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatLocalizedDate(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const countForRoleFilter = (value) =>
  value === 'all' ? users.length : users.filter((u) => u.role === value).length;

  const getRoleLabel = (role) => {
    const normalizedRole = String(role || '').toLowerCase();
    const key = ROLE_LABEL_KEYS[normalizedRole];
    if (key) return tUi(key);
    return normalizedRole.replace(/_/g, ' ');
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'role-badge admin';
      case 'support_agent':
        return 'role-badge support_agent';
      case 'operations_manager':
        return 'role-badge operations_manager';
      case 'support_manager':
        return 'role-badge support_manager';
      case 'warehouse_manager':
        return 'role-badge warehouse_manager';
      case 'seller':
        return 'role-badge seller';
      case 'warehouse_staff':
        return 'role-badge warehouse_staff';
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
      <div className="admin-users-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="admin-users">
      <div className="admin-users-header">
        <h1>{tUi("ui.pages.admin.adminUsers.manageUsers_eac32c061d")}</h1>
      </div>

      <div className="filter-section">
        <div className="users-search-row">
          <label htmlFor="admin-users-search">{tUi("ui.pages.admin.adminUsers.searchUsers_6f4c0b5424")}</label>
          <div className="users-search-input-wrap">
            <input
              id="admin-users-search"
              type="search"
              className="users-search-input"
              placeholder={tUi("ui.pages.admin.adminUsers.nameOrEmail_0be30e7013")}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              autoComplete="off" />
            
            {userSearch.trim() !== '' &&
            <button
              type="button"
              className="users-search-clear"
              onClick={() => setUserSearch('')}
              aria-label={tUi("ui.pages.admin.adminUsers.clearSearch_2e1d2ddc8e")}>{tUi("ui.pages.admin.adminUsers.clear_7ef332b212")}


            </button>
            }
          </div>
        </div>
        <label>{tUi("ui.pages.admin.adminUsers.filterByRole_9bb6e611f0")}</label>
        <div className="filter-buttons">
          {ROLE_FILTER_OPTIONS.map((value) =>
          <button
            key={value}
            type="button"
            className={roleFilter === value ? "active" : ''}
            onClick={() => setRoleFilter(value)}>
            
              {getRoleLabel(value)} ({countForRoleFilter(value)})
            </button>
          )}
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>{tUi('ui.common.id')}</th>
              <th>{tUi("ui.pages.admin.adminUsers.name_219118e2b5")}</th>
              <th>{tUi("ui.pages.admin.adminUsers.email_2753725b15")}</th>
              <th>{tUi("ui.pages.admin.adminUsers.role_da88828778")}</th>
              <th>{tUi("ui.pages.admin.adminUsers.verified_e1f19650a1")}</th>
              <th>{tUi("ui.pages.admin.adminUsers.account_65ee1efc26")}</th>
              <th>{tUi("ui.pages.admin.adminUsers.created_2a4f996003")}</th>
              <th>{tUi("ui.pages.admin.adminUsers.actions_eeeaafac64")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ?
            <tr>
                <td colSpan="8" className="no-users">
                  {users.length === 0 ? tUi("ui.pages.admin.adminUsers.noUsersFound_53cddce410") :

                userSearch.trim() ? tUi("ui.pages.admin.adminUsers.noUsersMatchYourSearch_afa1ee1f27") : tUi("ui.pages.admin.adminUsers.noUsersMatchTheSelected_6abe98d630")

                }
                </td>
              </tr> :

            filteredUsers.map((user, index) =>
            <motion.tr
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`user-row${user.is_blocked ? ' user-row-blocked' : ''}`}
              onClick={() => navigate(`/admin/users/${user.id}`)}
              style={{ cursor: 'pointer' }}>
              
                  <td>{user.id}</td>
                  <td>
                    <div className="user-name">
                      <img
                    src={getProfileImageUrl(user.profile_image)}
                    alt={tUi("ui.pages.admin.adminUsers.valueValue_e33c0a89f9", { value0: user.first_name, value1: user.last_name })}
                    className="user-avatar"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Fallback to default image on error
                      if (e.target.src !== defaultProfileImage) {
                        e.target.src = defaultProfileImage;
                      }
                    }} />
                  
                      <span>{user.first_name} {user.last_name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td>
                    <span className={user.is_verified ? "verified" : "not-verified"}>
                      {user.is_verified ? tUi("ui.pages.admin.adminUsers.verified_e00687bf61") : tUi("ui.pages.admin.adminUsers.notVerified_b97e561e2a")}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span className={user.is_blocked ? "account-status suspended" : "account-status active"}>
                      {user.is_blocked ? tUi("ui.pages.admin.adminUsers.suspended_d2685f367b") : tUi("ui.pages.admin.adminUsers.active_b157924ea3")}
                    </span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      {authLoading ?
                  <span className="action-self-placeholder">…</span> :
                  currentAuthUser?.id === user.id ?
                  <span className="action-self-placeholder" title={tUi("ui.pages.admin.adminUsers.youCannotBlockYourOwn_b9b05a483d")}>
                          —
                        </span> :

                  <button
                    type="button"
                    className={user.is_blocked ? "unblock-user-btn" : "block-user-btn"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBlock(user);
                    }}
                    disabled={updating || deleting || blockingId === user.id}>
                    
                          {blockingId === user.id ? '…' : user.is_blocked ? tUi("ui.pages.admin.adminUsers.unblock_6cbc50835c") : tUi("ui.pages.admin.adminUsers.block_acca25213e")}
                        </button>
                  }
                      <button
                    className="change-role-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoleChange(user);
                    }}
                    disabled={updating || deleting}>{tUi("ui.pages.admin.adminUsers.changeRole_3f89e37f4b")}


                  </button>
                      <button
                    className="delete-user-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(user);
                    }}
                    disabled={updating || deleting}>{tUi("ui.pages.admin.adminUsers.delete_a6a9493a15")}


                  </button>
                    </div>
                  </td>
                </motion.tr>
            )
            }
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showRoleModal && selectedUser &&
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowRoleModal(false)}>
          
            <motion.div
            className="modal-content role-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}>
            
              <h2>{tUi("ui.pages.admin.adminUsers.changeUserRole_086699c24a")}</h2>
              <div className="user-info">
                <p><strong>{tUi("ui.pages.admin.adminUsers.user_47b8c7478c")}</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                <p><strong>{tUi("ui.pages.admin.adminUsers.email_9b95f1bdda")}</strong> {selectedUser.email}</p>
                <p><strong>{tUi("ui.pages.admin.adminUsers.currentRole_307a24331e")}</strong> 
                  <span className={getRoleBadgeClass(selectedUser.role)}>
                    {getRoleLabel(selectedUser.role)}
                  </span>
                </p>
              </div>
              
              <div className="form-group">
                <label>{tUi("ui.pages.admin.adminUsers.newRole_1fb198cad7")}</label>
                <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={updating}>
                
                  <option value="admin">{tUi("ui.pages.admin.adminUsers.admin_9b8c8c337f")}</option>
                  <option value="support_manager">{tUi("ui.pages.admin.adminUsers.supportManager_2a7bb3b941")}</option>
                  <option value="operations_manager">{tUi("ui.pages.admin.adminUsers.operationsManager_e7f7834cf9")}</option>
                  <option value="warehouse_manager">{tUi("ui.pages.admin.adminUsers.warehouseManager_3e9668a875")}</option>
                  <option value="seller">Seller</option>
                  <option value="warehouse_staff">Warehouse Staff</option>
                  <option value="support_agent">{tUi("ui.pages.admin.adminUsers.supportAgent_5f7e6a1b2c")}</option>
                  <option value="driver">{tUi("ui.pages.admin.adminUsers.driver_533424916e")}</option>
                  <option value="customer">{tUi("ui.pages.admin.adminUsers.customer_68c8b84985")}</option>
                  <option value="cashier">{tUi("ui.pages.admin.adminUsers.cashier_29b35eadb9")}</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                className="cancel-btn"
                onClick={() => setShowRoleModal(false)}
                disabled={updating}>{tUi("ui.pages.admin.adminUsers.cancel_5783570289")}


              </button>
                <button
                className="save-btn"
                onClick={handleUpdateRole}
                disabled={updating || selectedUser.role === newRole}>
                
                  {updating ? tUi("ui.pages.admin.adminUsers.updating_10c0262ea0") : tUi("ui.pages.admin.adminUsers.updateRole_cfc1a123e5")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && userToDelete &&
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowDeleteModal(false)}>
          
            <motion.div
            className="modal-content delete-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}>
            
              <h2>{tUi("ui.pages.admin.adminUsers.deleteUser_e3ea89de3e")}</h2>
              <div className="user-info">
                <p><strong>{tUi("ui.pages.admin.adminUsers.user_47b8c7478c")}</strong> {userToDelete.first_name} {userToDelete.last_name}</p>
                <p><strong>{tUi("ui.pages.admin.adminUsers.email_9b95f1bdda")}</strong> {userToDelete.email}</p>
                <p><strong>{tUi("ui.pages.admin.adminUsers.role_5bf17f27d3")}</strong> 
                  <span className={getRoleBadgeClass(userToDelete.role)}>
                    {getRoleLabel(userToDelete.role)}
                  </span>
                </p>
              </div>
              
              <div className="delete-warning">
                <p>{tUi("ui.pages.admin.adminUsers.areYouSureYouWant_f9aef4fec1")}</p>
                <p>{tUi("ui.pages.admin.adminUsers.thisActionCannotBeUndone_c8a181f419")}</p>
              </div>

              <div className="modal-actions">
                <button
                className="cancel-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                disabled={deleting}>{tUi("ui.pages.admin.adminUsers.cancel_5783570289")}


              </button>
                <button
                className="delete-btn"
                onClick={handleDeleteUser}
                disabled={deleting}>
                
                  {deleting ? tUi("ui.pages.admin.adminUsers.deleting_51d4fbc5d4") : tUi("ui.pages.admin.adminUsers.deleteUser_e3ea89de3e")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

export default AdminUsers;
