import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import http from '../services/http';
import { DELIVERY_ENDPOINTS } from '../config/api';

export const useDeliveryIssueCount = () => {
  const { user, isAuthenticated } = useAuth();
  const [issueCount, setIssueCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const canManageDelivery = user?.role === 'admin' || user?.role === 'operations_manager';

  const fetchIssueCount = useCallback(async () => {
    if (!isAuthenticated || !canManageDelivery) {
      setIssueCount(0);
      return;
    }

    setLoading(true);
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
      const jobs = Array.isArray(response.data) ? response.data : [];
      const count = jobs.filter((job) => {
        const status = (job.status || '').toLowerCase();
        const hasOpenStatus = status !== 'cancelled' && status !== 'delivered';
        return !!job.issue_type && hasOpenStatus && !job.issue_resolved;
      }).length;
      setIssueCount(count);
    } catch (error) {
      console.error('Error fetching delivery issue count:', error);
      setIssueCount(0);
    } finally {
      setLoading(false);
    }
  }, [canManageDelivery, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && canManageDelivery) {
      fetchIssueCount();

      const interval = setInterval(() => {
        fetchIssueCount();
      }, 30000);

      return () => clearInterval(interval);
    }

    setIssueCount(0);
  }, [canManageDelivery, fetchIssueCount, isAuthenticated]);

  return {
    issueCount,
    loading,
    refresh: fetchIssueCount,
  };
};
