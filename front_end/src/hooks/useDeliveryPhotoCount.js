import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import http from '../services/http';
import { DELIVERY_ENDPOINTS } from '../config/api';

export const useDeliveryPhotoCount = () => {
  const { user, isAuthenticated } = useAuth();
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchPhotoCount = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') {
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
    } catch (error) {
      console.error('Error fetching delivery photo notification count:', error);
      setPhotoCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchPhotoCount();

      const interval = setInterval(() => {
        fetchPhotoCount();
      }, 30000);

      return () => clearInterval(interval);
    }

    setPhotoCount(0);
  }, [fetchPhotoCount, isAuthenticated, user?.role]);

  return {
    photoCount,
    loading,
    refresh: fetchPhotoCount,
  };
};
