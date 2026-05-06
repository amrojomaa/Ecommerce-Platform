import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import http from '../services/http';
import { TICKET_ENDPOINTS } from '../config/api';

const STORAGE_KEY_PREFIX = 'last_viewed_tickets_';
const UNREAD_TICKETS_POLL_INTERVAL_MS = 60 * 1000; // 1 minute

export const useUnreadTickets = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const getStorageKey = useCallback(() => {
    if (!user?.id) return null;
    return `${STORAGE_KEY_PREFIX}${user.id}`;
  }, [user?.id]);

  const getLastViewed = useCallback(() => {
    const key = getStorageKey();
    if (!key) return null;
    const stored = localStorage.getItem(key);
    return stored ? stored : null;
  }, [getStorageKey]);

  const setLastViewed = useCallback(() => {
    const key = getStorageKey();
    if (!key) return;
    const now = new Date().toISOString();
    localStorage.setItem(key, now);
  }, [getStorageKey]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'employee' && user.role !== 'customer')) {
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const lastViewed = getLastViewed();
      const params = lastViewed ? { last_viewed: lastViewed } : {};
      
      const response = await http.get(TICKET_ENDPOINTS.UNREAD_COUNT, { params });
      setUnreadCount(response.data?.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread ticket count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, getLastViewed]);

  const markAsViewed = useCallback(() => {
    setLastViewed();
    setUnreadCount(0);
  }, [setLastViewed]);

  useEffect(() => {
    if (isAuthenticated && user && (user.role === 'admin' || user.role === 'employee' || user.role === 'customer')) {
      fetchUnreadCount();
      
      // Poll for updates every minute
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, UNREAD_TICKETS_POLL_INTERVAL_MS);

      return () => clearInterval(interval);
    } else {
      setUnreadCount(0);
    }
  }, [fetchUnreadCount, isAuthenticated, user]);

  return {
    unreadCount,
    loading,
    markAsViewed,
    refresh: fetchUnreadCount,
  };
};
