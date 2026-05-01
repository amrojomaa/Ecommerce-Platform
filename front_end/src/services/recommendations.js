import http from './http';
import { RECOMMENDATION_ENDPOINTS } from '../config/api';

/**
 * Fire-and-forget behavioral event (no-op if not logged in).
 * @param {{ event_type: string, product_id?: number, query_text?: string }} payload
 */
export function trackRecommendationEvent(payload) {
  if (!localStorage.getItem('token')) {
    return Promise.resolve();
  }
  return http.post(RECOMMENDATION_ENDPOINTS.EVENTS, payload).catch(() => {
    // Silently ignore — personalization must not break UX
  });
}

export function fetchRealtimeRecommendations(limit = 10) {
  return http.get(RECOMMENDATION_ENDPOINTS.REALTIME, { params: { limit } });
}

export function fetchBatchRecommendations(limit = 15, forceRefresh = false) {
  return http.get(RECOMMENDATION_ENDPOINTS.BATCH, {
    params: { limit, force_refresh: forceRefresh },
  });
}

export function resetRecommendationProfile() {
  return http.post(RECOMMENDATION_ENDPOINTS.RESET, {});
}
