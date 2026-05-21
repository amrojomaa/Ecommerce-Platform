import { tUi } from "../../i18n/uiText";import React, { useState, useEffect, useRef, useCallback } from 'react';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/driver/DriverMap.css';

const DriverMap = () => {
  const { formatCurrency } = useCurrency();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [driverPosition, setDriverPosition] = useState(null);
  const [closestJobId, setClosestJobId] = useState(null);
  const [closestDistanceKm, setClosestDistanceKm] = useState(null);
  const [routeDistancesByJob, setRouteDistancesByJob] = useState({});
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const driverMarkerRef = useRef(null);
  const routeLayersRef = useRef([]);
  const routeRequestSeqRef = useRef(0);
  const mapSessionRef = useRef(0);

  const toRadians = useCallback((value) => value * Math.PI / 180, []);
  const haversineDistanceKm = useCallback((startLat, startLng, endLat, endLng) => {
    const earthRadiusKm = 6371;
    const dLat = toRadians(endLat - startLat);
    const dLng = toRadians(endLng - startLng);
    const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(startLat)) * Math.cos(toRadians(endLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }, [toRadians]);

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
            longitude: newPos.lng
          }).catch(() => {});
        },
        (err) => {
          console.warn('Geolocation error:', err);
          // Default position
          setDriverPosition({ lat: 32.2211, lng: 35.2544 });
        },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setDriverPosition({ lat: 32.2211, lng: 35.2544 });
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

    const currentSession = ++mapSessionRef.current;
    const map = L.map(mapRef.current).setView([driverPosition.lat, driverPosition.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Driver marker
    const driverIcon = L.divIcon({
      className: 'driver-marker',
      html: '<div class="driver-marker-inner">🚚</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], { icon: driverIcon }).addTo(map);

    return () => {
      if (mapSessionRef.current === currentSession) {
        mapSessionRef.current += 1;
      }
      routeRequestSeqRef.current += 1;
      routeLayersRef.current.forEach((layer) => {
        try {
          layer.remove();
        } catch (e) {}
      });
      routeLayersRef.current = [];
      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch (e) {}
      });
      markersRef.current = [];
      if (driverMarkerRef.current) {
        try {
          driverMarkerRef.current.remove();
        } catch (e) {}
        driverMarkerRef.current = null;
      }
      try {
        map.remove();
      } catch (e) {}
      mapInstanceRef.current = null;
    };
  }, [driverPosition]);

  // Update markers when jobs change
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current || !mapInstanceRef.current._loaded) return;

    // Clear old markers
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch (e) {}
    });
    markersRef.current = [];

    jobs.forEach((job) => {
      if (job.pickup_latitude && job.pickup_longitude) {
        const isClosest = job.id === closestJobId;
        const pickupIcon = L.divIcon({
          className: `job-marker pickup-marker${isClosest ? ' closest-marker' : ''}`,
          html: '<div class="job-marker-inner">📦</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        const marker = L.marker([job.pickup_latitude, job.pickup_longitude], { icon: pickupIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(
          `${isClosest ? 'Closest order' : 'Order'} #${job.order_id}` + (
          isClosest && closestDistanceKm !== null ? ` (${closestDistanceKm.toFixed(2)} km)` : '')
        )
        .on('click', () => setSelectedJob(job));
        markersRef.current.push(marker);
      }
      if (job.delivery_latitude && job.delivery_longitude) {
        let lat = job.delivery_latitude;
        let lng = job.delivery_longitude;
        if (job.pickup_latitude === job.delivery_latitude && job.pickup_longitude === job.delivery_longitude) {
          lat += 0.0003;
          lng += 0.0003;
        }
        const deliveryIcon = L.divIcon({
          className: 'job-marker delivery-marker',
          html: '<div class="job-marker-inner">📍</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        const marker = L.marker([lat, lng], { icon: deliveryIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(
          `${tUi("ui.pages.driver.driverMap.delivery_08ebebf690") || 'Delivery'} #${job.order_id}`
        )
        .on('click', () => setSelectedJob(job));
        markersRef.current.push(marker);
      }
    });
  }, [jobs, closestJobId, closestDistanceKm]);

  // Draw route paths for all jobs and collect per-job distance metrics
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current || !mapInstanceRef.current._loaded || !driverPosition) return;

    const activeSession = mapSessionRef.current;
    const isMapValid = () =>
    mapInstanceRef.current &&
    mapInstanceRef.current._loaded &&
    mapSessionRef.current === activeSession;

    routeLayersRef.current.forEach((layer) => {
      try {
        layer.remove();
      } catch (e) {}
    });
    routeLayersRef.current = [];

    if (!jobs.length) {
      setClosestJobId(null);
      setClosestDistanceKm(null);
      setRouteDistancesByJob({});
      return;
    }

    const routeColors = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
    const requestSeq = ++routeRequestSeqRef.current;

    const drawShortestRoute = async (startLat, startLng, endLat, endLng, lineStyle, fallbackStyle) => {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

      try {
        const response = await fetch(osrmUrl);
        const data = await response.json();
        if (requestSeq !== routeRequestSeqRef.current || !isMapValid()) {
          return null;
        }
        if (data.routes && data.routes.length > 0) {
          const routeCoordinates = data.routes[0].geometry.coordinates.map((coord) => [coord[1], coord[0]]);
          if (!isMapValid()) return null;
          const layer = L.polyline(routeCoordinates, lineStyle).addTo(mapInstanceRef.current);
          return {
            layer,
            distanceKm: Number.isFinite(data.routes[0].distance) ? data.routes[0].distance / 1000 : null
          };
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }

      if (!isMapValid()) return null;
      const fallbackLayer = L.polyline(
        [
        [startLat, startLng],
        [endLat, endLng]],

        fallbackStyle
      ).addTo(mapInstanceRef.current);

      return {
        layer: fallbackLayer,
        distanceKm: haversineDistanceKm(startLat, startLng, endLat, endLng)
      };
    };

    const drawAllRoutes = async () => {
      const newLayers = [];
      const nextRouteDistancesByJob = {};

      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        const hasPickup = Number.isFinite(job.pickup_latitude) && Number.isFinite(job.pickup_longitude);
        const hasDelivery = Number.isFinite(job.delivery_latitude) && Number.isFinite(job.delivery_longitude);
        if (!hasPickup) continue;

        const color = routeColors[index % routeColors.length];

        const toPickup = await drawShortestRoute(
          driverPosition.lat,
          driverPosition.lng,
          job.pickup_latitude,
          job.pickup_longitude,
          { color, weight: 4, opacity: 0.75 },
          { color, weight: 4, opacity: 0.75, dashArray: '10, 10' }
        );

        if (requestSeq !== routeRequestSeqRef.current || !isMapValid()) return;
        if (!toPickup) return;

        newLayers.push(toPickup.layer);
        const pickupDistanceKm = Number.isFinite(toPickup.distanceKm) ?
        toPickup.distanceKm :
        haversineDistanceKm(driverPosition.lat, driverPosition.lng, job.pickup_latitude, job.pickup_longitude);
        let totalDistanceKm = pickupDistanceKm;
        let warehouseToDeliveryDistanceKm = null;

        if (hasDelivery) {
          const pickupToDelivery = await drawShortestRoute(
            job.pickup_latitude,
            job.pickup_longitude,
            job.delivery_latitude,
            job.delivery_longitude,
            { color, weight: 3, opacity: 0.5, dashArray: '7, 7' },
            { color, weight: 3, opacity: 0.5, dashArray: '7, 7' }
          );

          if (requestSeq !== routeRequestSeqRef.current || !isMapValid()) return;
          if (!pickupToDelivery) return;
          newLayers.push(pickupToDelivery.layer);

          const deliveryDistanceKm = Number.isFinite(pickupToDelivery.distanceKm) ?
          pickupToDelivery.distanceKm :
          haversineDistanceKm(job.pickup_latitude, job.pickup_longitude, job.delivery_latitude, job.delivery_longitude);
          warehouseToDeliveryDistanceKm = deliveryDistanceKm;
          totalDistanceKm += deliveryDistanceKm;
        }

        nextRouteDistancesByJob[job.id] = {
          pickupDistanceKm,
          totalDistanceKm,
          warehouseToDeliveryDistanceKm
        };
      }

      if (!isMapValid()) return;
      routeLayersRef.current = newLayers;
      setRouteDistancesByJob(nextRouteDistancesByJob);
    };

    drawAllRoutes();

    return () => {
      routeRequestSeqRef.current += 1;
    };
  }, [jobs, driverPosition, haversineDistanceKm]);

  // Derive closest job from warehouse (pickup) to delivery distance.
  useEffect(() => {
    if (!driverPosition || !jobs.length) {
      setClosestJobId(null);
      setClosestDistanceKm(null);
      return;
    }

    let nearest = null;

    jobs.forEach((job) => {
      if (!Number.isFinite(job.pickup_latitude) || !Number.isFinite(job.pickup_longitude)) return;
      if (!Number.isFinite(job.delivery_latitude) || !Number.isFinite(job.delivery_longitude)) return;

      const warehouseToDeliveryDistanceKm = Number.isFinite(routeDistancesByJob[job.id]?.warehouseToDeliveryDistanceKm) ?
      routeDistancesByJob[job.id].warehouseToDeliveryDistanceKm :
      haversineDistanceKm(job.pickup_latitude, job.pickup_longitude, job.delivery_latitude, job.delivery_longitude);

      if (!nearest || warehouseToDeliveryDistanceKm < nearest.distanceKm) {
        nearest = { id: job.id, distanceKm: warehouseToDeliveryDistanceKm };
      }
    });

    setClosestJobId(nearest?.id ?? null);
    setClosestDistanceKm(Number.isFinite(nearest?.distanceKm) ? nearest.distanceKm : null);
  }, [jobs, driverPosition, routeDistancesByJob, haversineDistanceKm]);

  // Update driver marker position
  useEffect(() => {
    if (driverMarkerRef.current && driverPosition && mapInstanceRef.current && mapInstanceRef.current._loaded) {
      driverMarkerRef.current.setLatLng([driverPosition.lat, driverPosition.lng]);
    }
  }, [driverPosition]);

  const handleAccept = async (jobId) => {
    setAccepting(true);
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.ACCEPT_JOB, { job_id: jobId }));
      toast.success(tUi("ui.pages.driver.driverMap.jobAcceptedSuccessfully_f36ff52c4a"));
      setSelectedJob(null);
      fetchJobs();
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to accept job';
      toast.error(errorMessage);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (jobId) => {
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.DECLINE_JOB, { job_id: jobId }));
      toast.info(tUi("ui.pages.driver.driverMap.jobDeclined_9191aaa2f6"));
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
      </div>);

  }

  return (
    <div className="driver-map-page">
      <div className="map-header">
        <h1>{tUi("ui.pages.driver.driverMap.findDeliveryJobs_cfe3d4c660")}</h1>
        <div className="jobs-header-meta">
          <span className="jobs-count">{jobs.length}{tUi("ui.pages.driver.driverMap.available_9488931dee")}</span>
          {closestJobId &&
          <span className="closest-order-banner">{tUi("ui.pages.driver.driverMap.shortestWarehouseRoute_2b3db79613")}
            {jobs.find((job) => job.id === closestJobId)?.order_id || closestJobId}
              {closestDistanceKm !== null ? tUi("ui.pages.driver.driverMap.valueKm_71f82fee49", { value0: closestDistanceKm.toFixed(2) }) : ''}
            </span>
          }
        </div>
      </div>

      <div className="map-container">
        <div ref={mapRef} className="map-view" />

        {/* Job list sidebar */}
        <div className="jobs-sidebar">
          <h3>{tUi("ui.pages.driver.driverMap.availableJobs_6dffe10ec4")}</h3>
          {jobs.length === 0 ?
          <p className="no-jobs">{tUi("ui.pages.driver.driverMap.noDeliveryJobsAvailableRight_53630e0d5a")}</p> :

          <div className="jobs-list">
              {jobs.map((job) =>
            <div
              key={job.id}
              className={`job-item ${selectedJob?.id === job.id ? 'selected' : ''} ${closestJobId === job.id ? 'closest-job-item' : ''}`}
              onClick={() => {
                setSelectedJob(job);
                if (mapInstanceRef.current && mapInstanceRef.current._loaded && job.pickup_latitude) {
                  try {
                    mapInstanceRef.current.flyTo([job.pickup_latitude, job.pickup_longitude], 15);
                  } catch (e) {}
                }
              }}>
              
                  <div className="job-item-header">
                    <span className="job-order">{tUi("ui.pages.driver.driverMap.order_78ea594e7c")}{job.order_id}</span>
                    <span className="job-pay">{formatCurrency(job.payment_amount || 0)}</span>
                  </div>
                  <div className="job-distance-row">
                    {Number.isFinite(job.pickup_latitude) && Number.isFinite(job.pickup_longitude) && Number.isFinite(job.delivery_latitude) && Number.isFinite(job.delivery_longitude) &&
                <span className="job-distance">{tUi("ui.pages.driver.driverMap.warehouseRoute_91242014d8")}
                  {(Number.isFinite(routeDistancesByJob[job.id]?.warehouseToDeliveryDistanceKm) ?
                  routeDistancesByJob[job.id].warehouseToDeliveryDistanceKm :
                  haversineDistanceKm(job.pickup_latitude, job.pickup_longitude, job.delivery_latitude, job.delivery_longitude))
                  .toFixed(2)} km
                      </span>
                }
                    {closestJobId === job.id &&
                <span className="closest-job-badge">{tUi("ui.pages.driver.driverMap.closest_8047e0ec83")}</span>
                }
                  </div>
                  {Number.isFinite(routeDistancesByJob[job.id]?.totalDistanceKm) &&
              <div className="job-total-distance-row">
                      <span className="job-total-distance">{tUi("ui.pages.driver.driverMap.fromYourCurrentPosition_4f5a911a22")}{routeDistancesByJob[job.id].totalDistanceKm.toFixed(2)} km</span>
                    </div>
              }
                  <div className="job-item-details">
                    <div className="job-location">
                      <span className="location-icon">📦</span>
                      <span>{job.pickup_address || tUi("ui.pages.driver.driverMap.pickupLocation_5815f6573b")}</span>
                    </div>
                    <div className="job-location">
                      <span className="location-icon">📍</span>
                      <span>{job.delivery_address || tUi("ui.pages.driver.driverMap.deliveryLocation_2873c757f3")}</span>
                    </div>
                  </div>
                  {job.items && job.items.length > 0 &&
              <div className="job-items-preview">
                      {job.items.map((item, idx) =>
                <span key={idx} className="item-tag">
                          {item.product?.name} x{item.quantity}
                        </span>
                )}
                    </div>
              }
                </div>
            )}
            </div>
          }
        </div>
      </div>

      {/* Selected job detail modal */}
      {selectedJob &&
      <div className="job-detail-modal">
          <div className="job-detail-content">
            <button className="close-modal" onClick={() => setSelectedJob(null)}>×</button>
            <h2>{tUi("ui.pages.driver.driverMap.deliveryJobOrder_41762bc75b")}{selectedJob.order_id}</h2>
            
            <div className="detail-grid">
              <div className="detail-section">
                <h3>{tUi("ui.pages.driver.driverMap.pickup_d73f705138")}</h3>
                <p>{selectedJob.pickup_address || tUi("ui.pages.driver.driverMap.nA_de3570823c")}</p>
              </div>
              <div className="detail-section">
                <h3>{tUi("ui.pages.driver.driverMap.delivery_08ebebf690")}</h3>
                <p>{selectedJob.delivery_address || tUi("ui.pages.driver.driverMap.nA_de3570823c")}</p>
              </div>
              <div className="detail-section">
                <h3>{tUi("ui.pages.driver.driverMap.customer_d9db49ed61")}</h3>
                {selectedJob.customer ?
              <p>{selectedJob.customer.first_name} {selectedJob.customer.last_name}</p> :

              <p>{tUi("ui.pages.driver.driverMap.nA_de3570823c")}</p>
              }
              </div>
              <div className="detail-section">
                <h3>{tUi("ui.pages.driver.driverMap.payment_690e237bd5")}</h3>
                <p className="payment-amount">{formatCurrency(selectedJob.payment_amount || 0)}</p>
              </div>
            </div>

            {selectedJob.items && selectedJob.items.length > 0 &&
          <div className="items-section">
                <h3>{tUi("ui.pages.driver.driverMap.itemsToDeliver_0daaf38580")}</h3>
                <div className="items-list">
                  {selectedJob.items.map((item, idx) =>
              <div key={idx} className="item-row">
                      <span className="item-name">{item.product?.name}</span>
                      <span className="item-qty">x{item.quantity}</span>
                      <span className="item-price">{formatCurrency(item.total || 0)}</span>
                    </div>
              )}
                </div>
              </div>
          }

            <div className="job-actions">
              <button
              className="btn-accept"
              onClick={() => handleAccept(selectedJob.id)}
              disabled={accepting}>
              
                {accepting ? tUi("ui.pages.driver.driverMap.accepting_40f0cb67bc") : tUi("ui.pages.driver.driverMap.acceptJob_83dec8187c")}
              </button>
              <button
              className="btn-decline"
              onClick={() => handleDecline(selectedJob.id)}>{tUi("ui.pages.driver.driverMap.decline_7e736d807b")}


            </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default DriverMap;
