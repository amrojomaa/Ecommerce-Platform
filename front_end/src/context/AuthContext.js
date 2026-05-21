import { tUi } from "../i18n/uiText";import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import http from '../services/http';
import { AUTH_ENDPOINTS, USER_ENDPOINTS } from '../config/api';
import '../styles/components/SessionExpiryPopup.css';

export const AuthContext = createContext();

const SESSION_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const SESSION_WARNING_SECONDS = 10;
const SESSION_MONITOR_INTERVAL_MS = 1000;
const AUTH_PERSISTENCE_KEY = 'auth_persistence';
const AUTH_PERSISTENCE_PERSISTENT = 'persistent';
const AUTH_PERSISTENCE_SESSION = 'session';
const SESSION_AUTH_ACTIVE_KEY = 'session_auth_active';
const SESSION_AUTH_CHANNEL = 'session_auth_channel';
const SESSION_AUTH_PROBE_REQUEST = 'session-auth-probe-request';
const SESSION_AUTH_PROBE_RESPONSE = 'session-auth-probe-response';
const SESSION_AUTH_PROBE_TIMEOUT_MS = 300;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(SESSION_WARNING_SECONDS);
  const [isExtendingSession, setIsExtendingSession] = useState(false);
  const lastObservedTokenRef = useRef(null);
  const sessionExpiryHandledRef = useRef(false);

  const clearLocalAuthState = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(AUTH_PERSISTENCE_KEY);
    sessionStorage.removeItem(SESSION_AUTH_ACTIVE_KEY);
    setUser(null);
    setIsAuthenticated(false);
    // Dispatch event for cart context to detect user change
    window.dispatchEvent(new Event('auth-change'));
  }, []);

  // Keep backward-compatible logout signature while also clearing refresh cookie.
  const logout = useCallback((options = { syncServer: true }) => {
    if (options.syncServer) {
      http.post(AUTH_ENDPOINTS.LOGOUT, {}).catch(() => {



        // Ignore network/logout endpoint failures and continue local logout.
      });}clearLocalAuthState();}, [clearLocalAuthState]);

  const parseTokenExpiryMs = useCallback((token) => {
    if (!token) {
      return null;
    }

    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) {
        return null;
      }

      // JWT payload uses URL-safe Base64 encoding.
      const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - normalizedPayload.length % 4) % 4);
      const payload = JSON.parse(atob(`${normalizedPayload}${padding}`));
      if (!payload?.exp || typeof payload.exp !== 'number') {
        return null;
      }
      return payload.exp * 1000;
    } catch (_) {
      return null;
    }
  }, []);

  const redirectToLoginIfNeeded = useCallback(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/signup') {
      window.location.href = '/login';
    }
  }, []);

  const handleForcedLogout = useCallback(() => {
    setSessionWarningOpen(false);
    setSessionCountdown(SESSION_WARNING_SECONDS);
    setIsExtendingSession(false);
    logout();
    redirectToLoginIfNeeded();
  }, [logout, redirectToLoginIfNeeded]);

  const extendSession = useCallback(async () => {
    if (isExtendingSession) {
      return;
    }

    setIsExtendingSession(true);
    try {
      const response = await http.post(AUTH_ENDPOINTS.REFRESH_SESSION);
      const refreshedToken = response?.data?.access_token;

      if (!refreshedToken) {
        throw new Error('No access token returned');
      }

      localStorage.setItem('token', refreshedToken);
      sessionExpiryHandledRef.current = false;
      lastObservedTokenRef.current = refreshedToken;
      setSessionWarningOpen(false);
      setSessionCountdown(SESSION_WARNING_SECONDS);
      window.dispatchEvent(new Event('auth-change'));
    } catch (_) {
      handleForcedLogout();
    } finally {
      setIsExtendingSession(false);
    }
  }, [handleForcedLogout, isExtendingSession]);

  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await http.get(USER_ENDPOINTS.ME);
      const userData = response.data;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error fetching user info:', error);
      logout({ syncServer: false });
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const restoreSessionFromRefreshToken = useCallback(async () => {
    const persistenceMode = localStorage.getItem(AUTH_PERSISTENCE_KEY);
    if (persistenceMode !== AUTH_PERSISTENCE_PERSISTENT) {
      return false;
    }

    try {
      const response = await http.post(AUTH_ENDPOINTS.REFRESH_TOKEN, {});
      const refreshedToken = response?.data?.access_token;
      if (!refreshedToken) {
        return false;
      }
      localStorage.setItem('token', refreshedToken);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  const confirmActiveSessionAuth = useCallback(() => {
    if (sessionStorage.getItem(SESSION_AUTH_ACTIVE_KEY)) {
      return Promise.resolve(true);
    }

    if (typeof BroadcastChannel === 'undefined') {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      const channel = new BroadcastChannel(SESSION_AUTH_CHANNEL);
      let isResolved = false;

      const finish = (hasActiveSession) => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        window.clearTimeout(timeoutId);
        channel.close();
        resolve(hasActiveSession);
      };

      const timeoutId = window.setTimeout(() => finish(false), SESSION_AUTH_PROBE_TIMEOUT_MS);

      channel.onmessage = (event) => {
        const message = event.data;
        if (message?.type !== SESSION_AUTH_PROBE_RESPONSE || message.requestId !== requestId) {
          return;
        }
        sessionStorage.setItem(SESSION_AUTH_ACTIVE_KEY, '1');
        finish(true);
      };

      channel.postMessage({
        type: SESSION_AUTH_PROBE_REQUEST,
        requestId
      });
    });
  }, []);

  // Check if user is logged in on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const persistenceMode = localStorage.getItem(AUTH_PERSISTENCE_KEY);

      // Session-only mode: distinguish a browser restart from opening a new tab.
      const hasActiveSession = persistenceMode !== AUTH_PERSISTENCE_SESSION ||
        await confirmActiveSessionAuth();

      if (!hasActiveSession) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem(AUTH_PERSISTENCE_KEY);
      }

      const token = localStorage.getItem('token');

      // If access token exists, continue with normal bootstrap.
      if (token) {
        if (isMounted) {
          setIsAuthenticated(true);
        }
        await fetchUserInfo();
        return;
      }

      // Try silent login from refresh-token cookie.
      const restored = await restoreSessionFromRefreshToken();
      if (restored) {
        if (isMounted) {
          setIsAuthenticated(true);
        }
        await fetchUserInfo();
        return;
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, [confirmActiveSessionAuth, fetchUserInfo, restoreSessionFromRefreshToken]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return undefined;
    }

    const channel = new BroadcastChannel(SESSION_AUTH_CHANNEL);
    channel.onmessage = (event) => {
      const message = event.data;
      if (message?.type !== SESSION_AUTH_PROBE_REQUEST || !message.requestId) {
        return;
      }

      const hasSessionAuth = localStorage.getItem(AUTH_PERSISTENCE_KEY) === AUTH_PERSISTENCE_SESSION &&
        !!sessionStorage.getItem(SESSION_AUTH_ACTIVE_KEY);
      if (!hasSessionAuth) {
        return;
      }

      channel.postMessage({
        type: SESSION_AUTH_PROBE_RESPONSE,
        requestId: message.requestId
      });
    };

    return () => {
      channel.close();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionWarningOpen(false);
      setSessionCountdown(SESSION_WARNING_SECONDS);
      lastObservedTokenRef.current = null;
      sessionExpiryHandledRef.current = false;
      return undefined;
    }

    const monitorSessionExpiry = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      if (lastObservedTokenRef.current !== token) {
        lastObservedTokenRef.current = token;
        sessionExpiryHandledRef.current = false;
        setSessionWarningOpen(false);
        setSessionCountdown(SESSION_WARNING_SECONDS);
      }

      const expiresAtMs = parseTokenExpiryMs(token);
      if (!expiresAtMs) {
        return;
      }

      const secondsRemaining = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      if (secondsRemaining <= 0) {
        if (!sessionExpiryHandledRef.current) {
          sessionExpiryHandledRef.current = true;
          handleForcedLogout();
        }
        return;
      }

      if (secondsRemaining <= SESSION_WARNING_SECONDS) {
        setSessionWarningOpen(true);
        setSessionCountdown(secondsRemaining);
      } else {
        setSessionWarningOpen(false);
        setSessionCountdown(SESSION_WARNING_SECONDS);
      }
    };

    monitorSessionExpiry();
    const interval = setInterval(monitorSessionExpiry, SESSION_MONITOR_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [handleForcedLogout, isAuthenticated, parseTokenExpiryMs]);

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
        logout({ syncServer: false });
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
            logout({ syncServer: false });
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

  const login = async (email, password, rememberMe = false) => {
    try {
      // Clear any existing user state before logging in (important when switching accounts)
      setUser(null);
      setIsAuthenticated(false);

      // FastAPI OAuth2PasswordRequestForm expects form data with username and password
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      formData.append('remember_me', String(rememberMe));

      const response = await http.post(AUTH_ENDPOINTS.LOGIN, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token } = response.data;

      if (access_token) {
        localStorage.setItem('token', access_token);
        if (rememberMe) {
          localStorage.setItem(AUTH_PERSISTENCE_KEY, AUTH_PERSISTENCE_PERSISTENT);
          sessionStorage.removeItem(SESSION_AUTH_ACTIVE_KEY);
        } else {
          localStorage.setItem(AUTH_PERSISTENCE_KEY, AUTH_PERSISTENCE_SESSION);
          sessionStorage.setItem(SESSION_AUTH_ACTIVE_KEY, '1');
        }
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
        error: errorMessage
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
        error: error.response?.data?.detail || error.message || 'Signup failed. Please try again.'
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
        error: error.response?.data?.detail || error.message || 'Verification failed. Please try again.'
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
        error: error.response?.data?.detail || error.message || 'Failed to send verification code. Please try again.'
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
        error: error.response?.data?.detail || error.message || 'Invalid verification code. Please try again.'
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
        error: error.response?.data?.detail || error.message || 'Failed to reset password. Please try again.'
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
        localStorage.setItem(AUTH_PERSISTENCE_KEY, AUTH_PERSISTENCE_PERSISTENT);
        sessionStorage.removeItem(SESSION_AUTH_ACTIVE_KEY);
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
        error: errorMessage
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

  const isSupportAgent = () => {
    const r = user?.role;
    return r === 'support_agent' || r === 'support_manager' || r === 'admin';
  };

  const isDriver = () => {
    return user?.role === 'driver';
  };

  /** Dedicated POS access: cashier accounts (+ admin). Not employees—use a separate cashier login. */
  const isCashier = () => {
    const r = user?.role;
    return r === 'cashier' || r === 'admin';
  };

  const isSeller = () => {
    return user?.role === 'seller';
  };

  const isWarehouseStaff = () => {
    return user?.role === 'warehouse_staff';
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
    isSupportAgent,
    isDriver,
    isCashier,
    isSeller,
    isWarehouseStaff,
    fetchUserInfo,
    forgotPassword,
    verifyResetCode,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {isAuthenticated && sessionWarningOpen &&
      <div className="session-expiry-popup-overlay" role="presentation">
          <div
          className="session-expiry-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-expiry-title">
          
            <h3 id="session-expiry-title">{tUi("ui.context.authContext.sessionExpirationWarning_05363572c9")}</h3>
            <p>{tUi("ui.context.authContext.yourSessionWillExpireSoon_4e454494f0")}</p>
            <p className="session-expiry-popup-countdown">{tUi("ui.context.authContext.autoLogoutIn_e679cfa7ef")}
            {sessionCountdown}{tUi("ui.context.authContext.second_3b241123de")}{sessionCountdown === 1 ? '' : 's'}.
            </p>
            <div className="session-expiry-popup-actions">
              <button
              type="button"
              className="session-expiry-popup-extend-btn"
              onClick={extendSession}
              disabled={isExtendingSession}>
              
                {isExtendingSession ? tUi("ui.context.authContext.extending_278163f027") : tUi("ui.context.authContext.extendSession_71ae016880")}
              </button>
              <button
              type="button"
              className="session-expiry-popup-logout-btn"
              onClick={handleForcedLogout}
              disabled={isExtendingSession}>{tUi("ui.context.authContext.logout_61b5dc00ab")}


            </button>
            </div>
          </div>
        </div>
      }
    </AuthContext.Provider>);

};
