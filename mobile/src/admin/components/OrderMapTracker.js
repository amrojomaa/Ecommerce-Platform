import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';

const buildMapHtml = (deliveryJob, driverPosition, labels, isDark) => {
  const payload = JSON.stringify({
    job: deliveryJob,
    driver: driverPosition,
    labels,
    isDark,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${isDark ? '#0f172a' : '#f8fafc'}; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .job-marker-inner, .driver-marker-inner {
      width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 18px; box-shadow: 0 4px 12px rgba(15,23,42,0.18); border: 2px solid #fff;
    }
    .pickup-marker .job-marker-inner { background: #fef3c7; }
    .delivery-marker .job-marker-inner { background: #dbeafe; }
    .driver-marker-inner { background: #2563eb; width: 40px; height: 40px; font-size: 20px; }
    .live-badge {
      position: absolute; top: 10px; right: 10px; z-index: 1000;
      background: rgba(22,163,74,0.92); color: #fff; padding: 6px 10px; border-radius: 999px;
      font-size: 12px; font-weight: 700;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="liveBadge" class="live-badge" style="display:none;"></div>
  <script>
    const DATA = ${payload};
    const job = DATA.job || {};
    const driver = DATA.driver;
    const labels = DATA.labels || {};
    let map = null;
    let routeLayer = null;
    let markers = [];

    function clearMap() {
      markers.forEach(m => { try { m.remove(); } catch(e) {} });
      markers = [];
      if (routeLayer) { try { routeLayer.remove(); } catch(e) {} routeLayer = null; }
    }

    function initMap() {
      if (!window.L || map) return;
      let center = [32.2211, 35.2544];
      if (job.pickup_latitude) center = [job.pickup_latitude, job.pickup_longitude];
      else if (job.delivery_latitude) center = [job.delivery_latitude, job.delivery_longitude];

      map = L.map('map', { zoomControl: true }).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(map);
      renderMarkersAndRoute();
    }

    function renderMarkersAndRoute() {
      if (!map || !window.L) return;
      clearMap();
      const bounds = [];

      if (job.pickup_latitude) {
        const icon = L.divIcon({
          className: 'pickup-marker',
          html: '<div class="job-marker-inner">📦</div>',
          iconSize: [36, 36], iconAnchor: [18, 18]
        });
        const m = L.marker([job.pickup_latitude, job.pickup_longitude], { icon })
          .addTo(map).bindPopup(labels.pickup || 'Pickup');
        markers.push(m);
        bounds.push([job.pickup_latitude, job.pickup_longitude]);
      }

      if (job.delivery_latitude) {
        let dLat = job.delivery_latitude;
        let dLng = job.delivery_longitude;
        if (job.pickup_latitude === job.delivery_latitude && job.pickup_longitude === job.delivery_longitude) {
          dLat += 0.0003; dLng += 0.0003;
        }
        const icon = L.divIcon({
          className: 'delivery-marker',
          html: '<div class="job-marker-inner">📍</div>',
          iconSize: [36, 36], iconAnchor: [18, 18]
        });
        const m = L.marker([dLat, dLng], { icon }).addTo(map).bindPopup(labels.delivery || 'Delivery');
        markers.push(m);
        bounds.push([dLat, dLng]);
      }

      if (driver && driver.lat && driver.lng) {
        const icon = L.divIcon({
          className: 'driver-marker',
          html: '<div class="driver-marker-inner">🚚</div>',
          iconSize: [40, 40], iconAnchor: [20, 20]
        });
        const m = L.marker([driver.lat, driver.lng], { icon }).addTo(map).bindPopup(labels.driver || 'Driver');
        markers.push(m);
        bounds.push([driver.lat, driver.lng]);
        const badge = document.getElementById('liveBadge');
        if (badge) {
          badge.style.display = 'block';
          badge.textContent = labels.live || 'Live';
        }
      } else {
        const badge = document.getElementById('liveBadge');
        if (badge) badge.style.display = 'none';
      }

      if (bounds.length) {
        try { map.fitBounds(bounds, { padding: [40, 40] }); } catch(e) {}
      }

      let startLat = null, startLng = null, endLat = null, endLng = null;
      if (driver && driver.lat && driver.lng) {
        startLat = driver.lat; startLng = driver.lng;
        if (job.status === 'assigned') {
          endLat = job.pickup_latitude; endLng = job.pickup_longitude;
        } else {
          endLat = job.delivery_latitude; endLng = job.delivery_longitude;
        }
      } else {
        startLat = job.pickup_latitude; startLng = job.pickup_longitude;
        endLat = job.delivery_latitude; endLng = job.delivery_longitude;
      }

      if (startLat && startLng && endLat && endLng) {
        const url = 'https://router.project-osrm.org/route/v1/driving/' +
          startLng + ',' + startLat + ';' + endLng + ',' + endLat + '?overview=full&geometries=geojson';
        fetch(url).then(res => res.json()).then(data => {
          if (data.routes && data.routes.length && map) {
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            routeLayer = L.polyline(coords, { color: '#2563eb', weight: 4, opacity: 0.75, dashArray: '7,7' }).addTo(map);
          }
        }).catch(() => {
          if (map) {
            routeLayer = L.polyline([[startLat, startLng], [endLat, endLng]], {
              color: '#2563eb', weight: 4, opacity: 0.75, dashArray: '10,10'
            }).addTo(map);
          }
        });
      }
    }

    window.updateMapData = function(nextPayload) {
      Object.assign(DATA, nextPayload || {});
      renderMarkersAndRoute();
    };

    if (window.L) initMap();
    else window.addEventListener('load', initMap);
  </script>
</body>
</html>`;
};

const OrderMapTracker = ({ deliveryJob, labels = {} }) => {
  const { isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [driverPosition, setDriverPosition] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const fetchDriverLocation = useCallback(async () => {
    if (!deliveryJob) return;

    if (deliveryJob.status === 'picked_up' && deliveryJob.pickup_latitude) {
      setDriverPosition({
        lat: deliveryJob.pickup_latitude,
        lng: deliveryJob.pickup_longitude,
      });
      return;
    }

    if (
      !deliveryJob.driver_id ||
      ['delivered', 'cancelled'].includes((deliveryJob.status || '').toLowerCase())
    ) {
      return;
    }

    try {
      const response = await http.get(
        buildUrl(DELIVERY_ENDPOINTS.DRIVER_LOCATION, { driver_id: deliveryJob.driver_id })
      );
      if (response.data?.latitude && response.data?.longitude) {
        setDriverPosition({
          lat: response.data.latitude,
          lng: response.data.longitude,
        });
      }
    } catch (_) {}
  }, [deliveryJob]);

  useEffect(() => {
    const status = (deliveryJob?.status || '').toLowerCase();
    if (['assigned', 'picked_up', 'delivering'].includes(status)) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [deliveryJob?.status, fetchDriverLocation]);

  const html = useMemo(
    () => buildMapHtml(deliveryJob, driverPosition, labels, isDark),
    [deliveryJob, driverPosition, labels, isDark]
  );

  const injectUpdate = useMemo(() => {
    const payload = JSON.stringify({
      job: deliveryJob,
      driver: driverPosition,
      labels,
      isDark,
    });
    return `window.updateMapData && window.updateMapData(${payload}); true;`;
  }, [deliveryJob, driverPosition, labels, isDark]);

  if (!deliveryJob) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>{labels.unavailable}</Text>
      </View>
    );
  }

  const status = (deliveryJob.status || '').toLowerCase();
  if (['delivered', 'cancelled'].includes(status)) {
    const isDelivered = status === 'delivered';
    return (
      <View style={styles.doneCard}>
        <Text style={styles.doneIcon}>{isDelivered ? '✅' : '❌'}</Text>
        <Text style={styles.doneTitle}>
          {isDelivered ? labels.deliveryCompleted : labels.deliveryCancelled}
        </Text>
        <Text style={styles.doneText}>
          {isDelivered ? labels.trackingDeliveredInactive : labels.trackingCancelledInactive}
        </Text>
      </View>
    );
  }

  const hasAnyLocation =
    deliveryJob.pickup_latitude || deliveryJob.delivery_latitude || driverPosition;

  if (!hasAnyLocation) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>{labels.coordsUnavailable}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!mapReady ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={isDark ? '#93c5fd' : '#2563eb'} />
        </View>
      ) : null}
      <WebView
        key={`${deliveryJob.id}-${isDark ? 'dark' : 'light'}`}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        onLoadEnd={() => setMapReady(true)}
        injectedJavaScript={injectUpdate}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
      />
    </View>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    container: {
      height: 280,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      ...shadow,
    },
    webview: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.8)',
    },
    unavailable: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    unavailableText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
    },
    doneCard: {
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    doneIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    doneTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    doneText: {
      marginTop: 6,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

export default OrderMapTracker;
