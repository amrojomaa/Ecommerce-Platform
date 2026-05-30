import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { WAREHOUSE_ENDPOINTS } from '../config/api';

const POLL_INTERVAL_MS = 60 * 1000;

export const useWarehousePreparingCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [preparingCount, setPreparingCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'warehouse_staff') {
      setPreparingCount(0);
      return;
    }
    try {
      const response = await http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS);
      const orders = Array.isArray(response.data) ? response.data : [];
      setPreparingCount(orders.length);
    } catch (_) {
      setPreparingCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'warehouse_staff') {
      fetchCount();
      const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setPreparingCount(0);
    return undefined;
  }, [fetchCount, isAuthenticated, user?.role]);

  return { preparingCount, refresh: fetchCount };
};
