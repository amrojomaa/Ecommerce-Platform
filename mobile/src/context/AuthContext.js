import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import http from '../services/http';
import { AUTH_ENDPOINTS, USER_ENDPOINTS } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const didInitializeRef = useRef(false);
  const authRequestSeqRef = useRef(0);

  const clearLocalAuthState = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    } catch (_) {}
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post(AUTH_ENDPOINTS.LOGOUT, {});
    } catch (_) {}
    await clearLocalAuthState();
  }, [clearLocalAuthState]);

  const fetchUserInfo = useCallback(async (token) => {
    try {
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;
      const response = await http.get(USER_ENDPOINTS.ME, config);
      const userData = response.data;
      setUser(userData);
      setIsAuthenticated(true);
      await SecureStore.setItemAsync('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error fetching user info:', error);
      await logout();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Always start on the sign-in screen for the admin mobile app.
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (!didInitializeRef.current) {
        didInitializeRef.current = true;
        setUser(null);
        setIsAuthenticated(false);
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password, rememberMe = true) => {
    const requestId = authRequestSeqRef.current + 1;
    authRequestSeqRef.current = requestId;

    try {
      setUser(null);
      setIsAuthenticated(false);

      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      formData.append('remember_me', rememberMe ? 'true' : 'false');

      const response = await http.post(AUTH_ENDPOINTS.LOGIN, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;

      if (access_token) {
        if (requestId !== authRequestSeqRef.current) {
          return { success: false, ignored: true };
        }
        await SecureStore.setItemAsync('token', access_token);
        await fetchUserInfo(access_token);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error) {
      const errorMessage =
        error.message ||
        error.data?.detail ||
        error.response?.data?.detail ||
        'Login failed. Please check your credentials.';
      return { success: false, error: errorMessage };
    }
  };

  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'operations_manager';
  };

  const signup = async (payload) => {
    try {
      const response = await http.post(AUTH_ENDPOINTS.SIGNUP, payload);
      return { success: true, ...response.data };
    } catch (error) {
      const errorMessage =
        error.message ||
        error.data?.detail ||
        error.response?.data?.detail ||
        'Signup failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  const loginWithGoogle = async (googleToken) => {
    const requestId = authRequestSeqRef.current + 1;
    authRequestSeqRef.current = requestId;

    try {
      setUser(null);
      setIsAuthenticated(false);

      const response = await http.post(AUTH_ENDPOINTS.GOOGLE_AUTH, {
        token: googleToken,
      });

      const { access_token } = response.data;

      if (access_token) {
        if (requestId !== authRequestSeqRef.current) {
          return { success: false, ignored: true };
        }
        await SecureStore.setItemAsync('token', access_token);
        await fetchUserInfo(access_token);
        return { success: true };
      }

      return { success: false, error: 'Google login failed' };
    } catch (error) {
      const errorMessage =
        error.message ||
        error.data?.detail ||
        error.response?.data?.detail ||
        'Google login failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    loginWithGoogle,
    logout,
    isAdmin,
    fetchUserInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
