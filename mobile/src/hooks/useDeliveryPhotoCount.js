import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { DELIVERY_ENDPOINTS } from '../config/api';

export const useDeliveryPhotoCount = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const canManageDelivery =
    user?.role === 'admin' || user?.role === 'operations_manager';

  const fetchPhotoCount = useCallback(async () => {
    if (!isAuthenticated || !canManageDelivery) {
      setPhotoCount(0);
      return;
    }

    setLoading(true);
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
      const jobs = Array.isArray(response.data) ? response.data : [];

      const count = jobs.filter((job) => {
        const status = (job.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'delivered') {
          return false;
        }

        const photos = Array.isArray(job.photos) ? job.photos : [];
        const hasPickup = photos.some((photo) => photo.photo_type === 'pickup');
        const hasDelivery = photos.some((photo) => photo.photo_type === 'delivery');
        const needsPickupReview = hasPickup && !job.pickup_photo_checked;
        const needsDeliveryReview = hasDelivery && !job.delivery_photo_checked;
        return needsPickupReview || needsDeliveryReview;
      }).length;

      setPhotoCount(count);
    } catch (_) {
      setPhotoCount(0);
    } finally {
      setLoading(false);
    }
  }, [canManageDelivery, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && canManageDelivery) {
      fetchPhotoCount();
      const interval = setInterval(fetchPhotoCount, 30000);
      return () => clearInterval(interval);
    }
    setPhotoCount(0);
    return undefined;
  }, [canManageDelivery, fetchPhotoCount, isAuthenticated]);

  return {
    photoCount,
    loading,
    refresh: fetchPhotoCount,
  };
};
