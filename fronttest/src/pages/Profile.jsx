import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import PrivateRoute from '../routes/PrivateRoute';
import Loader from '../components/Loader';

const Profile = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await api.get('/users/me/information');
        const userData = response.data;
        setUser(userData);
        setFormData({
          name: userData.name || '',
          email: userData.email || '',
          password: '',
          confirmPassword: '',
        });
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load profile information.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setSaving(false);
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setSaving(false);
      return;
    }

    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
      };

      // Only include password if it's provided
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await api.put('/users/me', updateData);
      const updatedUser = response.data;
      setUser(updatedUser);
      
      // Update localStorage with new user data including role
      const userData = {
        email: updatedUser.email,
        name: updatedUser.name,
        id: updatedUser.id,
        role: updatedUser.role || user?.role,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      setEditMode(false);
      setSuccess('Profile updated successfully! Please refresh the page to see changes in the navbar.');
      setFormData({
        ...formData,
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        confirmPassword: '',
      });
    }
    setEditMode(false);
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <PrivateRoute>
        <Loader />
      </PrivateRoute>
    );
  }

  return (
    <PrivateRoute>
      <div className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

          <div className="bg-white rounded-lg shadow-md p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                {success}
              </div>
            )}

            {!editMode ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <p className="text-gray-900">{user?.name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <p className="text-gray-900">{user?.email || 'Not set'}</p>
                </div>
                {user?.id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
                    <p className="text-gray-500 text-sm">{user.id}</p>
                  </div>
                )}
                {user?.role && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <p className="text-gray-900">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </p>
                  </div>
                )}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                  />
                </div>

                {formData.password && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm new password"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 flex space-x-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PrivateRoute>
  );
};

export default Profile;
