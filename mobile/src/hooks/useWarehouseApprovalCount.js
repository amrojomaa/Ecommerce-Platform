import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { WAREHOUSE_ENDPOINTS } from '../config/api';

const POLL_INTERVAL_MS = 60 * 1000;

export const useWarehouseApprovalCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [approvalCount, setApprovalCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'warehouse_manager') {
      setApprovalCount(0);
      return;
    }
    try {
      const response = await http.get(WAREHOUSE_ENDPOINTS.PACKED_REVIEW);
      const orders = Array.isArray(response.data) ? response.data : [];
      setApprovalCount(orders.length);
    } catch (_) {
      setApprovalCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'warehouse_manager') {
      fetchCount();
      const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setApprovalCount(0);
    return undefined;
  }, [fetchCount, isAuthenticated, user?.role]);

  return { approvalCount, refresh: fetchCount };
};
