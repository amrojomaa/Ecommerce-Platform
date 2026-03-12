import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminUsers.css';

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('customer');
  const [updating, setUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    filterUsers();
  }, [roleFilter, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await http.get(USER_ENDPOINTS.ALL);
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (roleFilter === 'all') {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(user => user.role === roleFilter));
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
      const response = await http.patch(
        buildUrl(USER_ENDPOINTS.UPDATE_ROLE, { id: selectedUser.id }),
        { role: newRole }
      );
      
      toast.success(`User role updated to ${newRole}`);
      
      // Update the user in users list
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id ? { ...user, role: newRole } : user
        )
      );
      
      // Update filteredUsers based on current filter
      // If role filter is 'all', update the user in filtered list
      // If role filter matches new role, update the user
      // If role filter doesn't match new role, remove the user from filtered list
      setFilteredUsers(prevFilteredUsers => {
        if (roleFilter === 'all') {
          // Show all users, just update the role
          return prevFilteredUsers.map(user => 
            user.id === selectedUser.id ? { ...user, role: newRole } : user
          );
        } else if (roleFilter === newRole) {
          // New role matches filter, add user if not already in list, or update if exists
          const userExists = prevFilteredUsers.some(u => u.id === selectedUser.id);
          if (userExists) {
            return prevFilteredUsers.map(user => 
              user.id === selectedUser.id ? { ...user, role: newRole } : user
            );
          } else {
            // Add the user to filtered list
            return [...prevFilteredUsers, { ...selectedUser, role: newRole }];
          }
        } else {
          // New role doesn't match filter, remove user from filtered list
          return prevFilteredUsers.filter(user => user.id !== selectedUser.id);
        }
      });
      
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

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      await http.delete(
        buildUrl(USER_ENDPOINTS.DELETE, { id: userToDelete.id })
      );
      
      // Remove user from users list
      setUsers(prevUsers => 
        prevUsers.filter(user => user.id !== userToDelete.id)
      );
      
      // Remove user from filteredUsers list
      setFilteredUsers(prevFilteredUsers => 
        prevFilteredUsers.filter(user => user.id !== userToDelete.id)
      );
      
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
      <div className="admin-users-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-users">
      <div className="admin-users-header">
        <h1>Manage Users</h1>
        <div className="users-stats">
          <span>Total: {users.length}</span>
          <span>Admin: {users.filter(u => u.role === 'admin').length}</span>
          <span>Employee: {users.filter(u => u.role === 'employee').length}</span>
          <span>Customer: {users.filter(u => u.role === 'customer').length}</span>
        </div>
      </div>

      <div className="filter-section">
        <label>Filter by Role:</label>
        <div className="filter-buttons">
          <button
            className={roleFilter === 'all' ? 'active' : ''}
            onClick={() => setRoleFilter('all')}
          >
            All
          </button>
          <button
            className={roleFilter === 'admin' ? 'active' : ''}
            onClick={() => setRoleFilter('admin')}
          >
            Admin
          </button>
          <button
            className={roleFilter === 'employee' ? 'active' : ''}
            onClick={() => setRoleFilter('employee')}
          >
            Employee
          </button>
          <button
            className={roleFilter === 'customer' ? 'active' : ''}
            onClick={() => setRoleFilter('customer')}
          >
            Customer
          </button>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-users">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="user-row"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{user.id}</td>
                  <td>
                    <div className="user-name">
                      <img
                        src={getProfileImageUrl(user.profile_image)}
                        alt={`${user.first_name} ${user.last_name}`}
                        className="user-avatar"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          // Fallback to default image on error
                          if (e.target.src !== defaultProfileImage) {
                            e.target.src = defaultProfileImage;
                          }
                        }}
                      />
                      <span>{user.first_name} {user.last_name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={user.is_verified ? 'verified' : 'not-verified'}>
                      {user.is_verified ? '✓ Verified' : '✗ Not Verified'}
                    </span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="change-role-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRoleChange(user);
                        }}
                        disabled={updating || deleting}
                      >
                        Change Role
                      </button>
                      <button
                        className="delete-user-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(user);
                        }}
                        disabled={updating || deleting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showRoleModal && selectedUser && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRoleModal(false)}
          >
            <motion.div
              className="modal-content role-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Change User Role</h2>
              <div className="user-info">
                <p><strong>User:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Current Role:</strong> 
                  <span className={getRoleBadgeClass(selectedUser.role)}>
                    {selectedUser.role}
                  </span>
                </p>
              </div>
              
              <div className="form-group">
                <label>New Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={updating}
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                  <option value="customer">Customer</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowRoleModal(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  className="save-btn"
                  onClick={handleUpdateRole}
                  disabled={updating || selectedUser.role === newRole}
                >
                  {updating ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && userToDelete && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              className="modal-content delete-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Delete User</h2>
              <div className="user-info">
                <p><strong>User:</strong> {userToDelete.first_name} {userToDelete.last_name}</p>
                <p><strong>Email:</strong> {userToDelete.email}</p>
                <p><strong>Role:</strong> 
                  <span className={getRoleBadgeClass(userToDelete.role)}>
                    {userToDelete.role}
                  </span>
                </p>
              </div>
              
              <div className="delete-warning">
                <p>⚠️ Are you sure you want to delete this user?</p>
                <p>This action cannot be undone and will permanently remove the user from the database.</p>
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="delete-btn"
                  onClick={handleDeleteUser}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete User'}
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
