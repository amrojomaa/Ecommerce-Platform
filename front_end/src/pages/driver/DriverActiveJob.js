import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaXmark } from 'react-icons/fa6';
import {
  FiAlertTriangle,
  FiCheck,
  FiMapPin,
  FiMessageCircle,
  FiPackage,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import DeliveryChatModal from '../../components/DeliveryChatModal';
import OrderMapTracker from '../../components/OrderMapTracker';
import { formatDateTime, getImageUrl } from '../../utils/helpers';
import {
  getDeliveryStatusClass,
  getDeliveryStatusLabel,
} from '../../utils/driverDeliveryStatus';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/driver/DriverPanel.css';
import '../../styles/pages/driver/DriverActiveJob.css';
import '../../styles/pages/driver/DriverDeliveries.css';

const ISSUE_TYPES = [
  { value: 'customer_not_home', labelKey: 'ui.pages.driver.issueTypes.customerNotHome' },
  { value: 'incorrect_address', labelKey: 'ui.pages.driver.issueTypes.incorrectAddress' },
  { value: 'damaged_items', labelKey: 'ui.pages.driver.issueTypes.damagedItems' },
  { value: 'other', labelKey: 'ui.pages.driver.issueTypes.other' },
];

const STATUS_STEP_KEYS = ['assigned', 'picked_up', 'delivering', 'delivered'];

const getPhotoPillClass = (photoCount, checked) => {
  if (photoCount === 0) return 'waiting';
  if (checked) return 'approved';
  return 'pending';
};

const DriverActiveJob = () => {
  const { t } = useTranslation();
  const panelKicker = t('ui.sidebar.panel.driver');
  const [jobs, setJobs] = useState([]);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [expandedJobTab, setExpandedJobTab] = useState('overview');
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

  const activeJob = expandedJobId ? jobs.find((job) => job.id === expandedJobId) || null : null;

  const fetchActiveJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS);
      const activeJobs = response.data || [];
      setJobs(activeJobs);
      setExpandedJobId((prevId) => {
        if (activeJobs.length === 0) return null;
        if (prevId && activeJobs.some((job) => job.id === prevId)) return prevId;
        return prevId;
      });
    } catch (error) {
      console.error('Error fetching active jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveJobs();

    const pollInterval = setInterval(() => {
      fetchActiveJobs();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [fetchActiveJobs]);

  useEffect(() => {
    if (!expandedJobId) return undefined;
    setPickupPhotoFile(null);
    setDeliveryPhotoFile(null);
    setIssuePhotoFile(null);
    setExpandedJobTab('overview');
    return undefined;
  }, [expandedJobId]);

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

  const handlePickup = async () => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      const response = await http.patch(buildUrl(DELIVERY_ENDPOINTS.PICKUP_JOB, { job_id: activeJob.id }));
      toast.success(tUi("ui.pages.driver.driverActiveJob.orderMarkedAsPickedUp_de1a5b6c99"));
      setJobs((prevJobs) => prevJobs.map((job) => job.id === response.data.id ? response.data : job));
      setExpandedJobId(response.data.id);
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
      setExpandedJobId(null);
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

  const getStatusSteps = (job) => {
    const currentIdx = STATUS_STEP_KEYS.indexOf(job?.status);
    return STATUS_STEP_KEYS.map((key, idx) => ({
      key,
      label: getDeliveryStatusLabel(key, t),
      completed: idx <= currentIdx,
      current: idx === currentIdx,
    }));
  };

  const getIssueTypeLabel = (type) => {
    const match = ISSUE_TYPES.find((item) => item.value === type);
    return match ? t(match.labelKey) : String(type || '').replace(/_/g, ' ');
  };

  const toggleJob = (jobId) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  const renderJobDetail = (job) => {
    const statusSteps = getStatusSteps(job);
    const allPhotos = Array.isArray(job.photos) ? job.photos : [];
    const pickupPhotos = allPhotos.filter((photo) => photo.photo_type === 'pickup');
    const deliveryPhotos = allPhotos.filter((photo) => photo.photo_type === 'delivery');
    const issuePhotos = allPhotos.filter((photo) => photo.photo_type === 'issue');
    const pickupChecked = !!job.pickup_photo_checked;
    const deliveryChecked = !!job.delivery_photo_checked;
    const canMarkPickup = job.status === 'assigned' && pickupPhotos.length > 0 && pickupChecked;
    const canMarkDelivered =
      (job.status === 'picked_up' || job.status === 'delivering') &&
      deliveryPhotos.length > 0 &&
      deliveryChecked;
    const canUploadDeliveryProof = job.status === 'picked_up' || job.status === 'delivering';

    return (
      <div className="drv-del-job-detail" onClick={(e) => e.stopPropagation()} role="region">
        <header className="drv-del-job-header">
          <div className="drv-del-job-header-copy">
            <p className="drv-del-job-kicker">{t('ui.pages.driver.list.jobDetails', { id: job.id })}</p>
            <h3 className="drv-del-job-title">
              {tUi('ui.pages.driver.driverActiveJob.order_4b245b25fc')}
              {job.order_id}
            </h3>
          </div>
          <div className="drv-del-job-header-actions">
            <span className={getDeliveryStatusClass(job.status)}>
              {getDeliveryStatusLabel(job.status, t)}
            </span>
            <button
              type="button"
              className="drv-del-close-btn"
              onClick={() => setExpandedJobId(null)}
              aria-label={t('ui.pages.driver.list.closeDetails')}
            >
              <FaXmark aria-hidden />
            </button>
          </div>
        </header>

        <div className="drv-del-job-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={expandedJobTab === 'overview'}
            className={expandedJobTab === 'overview' ? 'is-active' : ''}
            onClick={() => setExpandedJobTab('overview')}
          >
            {t('ui.pages.driver.list.tabManage')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={expandedJobTab === 'map'}
            className={expandedJobTab === 'map' ? 'is-active' : ''}
            onClick={() => setExpandedJobTab('map')}
          >
            {t('ui.pages.driver.list.tabMap')}
          </button>
        </div>

        {expandedJobTab === 'map' ? (
          <div className="drv-del-job-tab-panel drv-del-map-section">
            <OrderMapTracker deliveryJob={job} />
          </div>
        ) : (
          <div className="drv-del-job-tab-panel">
            <div className="drv-active-stepper">
              {statusSteps.map((step, idx) => (
                <div
                  key={step.key}
                  className={`drv-active-step ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}
                >
                  <div className="drv-active-step-circle">
                    {step.completed ? <FiCheck aria-hidden /> : idx + 1}
                  </div>
                  <span className="drv-active-step-label">{step.label}</span>
                  {idx < statusSteps.length - 1 && <div className="drv-active-step-connector" />}
                </div>
              ))}
            </div>

            <aside className="drv-active-sidebar drv-active-sidebar--expanded">
              <div className="drv-active-card drv-active-route">
                <h3>
                  {tUi('ui.pages.driver.driverActiveJob.order_4b245b25fc')}
                  {job.order_id}
                </h3>
                <div className="drv-active-route-point drv-active-route-point--pickup">
                  <FiPackage className="drv-active-route-icon" aria-hidden />
                  <div>
                    <span className="drv-active-route-label">
                      {tUi('ui.pages.driver.driverActiveJob.pickup_8822545cf7')}
                    </span>
                    <p>{job.pickup_address || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}</p>
                  </div>
                </div>
                <div className="drv-active-route-line" />
                <div className="drv-active-route-point drv-active-route-point--delivery">
                  <FiMapPin className="drv-active-route-icon" aria-hidden />
                  <div>
                    <span className="drv-active-route-label">
                      {tUi('ui.pages.driver.driverActiveJob.delivery_6992613df3')}
                    </span>
                    <p>{job.delivery_address || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}</p>
                    {job.customer && (
                      <p className="drv-active-customer">
                        <FiUser aria-hidden />
                        {job.customer.first_name} {job.customer.last_name}
                        {job.customer.phone &&
                          tUi('ui.pages.driver.driverActiveJob.value_0fb34ea1e8', {
                            value0: job.customer.phone,
                          })}
                      </p>
                    )}
                  </div>
                </div>
                {job.items?.length > 0 && (
                  <div className="drv-active-route-items">
                    <span className="drv-active-route-items-label">
                      {tUi('ui.pages.driver.driverActiveJob.items_34f553ea91')}
                    </span>
                    <div className="drv-active-tags">
                      {job.items.map((item, idx) => (
                        <span key={idx} className="drv-tag">
                          {item.product?.name} x{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="drv-active-card drv-active-proof">
                <h3>{tUi('ui.pages.driver.driverActiveJob.uploadPhoto_b55433437d')}</h3>
                <div className="drv-photo-pills">
                  <div className={`drv-photo-pill drv-photo-pill--${getPhotoPillClass(pickupPhotos.length, pickupChecked)}`}>
                    {tUi('ui.pages.driver.driverActiveJob.pickup_3633344126')}
                    {pickupPhotos.length === 0
                      ? tUi('ui.pages.driver.driverActiveJob.noPhotoYet_3c57d3e62c')
                      : pickupChecked
                        ? tUi('ui.pages.driver.driverActiveJob.markedOk_ed9c22f906')
                        : tUi('ui.pages.driver.driverActiveJob.pendingAdminCheck_370751e858')}
                  </div>
                  <div className={`drv-photo-pill drv-photo-pill--${getPhotoPillClass(deliveryPhotos.length, deliveryChecked)}`}>
                    {tUi('ui.pages.driver.driverActiveJob.delivery_e16a033b49')}
                    {deliveryPhotos.length === 0
                      ? tUi('ui.pages.driver.driverActiveJob.noPhotoYet_3c57d3e62c')
                      : deliveryChecked
                        ? tUi('ui.pages.driver.driverActiveJob.markedOk_ed9c22f906')
                        : tUi('ui.pages.driver.driverActiveJob.pendingAdminCheck_370751e858')}
                  </div>
                </div>
                <div className="drv-proof-block">
                  <h4>{tUi('ui.pages.driver.driverActiveJob.pickupProof_d91ee33534')}</h4>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPickupPhotoFile(e.target.files?.[0] || null)}
                    className="drv-proof-input"
                    disabled={pickupPhotos.length > 0}
                  />
                  {pickupPhotoPreview && (
                    <div className="drv-proof-preview">
                      <img src={pickupPhotoPreview} alt={tUi('ui.pages.driver.driverActiveJob.pickupSelectedUpload_de7d5a40fa')} />
                    </div>
                  )}
                  {pickupPhotoFile && (
                    <div className="drv-proof-actions">
                      <button
                        type="button"
                        onClick={() => handlePhotoUpload('pickup')}
                        disabled={uploading || pickupPhotos.length > 0}
                        className="drv-btn-secondary"
                      >
                        {pickupPhotos.length > 0
                          ? tUi('ui.pages.driver.driverActiveJob.pickupAlreadyUploaded_71dfe59cdc')
                          : uploading
                            ? '...'
                            : tUi('ui.pages.driver.driverActiveJob.uploadPickupProof_bef4425b25')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="drv-proof-block">
                  <h4>{tUi('ui.pages.driver.driverActiveJob.deliveryProof_554ad921e3')}</h4>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDeliveryPhotoFile(e.target.files?.[0] || null)}
                    className="drv-proof-input"
                    disabled={deliveryPhotos.length > 0 || !canUploadDeliveryProof}
                  />
                  {deliveryPhotoPreview && (
                    <div className="drv-proof-preview">
                      <img src={deliveryPhotoPreview} alt={tUi('ui.pages.driver.driverActiveJob.deliverySelectedUpload_4fd02d557d')} />
                    </div>
                  )}
                  {deliveryPhotoFile && (
                    <div className="drv-proof-actions">
                      <button
                        type="button"
                        onClick={() => handlePhotoUpload('delivery')}
                        disabled={uploading || deliveryPhotos.length > 0 || !canUploadDeliveryProof}
                        className="drv-btn-secondary"
                      >
                        {!canUploadDeliveryProof
                          ? tUi('ui.pages.driver.driverActiveJob.finishPickupFirst_40d56dd056')
                          : deliveryPhotos.length > 0
                            ? tUi('ui.pages.driver.driverActiveJob.deliveryAlreadyUploaded_4286214dd6')
                            : uploading
                              ? '...'
                              : tUi('ui.pages.driver.driverActiveJob.uploadDeliveryProof_87ad06b40c')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {job.issue_type && (
                <div className="drv-active-card drv-active-card--issue">
                  <h3>
                    <FiAlertTriangle aria-hidden />
                    {tUi('ui.pages.driver.driverActiveJob.reportedIssue_be909d9dd2')}
                  </h3>
                  <p className="drv-issue-type">{getIssueTypeLabel(job.issue_type)}</p>
                  {job.issue_description && <p className="drv-issue-desc">{job.issue_description}</p>}
                  {issuePhotos.length > 0 && (
                    <div className="drv-issue-photo-grid">
                      {issuePhotos.map((photo) => (
                        <img
                          key={`summary-issue-${photo.id}`}
                          src={getImageUrl(photo.image_path)}
                          alt={tUi('ui.pages.driver.driverActiveJob.issuePreview_8cb12330da')}
                        />
                      ))}
                    </div>
                  )}
                  <div className="drv-issue-thread">
                    <h4>{tUi('ui.pages.driver.driverActiveJob.issueDiscussionAdminDriver_20a6cecfc6')}</h4>
                    {issueChatLoading ? (
                      <p className="drv-issue-thread-empty">
                        {tUi('ui.pages.driver.driverActiveJob.loadingDiscussion_3385e5044c')}
                      </p>
                    ) : issueMessages.length === 0 ? (
                      <p className="drv-issue-thread-empty">
                        {tUi('ui.pages.driver.driverActiveJob.noMessagesYet_5dc9c8c5d1')}
                      </p>
                    ) : (
                      <div className="drv-issue-thread-list">
                        {issueMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`drv-issue-thread-message ${msg.sender_id === currentUserId ? 'mine' : ''}`}
                          >
                            <div className="drv-issue-thread-meta">
                              <strong>{msg.sender_name || tUi('ui.pages.driver.driverActiveJob.user_472cb0a9b5')}</strong>
                              <span>
                                {formatDateTime(msg.created_at)}
                              </span>
                            </div>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!job.issue_resolved && (
                      <div className="drv-issue-thread-input">
                        <input
                          type="text"
                          value={issueMessageText}
                          onChange={(e) => setIssueMessageText(e.target.value)}
                          placeholder={tUi('ui.pages.driver.driverActiveJob.writeAMessageToAdmin_a96d3938ba')}
                        />
                        <button
                          type="button"
                          onClick={handleSendIssueMessage}
                          disabled={issueSending || !issueMessageText.trim()}
                          className="drv-btn-primary"
                        >
                          {issueSending
                            ? tUi('ui.pages.driver.driverActiveJob.sending_a6441250fe')
                            : tUi('ui.pages.driver.driverActiveJob.send_b8a99b8547')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="drv-active-actions">
                <button type="button" onClick={() => setShowChat(true)} className="drv-btn-success">
                  <FiMessageCircle aria-hidden />
                  {tUi('ui.pages.driver.driverActiveJob.chatWithCustomer_f2dc21eb4f')}
                </button>
                {job.status === 'assigned' && (
                  <button type="button" onClick={handlePickup} disabled={updating || !canMarkPickup} className="drv-btn-primary">
                    <FiPackage aria-hidden />
                    {updating
                      ? tUi('ui.pages.driver.driverActiveJob.updating_aef6cc41f2')
                      : tUi('ui.pages.driver.driverActiveJob.markAsPickedUp_a0c8f3df13')}
                  </button>
                )}
                {(job.status === 'picked_up' || job.status === 'delivering') && (
                  <button type="button" onClick={handleDeliver} disabled={updating || !canMarkDelivered} className="drv-btn-success">
                    <FiTruck aria-hidden />
                    {updating
                      ? tUi('ui.pages.driver.driverActiveJob.updating_aef6cc41f2')
                      : tUi('ui.pages.driver.driverActiveJob.markAsDelivered_0559504313')}
                  </button>
                )}
                <button type="button" onClick={() => setShowIssueModal(true)} className="drv-btn-danger">
                  <FiAlertTriangle aria-hidden />
                  {tUi('ui.pages.driver.driverActiveJob.reportIssue_fc5eeeabe9')}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const activeDeliveryTitle = tUi('ui.pages.driver.driverActiveJob.activeDelivery_29af547736');

  if (jobs.length === 0) {
    return (
      <div className="admin-page-shell adm-page drv-page drv-del-page drv-active-page">
        <PageHeader
          kicker={panelKicker}
          title={tUi('ui.pages.driver.driverActiveJob.noActiveDelivery_4321221a6f')}
          subtitle={t('ui.pages.driver.active.subtitle')}
        />
        <div className="drv-empty">
          <FiTruck className="drv-empty-icon" aria-hidden />
          <p>{tUi('ui.pages.driver.driverActiveJob.youDonTHaveAny_36a11095cf')}</p>
          <Link to="/driver/map" className="drv-btn-primary">
            {tUi('ui.pages.driver.driverActiveJob.findAvailableJobs_e12cd068e4')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page drv-page drv-del-page drv-active-page">
      <PageHeader
        kicker={panelKicker}
        title={activeDeliveryTitle}
        subtitle={t('ui.pages.driver.active.subtitle')}
        actions={
          <span className="drv-header-pill">
            {jobs.length} {t('ui.pages.driver.list.activeCount')}
          </span>
        }
      />

      <section className="drv-del-section">
        <div className="drv-del-data-panel" role="region" aria-label={activeDeliveryTitle}>
          <table className="drv-del-table">
            <thead>
              <tr>
                <th className="drv-del-col-id" scope="col">{t('ui.pages.driver.list.jobId')}</th>
                <th className="drv-del-col-order" scope="col">Order</th>
                <th className="drv-del-col-status" scope="col">{t('ui.pages.driver.list.status')}</th>
                <th className="drv-del-col-address" scope="col">{tUi('ui.pages.driver.driverActiveJob.pickup_8822545cf7')}</th>
                <th className="drv-del-col-address" scope="col">{tUi('ui.pages.driver.driverActiveJob.delivery_6992613df3')}</th>
                <th className="drv-del-col-customer" scope="col">{t('ui.pages.driver.list.customer')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => {
                const isExpanded = expandedJobId === job.id;
                const customerName = job.customer
                  ? `${job.customer.first_name} ${job.customer.last_name}`.trim()
                  : null;

                return (
                  <React.Fragment key={job.id}>
                    <motion.tr
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`drv-del-row${isExpanded ? ' is-expanded' : ''}`}
                      onClick={() => toggleJob(job.id)}
                    >
                      <td className="drv-del-col-id drv-del-id">#{job.id}</td>
                      <td className="drv-del-col-order">#{job.order_id}</td>
                      <td className="drv-del-col-status">
                        <span className={getDeliveryStatusClass(job.status)}>
                          {getDeliveryStatusLabel(job.status, t)}
                        </span>
                      </td>
                      <td className="drv-del-col-address">
                        {job.pickup_address || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}
                      </td>
                      <td className="drv-del-col-address">
                        {job.delivery_address || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}
                      </td>
                      <td className="drv-del-col-customer">
                        {customerName || <span className="drv-del-muted">{tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}</span>}
                      </td>
                    </motion.tr>
                    {isExpanded && (
                      <tr className="drv-del-expanded-row">
                        <td colSpan="6">{renderJobDetail(job)}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showIssueModal && activeJob && (
        <div className="drv-modal-overlay">
          <div className="drv-modal drv-active-issue-modal" role="dialog" aria-modal="true">
            <button type="button" className="drv-modal-close" onClick={() => setShowIssueModal(false)}>
              ×
            </button>
            <h2>{tUi('ui.pages.driver.driverActiveJob.reportAnIssue_2a314befe7')}</h2>
            <div className="drv-issue-types">
              {ISSUE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`drv-issue-type-btn ${issueType === type.value ? 'selected' : ''}`}
                  onClick={() => setIssueType(type.value)}
                >
                  {t(type.labelKey)}
                </button>
              ))}
            </div>
            <textarea
              placeholder={tUi('ui.pages.driver.driverActiveJob.describeTheIssue_16722c25ec')}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="drv-issue-description"
            />
            <input id="issue-photo" type="file" accept="image/*" onChange={handleIssuePhotoChange} className="drv-issue-photo-input" />
            {issuePhotoPreview && (
              <div className="drv-issue-photo-preview">
                <img src={issuePhotoPreview} alt={tUi('ui.pages.driver.driverActiveJob.issueUploadPreview_0852883258')} />
              </div>
            )}
            <button type="button" onClick={handleReportIssue} className="drv-btn-danger drv-active-submit-issue" disabled={!issueType}>
              {tUi('ui.pages.driver.driverActiveJob.submitReport_a2a57073d5')}
            </button>
          </div>
        </div>
      )}

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
