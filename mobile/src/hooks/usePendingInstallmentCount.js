import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { INSTALLMENT_ENDPOINTS } from '../config/api';

export const usePendingInstallmentCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [pendingCount, setPendingCount] = useState(0);
  const canReview =
    user?.role === 'admin' || user?.role === 'operations_manager';

  const fetchPendingCount = useCallback(async () => {
    if (!isAuthenticated || !canReview) {
      setPendingCount(0);
      return;
    }

    try {
      const response = await http.get(INSTALLMENT_ENDPOINTS.ADMIN_REQUESTS, {
        params: { status_filter: 'pending' },
      });
      const requests = Array.isArray(response.data)
        ? response.data
        : response.data?.requests || [];
      setPendingCount(
        requests.filter((req) => String(req.status || '').toLowerCase() === 'pending').length
      );
    } catch (_) {
      setPendingCount(0);
    }
  }, [canReview, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && canReview) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
    setPendingCount(0);
    return undefined;
  }, [canReview, fetchPendingCount, isAuthenticated]);

  return {
    pendingCount,
    refresh: fetchPendingCount,
  };
};
