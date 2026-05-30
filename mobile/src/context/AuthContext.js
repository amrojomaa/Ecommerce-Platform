import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import http from '../services/http';
import { AUTH_ENDPOINTS, USER_ENDPOINTS } from '../config/api';
import { isTokenExpired } from '../utils/authToken';

export const AuthContext = createContext();

const persistAuthTokens = async (accessToken, refreshToken) => {
  if (accessToken) {
    await SecureStore.setItemAsync('token', accessToken);
  }
  if (refreshToken) {
    await SecureStore.setItemAsync('refresh_token', refreshToken);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const didInitializeRef = useRef(false);
  const authRequestSeqRef = useRef(0);

  const clearLocalAuthState = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refresh_token');
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

  const refreshStoredSession = useCallback(async (refreshToken) => {
    if (!refreshToken) return null;
    try {
      const response = await http.post(
        AUTH_ENDPOINTS.REFRESH_TOKEN,
        {},
        {
          headers: { Authorization: `Bearer ${refreshToken}` },
          _silentAuth: true,
        }
      );
      const nextAccessToken = response.data?.access_token;
      const nextRefreshToken = response.data?.refresh_token;
      if (!nextAccessToken) return null;
      await persistAuthTokens(nextAccessToken, nextRefreshToken);
      return nextAccessToken;
    } catch (_) {
      return null;
    }
  }, []);

  const fetchUserInfo = useCallback(
    async (token, options = {}) => {
      const { silent = false } = options;

      try {
        const config = {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          _silentAuth: silent,
        };
        const response = await http.get(USER_ENDPOINTS.ME, config);
        const userData = response.data;
        setUser(userData);
        setIsAuthenticated(true);
        await SecureStore.setItemAsync('user', JSON.stringify(userData));
        return userData;
      } catch (error) {
        if (!silent) {
          console.error('Error fetching user info:', error);
        }
        await clearLocalAuthState();
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [clearLocalAuthState]
  );

  const restoreSession = useCallback(async () => {
    let token = await SecureStore.getItemAsync('token');
    const refreshToken = await SecureStore.getItemAsync('refresh_token');

    if (!token && !refreshToken) {
      return false;
    }

    if (token && isTokenExpired(token)) {
      const refreshed = refreshToken
        ? await refreshStoredSession(refreshToken)
        : null;
      if (!refreshed) {
        await clearLocalAuthState();
        return false;
      }
      token = refreshed;
    }

    try {
      await fetchUserInfo(token, { silent: true });
      return true;
    } catch (_) {
      const refreshed = refreshToken
        ? await refreshStoredSession(refreshToken)
        : null;
      if (!refreshed) {
        await clearLocalAuthState();
        return false;
      }

      try {
        await fetchUserInfo(refreshed, { silent: true });
        return true;
      } catch (retryError) {
        await clearLocalAuthState();
        return false;
      }
    }
  }, [clearLocalAuthState, fetchUserInfo, refreshStoredSession]);

  // Restore session from SecureStore on app start.
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (!didInitializeRef.current) {
        didInitializeRef.current = true;
      }

      try {
        const restored = await restoreSession();
        if (restored || !isMounted) {
          return;
        }
      } catch (_) {
        await clearLocalAuthState();
      }

      if (isMounted) {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, [clearLocalAuthState, restoreSession]);

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

      const { access_token, refresh_token } = response.data;

      if (access_token) {
        if (requestId !== authRequestSeqRef.current) {
          return { success: false, ignored: true };
        }
        await persistAuthTokens(access_token, rememberMe ? refresh_token : null);
        if (!rememberMe) {
          try {
            await SecureStore.deleteItemAsync('refresh_token');
          } catch (_) {}
        }
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

  const hasPanelAccess = () => {
    return [
      'admin',
      'operations_manager',
      'support_manager',
      'support_agent',
      'warehouse_manager',
      'warehouse_staff',
      'cashier',
      'seller',
      'driver',
    ].includes(user?.role);
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

      const { access_token, refresh_token } = response.data;

      if (access_token) {
        if (requestId !== authRequestSeqRef.current) {
          return { success: false, ignored: true };
        }
        await persistAuthTokens(access_token, refresh_token);
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
    hasPanelAccess,
    fetchUserInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
