import React, { createContext, useState, useEffect, useCallback } from 'react';
import http from '../services/http';
import { AUTH_ENDPOINTS, USER_ENDPOINTS } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const SESSION_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Define logout function first using useCallback
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    // Dispatch event for cart context to detect user change
    window.dispatchEvent(new Event('auth-change'));
  }, []);

  const fetchUserInfo = useCallback(async () => {
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
  }, [logout]);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        // Don't set user from cache - wait for fresh data from server
        // This ensures profile images and other data are up-to-date
        setIsAuthenticated(true);
        // Fetch fresh user info from server (this will update user state)
        fetchUserInfo();
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    } else {
      setLoading(false);
    }
  }, [fetchUserInfo, logout]);

  // Listen for session invalidation events from HTTP interceptor
  useEffect(() => {
    const handleSessionInvalidated = () => {
      console.log('Session invalidated event received');
      logout();
    };

    window.addEventListener('session-invalidated', handleSessionInvalidated);

    return () => {
      window.removeEventListener('session-invalidated', handleSessionInvalidated);
    };
  }, [logout]);

  // Periodically validate session to detect when logged out from another browser
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isChecking = false; // Prevent concurrent checks

    // Function to check and update user info
    const checkAndUpdateUser = async () => {
      // Skip if already checking
      if (isChecking) {
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        // Token was removed (possibly by interceptor), logout
        logout();
        return;
      }

      isChecking = true;
      try {
        // Make a lightweight request to validate the session and get updated user info
        // This will trigger token version validation on the backend
        // If token version doesn't match, backend returns 401
        const response = await http.get(USER_ENDPOINTS.ME);
        
        // If successful, update user info in case role or other data changed
        if (response.data) {
          const updatedUser = response.data;
          const previousRole = user?.role;
          const newRole = updatedUser.role;
          
          // Check if role changed
          if (previousRole && previousRole !== newRole) {
            console.log(`Role changed from ${previousRole} to ${newRole}`);
            // Dispatch event to notify components about role change
            window.dispatchEvent(new CustomEvent('user-role-changed', { 
              detail: { 
                previousRole, 
                newRole,
                user: updatedUser 
              } 
            }));
          }
          
          // Always update user state to reflect any changes
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (error) {
        // If we get a 401, the session was invalidated (user logged in elsewhere)
        // The HTTP interceptor will handle clearing the token and redirecting
        // We just need to ensure logout is called
        if (error.response?.status === 401 || error.status === 401) {
          console.log('Session invalidated - user logged in from another browser');
          // The interceptor will clear the token, but we should also call logout
          // to update the React state
          if (!localStorage.getItem('token')) {
            // Token already cleared by interceptor
            logout();
          }
        }
        // For other errors, don't logout (might be network issues)
      } finally {
        isChecking = false;
      }
    };
    
    // Run immediately on mount to get fresh data (important for cross-browser sync)
    // This ensures browser2 gets the latest profile image from browser1
    checkAndUpdateUser();
    
    // Then check periodically every minute.
    const sessionCheckInterval = setInterval(checkAndUpdateUser, SESSION_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(sessionCheckInterval);
    };
    // Note: We intentionally don't include 'user' in dependencies to avoid infinite loops
    // The function uses the latest user state via closure, which is sufficient
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, logout]);

  const login = async (email, password) => {
    try {
      // Clear any existing user state before logging in (important when switching accounts)
      setUser(null);
      setIsAuthenticated(false);
      
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
        // Dispatch event for cart context to detect user change
        window.dispatchEvent(new Event('auth-change'));
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
      // Clear any existing user state before logging in (important when switching accounts)
      setUser(null);
      setIsAuthenticated(false);
      
      const response = await http.post(AUTH_ENDPOINTS.GOOGLE_AUTH, {
        token: googleToken
      });

      const { access_token } = response.data;
      
      if (access_token) {
        localStorage.setItem('token', access_token);
        await fetchUserInfo();
        // Dispatch event for cart context to detect user change
        window.dispatchEvent(new Event('auth-change'));
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

  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'operations_manager';
  };

  const isOperationsManager = () => {
    return user?.role === 'operations_manager';
  };

  const isSupportManager = () => {
    return user?.role === 'support_manager';
  };

  const isWarehouseManager = () => {
    return user?.role === 'warehouse_manager';
  };

  const isEmployee = () => {
    return user?.role === 'employee' || user?.role === 'admin';
  };

  const isDriver = () => {
    return user?.role === 'driver';
  };

  /** Dedicated POS access: cashier accounts (+ admin). Not employees—use a separate cashier login. */
  const isCashier = () => {
    const r = user?.role;
    return r === 'cashier' || r === 'admin';
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
    isOperationsManager,
    isSupportManager,
    isWarehouseManager,
    isEmployee,
    isDriver,
    isCashier,
    fetchUserInfo,
    forgotPassword,
    verifyResetCode,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
