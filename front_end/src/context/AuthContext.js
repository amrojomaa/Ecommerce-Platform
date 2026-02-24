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

      return { 
        success: true, 
        message: response.data.message || 'Account created successfully',
        email: response.data.email || userData.email,
        verification_code: response.data.verification_code || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Signup failed. Please try again.',
      };
    }
  };

  const verifyEmail = async (email, verificationCode) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.VERIFY_EMAIL, {
        email,
        verification_code: verificationCode
      });

      return { 
        success: true, 
        message: response.data.message || 'Email verified successfully' 
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Verification failed. Please try again.',
      };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
        email
      });

      return { 
        success: true, 
        message: response.data.message || 'Verification code sent to your email',
        email: response.data.email,
        verification_code: response.data.verification_code || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to send verification code. Please try again.',
      };
    }
  };

  const verifyResetCode = async (email, verificationCode) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.VERIFY_RESET_CODE, {
        email,
        verification_code: verificationCode
      });

      return { 
        success: true, 
        message: response.data.message || 'Verification code is valid' 
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Invalid verification code. Please try again.',
      };
    }
  };

  const resetPassword = async (email, verificationCode, newPassword) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.RESET_PASSWORD, {
        email,
        verification_code: verificationCode,
        new_password: newPassword
      });

      return { 
        success: true, 
        message: response.data.message || 'Password reset successfully' 
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to reset password. Please try again.',
      };
    }
  };

  const loginWithGoogle = async (googleToken) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.GOOGLE_AUTH, {
        token: googleToken
      });

      const { access_token } = response.data;
      
      if (access_token) {
        localStorage.setItem('token', access_token);
        await fetchUserInfo();
        return { success: true };
      }
      
      return { success: false, error: 'Google login failed' };
    } catch (error) {
      const errorMessage = error.message || error.data?.detail || error.response?.data?.detail || 'Google login failed. Please try again.';
      return {
        success: false,
        error: errorMessage,
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
    verifyEmail,
    loginWithGoogle,
    logout,
    isAdmin,
    fetchUserInfo,
    forgotPassword,
    verifyResetCode,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
