import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { DELIVERY_ENDPOINTS } from '../config/api';

const POLL_INTERVAL_MS = 60 * 1000;

export const useDriverAvailableJobCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [availableCount, setAvailableCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'driver') {
      setAvailableCount(0);
      return;
    }
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS);
      const jobs = Array.isArray(response.data) ? response.data : [];
      setAvailableCount(jobs.length);
    } catch (_) {
      setAvailableCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'driver') {
      fetchCount();
      const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setAvailableCount(0);
    return undefined;
  }, [fetchCount, isAuthenticated, user?.role]);

  return { availableCount, refresh: fetchCount };
};

export const useDriverActiveJobCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [activeCount, setActiveCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'driver') {
      setActiveCount(0);
      return;
    }
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS);
      const jobs = Array.isArray(response.data) ? response.data : [];
      setActiveCount(jobs.length);
    } catch (_) {
      setActiveCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'driver') {
      fetchCount();
      const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setActiveCount(0);
    return undefined;
  }, [fetchCount, isAuthenticated, user?.role]);

  return { activeCount, refresh: fetchCount };
};
