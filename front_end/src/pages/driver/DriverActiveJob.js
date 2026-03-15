import React, { useState, useEffect, useRef, useCallback } from 'react';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import DeliveryChatModal from '../../components/DeliveryChatModal';
import '../../styles/pages/driver/DriverActiveJob.css';

const DriverActiveJob = () => {
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const token = localStorage.getItem('token');
  // Hacky way to get driver ID if not stored in auth context directly, parse JWT if needed
  // Better to rely on token in WS endpoint and let it sort it out.
  // Assuming user ID is stored in localStorage or decode JWT:
  const getUserIdFromToken = () => {
      if (!token) return null;
      try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.user_id;
      } catch (e) {
          return null;
      }
  };
  const currentUserId = getUserIdFromToken();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const fetchActiveJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS);
      setJobs(response.data);
      if (response.data.length > 0) {
        setActiveJob(response.data[0]);
      } else {
        setActiveJob(null);
      }
    } catch (error) {
      console.error('Error fetching active jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveJobs();
    
    // Also poll every 30 seconds to catch admin cancellations
    const pollInterval = setInterval(() => {
      fetchActiveJobs();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [fetchActiveJobs]);

  // Update location periodically
  useEffect(() => {
    if (!activeJob) return;

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            http.patch(DELIVERY_ENDPOINTS.UPDATE_LOCATION, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }).catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 10000);
    return () => clearInterval(interval);
  }, [activeJob]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !activeJob) return;

    const initMap = () => {
      try {
        const L = window.L;
        if (!L || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const centerLat = activeJob.pickup_latitude || 31.9;
        const centerLng = activeJob.pickup_longitude || 35.9;

        const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Pickup marker
        if (typeof activeJob.pickup_latitude === 'number' && typeof activeJob.pickup_longitude === 'number') {
          const pickupIcon = L.divIcon({
            className: 'active-marker pickup',
            html: '<div class="active-marker-inner">📦</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          L.marker([activeJob.pickup_latitude, activeJob.pickup_longitude], { icon: pickupIcon })
            .addTo(map)
            .bindPopup('Pickup Location');
        }

        // Delivery marker
        if (typeof activeJob.delivery_latitude === 'number' && typeof activeJob.delivery_longitude === 'number') {
          const deliveryIcon = L.divIcon({
            className: 'active-marker delivery',
            html: '<div class="active-marker-inner">🏠</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          L.marker([activeJob.delivery_latitude, activeJob.delivery_longitude], { icon: deliveryIcon })
            .addTo(map)
            .bindPopup('Delivery Location');
        }

        const hasPickup = typeof activeJob.pickup_latitude === 'number' && typeof activeJob.pickup_longitude === 'number';
        const hasDelivery = typeof activeJob.delivery_latitude === 'number' && typeof activeJob.delivery_longitude === 'number';

        const drawRoute = (startLat, startLng, endLat, endLng) => {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

          fetch(osrmUrl)
            .then(res => res.json())
            .then(data => {
              if (data.routes && data.routes.length > 0) {
                const routeCoordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                L.polyline(routeCoordinates, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(map);
                map.fitBounds(L.polyline(routeCoordinates).getBounds(), { padding: [50, 50] });
              } else {
                L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#3b82f6', weight: 4, dashArray: '10, 10' }).addTo(map);
                map.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [50, 50] });
              }
            })
            .catch(err => {
              console.error("Error fetching route:", err);
              L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#3b82f6', weight: 4, dashArray: '10, 10' }).addTo(map);
              map.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [50, 50] });
            });
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            if (!mapInstanceRef.current) return;
            
            let driverLat = pos.coords.latitude;
            let driverLng = pos.coords.longitude;

            // If the driver implies they picked up the order, their starting origin is the pickup location.
            // This prevents the GPS from placing them somewhere else and drawing an inaccurate route.
            const isPickedUp = activeJob.status === 'picked_up' || activeJob.status === 'delivering';
            if (isPickedUp && hasPickup) {
              driverLat = activeJob.pickup_latitude;
              driverLng = activeJob.pickup_longitude;
            }

            const driverIcon = L.divIcon({
              className: 'active-marker driver',
              html: '<div class="active-marker-inner">🚚</div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            });
            L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map).bindPopup(isPickedUp ? 'Picked Up From Here' : 'Your Location');

            if (activeJob.status === 'assigned' && hasPickup) {
              drawRoute(driverLat, driverLng, activeJob.pickup_latitude, activeJob.pickup_longitude);
            } else if (isPickedUp && hasDelivery) {
              drawRoute(driverLat, driverLng, activeJob.delivery_latitude, activeJob.delivery_longitude);
            } else if (hasPickup && hasDelivery) {
              drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
            }
          }, (err) => {
             if (hasPickup && hasDelivery) drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
          }, { enableHighAccuracy: true });
        } else {
          if (hasPickup && hasDelivery) drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
        }

        mapInstanceRef.current = map;
      } catch (err) {
        console.error("Map initialization error:", err);
      }
    };

    // Load Leaflet if needed
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }

    if (window.L) {
      initMap();
    } else if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      const checkLeaflet = setInterval(() => {
        if (window.L) {
          clearInterval(checkLeaflet);
          initMap();
        }
      }, 100);
      return () => clearInterval(checkLeaflet);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeJob]);

  const handlePickup = async () => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      const response = await http.patch(buildUrl(DELIVERY_ENDPOINTS.PICKUP_JOB, { job_id: activeJob.id }));
      toast.success('Order marked as picked up!');
      setActiveJob(response.data);
      fetchActiveJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
      fetchActiveJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handleDeliver = async () => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      const response = await http.patch(buildUrl(DELIVERY_ENDPOINTS.DELIVER_JOB, { job_id: activeJob.id }));
      toast.success('Order delivered successfully! 🎉');
      setActiveJob(null);
      fetchActiveJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
      fetchActiveJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = async (type) => {
    if (!photoFile || !activeJob) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      await http.post(
        buildUrl(DELIVERY_ENDPOINTS.UPLOAD_PHOTO, { job_id: activeJob.id }) + `?photo_type=${type}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(`${type === 'pickup' ? 'Pickup' : 'Delivery'} photo uploaded!`);
      setPhotoFile(null);
    } catch (error) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!activeJob || !issueType) return;
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.REPORT_ISSUE, { job_id: activeJob.id }), {
        issue_type: issueType,
        description: issueDescription,
      });
      toast.success('Issue reported');
      setShowIssueModal(false);
      setIssueType('');
      setIssueDescription('');
      fetchActiveJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to report issue');
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { key: 'assigned', label: 'Accepted', icon: '✅' },
      { key: 'picked_up', label: 'Picked Up', icon: '📦' },
      { key: 'delivering', label: 'Delivering', icon: '🚚' },
      { key: 'delivered', label: 'Delivered', icon: '🏠' },
    ];
    const statusOrder = ['assigned', 'picked_up', 'delivering', 'delivered'];
    const currentIdx = statusOrder.indexOf(activeJob?.status);
    return steps.map((step, idx) => ({
      ...step,
      completed: idx <= currentIdx,
      current: idx === currentIdx,
    }));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!activeJob) {
    return (
      <div className="active-job-page">
        <div className="no-active-job">
          <div className="no-job-icon">🚚</div>
          <h2>No Active Delivery</h2>
          <p>You don't have any active delivery jobs right now.</p>
          <a href="/driver/map" className="btn-find-jobs">Find Available Jobs</a>
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <div className="active-job-page">
      <h1>Active Delivery</h1>

      {/* Status stepper */}
      <div className="status-stepper">
        {statusSteps.map((step, idx) => (
          <div key={step.key} className={`step ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}>
            <div className="step-circle">
              {step.completed ? step.icon : (idx + 1)}
            </div>
            <span className="step-label">{step.label}</span>
            {idx < statusSteps.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>

      <div className="active-job-layout">
        {/* Map */}
        <div className="active-job-map">
          <div ref={mapRef} className="active-map-view" />
        </div>

        {/* Job info */}
        <div className="active-job-info">
          <div className="info-card">
            <h3>Order #{activeJob.order_id}</h3>
            <div className="info-status">
              <span className={`status-badge status-${activeJob.status || 'unknown'}`}>
                {(activeJob.status || 'unknown').replace('_', ' ')}
              </span>
              <span className="info-payment">
                ${typeof activeJob.payment_amount === 'number' ? activeJob.payment_amount.toFixed(2) : '0.00'}
              </span>
            </div>
          </div>

          <div className="info-card">
            <h3>📦 Pickup</h3>
            <p>{activeJob.pickup_address || 'N/A'}</p>
          </div>

          <div className="info-card">
            <h3>📍 Delivery</h3>
            <p>{activeJob.delivery_address || 'N/A'}</p>
            {activeJob.customer && (
              <p className="customer-name">
                👤 {activeJob.customer.first_name} {activeJob.customer.last_name}
                {activeJob.customer.phone && ` • ${activeJob.customer.phone}`}
              </p>
            )}
          </div>

          {/* Items */}
          {activeJob.items && activeJob.items.length > 0 && (
            <div className="info-card">
              <h3>Items</h3>
              {activeJob.items.map((item, idx) => (
                <div key={idx} className="delivery-item">
                  <span>{item.product?.name}</span>
                  <span>x{item.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Photo upload */}
          <div className="info-card">
            <h3>📸 Upload Photo</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files[0])}
              className="photo-input"
            />
            {photoFile && (
              <div className="photo-actions">
                <button
                  onClick={() => handlePhotoUpload('pickup')}
                  disabled={uploading}
                  className="btn-photo"
                >
                  {uploading ? '...' : 'Upload as Pickup'}
                </button>
                <button
                  onClick={() => handlePhotoUpload('delivery')}
                  disabled={uploading}
                  className="btn-photo"
                >
                  {uploading ? '...' : 'Upload as Delivery'}
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="action-buttons">
            <button onClick={() => setShowChat(true)} className="btn-primary-action" style={{ backgroundColor: '#10b981', marginBottom: '10px', width: '100%' }}>
              💬 Chat with Customer
            </button>
            {activeJob.status === 'assigned' && (
              <button onClick={handlePickup} disabled={updating} className="btn-primary-action">
                {updating ? 'Updating...' : '📦 Mark as Picked Up'}
              </button>
            )}
            {(activeJob.status === 'picked_up' || activeJob.status === 'delivering') && (
              <button onClick={handleDeliver} disabled={updating} className="btn-primary-action btn-deliver">
                {updating ? 'Updating...' : '🏠 Mark as Delivered'}
              </button>
            )}
            <button onClick={() => setShowIssueModal(true)} className="btn-report-issue">
              ⚠️ Report Issue
            </button>
          </div>
        </div>
      </div>

      {/* Issue Report Modal */}
      {showIssueModal && (
        <div className="issue-modal-overlay">
          <div className="issue-modal">
            <button className="close-modal" onClick={() => setShowIssueModal(false)}>×</button>
            <h2>Report an Issue</h2>
            <div className="issue-types">
              {[
                { value: 'customer_not_home', label: '🏠 Customer Not Home' },
                { value: 'incorrect_address', label: '📍 Incorrect Address' },
                { value: 'damaged_items', label: '❌ Damaged Items' },
                { value: 'other', label: '📝 Other' },
              ].map((type) => (
                <button
                  key={type.value}
                  className={`issue-type-btn ${issueType === type.value ? 'selected' : ''}`}
                  onClick={() => setIssueType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Describe the issue..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="issue-description"
            />
            <button onClick={handleReportIssue} className="btn-submit-issue" disabled={!issueType}>
              Submit Report
            </button>
          </div>
        </div>
      )}

      {/* Delivery Chat Modal */}
      {activeJob && (
         <DeliveryChatModal
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            jobId={activeJob.id}
            token={token}
            currentUserId={currentUserId}
            isDriver={true}
         />
      )}
    </div>
  );
};

export default DriverActiveJob;
