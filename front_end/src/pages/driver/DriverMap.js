import React, { useState, useEffect, useRef, useCallback } from 'react';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/driver/DriverMap.css';

const DriverMap = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [driverPosition, setDriverPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const driverMarkerRef = useRef(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS);
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get driver position
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverPosition(newPos);
          // Update location on server
          http.patch(DELIVERY_ENDPOINTS.UPDATE_LOCATION, {
            latitude: newPos.lat,
            longitude: newPos.lng,
          }).catch(() => {});
        },
        (err) => {
          console.warn('Geolocation error:', err);
          // Default position
          setDriverPosition({ lat: 31.9, lng: 35.9 });
        },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setDriverPosition({ lat: 31.9, lng: 35.9 });
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !driverPosition || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([driverPosition.lat, driverPosition.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Driver marker
    const driverIcon = L.divIcon({
      className: 'driver-marker',
      html: '<div class="driver-marker-inner">🚚</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], { icon: driverIcon }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [driverPosition]);

  // Update markers when jobs change
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    jobs.forEach((job) => {
      if (job.pickup_latitude && job.pickup_longitude) {
        const pickupIcon = L.divIcon({
          className: 'job-marker pickup-marker',
          html: '<div class="job-marker-inner">📦</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = L.marker([job.pickup_latitude, job.pickup_longitude], { icon: pickupIcon })
          .addTo(mapInstanceRef.current)
          .on('click', () => setSelectedJob(job));
        markersRef.current.push(marker);
      }
      if (job.delivery_latitude && job.delivery_longitude) {
        const deliveryIcon = L.divIcon({
          className: 'job-marker delivery-marker',
          html: '<div class="job-marker-inner">📍</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = L.marker([job.delivery_latitude, job.delivery_longitude], { icon: deliveryIcon })
          .addTo(mapInstanceRef.current)
          .on('click', () => setSelectedJob(job));
        markersRef.current.push(marker);
      }
    });
  }, [jobs]);

  // Update driver marker position
  useEffect(() => {
    if (driverMarkerRef.current && driverPosition) {
      driverMarkerRef.current.setLatLng([driverPosition.lat, driverPosition.lng]);
    }
  }, [driverPosition]);

  const handleAccept = async (jobId) => {
    setAccepting(true);
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.ACCEPT_JOB, { job_id: jobId }));
      toast.success('Job accepted successfully!');
      setSelectedJob(null);
      fetchJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to accept job');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (jobId) => {
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.DECLINE_JOB, { job_id: jobId }));
      toast.info('Job declined');
      setSelectedJob(null);
      fetchJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to decline job');
    }
  };

  // Load Leaflet CSS and JS
  useEffect(() => {
    // Check if already loaded
    if (document.getElementById('leaflet-css')) return;

    const css = document.createElement('link');
    css.id = 'leaflet-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      // Trigger re-render to init map
      setDriverPosition((prev) => prev ? { ...prev } : prev);
    };
    document.head.appendChild(script);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="driver-map-page">
      <div className="map-header">
        <h1>Find Delivery Jobs</h1>
        <span className="jobs-count">{jobs.length} available</span>
      </div>

      <div className="map-container">
        <div ref={mapRef} className="map-view" />

        {/* Job list sidebar */}
        <div className="jobs-sidebar">
          <h3>Available Jobs</h3>
          {jobs.length === 0 ? (
            <p className="no-jobs">No delivery jobs available right now.</p>
          ) : (
            <div className="jobs-list">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={`job-item ${selectedJob?.id === job.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedJob(job);
                    if (mapInstanceRef.current && job.pickup_latitude) {
                      mapInstanceRef.current.flyTo([job.pickup_latitude, job.pickup_longitude], 15);
                    }
                  }}
                >
                  <div className="job-item-header">
                    <span className="job-order">Order #{job.order_id}</span>
                    <span className="job-pay">${job.payment_amount.toFixed(2)}</span>
                  </div>
                  <div className="job-item-details">
                    <div className="job-location">
                      <span className="location-icon">📦</span>
                      <span>{job.pickup_address || 'Pickup location'}</span>
                    </div>
                    <div className="job-location">
                      <span className="location-icon">📍</span>
                      <span>{job.delivery_address || 'Delivery location'}</span>
                    </div>
                  </div>
                  {job.items && job.items.length > 0 && (
                    <div className="job-items-preview">
                      {job.items.map((item, idx) => (
                        <span key={idx} className="item-tag">
                          {item.product?.name} x{item.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected job detail modal */}
      {selectedJob && (
        <div className="job-detail-modal">
          <div className="job-detail-content">
            <button className="close-modal" onClick={() => setSelectedJob(null)}>×</button>
            <h2>Delivery Job - Order #{selectedJob.order_id}</h2>
            
            <div className="detail-grid">
              <div className="detail-section">
                <h3>📦 Pickup</h3>
                <p>{selectedJob.pickup_address || 'N/A'}</p>
              </div>
              <div className="detail-section">
                <h3>📍 Delivery</h3>
                <p>{selectedJob.delivery_address || 'N/A'}</p>
              </div>
              <div className="detail-section">
                <h3>👤 Customer</h3>
                {selectedJob.customer ? (
                  <p>{selectedJob.customer.first_name} {selectedJob.customer.last_name}</p>
                ) : (
                  <p>N/A</p>
                )}
              </div>
              <div className="detail-section">
                <h3>💰 Payment</h3>
                <p className="payment-amount">${selectedJob.payment_amount.toFixed(2)}</p>
              </div>
            </div>

            {selectedJob.items && selectedJob.items.length > 0 && (
              <div className="items-section">
                <h3>Items to Deliver</h3>
                <div className="items-list">
                  {selectedJob.items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <span className="item-name">{item.product?.name}</span>
                      <span className="item-qty">x{item.quantity}</span>
                      <span className="item-price">${item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="job-actions">
              <button
                className="btn-accept"
                onClick={() => handleAccept(selectedJob.id)}
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : '✅ Accept Job'}
              </button>
              <button
                className="btn-decline"
                onClick={() => handleDecline(selectedJob.id)}
              >
                ❌ Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverMap;
