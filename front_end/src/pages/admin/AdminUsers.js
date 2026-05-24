import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { formatDateTime, resolveProfileImageUrl, DEFAULT_PROFILE_IMAGE } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { getRoleLabel as translateRoleLabel } from '../../i18n/roles';
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

const LIST_AVATAR_SIZE = 40;

const AdminUsers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');

  const getProfileImageUrl = (profileImage) =>
    resolveProfileImageUrl(profileImage, {
      apiBaseUrl: API_BASE_URL,
      defaultImage: DEFAULT_PROFILE_IMAGE,
      displaySize: LIST_AVATAR_SIZE,
    });

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

  const getRoleBadgeClass = (role) => {
    const normalized = String(role || 'customer').toLowerCase();
    return `adm-users-role adm-users-role--${normalized}`;
  };

  const formatCreatedDate = (dateString) => {
    if (!dateString) {
      return '—';
    }
    return formatDateTime(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const countForRoleFilter = (value) =>
    value === 'all' ? users.length : users.filter((u) => u.role === value).length;

  const getRoleLabel = (role) => {
    const normalizedRole = String(role || '').toLowerCase();
    if (normalizedRole === 'all') {
      return tUi('ui.pages.admin.adminUsers.all_934fce7d68');
    }
    return translateRoleLabel(normalizedRole);
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
              <th className="adm-users-col-created" scope="col">
                {tUi('ui.pages.admin.adminUsers.created_2a4f996003')}
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
                        key={`user-${user.id}-${user.profile_image || 'default'}`}
                        src={getProfileImageUrl(user.profile_image)}
                        alt={tUi('ui.pages.admin.adminUsers.valueValue_e33c0a89f9', {
                          value0: user.first_name,
                          value1: user.last_name
                        })}
                        className="adm-users-avatar"
                        width={LIST_AVATAR_SIZE}
                        height={LIST_AVATAR_SIZE}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                            e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
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
                  <td className="adm-users-col-created">{formatCreatedDate(user.created_at)}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        )}
      </section>
    </div>
  );

};

export default AdminUsers;
