import React, { createContext, useState, useEffect } from 'react';
import http from '../services/http';
import { AUTH_ENDPOINTS, USER_ENDPOINTS } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
        // Verify token by fetching user info
        fetchUserInfo();
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await http.get(USER_ENDPOINTS.ME);
      const userData = response.data;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error fetching user info:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      // FastAPI OAuth2PasswordRequestForm expects form data with username and password
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await http.post(AUTH_ENDPOINTS.LOGIN, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      
      if (access_token) {
        localStorage.setItem('token', access_token);
        await fetchUserInfo();
        return { success: true };
      }
      
      return { success: false, error: 'Login failed' };
    } catch (error) {
      // Extract error message from backend response
      // The interceptor formats errors, so check both error.message and error.data
      const errorMessage = error.message || error.data?.detail || error.response?.data?.detail || 'Login failed. Please check your credentials.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.SIGNUP, userData);

      return { success: true, message: response.data.message || 'Account created successfully' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Signup failed. Please try again.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    isAdmin,
    fetchUserInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
