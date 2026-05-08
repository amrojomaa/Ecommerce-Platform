import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate, getImageUrl } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminDeliveries.css';

const AdminDeliveries = () => {
  const { formatCurrency } = useCurrency();
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [showIssueOnly, setShowIssueOnly] = useState(false);
  const [showProofOnly, setShowProofOnly] = useState(false);
  const [issueMessages, setIssueMessages] = useState([]);
  const [issueMessageText, setIssueMessageText] = useState('');
  const [issueChatLoading, setIssueChatLoading] = useState(false);
  const [issueSending, setIssueSending] = useState(false);
  const [resolvingIssue, setResolvingIssue] = useState(false);
  const [reviewingPhotoType, setReviewingPhotoType] = useState(null);
  const [selectedDriverByJob, setSelectedDriverByJob] = useState({});
  const [assigningDriverJobId, setAssigningDriverJobId] = useState(null);

  const hasOpenIssue = (job) => {
    const status = (job.status || '').toLowerCase();
    const isOpenStatus = status !== 'cancelled' && status !== 'delivered';
    return !!job.issue_type && isOpenStatus && !job.issue_resolved;
  };

  const hasProofPhotos = (job) => {
    const status = (job.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'delivered') return false;

    const photos = Array.isArray(job.photos) ? job.photos : [];
    const hasPickup = photos.some(photo => photo.photo_type === 'pickup');
    const hasDelivery = photos.some(photo => photo.photo_type === 'delivery');

    const needsPickupReview = hasPickup && !job.pickup_photo_checked;
    const needsDeliveryReview = hasDelivery && !job.delivery_photo_checked;

    return needsPickupReview || needsDeliveryReview;
  };

  useEffect(() => {
    fetchJobs();
    fetchDrivers();
  }, []);

  useEffect(() => {
    if (allJobs.length > 0) {
      let filtered = allJobs;
      if (statusFilter !== 'all') {
        filtered = allJobs.filter(job =>
          (job.status || '').toLowerCase() === statusFilter.toLowerCase()
        );
      }

      if (showIssueOnly) {
        filtered = filtered.filter(hasOpenIssue);
      }

      if (showProofOnly) {
        filtered = filtered.filter(hasProofPhotos);
      }

      setJobs(filtered);
    } else {
      setJobs([]);
    }
  }, [statusFilter, allJobs, showIssueOnly, showProofOnly]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
      const data = Array.isArray(response.data) ? response.data : [];
      setAllJobs(data);
    } catch (error) {
      console.error('Error fetching delivery jobs:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch delivery jobs';
      setError(errorMessage);
      setAllJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.DRIVERS);
      setDrivers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setDrivers([]);
    }
  };

  const fetchIssueMessages = async (jobId) => {
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
  };

  const handleSendIssueMessage = async () => {
    if (!expandedJobId || !issueMessageText.trim()) return;
    setIssueSending(true);
    try {
      const response = await http.post(
        buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: expandedJobId }),
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

  const handleResolveIssue = async (jobId) => {
    if (!jobId) return;
    setResolvingIssue(true);
    try {
      await http.patch(buildUrl(DELIVERY_ENDPOINTS.RESOLVE_ISSUE, { job_id: jobId }));
      toast.success('Issue marked as solved');
      await fetchJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to resolve issue');
    } finally {
      setResolvingIssue(false);
    }
  };

  const handleReviewPhotoType = async (jobId, photoType) => {
    setReviewingPhotoType(`${jobId}-${photoType}`);
    try {
      const response = await http.post(
        `${buildUrl(DELIVERY_ENDPOINTS.REVIEW_PHOTO, { job_id: jobId })}?photo_type=${photoType}`
      );

      const updatedJob = response.data;
      setAllJobs(prevJobs => prevJobs.map(job => (job.id === jobId ? updatedJob : job)));
      toast.success(`${photoType === 'pickup' ? 'Pickup' : 'Delivery'} photos marked as OK`);
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to review photos');
    } finally {
      setReviewingPhotoType(null);
    }
  };

  const handleAssignDriver = async (jobId) => {
    const selectedDriverId = selectedDriverByJob[jobId];
    if (!selectedDriverId) {
      toast.error('Please select a driver first');
      return;
    }

    setAssigningDriverJobId(jobId);
    try {
      const response = await http.patch(
        buildUrl(DELIVERY_ENDPOINTS.ASSIGN_DRIVER, { job_id: jobId }),
        { driver_id: Number(selectedDriverId) }
      );

      const updatedJob = response.data;
      setAllJobs(prevJobs => prevJobs.map(job => (job.id === jobId ? updatedJob : job)));
      toast.success('Driver assigned successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to assign driver');
    } finally {
      setAssigningDriverJobId(null);
    }
  };

  useEffect(() => {
    if (!expandedJobId) {
      setIssueMessages([]);
      setIssueMessageText('');
      return;
    }

    const job = allJobs.find((j) => j.id === expandedJobId);
    if (job?.issue_type) {
      fetchIssueMessages(expandedJobId);
    } else {
      setIssueMessages([]);
      setIssueMessageText('');
    }
  }, [expandedJobId, allJobs]);

  const deliveryStatuses = ['all', 'available', 'assigned', 'picked_up', 'delivering', 'delivered', 'cancelled'];
  const issueCount = allJobs.filter(hasOpenIssue).length;
  const proofPhotoCount = allJobs.filter(hasProofPhotos).length;

  const getStatusLabel = (status) => {
    const labels = {
      available: 'Available',
      assigned: 'Assigned',
      picked_up: 'Picked Up',
      delivering: 'Delivering',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="admin-deliveries-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-deliveries">
      {issueCount > 0 && (
        <div className="delivery-issue-notice" role="status" aria-live="polite">
          <div className="notice-icon-wrap" aria-hidden="true">
            <span className="notice-bell">🔔</span>
            <span className="notice-count">{issueCount}</span>
          </div>
          <div className="notice-text">
            <strong>{issueCount}</strong> delivery {issueCount === 1 ? 'issue report needs' : 'issue reports need'} admin attention.
          </div>
          <button
            type="button"
            className="notice-action-btn"
            onClick={() => {
              setShowIssueOnly(true);
              setShowProofOnly(false);
              setStatusFilter('all');
              setExpandedJobId(null);
            }}
          >
            View issue orders
          </button>
          {showIssueOnly && (
            <button
              type="button"
              className="notice-clear-btn"
              onClick={() => {
                setShowIssueOnly(false);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {proofPhotoCount > 0 && (
        <div className="delivery-photo-notice" role="status" aria-live="polite">
          <div className="notice-icon-wrap" aria-hidden="true">
            <span className="notice-bell">📸</span>
            <span className="notice-count">{proofPhotoCount}</span>
          </div>
          <div className="notice-text">
            <strong>{proofPhotoCount}</strong> delivery {proofPhotoCount === 1 ? 'job has' : 'jobs have'} proof photos uploaded by drivers.
          </div>
          <button
            type="button"
            className="notice-action-btn"
            onClick={() => {
              setShowProofOnly(true);
              setShowIssueOnly(false);
              setStatusFilter('all');
              setExpandedJobId(null);
            }}
          >
            View photo orders
          </button>
          {showProofOnly && (
            <button
              type="button"
              className="notice-clear-btn"
              onClick={() => {
                setShowProofOnly(false);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="admin-deliveries-header">
        <h1>Delivery Management</h1>
        <div className="deliveries-filter">
          <label htmlFor="delivery-status-filter">Filter by Status:</label>
          <select
            id="delivery-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter-select"
          >
            {deliveryStatuses.map(status => (
              <option key={status} value={status}>
                {status === 'all' ? 'All' : getStatusLabel(status)}
              </option>
            ))}
          </select>
          {statusFilter !== 'all' && (
            <span className="filter-count">
              ({jobs.length} {jobs.length === 1 ? 'job' : 'jobs'})
            </span>
          )}
          {showIssueOnly && (
            <span className="issue-only-pill">Issue reports only</span>
          )}
          {showProofOnly && (
            <span className="issue-only-pill photo-only-pill">Proof photos only</span>
          )}
        </div>
      </div>

      {error ? (
        <motion.div
          className="error-message"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '20px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '8px',
            margin: '20px 0'
          }}
        >
          <p><strong>Error:</strong> {error}</p>
          <button onClick={fetchJobs} className="retry-btn">Retry</button>
        </motion.div>
      ) : jobs.length === 0 ? (
        <motion.div
          className="empty-deliveries"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>
            {statusFilter === 'all'
              ? 'No delivery jobs found.'
              : `No delivery jobs with status "${getStatusLabel(statusFilter)}".`}
          </p>
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="show-all-btn">
              Show All Jobs
            </button>
          )}
        </motion.div>
      ) : (
        <div className="deliveries-table-container">
          <table className="deliveries-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Order ID</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Payment</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => {
                const normalizedStatus = (job.status || '').toLowerCase();
                const canAssignDriver = normalizedStatus === 'available' || normalizedStatus === 'assigned';
                const pickupPhotos = Array.isArray(job.photos)
                  ? job.photos.filter(photo => photo.photo_type === 'pickup')
                  : [];
                const deliveryPhotos = Array.isArray(job.photos)
                  ? job.photos.filter(photo => photo.photo_type === 'delivery')
                  : [];
                const issuePhotos = Array.isArray(job.photos)
                  ? job.photos.filter(photo => photo.photo_type === 'issue')
                  : [];

                return (
                <React.Fragment key={job.id}>
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`delivery-row ${expandedJobId === job.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td data-label="Job ID">#{job.id}</td>
                    <td data-label="Order ID">#{job.order_id}</td>
                    <td data-label="Driver">{job.driver_name || <span className="no-driver">Unassigned</span>}</td>
                    <td data-label="Status">
                      <span className={`delivery-status status-${job.status}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </td>
                    <td className="address-cell" data-label="Pickup">{job.pickup_address || 'N/A'}</td>
                    <td className="address-cell" data-label="Delivery">{job.delivery_address || 'N/A'}</td>
                    <td className="payment-cell" data-label="Payment">{formatCurrency(job.payment_amount || 0)}</td>
                    <td data-label="Created">{formatDate(job.created_at)}</td>
                  </motion.tr>
                  {expandedJobId === job.id && (
                    <tr className="expanded-row">
                      <td colSpan="8">
                        <div className="job-expanded-details">
                          <>
                          <div className="expanded-grid">
                            <div className="detail-card">
                              <h4>📦 Pickup</h4>
                              <p>{job.pickup_address || 'N/A'}</p>
                              {job.pickup_latitude && (
                                <p className="coords">({job.pickup_latitude?.toFixed(4)}, {job.pickup_longitude?.toFixed(4)})</p>
                              )}
                            </div>
                            <div className="detail-card">
                              <h4>📍 Delivery</h4>
                              <p>{job.delivery_address || 'N/A'}</p>
                              {job.delivery_latitude && (
                                <p className="coords">({job.delivery_latitude?.toFixed(4)}, {job.delivery_longitude?.toFixed(4)})</p>
                              )}
                            </div>
                            <div className="detail-card">
                              <h4>👤 Customer</h4>
                              {job.customer ? (
                                <p>{job.customer.first_name} {job.customer.last_name}
                                  {job.customer.phone && ` • ${job.customer.phone}`}
                                </p>
                              ) : (
                                <p>N/A</p>
                              )}
                            </div>
                            <div className="detail-card">
                              <h4>🚚 Driver</h4>
                              <p>{job.driver_name || 'Not assigned'}</p>
                              {canAssignDriver && (
                                <div
                                  className="assign-driver-controls"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    value={selectedDriverByJob[job.id] ?? (job.driver_id ? String(job.driver_id) : '')}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setSelectedDriverByJob((prev) => ({ ...prev, [job.id]: value }));
                                    }}
                                  >
                                    <option value="">Select driver...</option>
                                    {drivers.map((driver) => (
                                      <option key={driver.id} value={String(driver.id)}>
                                        {driver.first_name} {driver.last_name} ({driver.email})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="assign-driver-btn"
                                    disabled={
                                      assigningDriverJobId === job.id ||
                                      !(selectedDriverByJob[job.id] ?? (job.driver_id ? String(job.driver_id) : ''))
                                    }
                                    onClick={() => handleAssignDriver(job.id)}
                                  >
                                    {assigningDriverJobId === job.id ? 'Assigning...' : 'Assign Driver'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {(pickupPhotos.length > 0 || deliveryPhotos.length > 0) && (
                            <div className="proof-photos-section">
                              <h4>Delivery Proof Photos</h4>
                              <div className="proof-photo-groups">
                                {pickupPhotos.length > 0 && (
                                  <div className="proof-photo-group">
                                    <div className="proof-photo-group-header">
                                      <h5>Picked Up</h5>
                                      <button
                                        type="button"
                                        className="proof-ok-btn"
                                        disabled={job.pickup_photo_checked || reviewingPhotoType === `${job.id}-pickup`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReviewPhotoType(job.id, 'pickup');
                                        }}
                                      >
                                        {job.pickup_photo_checked
                                          ? 'Checked OK'
                                          : reviewingPhotoType === `${job.id}-pickup`
                                            ? 'Saving...'
                                            : 'Mark OK'}
                                      </button>
                                    </div>
                                    <div className="proof-photo-grid">
                                      {pickupPhotos.map((photo) => (
                                        <div className="proof-photo-card" key={`pickup-photo-${photo.id}`}>
                                          <img
                                            src={getImageUrl(photo.image_path)}
                                            alt="Pickup proof"
                                            className="proof-preview-photo"
                                          />
                                          <span>{formatDate(photo.created_at)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {deliveryPhotos.length > 0 && (
                                  <div className="proof-photo-group">
                                    <div className="proof-photo-group-header">
                                      <h5>Delivered</h5>
                                      <button
                                        type="button"
                                        className="proof-ok-btn"
                                        disabled={job.delivery_photo_checked || reviewingPhotoType === `${job.id}-delivery`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReviewPhotoType(job.id, 'delivery');
                                        }}
                                      >
                                        {job.delivery_photo_checked
                                          ? 'Checked OK'
                                          : reviewingPhotoType === `${job.id}-delivery`
                                            ? 'Saving...'
                                            : 'Mark OK'}
                                      </button>
                                    </div>
                                    <div className="proof-photo-grid">
                                      {deliveryPhotos.map((photo) => (
                                        <div className="proof-photo-card" key={`delivery-photo-${photo.id}`}>
                                          <img
                                            src={getImageUrl(photo.image_path)}
                                            alt="Delivery proof"
                                            className="proof-preview-photo"
                                          />
                                          <span>{formatDate(photo.created_at)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {job.issue_type && (
                            <div className="issue-alert">
                              <strong>⚠️ Issue Reported:</strong> {job.issue_type.replace(/_/g, ' ')}
                              {job.issue_resolved && (
                                <span className="issue-solved-pill">Solved</span>
                              )}
                              {job.issue_description && <p>{job.issue_description}</p>}
                              {issuePhotos.length > 0 && (
                                <div className="issue-photo-strip">
                                  {issuePhotos.map((photo) => (
                                      <img
                                        key={`issue-photo-${photo.id}`}
                                        src={getImageUrl(photo.image_path)}
                                        alt="Issue report"
                                        className="issue-preview-photo"
                                      />
                                    ))}
                                </div>
                              )}

                              <div className="issue-thread-admin-box">
                                <h5>Issue Discussion (Admin ↔ Driver)</h5>
                                {issueChatLoading ? (
                                  <p className="issue-thread-empty">Loading discussion...</p>
                                ) : issueMessages.length === 0 ? (
                                  <p className="issue-thread-empty">No messages yet.</p>
                                ) : (
                                  <div className="issue-thread-admin-list">
                                    {issueMessages.map((msg) => (
                                      <div key={msg.id} className="issue-thread-admin-message">
                                        <div className="issue-thread-admin-meta">
                                          <strong>{msg.sender_name || 'User'}</strong>
                                          <span>{msg.sender_role || 'user'} • {new Date(msg.created_at).toLocaleString()}</span>
                                        </div>
                                        <p>{msg.message}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {!job.issue_resolved ? (
                                  <div className="issue-thread-admin-actions">
                                    <input
                                      type="text"
                                      value={issueMessageText}
                                      onChange={(e) => setIssueMessageText(e.target.value)}
                                      placeholder="Reply to driver..."
                                    />
                                    <button onClick={handleSendIssueMessage} disabled={issueSending || !issueMessageText.trim()}>
                                      {issueSending ? 'Sending...' : 'Send'}
                                    </button>
                                    <button
                                      className="resolve-issue-btn"
                                      onClick={() => handleResolveIssue(job.id)}
                                      disabled={resolvingIssue}
                                    >
                                      {resolvingIssue ? 'Saving...' : 'Mark as Solved'}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="issue-thread-closed">Issue closed by admin.</p>
                                )}
                              </div>
                            </div>
                          )}
                          {job.items && job.items.length > 0 && (
                            <div className="expanded-items">
                              <h4>Items</h4>
                              <div className="items-list">
                                {job.items.map((item, idx) => (
                                  <span key={idx} className="item-tag">
                                    {item.product?.name} x{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          </>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDeliveries;
