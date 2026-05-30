import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { WAREHOUSE_ENDPOINTS } from '../config/api';

const POLL_INTERVAL_MS = 60 * 1000;

export const useWarehouseOpenIssueCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [openIssueCount, setOpenIssueCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'warehouse_manager') {
      setOpenIssueCount(0);
      return;
    }
    try {
      const response = await http.get(`${WAREHOUSE_ENDPOINTS.ALL_ISSUES}?status_filter=open`);
      const issues = Array.isArray(response.data) ? response.data : [];
      setOpenIssueCount(issues.length);
    } catch (_) {
      setOpenIssueCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'warehouse_manager') {
      fetchCount();
      const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    setOpenIssueCount(0);
    return undefined;
  }, [fetchCount, isAuthenticated, user?.role]);

  return { openIssueCount, refresh: fetchCount };
};
