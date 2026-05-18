import React, { useState, useEffect, useRef, useCallback } from 'react';
import http from '../services/http';
import { DELIVERY_ENDPOINTS } from '../config/api';
import '../styles/components/OrderMapTracker.css';

const OrderMapTracker = ({ deliveryJob }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayersRef = useRef([]);
  const driverMarkerRef = useRef(null);
  const mapSessionRef = useRef(0);
  const [driverPosition, setDriverPosition] = useState(null);

  const fetchDriverLocation = useCallback(async () => {
    // Hardcode position to warehouse if assigned or picked up
    if (['assigned', 'picked_up'].includes(deliveryJob?.status) && deliveryJob?.pickup_latitude) {
      setDriverPosition({ lat: deliveryJob.pickup_latitude, lng: deliveryJob.pickup_longitude });
      return;
    }

    if (!deliveryJob?.driver_id) {
      return;
    }
    try {
      const response = await http.get(`/delivery/location/${deliveryJob.driver_id}`);
      if (response.data && response.data.latitude && response.data.longitude) {
        setDriverPosition({ lat: response.data.latitude, lng: response.data.longitude });
      }
    } catch (error) {
      console.warn("Could not fetch driver location:", error);
    }
  }, [deliveryJob?.driver_id, deliveryJob?.status, deliveryJob?.pickup_latitude, deliveryJob?.pickup_longitude]);

  useEffect(() => {
    if (!['delivered', 'cancelled', 'assigned', 'picked_up'].includes(deliveryJob?.status)) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 10000); // Polling every 10 seconds
      return () => clearInterval(interval);
    } else {
      // Just fetch once for hardcoded statuses like picked_up
      fetchDriverLocation();
    }
  }, [deliveryJob?.status, fetchDriverLocation]);

  // Load Leaflet
  useEffect(() => {
    if (document.getElementById('leaflet-css')) {
      initMap();
      return;
    }

    const css = document.createElement('link');
    css.id = 'leaflet-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      initMap();
    };
    document.head.appendChild(script);
    
    function initMap() {
      // Small delay to ensure container size is correct before rendering map
      setTimeout(() => {
        // Trigger a fake re-render to run the map initialization effect
        setDriverPosition(prev => prev ? {...prev} : prev);
      }, 100);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstanceRef.current || !deliveryJob) return;
    const L = window.L;

    const currentSession = ++mapSessionRef.current;
    
    // Default center to pickup if available, else delivery, else fallback
    let center = [31.9, 35.9];
    if (deliveryJob.pickup_latitude) {
      center = [deliveryJob.pickup_latitude, deliveryJob.pickup_longitude];
    } else if (deliveryJob.delivery_latitude) {
      center = [deliveryJob.delivery_latitude, deliveryJob.delivery_longitude];
    }

    const map = L.map(mapRef.current).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapSessionRef.current === currentSession) {
        mapSessionRef.current += 1;
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch(e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [deliveryJob]);

  // Draw Markers & Routes
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current || !mapInstanceRef.current._loaded || !deliveryJob) return;

    // Clear old markers
    markersRef.current.forEach(m => { try { m.remove(); } catch(e){} });
    markersRef.current = [];
    routeLayersRef.current.forEach(l => { try { l.remove(); } catch(e){} });
    routeLayersRef.current = [];

    const bounds = [];

    // Pickup Marker
    if (deliveryJob.pickup_latitude) {
      const pickupIcon = L.divIcon({
        className: 'job-marker pickup-marker',
        html: '<div class="job-marker-inner">📦</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      const m = L.marker([deliveryJob.pickup_latitude, deliveryJob.pickup_longitude], { icon: pickupIcon }).addTo(mapInstanceRef.current).bindPopup("Pickup Location");
      markersRef.current.push(m);
      bounds.push([deliveryJob.pickup_latitude, deliveryJob.pickup_longitude]);
    }

    // Delivery Marker
    if (deliveryJob.delivery_latitude) {
      const deliveryIcon = L.divIcon({
        className: 'job-marker delivery-marker',
        html: '<div class="job-marker-inner">📍</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      const m = L.marker([deliveryJob.delivery_latitude, deliveryJob.delivery_longitude], { icon: deliveryIcon }).addTo(mapInstanceRef.current).bindPopup("Delivery Location");
      markersRef.current.push(m);
      bounds.push([deliveryJob.delivery_latitude, deliveryJob.delivery_longitude]);
    }

    // Fit bounds if we have points
    if (bounds.length > 0) {
      try {
        // Only fit bounds once on load, we don't want to snap away from user if they're panning
        if (!mapInstanceRef.current._hasFittedBounds) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          mapInstanceRef.current._hasFittedBounds = true;
        }
      } catch(e) {}
    }

    // Draw route if both exist
    if (deliveryJob.pickup_latitude && deliveryJob.delivery_latitude) {
      const startLng = deliveryJob.pickup_longitude;
      const startLat = deliveryJob.pickup_latitude;
      const endLng = deliveryJob.delivery_longitude;
      const endLat = deliveryJob.delivery_latitude;

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      
      fetch(osrmUrl).then(res => res.json()).then(data => {
        if (data.routes && data.routes.length > 0) {
          const routeCoordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          if (mapInstanceRef.current && mapInstanceRef.current._loaded) {
            const layer = L.polyline(routeCoordinates, { color: '#2563eb', weight: 4, opacity: 0.75, dashArray: '7, 7' }).addTo(mapInstanceRef.current);
            routeLayersRef.current.push(layer);
          }
        }
      }).catch(() => {
        // fallback line
        if (mapInstanceRef.current && mapInstanceRef.current._loaded) {
          const layer = L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#2563eb', weight: 4, opacity: 0.75, dashArray: '10, 10' }).addTo(mapInstanceRef.current);
          routeLayersRef.current.push(layer);
        }
      });
    }

  }, [deliveryJob]);

  // Driver Marker
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current || !driverPosition) return;

    if (!driverMarkerRef.current) {
      const driverIcon = L.divIcon({
        className: 'driver-marker',
        html: '<div class="driver-marker-inner tracker-driver">🚚</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], { icon: driverIcon }).addTo(mapInstanceRef.current).bindPopup("Driver Current Location");
    } else {
      driverMarkerRef.current.setLatLng([driverPosition.lat, driverPosition.lng]);
    }
  }, [driverPosition]);


  const hasAnyLocation = deliveryJob?.pickup_latitude || deliveryJob?.delivery_latitude || driverPosition;

  if (!deliveryJob || !hasAnyLocation) {
    return <div className="tracker-unavailable">Map coordinates unavailable for this order. (Waiting for driver to share location or update job)</div>;
  }

  return (
    <div className="order-map-tracker-container">
      <div ref={mapRef} className="order-map-tracker" />
      {driverPosition && <div className="live-badge">Live Tracking 🟢</div>}
    </div>
  );
};

export default OrderMapTracker;
