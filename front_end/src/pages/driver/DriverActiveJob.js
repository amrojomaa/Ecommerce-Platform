import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import DeliveryChatModal from '../../components/DeliveryChatModal';
import { formatDateTime, getImageUrl } from '../../utils/helpers';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/driver/DriverActiveJob.css';

const DriverActiveJob = () => {
  const { formatCurrency } = useCurrency();
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issuePhotoFile, setIssuePhotoFile] = useState(null);
  const [issuePhotoPreview, setIssuePhotoPreview] = useState('');
  const [pickupPhotoFile, setPickupPhotoFile] = useState(null);
  const [pickupPhotoPreview, setPickupPhotoPreview] = useState('');
  const [deliveryPhotoFile, setDeliveryPhotoFile] = useState(null);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [issueMessages, setIssueMessages] = useState([]);
  const [issueMessageText, setIssueMessageText] = useState('');
  const [issueChatLoading, setIssueChatLoading] = useState(false);
  const [issueSending, setIssueSending] = useState(false);

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
  const activeJob = jobs.find((job) => job.id === activeJobId) || jobs[0] || null;

  const fetchActiveJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS);
      const activeJobs = response.data || [];
      setJobs(activeJobs);
      setActiveJobId((prevId) => {
        if (activeJobs.length === 0) return null;
        if (prevId && activeJobs.some((job) => job.id === prevId)) return prevId;
        return activeJobs[0].id;
      });
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

  useEffect(() => {
    if (!pickupPhotoFile) {
      setPickupPhotoPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(pickupPhotoFile);
    setPickupPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pickupPhotoFile]);

  useEffect(() => {
    if (!deliveryPhotoFile) {
      setDeliveryPhotoPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(deliveryPhotoFile);
    setDeliveryPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [deliveryPhotoFile]);

  useEffect(() => {
    if (!issuePhotoFile) {
      setIssuePhotoPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(issuePhotoFile);
    setIssuePhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [issuePhotoFile]);

  // Update location periodically
  useEffect(() => {
    if (!activeJob) return;

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            http.patch(DELIVERY_ENDPOINTS.UPDATE_LOCATION, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
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
    let isCancelled = false;

    const initMap = () => {
      try {
        const L = window.L;
        if (!L || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const centerLat = activeJob.pickup_latitude || 32.2211;
        const centerLng = activeJob.pickup_longitude || 35.2544;

        const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);
        // Register map instance immediately so async callbacks can draw routes safely.
        mapInstanceRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(map);

        // Pickup marker
        if (typeof activeJob.pickup_latitude === 'number' && typeof activeJob.pickup_longitude === 'number') {
          const pickupIcon = L.divIcon({
            className: 'active-marker pickup',
            html: '<div class="active-marker-inner">📦</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          L.marker([activeJob.pickup_latitude, activeJob.pickup_longitude], { icon: pickupIcon })
          .addTo(map)
          .bindPopup('Pickup Location');
        }

        // Delivery marker
        if (typeof activeJob.delivery_latitude === 'number' && typeof activeJob.delivery_longitude === 'number') {
          let deliveryLat = activeJob.delivery_latitude;
          let deliveryLng = activeJob.delivery_longitude;
          if (activeJob.pickup_latitude === activeJob.delivery_latitude && activeJob.pickup_longitude === activeJob.delivery_longitude) {
            deliveryLat += 0.0003;
            deliveryLng += 0.0003;
          }
          const deliveryIcon = L.divIcon({
            className: 'active-marker delivery',
            html: '<div class="active-marker-inner">🏠</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          L.marker([deliveryLat, deliveryLng], { icon: deliveryIcon })
          .addTo(map)
          .bindPopup('Delivery Location');
        }

        const hasPickup = typeof activeJob.pickup_latitude === 'number' && typeof activeJob.pickup_longitude === 'number';
        const hasDelivery = typeof activeJob.delivery_latitude === 'number' && typeof activeJob.delivery_longitude === 'number';
        const isPickedUpState = activeJob.status === 'picked_up' || activeJob.status === 'delivering';
        const isMapActive = () => !isCancelled && mapInstanceRef.current === map;

        const drawRoute = (startLat, startLng, endLat, endLng) => {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

          fetch(osrmUrl)
          .then((res) => res.json())
          .then((data) => {
            if (!isMapActive()) return;
            if (data.routes && data.routes.length > 0) {
              const routeCoordinates = data.routes[0].geometry.coordinates.map((coord) => [coord[1], coord[0]]);
              L.polyline(routeCoordinates, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(map);
              map.fitBounds(L.polyline(routeCoordinates).getBounds(), { padding: [50, 50] });
            } else {
              L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#3b82f6', weight: 4, dashArray: '10, 10' }).addTo(map);
              map.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [50, 50] });
            }
          })
          .catch((err) => {
            console.error("Error fetching route:", err);
            if (!isMapActive()) return;
            L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#3b82f6', weight: 4, dashArray: '10, 10' }).addTo(map);
            map.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [50, 50] });
          });
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            if (!isMapActive()) return;

            let driverLat = pos.coords.latitude;
            let driverLng = pos.coords.longitude;

            if (activeJob.status === 'picked_up' && hasPickup) {
              driverLat = activeJob.pickup_latitude;
              driverLng = activeJob.pickup_longitude;
            }

            const driverIcon = L.divIcon({
              className: 'active-marker driver',
              html: '<div class="active-marker-inner">🚚</div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            });
            L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map).bindPopup(activeJob.status === 'picked_up' ? 'Driver at Warehouse (Picked Up)' : 'Your Location');

            if (isPickedUpState && hasDelivery) {
              // After pickup, route from driver's current position to customer's delivery location
              drawRoute(driverLat, driverLng, activeJob.delivery_latitude, activeJob.delivery_longitude);
            } else if (activeJob.status === 'assigned' && hasPickup) {
              // If assigned but not picked up yet, route from driver's current position to pickup location
              drawRoute(driverLat, driverLng, activeJob.pickup_latitude, activeJob.pickup_longitude);
            } else if (hasPickup && hasDelivery) {
              drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
            }
          }, (err) => {
            if (!isMapActive()) return;
            if (isPickedUpState && hasDelivery) {
              drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
            } else if (hasPickup && hasDelivery) {
              drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
            }
          }, { enableHighAccuracy: true });
        } else {
          if (!isMapActive()) return;
          if (hasPickup && hasDelivery) drawRoute(activeJob.pickup_latitude, activeJob.pickup_longitude, activeJob.delivery_latitude, activeJob.delivery_longitude);
        }

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
      isCancelled = true;
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
      toast.success(tUi("ui.pages.driver.driverActiveJob.orderMarkedAsPickedUp_de1a5b6c99"));
      setJobs((prevJobs) => prevJobs.map((job) => job.id === response.data.id ? response.data : job));
      setActiveJobId(response.data.id);
      fetchActiveJobs();
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update status';
      toast.error(errorMessage);
      fetchActiveJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handleDeliver = async () => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      await http.patch(buildUrl(DELIVERY_ENDPOINTS.DELIVER_JOB, { job_id: activeJob.id }));
      toast.success(tUi("ui.pages.driver.driverActiveJob.orderDeliveredSuccessfully_4c4dd3d526"));
      setJobs((prevJobs) => prevJobs.filter((job) => job.id !== activeJob.id));
      fetchActiveJobs();
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update status';
      toast.error(errorMessage);
      fetchActiveJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = async (type) => {
    if (!activeJob) return;
    const selectedFile = type === 'pickup' ? pickupPhotoFile : deliveryPhotoFile;
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await http.post(
        buildUrl(DELIVERY_ENDPOINTS.UPLOAD_PHOTO, { job_id: activeJob.id }) + `?photo_type=${type}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(`${type === 'pickup' ? 'Pickup' : 'Delivery'} photo uploaded!`);
      if (type === 'pickup') {
        setPickupPhotoFile(null);
      } else {
        setDeliveryPhotoFile(null);
      }
      fetchActiveJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!activeJob || !issueType) return;
    try {
      const formData = new FormData();
      formData.append('issue_type', issueType);
      formData.append('description', issueDescription || '');
      if (issuePhotoFile) {
        formData.append('photo', issuePhotoFile);
      }

      await http.post(buildUrl(DELIVERY_ENDPOINTS.REPORT_ISSUE, { job_id: activeJob.id }), formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(tUi("ui.pages.driver.driverActiveJob.issueReported_63b95b7715"));
      setShowIssueModal(false);
      setIssueType('');
      setIssueDescription('');
      setIssuePhotoFile(null);
      setIssuePhotoPreview('');
      fetchActiveJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to report issue');
    }
  };

  const handleIssuePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setIssuePhotoFile(file);
  };

  const fetchIssueMessages = useCallback(async (jobId) => {
    if (!jobId) return;
    setIssueChatLoading(true);
    try {
      const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: jobId }));
      setIssueMessages(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setIssueMessages([]);
    } finally {
      setIssueChatLoading(false);
    }
  }, []);

  const handleSendIssueMessage = async () => {
    if (!activeJob?.id || !issueMessageText.trim()) return;
    setIssueSending(true);
    try {
      const response = await http.post(
        buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: activeJob.id }),
        { message: issueMessageText.trim() }
      );
      setIssueMessages((prev) => [...prev, response.data]);
      setIssueMessageText('');
    } catch (error) {
      toast.error(error.message || 'Failed to send issue message');
    } finally {
      setIssueSending(false);
    }
  };

  useEffect(() => {
    if (activeJob?.id && activeJob?.issue_type) {
      fetchIssueMessages(activeJob.id);
      return;
    }
    setIssueMessages([]);
  }, [activeJob?.id, activeJob?.issue_type, fetchIssueMessages]);

  const getStatusSteps = () => {
    const steps = [
    { key: 'assigned', label: 'Accepted', icon: '✅' },
    { key: 'picked_up', label: 'Picked Up', icon: '📦' },
    { key: 'delivering', label: 'Delivering', icon: '🚚' },
    { key: 'delivered', label: 'Delivered', icon: '🏠' }];

    const statusOrder = ['assigned', 'picked_up', 'delivering', 'delivered'];
    const currentIdx = statusOrder.indexOf(activeJob?.status);
    return steps.map((step, idx) => ({
      ...step,
      completed: idx <= currentIdx,
      current: idx === currentIdx
    }));
  };

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const activeDeliveryTitle = tUi('ui.pages.driver.driverActiveJob.activeDelivery_29af547736');

  if (!activeJob) {
    return (
      <div className="page-shell active-job-page">
        <PageHeader
          kicker={activeDeliveryTitle}
          title={tUi('ui.pages.driver.driverActiveJob.noActiveDelivery_4321221a6f')}
          subtitle={tUi('ui.pages.driver.driverActiveJob.youDonTHaveAny_36a11095cf')}
        />
        <div className="no-active-job">
          <div className="no-job-icon">🚚</div>
          <a href="/driver/map" className="btn-find-jobs">{tUi("ui.pages.driver.driverActiveJob.findAvailableJobs_e12cd068e4")}</a>
        </div>
      </div>);

  }

  const statusSteps = getStatusSteps();
  const allPhotos = Array.isArray(activeJob.photos) ? activeJob.photos : [];
  const pickupPhotos = allPhotos.filter((photo) => photo.photo_type === 'pickup');
  const deliveryPhotos = allPhotos.filter((photo) => photo.photo_type === 'delivery');
  const issuePhotos = allPhotos.filter((photo) => photo.photo_type === 'issue');
  const pickupChecked = !!activeJob.pickup_photo_checked;
  const deliveryChecked = !!activeJob.delivery_photo_checked;
  const canMarkPickup = activeJob.status === 'assigned' && pickupPhotos.length > 0 && pickupChecked;
  const canMarkDelivered = (activeJob.status === 'picked_up' || activeJob.status === 'delivering') &&
  deliveryPhotos.length > 0 &&
  deliveryChecked;
  const canUploadDeliveryProof = activeJob.status === 'picked_up' || activeJob.status === 'delivering';

  return (
    <div className="page-shell active-job-page">
      <PageHeader kicker={activeDeliveryTitle} title={activeDeliveryTitle} />
      {jobs.length > 1 &&
      <div className="info-card">
          <h3>{tUi("ui.pages.driver.driverActiveJob.yourActiveOrders_f7aa9c2b9d")}{jobs.length})</h3>
          <div className="photo-actions">
            {jobs.map((job) =>
          <button
            key={job.id}
            className="btn-photo"
            style={{
              border: job.id === activeJob?.id ? '2px solid var(--primary-color)' : undefined,
              fontWeight: job.id === activeJob?.id ? '700' : '500'
            }}
            onClick={() => setActiveJobId(job.id)}>
            
                #{job.order_id} ({(job.status || "assigned").replace('_', ' ')})
              </button>
          )}
          </div>
        </div>
      }

      {/* Status stepper */}
      <div className="status-stepper">
        {statusSteps.map((step, idx) =>
        <div key={step.key} className={`step ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}>
            <div className="step-circle">
              {step.completed ? step.icon : idx + 1}
            </div>
            <span className="step-label">{step.label}</span>
            {idx < statusSteps.length - 1 && <div className="step-connector" />}
          </div>
        )}
      </div>

      <div className="active-job-layout">
        {/* Map */}
        <div className="active-job-map">
          <div ref={mapRef} className="active-map-view" />
        </div>

        {/* Job info */}
        <div className="active-job-info">
          <div className="info-card">
            <h3>{tUi("ui.pages.driver.driverActiveJob.order_4b245b25fc")}{activeJob.order_id}</h3>
            <div className="info-status">
              <span className={`status-badge status-${activeJob.status || 'unknown'}`}>
                {(activeJob.status || "unknown").replace('_', ' ')}
              </span>
              <span className="info-payment">
                {formatCurrency(activeJob.payment_amount || 0)}
              </span>
            </div>
          </div>

          <div className="info-card">
            <h3>{tUi("ui.pages.driver.driverActiveJob.pickup_8822545cf7")}</h3>
            <p>{activeJob.pickup_address || tUi("ui.pages.driver.driverActiveJob.nA_db8e99dc32")}</p>
          </div>

          <div className="info-card">
            <h3>{tUi("ui.pages.driver.driverActiveJob.delivery_6992613df3")}</h3>
            <p>{activeJob.delivery_address || tUi("ui.pages.driver.driverActiveJob.nA_db8e99dc32")}</p>
            {activeJob.customer &&
            <p className="customer-name">
                👤 {activeJob.customer.first_name} {activeJob.customer.last_name}
                {activeJob.customer.phone && tUi("ui.pages.driver.driverActiveJob.value_0fb34ea1e8", { value0: activeJob.customer.phone })}
              </p>
            }
          </div>

          {/* Items */}
          {activeJob.items && activeJob.items.length > 0 &&
          <div className="info-card">
              <h3>{tUi("ui.pages.driver.driverActiveJob.items_34f553ea91")}</h3>
              {activeJob.items.map((item, idx) =>
            <div key={idx} className="delivery-item">
                  <span>{item.product?.name}</span>
                  <span>x{item.quantity}</span>
                </div>
            )}
            </div>
          }

          {/* Photo upload */}
          <div className="info-card">
            <h3>{tUi("ui.pages.driver.driverActiveJob.uploadPhoto_b55433437d")}</h3>
            <div className="photo-review-status">
              <div
                className={`photo-review-pill ${pickupPhotos.length === 0 ? 'waiting' : pickupChecked ? 'approved' : 'pending'}`}>{tUi("ui.pages.driver.driverActiveJob.pickup_3633344126")}

                {pickupPhotos.length === 0 ? tUi("ui.pages.driver.driverActiveJob.noPhotoYet_3c57d3e62c") : pickupChecked ? tUi("ui.pages.driver.driverActiveJob.markedOk_ed9c22f906") : tUi("ui.pages.driver.driverActiveJob.pendingAdminCheck_370751e858")}
              </div>
              <div
                className={`photo-review-pill ${deliveryPhotos.length === 0 ? 'waiting' : deliveryChecked ? 'approved' : 'pending'}`}>{tUi("ui.pages.driver.driverActiveJob.delivery_e16a033b49")}

                {deliveryPhotos.length === 0 ? tUi("ui.pages.driver.driverActiveJob.noPhotoYet_3c57d3e62c") : deliveryChecked ? tUi("ui.pages.driver.driverActiveJob.markedOk_ed9c22f906") : tUi("ui.pages.driver.driverActiveJob.pendingAdminCheck_370751e858")}
              </div>
            </div>
            <div className="proof-upload-block">
              <h4>{tUi("ui.pages.driver.driverActiveJob.pickupProof_d91ee33534")}</h4>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPickupPhotoFile(e.target.files?.[0] || null)}
                className="photo-input"
                disabled={pickupPhotos.length > 0} />
              
              {pickupPhotoPreview &&
              <div className="selected-photo-preview">
                  <img src={pickupPhotoPreview} alt={tUi("ui.pages.driver.driverActiveJob.pickupSelectedUpload_de7d5a40fa")} />
                </div>
              }
              {pickupPhotoFile &&
              <div className="photo-actions">
                  <button
                  onClick={() => handlePhotoUpload("pickup")}
                  disabled={uploading || pickupPhotos.length > 0}
                  className="btn-photo">
                  
                    {pickupPhotos.length > 0 ? tUi("ui.pages.driver.driverActiveJob.pickupAlreadyUploaded_71dfe59cdc") : uploading ? '...' : tUi("ui.pages.driver.driverActiveJob.uploadPickupProof_bef4425b25")}
                  </button>
                </div>
              }
            </div>

            <div className="proof-upload-block">
              <h4>{tUi("ui.pages.driver.driverActiveJob.deliveryProof_554ad921e3")}</h4>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setDeliveryPhotoFile(e.target.files?.[0] || null)}
                className="photo-input"
                disabled={deliveryPhotos.length > 0 || !canUploadDeliveryProof} />
              
              {deliveryPhotoPreview &&
              <div className="selected-photo-preview">
                  <img src={deliveryPhotoPreview} alt={tUi("ui.pages.driver.driverActiveJob.deliverySelectedUpload_4fd02d557d")} />
                </div>
              }
              {deliveryPhotoFile &&
              <div className="photo-actions">
                  <button
                  onClick={() => handlePhotoUpload("delivery")}
                  disabled={uploading || deliveryPhotos.length > 0 || !canUploadDeliveryProof}
                  className="btn-photo">
                  
                    {!canUploadDeliveryProof ? tUi("ui.pages.driver.driverActiveJob.finishPickupFirst_40d56dd056") :

                  deliveryPhotos.length > 0 ? tUi("ui.pages.driver.driverActiveJob.deliveryAlreadyUploaded_4286214dd6") :

                  uploading ? '...' : tUi("ui.pages.driver.driverActiveJob.uploadDeliveryProof_87ad06b40c")}
                  </button>
                </div>
              }
            </div>
            {!canUploadDeliveryProof &&
            <p className="action-help-text">{tUi("ui.pages.driver.driverActiveJob.youCanUploadDeliveryProof_ea20923d29")}

            </p>
            }

            {(pickupPhotos.length > 0 || deliveryPhotos.length > 0 || issuePhotos.length > 0) &&
            <div className="uploaded-photos-wrap">
                <h4>{tUi("ui.pages.driver.driverActiveJob.uploadedPhotos_4cae6fa9ac")}</h4>
                <div className="uploaded-photos-grid">
                  {pickupPhotos.map((photo) =>
                <div className="uploaded-photo-card" key={`pickup-${photo.id}`}>
                      <img src={getImageUrl(photo.image_path)} alt={tUi("ui.pages.driver.driverActiveJob.pickupProof_0d94ac2052")} />
                      <span>{tUi("ui.pages.driver.driverActiveJob.pickup_d8bf62106d")}{pickupChecked ? tUi("ui.pages.driver.driverActiveJob.markedOk_1b49d26729") : tUi("ui.pages.driver.driverActiveJob.pending_8634c29c3b")}</span>
                    </div>
                )}
                  {deliveryPhotos.map((photo) =>
                <div className="uploaded-photo-card" key={`delivery-${photo.id}`}>
                      <img src={getImageUrl(photo.image_path)} alt={tUi("ui.pages.driver.driverActiveJob.deliveryProof_ef5eda3f79")} />
                      <span>{tUi("ui.pages.driver.driverActiveJob.delivery_64ce2809d3")}{deliveryChecked ? tUi("ui.pages.driver.driverActiveJob.markedOk_1b49d26729") : tUi("ui.pages.driver.driverActiveJob.pending_8634c29c3b")}</span>
                    </div>
                )}
                  {issuePhotos.map((photo) =>
                <div className="uploaded-photo-card" key={`issue-${photo.id}`}>
                      <img src={getImageUrl(photo.image_path)} alt={tUi("ui.pages.driver.driverActiveJob.issue_7d5d1cc754")} />
                      <span>{tUi("ui.pages.driver.driverActiveJob.issue_7d5d1cc754")}</span>
                    </div>
                )}
                </div>
              </div>
            }
          </div>

          {activeJob.issue_type &&
          <div className="info-card issue-summary-card">
              <h3>{tUi("ui.pages.driver.driverActiveJob.reportedIssue_be909d9dd2")}</h3>
              {activeJob.issue_resolved && <p className="issue-resolved-badge">{tUi("ui.pages.driver.driverActiveJob.solvedByAdmin_b1fe4fb7d1")}</p>}
              <p className="issue-type-label">{activeJob.issue_type.replace(/_/g, ' ')}</p>
              {activeJob.issue_description && <p>{activeJob.issue_description}</p>}
              {issuePhotos.length > 0 &&
            <div className="issue-photo-preview-grid">
                  {issuePhotos.map((photo) =>
              <img key={`summary-issue-${photo.id}`} src={getImageUrl(photo.image_path)} alt={tUi("ui.pages.driver.driverActiveJob.issuePreview_8cb12330da")} />
              )}
                </div>
            }

              <div className="issue-thread-box">
                <h4>{tUi("ui.pages.driver.driverActiveJob.issueDiscussionAdminDriver_20a6cecfc6")}</h4>
                {issueChatLoading ?
              <p className="issue-thread-empty">{tUi("ui.pages.driver.driverActiveJob.loadingDiscussion_3385e5044c")}</p> :
              issueMessages.length === 0 ?
              <p className="issue-thread-empty">{tUi("ui.pages.driver.driverActiveJob.noMessagesYet_5dc9c8c5d1")}</p> :

              <div className="issue-thread-list">
                    {issueMessages.map((msg) =>
                <div
                  key={msg.id}
                  className={`issue-thread-message ${msg.sender_id === currentUserId ? 'mine' : ''}`}>
                  
                        <div className="issue-thread-meta">
                          <strong>{msg.sender_name || tUi("ui.pages.driver.driverActiveJob.user_472cb0a9b5")}</strong>
                          <span>{msg.sender_role || tUi("ui.pages.driver.driverActiveJob.user_674e0635d1")} • {formatDateTime(msg.created_at)}</span>
                        </div>
                        <p>{msg.message}</p>
                      </div>
                )}
                  </div>
              }

                {!activeJob.issue_resolved ?
              <div className="issue-thread-input-wrap">
                    <input
                  type="text"
                  value={issueMessageText}
                  onChange={(e) => setIssueMessageText(e.target.value)}
                  placeholder={tUi("ui.pages.driver.driverActiveJob.writeAMessageToAdmin_a96d3938ba")} />
                
                    <button onClick={handleSendIssueMessage} disabled={issueSending || !issueMessageText.trim()}>
                      {issueSending ? tUi("ui.pages.driver.driverActiveJob.sending_a6441250fe") : tUi("ui.pages.driver.driverActiveJob.send_b8a99b8547")}
                    </button>
                  </div> :

              <p className="issue-thread-closed">{tUi("ui.pages.driver.driverActiveJob.discussionClosedBecauseIssueIs_cebf41bf25")}</p>
              }
              </div>
            </div>
          }

          {/* Action buttons */}
          <div className="action-buttons">
            <button onClick={() => setShowChat(true)} className="btn-primary-action" style={{ backgroundColor: '#10b981', marginBottom: '10px', width: '100%' }}>{tUi("ui.pages.driver.driverActiveJob.chatWithCustomer_f2dc21eb4f")}

            </button>
            {activeJob.status === "assigned" &&
            <button onClick={handlePickup} disabled={updating || !canMarkPickup} className="btn-primary-action">
                {updating ? tUi("ui.pages.driver.driverActiveJob.updating_aef6cc41f2") : tUi("ui.pages.driver.driverActiveJob.markAsPickedUp_a0c8f3df13")}
              </button>
            }
            {activeJob.status === "assigned" && !canMarkPickup &&
            <p className="action-help-text">{tUi("ui.pages.driver.driverActiveJob.uploadPickupProofAndWait_691b08863d")}

            </p>
            }
            {(activeJob.status === "picked_up" || activeJob.status === "delivering") &&
            <button onClick={handleDeliver} disabled={updating || !canMarkDelivered} className="btn-primary-action btn-deliver">
                {updating ? tUi("ui.pages.driver.driverActiveJob.updating_aef6cc41f2") : tUi("ui.pages.driver.driverActiveJob.markAsDelivered_0559504313")}
              </button>
            }
            {(activeJob.status === "picked_up" || activeJob.status === "delivering") && !canMarkDelivered &&
            <p className="action-help-text">{tUi("ui.pages.driver.driverActiveJob.uploadDeliveryProofAndWait_b1cc195681")}

            </p>
            }
            <button onClick={() => setShowIssueModal(true)} className="btn-report-issue">{tUi("ui.pages.driver.driverActiveJob.reportIssue_fc5eeeabe9")}

            </button>
          </div>
        </div>
      </div>

      {/* Issue Report Modal */}
      {showIssueModal &&
      <div className="issue-modal-overlay">
          <div className="issue-modal">
            <button className="close-modal" onClick={() => setShowIssueModal(false)}>×</button>
            <h2>{tUi("ui.pages.driver.driverActiveJob.reportAnIssue_2a314befe7")}</h2>
            <div className="issue-types">
              {[
            { value: 'customer_not_home', label: '🏠 Customer Not Home' },
            { value: 'incorrect_address', label: '📍 Incorrect Address' },
            { value: 'damaged_items', label: '❌ Damaged Items' },
            { value: 'other', label: '📝 Other' }]
            .map((type) =>
            <button
              key={type.value}
              className={`issue-type-btn ${issueType === type.value ? 'selected' : ''}`}
              onClick={() => setIssueType(type.value)}>
              
                  {type.label}
                </button>
            )}
            </div>
            <textarea
            placeholder={tUi("ui.pages.driver.driverActiveJob.describeTheIssue_16722c25ec")}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="issue-description" />
          
            <div className="issue-photo-upload-wrap">
              <label htmlFor="issue-photo">{tUi("ui.pages.driver.driverActiveJob.optionalPhoto_3348d1161f")}</label>
              <input
              id="issue-photo"
              type="file"
              accept="image/*"
              onChange={handleIssuePhotoChange}
              className="issue-photo-input" />
            
              {issuePhotoPreview &&
            <div className="issue-photo-preview">
                  <img src={issuePhotoPreview} alt={tUi("ui.pages.driver.driverActiveJob.issueUploadPreview_0852883258")} />
                </div>
            }
            </div>
            <button onClick={handleReportIssue} className="btn-submit-issue" disabled={!issueType}>{tUi("ui.pages.driver.driverActiveJob.submitReport_a2a57073d5")}

          </button>
          </div>
        </div>
      }

      {/* Delivery Chat Modal */}
      {activeJob &&
      <DeliveryChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        jobId={activeJob.id}
        token={token}
        currentUserId={currentUserId}
        isDriver={true} />

      }
    </div>);

};

export default DriverActiveJob;
