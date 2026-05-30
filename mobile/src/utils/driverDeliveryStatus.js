export const DELIVERY_STATUS_LABEL_KEYS = {
  available: 'ui.pages.driver.status.available',
  assigned: 'ui.pages.driver.status.assigned',
  picked_up: 'ui.pages.driver.status.pickedUp',
  delivering: 'ui.pages.driver.status.delivering',
  delivered: 'ui.pages.driver.status.delivered',
  cancelled: 'ui.pages.driver.status.cancelled',
};

const normalizeDeliveryStatus = (status) => String(status || '').toLowerCase().trim();

export const getDeliveryStatusLabel = (status, tUi) => {
  const normalized = normalizeDeliveryStatus(status);
  const key = DELIVERY_STATUS_LABEL_KEYS[normalized];
  if (key) return tUi(key);
  return normalized.replace(/_/g, ' ') || status || '';
};

export const getDeliveryStatusTone = (status) => {
  const normalized = normalizeDeliveryStatus(status);
  if (DELIVERY_STATUS_LABEL_KEYS[normalized]) return normalized;
  return 'default';
};
