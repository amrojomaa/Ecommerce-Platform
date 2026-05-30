import { useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { TICKET_ENDPOINTS } from '../config/api';

const STORAGE_KEY_PREFIX = 'last_viewed_tickets_';
const UNREAD_TICKETS_POLL_INTERVAL_MS = 60 * 1000;

const ROLES_WITH_UNREAD = ['admin', 'support_manager', 'support_agent'];

export const useUnreadTickets = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const getStorageKey = useCallback(() => {
    if (!user?.id) return null;
    return `${STORAGE_KEY_PREFIX}${user.id}`;
  }, [user?.id]);

  const getLastViewed = useCallback(async () => {
    const key = getStorageKey();
    if (!key) return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch (_) {
      return null;
    }
  }, [getStorageKey]);

  const setLastViewed = useCallback(async () => {
    const key = getStorageKey();
    if (!key) return;
    try {
      await SecureStore.setItemAsync(key, new Date().toISOString());
    } catch (_) {}
  }, [getStorageKey]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user || !ROLES_WITH_UNREAD.includes(user.role)) {
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const lastViewed = await getLastViewed();
      const params = lastViewed ? { last_viewed: lastViewed } : {};
      const response = await http.get(TICKET_ENDPOINTS.UNREAD_COUNT, { params });
      setUnreadCount(response.data?.unread_count || 0);
    } catch (_) {
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [getLastViewed, isAuthenticated, user]);

  const markAsViewed = useCallback(async () => {
    await setLastViewed();
    setUnreadCount(0);
  }, [setLastViewed]);

  useEffect(() => {
    if (isAuthenticated && ROLES_WITH_UNREAD.includes(user?.role)) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, UNREAD_TICKETS_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setUnreadCount(0);
    return undefined;
  }, [fetchUnreadCount, isAuthenticated, user?.role]);

  return {
    unreadCount,
    loading,
    markAsViewed,
    refresh: fetchUnreadCount,
  };
};
