import { useCallback, useContext, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import http from '../services/http';
import { DELIVERY_ENDPOINTS } from '../config/api';

export const useDriverLocation = (enabled = true) => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const watchRef = useRef(null);

  const pushLocation = useCallback(async (latitude, longitude) => {
    try {
      await http.patch(DELIVERY_ENDPOINTS.UPDATE_LOCATION, { latitude, longitude });
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!enabled || !isAuthenticated || user?.role !== 'driver') {
      return undefined;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 25,
          },
          (pos) => {
            pushLocation(pos.coords.latitude, pos.coords.longitude);
          }
        );
      } catch (_) {}
    };

    start();

    return () => {
      cancelled = true;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [enabled, isAuthenticated, pushLocation, user?.role]);
};
