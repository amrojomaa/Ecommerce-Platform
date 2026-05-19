import React, { useState, useEffect, useRef, useCallback } from 'react';
import http from '../services/http';
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
    if (deliveryJob?.status === 'picked_up' && deliveryJob?.pickup_latitude) {
      setDriverPosition({ lat: deliveryJob.pickup_latitude, lng: deliveryJob.pickup_longitude });
      return;
    }
    if (!deliveryJob?.driver_id || ['delivered', 'cancelled'].includes(deliveryJob?.status)) {
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
    if (['assigned', 'picked_up', 'delivering'].includes(deliveryJob?.status)) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 5000); // Poll driver position every 5 seconds for responsive tracking
      return () => clearInterval(interval);
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
    let center = [32.2211, 35.2544];
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

    if (driverMarkerRef.current) {
      try { driverMarkerRef.current.remove(); } catch(e){}
      driverMarkerRef.current = null;
    }

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
      let deliveryLat = deliveryJob.delivery_latitude;
      let deliveryLng = deliveryJob.delivery_longitude;
      if (deliveryJob.pickup_latitude === deliveryJob.delivery_latitude && deliveryJob.pickup_longitude === deliveryJob.delivery_longitude) {
        deliveryLat += 0.0003;
        deliveryLng += 0.0003;
      }
      const deliveryIcon = L.divIcon({
        className: 'job-marker delivery-marker',
        html: '<div class="job-marker-inner">📍</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      const m = L.marker([deliveryLat, deliveryLng], { icon: deliveryIcon }).addTo(mapInstanceRef.current).bindPopup("Delivery Location");
      markersRef.current.push(m);
      bounds.push([deliveryLat, deliveryLng]);
    }

    // Driver Marker
    if (driverPosition) {
      const driverIcon = L.divIcon({
        className: 'driver-marker',
        html: '<div class="driver-marker-inner tracker-driver">🚚</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], { icon: driverIcon }).addTo(mapInstanceRef.current).bindPopup("Driver Current Location");
      bounds.push([driverPosition.lat, driverPosition.lng]);
    }

    // Fit bounds if we have points
    if (bounds.length > 0) {
      try {
        if (!mapInstanceRef.current._hasFittedBounds) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          mapInstanceRef.current._hasFittedBounds = true;
        }
      } catch(e) {}
    }

    // Determine route start and end coordinates based on status (Just copy the driver's concept!)
    let startLat = null;
    let startLng = null;
    let endLat = null;
    let endLng = null;

    if (driverPosition) {
      startLat = driverPosition.lat;
      startLng = driverPosition.lng;
      if (['assigned'].includes(deliveryJob.status)) {
        // Route from driver to pickup warehouse
        endLat = deliveryJob.pickup_latitude;
        endLng = deliveryJob.pickup_longitude;
      } else {
        // Route from driver to customer delivery location
        endLat = deliveryJob.delivery_latitude;
        endLng = deliveryJob.delivery_longitude;
      }
    } else {
      // Fallback: Route from pickup to delivery
      startLat = deliveryJob.pickup_latitude;
      startLng = deliveryJob.pickup_longitude;
      endLat = deliveryJob.delivery_latitude;
      endLng = deliveryJob.delivery_longitude;
    }

    if (startLat && startLng && endLat && endLng) {
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
        if (mapInstanceRef.current && mapInstanceRef.current._loaded) {
          const layer = L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#2563eb', weight: 4, opacity: 0.75, dashArray: '10, 10' }).addTo(mapInstanceRef.current);
          routeLayersRef.current.push(layer);
        }
      });
    }

  }, [deliveryJob, driverPosition]);

  if (!deliveryJob) {
    return <div className="tracker-unavailable">No delivery job details available.</div>;
  }

  // Remove map when delivered or cancelled because it's done
  if (['delivered', 'cancelled'].includes(deliveryJob.status)) {
    return (
      <div className="tracker-done-container">
        <div className="tracker-done-card">
          <div className={`tracker-done-icon ${deliveryJob.status}`}>
            {deliveryJob.status === 'delivered' ? '✅' : '❌'}
          </div>
          <h3>
            {deliveryJob.status === 'delivered' 
              ? 'Delivery Completed Successfully' 
              : 'Delivery Cancelled'}
          </h3>
          <p>
            {deliveryJob.status === 'delivered'
              ? 'This order has been delivered and fulfilled. Map tracking is no longer active.'
              : 'This order fulfillment has been cancelled. Map tracking is inactive.'}
          </p>
        </div>
      </div>
    );
  }

  const hasAnyLocation = deliveryJob.pickup_latitude || deliveryJob.delivery_latitude || driverPosition;

  if (!hasAnyLocation) {
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
