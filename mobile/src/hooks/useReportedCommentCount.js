import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { COMMENT_ENDPOINTS } from '../config/api';

export const useReportedCommentCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [reportedCount, setReportedCount] = useState(0);

  const fetchReportedCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'support_manager') {
      setReportedCount(0);
      return;
    }

    try {
      const response = await http.get(COMMENT_ENDPOINTS.ALL, {
        params: { is_reported: true, skip: 0, limit: 100 },
      });
      const data = response.data || [];
      setReportedCount(data.length);
    } catch (_) {
      setReportedCount(0);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'support_manager') {
      fetchReportedCount();
      const interval = setInterval(fetchReportedCount, 30000);
      return () => clearInterval(interval);
    }
    setReportedCount(0);
    return undefined;
  }, [fetchReportedCount, isAuthenticated, user?.role]);

  return {
    reportedCount,
    refresh: fetchReportedCount,
  };
};
