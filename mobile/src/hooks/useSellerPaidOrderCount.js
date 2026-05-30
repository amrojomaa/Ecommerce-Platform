import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { SELLER_ENDPOINTS } from '../config/api';

const POLL_INTERVAL_MS = 60 * 1000;

export const useSellerPaidOrderCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [paidOrderCount, setPaidOrderCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'seller') {
      setPaidOrderCount(0);
      return;
    }
    try {
      const response = await http.get(SELLER_ENDPOINTS.ORDERS);
      const orders = Array.isArray(response.data) ? response.data : [];
      setPaidOrderCount(orders.filter((order) => String(order.status || '').toLowerCase() === 'paid').length);
    } catch (_) {
      setPaidOrderCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'seller') {
      fetchCount();
      const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setPaidOrderCount(0);
    return undefined;
  }, [fetchCount, isAuthenticated, user?.role]);

  return { paidOrderCount, refresh: fetchCount };
};
