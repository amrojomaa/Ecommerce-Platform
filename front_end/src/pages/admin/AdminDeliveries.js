import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate, formatDateTime, getImageUrl } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import OrderMapTracker from '../../components/OrderMapTracker';
import { FaXmark } from 'react-icons/fa6';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminDeliveries.css';

const DELIVERY_STATUS_LABEL_KEYS = {
  available: 'ui.pages.admin.adminDeliveries.available_66883aa01e',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
};

const ROLE_LABEL_KEYS = {
  admin: 'ui.pages.admin.adminUsers.admin_9b8c8c337f',
  support_manager: 'ui.pages.admin.adminUsers.supportManager_2a7bb3b941',
  operations_manager: 'ui.pages.admin.adminUsers.operationsManager_e7f7834cf9',
  warehouse_manager: 'ui.pages.admin.adminUsers.warehouseManager_3e9668a875',
  support_agent: 'ui.pages.admin.adminUsers.supportAgent_5f7e6a1b2c',
  driver: 'ui.pages.admin.adminUsers.driver_533424916e',
  customer: 'ui.pages.admin.adminUsers.customer_68c8b84985',
  cashier: 'ui.pages.admin.adminUsers.cashier_29b35eadb9',
};

const AdminDeliveries = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [expandedJobTab, setExpandedJobTab] = useState('overview');
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
    const hasPickup = photos.some((photo) => photo.photo_type === 'pickup');
    const hasDelivery = photos.some((photo) => photo.photo_type === 'delivery');

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
        filtered = allJobs.filter((job) =>
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
      toast.success(tUi("ui.pages.admin.adminDeliveries.issueMarkedAsSolved_9610dc7d9b"));
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
      setAllJobs((prevJobs) => prevJobs.map((job) => job.id === jobId ? updatedJob : job));
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
      toast.error(tUi("ui.pages.admin.adminDeliveries.pleaseSelectADriverFirst_409da1b2f7"));
      return;
    }

    setAssigningDriverJobId(jobId);
    try {
      const response = await http.patch(
        buildUrl(DELIVERY_ENDPOINTS.ASSIGN_DRIVER, { job_id: jobId }),
        { driver_id: Number(selectedDriverId) }
      );

      const updatedJob = response.data;
      setAllJobs((prevJobs) => prevJobs.map((job) => job.id === jobId ? updatedJob : job));
      toast.success(tUi("ui.pages.admin.adminDeliveries.driverAssignedSuccessfully_d1e7b8c241"));
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

    setExpandedJobTab('overview');

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
    const normalized = String(status || '').toLowerCase();
    const key = DELIVERY_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return normalized.replace(/_/g, ' ');
  };

  const getRoleLabel = (role) => {
    const normalized = String(role || '').toLowerCase();
    const key = ROLE_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return normalized.replace(/_/g, ' ');
  };

  const deliveryMgmtTitle = tUi('ui.pages.admin.adminDeliveries.deliveryManagement_51f1bfe811');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });
  const jobCountLabel =
    jobs.length === 1
      ? tUi('ui.pages.admin.adminDeliveries.job_40eab796f5')
      : tUi('ui.pages.admin.adminDeliveries.jobs_e4035b76af');

  return (
    <div className="admin-page-shell adm-page adm-del-page">
      <PageHeader
        kicker={panelKicker}
        title={deliveryMgmtTitle}
        subtitle={tUi('ui.pages.admin.adminDeliveries.subtitle_1a2b3c4d5g')}
        actions={
          <div className="adm-del-header-filter">
            <div className="adm-del-filter-row">
              <label className="adm-del-filter-label" htmlFor="delivery-status-filter">
                {tUi('ui.pages.admin.adminDeliveries.filterByStatus_25f69a210d')}
              </label>
              <select
                id="delivery-status-filter"
                className="adm-del-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {deliveryStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all'
                      ? tUi('ui.pages.admin.adminDeliveries.all_37e6961373')
                      : getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-del-header-meta" aria-live="polite">
              <strong>{jobs.length}</strong> {jobCountLabel}
            </p>
            {(showIssueOnly || showProofOnly) && (
              <div className="adm-del-filter-pills">
                {showIssueOnly && (
                  <span className="adm-del-filter-pill">
                    {tUi('ui.pages.admin.adminDeliveries.issueReportsOnly_098fbc0bc3')}
                  </span>
                )}
                {showProofOnly && (
                  <span className="adm-del-filter-pill adm-del-filter-pill--photo">
                    {tUi('ui.pages.admin.adminDeliveries.proofPhotosOnly_35ed213543')}
                  </span>
                )}
              </div>
            )}
          </div>
        }
      />

      {(issueCount > 0 || proofPhotoCount > 0) && (
        <div className="adm-del-notices">
          {issueCount > 0 && (
            <div className="adm-del-notice adm-del-notice--issue" role="status" aria-live="polite">
              <div className="adm-del-notice-icon" aria-hidden="true">
                <span className="adm-del-notice-bell">🔔</span>
                <span className="adm-del-notice-count">{issueCount}</span>
              </div>
              <div className="adm-del-notice-text">
                <strong>{issueCount}</strong>
                {tUi('ui.pages.admin.adminDeliveries.delivery_8e33d75337')}
                {issueCount === 1
                  ? tUi('ui.pages.admin.adminDeliveries.issueReportNeeds_9d4a2961c3')
                  : tUi('ui.pages.admin.adminDeliveries.issueReportsNeed_06c771831a')}
                {tUi('ui.pages.admin.adminDeliveries.adminAttention_5a79bc3bce')}
              </div>
              <button
                type="button"
                className="adm-del-notice-btn"
                onClick={() => {
                  setShowIssueOnly(true);
                  setShowProofOnly(false);
                  setStatusFilter('all');
                  setExpandedJobId(null);
                }}
              >
                {tUi('ui.pages.admin.adminDeliveries.viewIssueOrders_863af5a2ad')}
              </button>
              {showIssueOnly && (
                <button
                  type="button"
                  className="adm-del-notice-btn adm-del-notice-btn--clear"
                  onClick={() => setShowIssueOnly(false)}
                >
                  {tUi('ui.pages.admin.adminDeliveries.clear_9b77f46f9c')}
                </button>
              )}
            </div>
          )}

          {proofPhotoCount > 0 && (
            <div className="adm-del-notice adm-del-notice--photo" role="status" aria-live="polite">
              <div className="adm-del-notice-icon" aria-hidden="true">
                <span className="adm-del-notice-bell">📸</span>
                <span className="adm-del-notice-count">{proofPhotoCount}</span>
              </div>
              <div className="adm-del-notice-text">
                <strong>{proofPhotoCount}</strong>
                {tUi('ui.pages.admin.adminDeliveries.delivery_8e33d75337')}
                {proofPhotoCount === 1
                  ? tUi('ui.pages.admin.adminDeliveries.jobHas_b7c5f7c5de')
                  : tUi('ui.pages.admin.adminDeliveries.jobsHave_aa577eee49')}
                {tUi('ui.pages.admin.adminDeliveries.proofPhotosUploadedByDrivers_6d35ed5c58')}
              </div>
              <button
                type="button"
                className="adm-del-notice-btn"
                onClick={() => {
                  setShowProofOnly(true);
                  setShowIssueOnly(false);
                  setStatusFilter('all');
                  setExpandedJobId(null);
                }}
              >
                {tUi('ui.pages.admin.adminDeliveries.viewPhotoOrders_58b886c5cd')}
              </button>
              {showProofOnly && (
                <button
                  type="button"
                  className="adm-del-notice-btn adm-del-notice-btn--clear"
                  onClick={() => setShowProofOnly(false)}
                >
                  {tUi('ui.pages.admin.adminDeliveries.clear_9b77f46f9c')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <section className="adm-del-section">
        {loading ? (
          <div className="adm-del-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : error ? (
          <motion.div
            className="adm-del-error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p>
              <strong>{tUi('ui.pages.admin.adminDeliveries.error_c7f47eee32')}</strong> {error}
            </p>
            <button type="button" onClick={fetchJobs} className="adm-btn-primary">
              {tUi('ui.pages.admin.adminDeliveries.retry_4ec5161833')}
            </button>
          </motion.div>
        ) : jobs.length === 0 ? (
          <motion.div className="adm-del-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p>
              {statusFilter === 'all'
                ? tUi('ui.pages.admin.adminDeliveries.noDeliveryJobsFound_80dac255bf')
                : tUi('ui.pages.admin.adminDeliveries.noDeliveryJobsWithStatus_64e7ce84ea', {
                    value0: getStatusLabel(statusFilter)
                  })}
            </p>
            {statusFilter !== 'all' && (
              <button type="button" onClick={() => setStatusFilter('all')} className="adm-btn-secondary">
                {tUi('ui.pages.admin.adminDeliveries.showAllJobs_7eacebe8db')}
              </button>
            )}
          </motion.div>
        ) : (
          <div className="adm-del-data-panel" role="region" aria-label={deliveryMgmtTitle}>
            <table className="adm-del-table">
            <thead>
              <tr>
                <th className="adm-del-col-id" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.jobId_e9870f1542')}
                </th>
                <th className="adm-del-col-order" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.orderId_722c965e70')}
                </th>
                <th className="adm-del-col-driver" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.driver_98ea19431c')}
                </th>
                <th className="adm-del-col-status" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.status_e033fc5e4f')}
                </th>
                <th className="adm-del-col-address" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.pickup_b758cea6c8')}
                </th>
                <th className="adm-del-col-address" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.delivery_e0a72301c9')}
                </th>
                <th className="adm-del-col-payment" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.payment_ca9b9e5f35')}
                </th>
                <th className="adm-del-col-date" scope="col">
                  {tUi('ui.pages.admin.adminDeliveries.created_138ce7b7fa')}
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => {
              const normalizedStatus = (job.status || '').toLowerCase();
              const canAssignDriver = normalizedStatus === "available" || normalizedStatus === "assigned";
              const pickupPhotos = Array.isArray(job.photos) ?
              job.photos.filter((photo) => photo.photo_type === "pickup") :
              [];
              const deliveryPhotos = Array.isArray(job.photos) ?
              job.photos.filter((photo) => photo.photo_type === "delivery") :
              [];
              const issuePhotos = Array.isArray(job.photos) ?
              job.photos.filter((photo) => photo.photo_type === "issue") :
              [];

              return (
                <React.Fragment key={job.id}>
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`adm-del-row ${expandedJobId === job.id ? 'is-expanded' : ''}`}
                    onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                  >
                    <td className="adm-del-col-id adm-del-id" data-label={tUi('ui.pages.admin.adminDeliveries.jobId_e9870f1542')}>
                      #{job.id}
                    </td>
                    <td className="adm-del-col-order" data-label={tUi('ui.pages.admin.adminDeliveries.orderId_722c965e70')}>
                      #{job.order_id}
                    </td>
                    <td className="adm-del-col-driver" data-label={tUi('ui.pages.admin.adminDeliveries.driver_98ea19431c')}>
                      {job.driver_name || (
                        <span className="adm-del-muted">{tUi('ui.pages.admin.adminDeliveries.unassigned_28bca48db4')}</span>
                      )}
                    </td>
                    <td className="adm-del-col-status" data-label={tUi('ui.pages.admin.adminDeliveries.status_e033fc5e4f')}>
                      <span className={`adm-del-status adm-del-status--${normalizedStatus}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </td>
                    <td className="adm-del-col-address" data-label={tUi('ui.pages.admin.adminDeliveries.pickup_b758cea6c8')}>
                      {job.pickup_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}
                    </td>
                    <td className="adm-del-col-address" data-label={tUi('ui.pages.admin.adminDeliveries.delivery_e0a72301c9')}>
                      {job.delivery_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}
                    </td>
                    <td className="adm-del-col-payment" data-label={tUi('ui.pages.admin.adminDeliveries.payment_ca9b9e5f35')}>
                      {formatCurrency(job.payment_amount || 0)}
                    </td>
                    <td className="adm-del-col-date" data-label={tUi('ui.pages.admin.adminDeliveries.created_138ce7b7fa')}>
                      {formatDate(job.created_at)}
                    </td>
                  </motion.tr>
                  {expandedJobId === job.id && (
                  <tr className="adm-del-expanded-row">
                      <td colSpan="8">
                        <div
                          className="adm-del-job-detail"
                          onClick={(e) => e.stopPropagation()}
                          role="region"
                          aria-label={tUi('ui.pages.admin.adminDeliveries.jobDetails_7a8b9c0d1e', {
                            value0: job.id
                          })}
                        >
                          <header className="adm-del-job-header">
                            <div className="adm-del-job-header-copy">
                              <p className="adm-del-job-kicker">
                                {tUi('ui.pages.admin.adminDeliveries.jobDetails_7a8b9c0d1e', { value0: job.id })}
                              </p>
                              <h3 className="adm-del-job-title">
                                {tUi('ui.pages.admin.adminDeliveries.orderTitle_8e5d31f868', {
                                  value0: job.order_id
                                })}
                              </h3>
                            </div>
                            <div className="adm-del-job-header-actions">
                              <span className={`adm-del-status adm-del-status--${normalizedStatus}`}>
                                {getStatusLabel(job.status)}
                              </span>
                              <button
                                type="button"
                                className="adm-del-close-btn"
                                onClick={() => setExpandedJobId(null)}
                                aria-label={tUi('ui.pages.admin.adminDeliveries.closeDetails_8b9c0d1e2f')}
                              >
                                <FaXmark aria-hidden />
                              </button>
                            </div>
                          </header>

                          <div className="adm-del-job-meta">
                            <div className="adm-del-job-meta-item">
                              <span className="adm-del-job-meta-label">
                                {tUi('ui.pages.admin.adminDeliveries.payment_ca9b9e5f35')}
                              </span>
                              <span className="adm-del-job-meta-value">
                                {formatCurrency(job.payment_amount || 0)}
                              </span>
                            </div>
                            <div className="adm-del-job-meta-item">
                              <span className="adm-del-job-meta-label">
                                {tUi('ui.pages.admin.adminDeliveries.driver_98ea19431c')}
                              </span>
                              <span className="adm-del-job-meta-value">
                                {job.driver_name || tUi('ui.pages.admin.adminDeliveries.unassigned_28bca48db4')}
                              </span>
                            </div>
                            <div className="adm-del-job-meta-item">
                              <span className="adm-del-job-meta-label">
                                {tUi('ui.pages.admin.adminDeliveries.created_138ce7b7fa')}
                              </span>
                              <span className="adm-del-job-meta-value">{formatDate(job.created_at)}</span>
                            </div>
                          </div>

                          <div className="adm-del-job-tabs" role="tablist">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={expandedJobTab === 'overview'}
                              className={expandedJobTab === 'overview' ? 'is-active' : ''}
                              onClick={() => setExpandedJobTab('overview')}
                            >
                              {tUi('ui.pages.admin.adminDeliveries.tabOverview_9c0d1e2f3a')}
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={expandedJobTab === 'map'}
                              className={expandedJobTab === 'map' ? 'is-active' : ''}
                              onClick={() => setExpandedJobTab('map')}
                            >
                              {tUi('ui.pages.admin.adminDeliveries.tabTracking_0d1e2f3a4b')}
                            </button>
                            {(pickupPhotos.length > 0 || deliveryPhotos.length > 0) && (
                              <button
                                type="button"
                                role="tab"
                                aria-selected={expandedJobTab === 'proof'}
                                className={expandedJobTab === 'proof' ? 'is-active' : ''}
                                onClick={() => setExpandedJobTab('proof')}
                              >
                                {tUi('ui.pages.admin.adminDeliveries.deliveryProofPhotos_2ec00d3e69')}
                              </button>
                            )}
                            {job.issue_type && (
                              <button
                                type="button"
                                role="tab"
                                aria-selected={expandedJobTab === 'issue'}
                                className={expandedJobTab === 'issue' ? 'is-active' : ''}
                                onClick={() => setExpandedJobTab('issue')}
                              >
                                {tUi('ui.pages.admin.adminDeliveries.issueReported_44c3c7d44b')}
                              </button>
                            )}
                          </div>

                          <div className="adm-del-job-tab-panel">
                            {expandedJobTab === 'overview' && (
                              <div className="adm-del-job-overview">
                                <div className="adm-del-detail-grid">
                                  <div className="adm-del-detail-card">
                                    <h4>{tUi('ui.pages.admin.adminDeliveries.pickup_d7b7e7a679')}</h4>
                                    <p>{job.pickup_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}</p>
                                    {job.pickup_latitude && (
                                      <p className="coords">
                                        ({job.pickup_latitude?.toFixed(4)}, {job.pickup_longitude?.toFixed(4)})
                                      </p>
                                    )}
                                  </div>
                                  <div className="adm-del-detail-card">
                                    <h4>{tUi('ui.pages.admin.adminDeliveries.delivery_bf08aa740b')}</h4>
                                    <p>{job.delivery_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}</p>
                                    {job.delivery_latitude && (
                                      <p className="coords">
                                        ({job.delivery_latitude?.toFixed(4)}, {job.delivery_longitude?.toFixed(4)})
                                      </p>
                                    )}
                                  </div>
                                  <div className="adm-del-detail-card">
                                    <h4>{tUi('ui.pages.admin.adminDeliveries.customer_6ce1add7ce')}</h4>
                                    {job.customer ? (
                                      <p>
                                        {job.customer.first_name} {job.customer.last_name}
                                        {job.customer.phone &&
                                          tUi('ui.pages.admin.adminDeliveries.value_9e10da0234', {
                                            value0: job.customer.phone
                                          })}
                                      </p>
                                    ) : (
                                      <p>{tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}</p>
                                    )}
                                  </div>
                                  <div className="adm-del-detail-card adm-del-detail-card--driver">
                                    <h4>{tUi('ui.pages.admin.adminDeliveries.driver_f405bc2809')}</h4>
                                    <p>{job.driver_name || tUi('ui.pages.admin.adminDeliveries.notAssigned_128e07a7a1')}</p>
                                    {canAssignDriver && (
                                      <div className="adm-del-assign-controls">
                                        <select
                                          value={
                                            selectedDriverByJob[job.id] ??
                                            (job.driver_id ? String(job.driver_id) : '')
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setSelectedDriverByJob((prev) => ({ ...prev, [job.id]: value }));
                                          }}
                                        >
                                          <option value="">
                                            {tUi('ui.pages.admin.adminDeliveries.selectDriver_a679aadb8d')}
                                          </option>
                                          {drivers.map((driver) => (
                                            <option key={driver.id} value={String(driver.id)}>
                                              {driver.first_name} {driver.last_name} ({driver.email})
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          className="adm-btn-primary adm-del-assign-btn"
                                          disabled={
                                            assigningDriverJobId === job.id ||
                                            !(selectedDriverByJob[job.id] ??
                                              (job.driver_id ? String(job.driver_id) : ''))
                                          }
                                          onClick={() => handleAssignDriver(job.id)}
                                        >
                                          {assigningDriverJobId === job.id
                                            ? tUi('ui.pages.admin.adminDeliveries.assigning_0faec53f0e')
                                            : tUi('ui.pages.admin.adminDeliveries.assignDriver_a52d732a9a')}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {job.items && job.items.length > 0 && (
                                  <section className="adm-del-items-section">
                                    <h4 className="adm-del-section-title">
                                      {tUi('ui.pages.admin.adminDeliveries.items_fa39ea7cbb')}
                                    </h4>
                                    <div className="adm-del-items-list">
                                      {job.items.map((item, idx) => (
                                        <span key={idx} className="adm-del-item-tag">
                                          {item.product?.name} x{item.quantity}
                                        </span>
                                      ))}
                                    </div>
                                  </section>
                                )}
                              </div>
                            )}

                            {expandedJobTab === 'map' && (
                              <div className="adm-del-map-section">
                                <OrderMapTracker deliveryJob={job} />
                              </div>
                            )}

                            {expandedJobTab === 'proof' && (pickupPhotos.length > 0 || deliveryPhotos.length > 0) && (
                              <section className="adm-del-proof-section">
                                <div className="adm-del-proof-groups">
                                  {pickupPhotos.length > 0 && (
                                    <div className="adm-del-proof-group">
                                      <div className="adm-del-proof-header">
                                        <h5>{tUi('ui.pages.admin.adminDeliveries.pickedUp_519b67e151')}</h5>
                                        <button
                                          type="button"
                                          className="adm-del-btn-ok"
                                          disabled={
                                            job.pickup_photo_checked ||
                                            reviewingPhotoType === `${job.id}-pickup`
                                          }
                                          onClick={() => handleReviewPhotoType(job.id, 'pickup')}
                                        >
                                          {job.pickup_photo_checked
                                            ? tUi('ui.pages.admin.adminDeliveries.checkedOk_c8b794882a')
                                            : reviewingPhotoType === `${job.id}-pickup`
                                              ? tUi('ui.pages.admin.adminDeliveries.saving_3400c1bb21')
                                              : tUi('ui.pages.admin.adminDeliveries.markOk_245791044e')}
                                        </button>
                                      </div>
                                      <div className="adm-del-proof-grid">
                                        {pickupPhotos.map((photo) => (
                                          <div className="adm-del-proof-card" key={`pickup-photo-${photo.id}`}>
                                            <img
                                              src={getImageUrl(photo.image_path)}
                                              alt={tUi('ui.pages.admin.adminDeliveries.pickupProof_de18bafb10')}
                                              className="adm-del-proof-img"
                                            />
                                            <span>{formatDate(photo.created_at)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {deliveryPhotos.length > 0 && (
                                    <div className="adm-del-proof-group">
                                      <div className="adm-del-proof-header">
                                        <h5>{tUi('ui.pages.admin.adminDeliveries.delivered_7131e29334')}</h5>
                                        <button
                                          type="button"
                                          className="adm-del-btn-ok"
                                          disabled={
                                            job.delivery_photo_checked ||
                                            reviewingPhotoType === `${job.id}-delivery`
                                          }
                                          onClick={() => handleReviewPhotoType(job.id, 'delivery')}
                                        >
                                          {job.delivery_photo_checked
                                            ? tUi('ui.pages.admin.adminDeliveries.checkedOk_c8b794882a')
                                            : reviewingPhotoType === `${job.id}-delivery`
                                              ? tUi('ui.pages.admin.adminDeliveries.saving_3400c1bb21')
                                              : tUi('ui.pages.admin.adminDeliveries.markOk_245791044e')}
                                        </button>
                                      </div>
                                      <div className="adm-del-proof-grid">
                                        {deliveryPhotos.map((photo) => (
                                          <div className="adm-del-proof-card" key={`delivery-photo-${photo.id}`}>
                                            <img
                                              src={getImageUrl(photo.image_path)}
                                              alt={tUi('ui.pages.admin.adminDeliveries.deliveryProof_8e26a61d41')}
                                              className="adm-del-proof-img"
                                            />
                                            <span>{formatDate(photo.created_at)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </section>
                            )}

                            {expandedJobTab === 'issue' && job.issue_type && (
                              <section className="adm-del-issue-panel">
                                <div className="adm-del-issue-alert">
                                  <strong>{tUi('ui.pages.admin.adminDeliveries.issueReported_44c3c7d44b')}</strong>{' '}
                                  {job.issue_type.replace(/_/g, ' ')}
                                  {job.issue_resolved && (
                                    <span className="adm-del-issue-solved">
                                      {tUi('ui.pages.admin.adminDeliveries.solved_1bad684e4b')}
                                    </span>
                                  )}
                                  {job.issue_description && <p>{job.issue_description}</p>}
                                  {issuePhotos.length > 0 && (
                                    <div className="adm-del-issue-photos">
                                      {issuePhotos.map((photo) => (
                                        <img
                                          key={`issue-photo-${photo.id}`}
                                          src={getImageUrl(photo.image_path)}
                                          alt={tUi('ui.pages.admin.adminDeliveries.issueReport_8c535704c0')}
                                          className="adm-del-issue-img"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="adm-del-issue-thread">
                                  <h5 className="adm-del-section-title">
                                    {tUi('ui.pages.admin.adminDeliveries.issueDiscussionAdminDriver_e2c77dbbbc')}
                                  </h5>
                                  {issueChatLoading ? (
                                    <p className="adm-del-thread-empty">
                                      {tUi('ui.pages.admin.adminDeliveries.loadingDiscussion_a617f0a9e2')}
                                    </p>
                                  ) : issueMessages.length === 0 ? (
                                    <p className="adm-del-thread-empty">
                                      {tUi('ui.pages.admin.adminDeliveries.noMessagesYet_3b81b04428')}
                                    </p>
                                  ) : (
                                    <div className="adm-del-thread-list">
                                      {issueMessages.map((msg) => (
                                        <div key={msg.id} className="adm-del-thread-message">
                                          <div className="adm-del-thread-meta">
                                            <strong>
                                              {msg.sender_name ||
                                                tUi('ui.pages.admin.adminDeliveries.user_78896fd17c')}
                                            </strong>
                                            <span>
                                              {msg.sender_role
                                                ? getRoleLabel(msg.sender_role)
                                                : tUi('ui.pages.admin.adminDeliveries.user_532f4a40ae')}{' '}
                                              • {formatDateTime(msg.created_at)}
                                            </span>
                                          </div>
                                          <p>{msg.message}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {!job.issue_resolved ? (
                                    <div className="adm-del-thread-actions">
                                      <input
                                        type="text"
                                        value={issueMessageText}
                                        onChange={(e) => setIssueMessageText(e.target.value)}
                                        placeholder={tUi(
                                          'ui.pages.admin.adminDeliveries.replyToDriver_f3e492b4fe'
                                        )}
                                      />
                                      <button
                                        type="button"
                                        onClick={handleSendIssueMessage}
                                        disabled={issueSending || !issueMessageText.trim()}
                                      >
                                        {issueSending
                                          ? tUi('ui.pages.admin.adminDeliveries.sending_c686f867c6')
                                          : tUi('ui.pages.admin.adminDeliveries.send_50281357f3')}
                                      </button>
                                      <button
                                        type="button"
                                        className="adm-del-btn-resolve"
                                        onClick={() => handleResolveIssue(job.id)}
                                        disabled={resolvingIssue}
                                      >
                                        {resolvingIssue
                                          ? tUi('ui.pages.admin.adminDeliveries.saving_3400c1bb21')
                                          : tUi('ui.pages.admin.adminDeliveries.markAsSolved_d73588c2d7')}
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="adm-del-thread-closed">
                                      {tUi('ui.pages.admin.adminDeliveries.issueClosedByAdmin_a88a36322d')}
                                    </p>
                                  )}
                                </div>
                              </section>
                            )}
                          </div>
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
      </section>
    </div>
  );

};

export default AdminDeliveries;
