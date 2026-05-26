import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaXmark } from 'react-icons/fa6';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import OrderMapTracker from '../../components/OrderMapTracker';
import { getDeliveryStatusClass, getDeliveryStatusLabel } from '../../utils/driverDeliveryStatus';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/driver/DriverPanel.css';
import '../../styles/pages/driver/DriverDeliveries.css';
import '../../styles/pages/driver/DriverMap.css';

const DriverMap = () => {
  const { t } = useTranslation();
  const panelKicker = t('ui.sidebar.panel.driver');
  const [jobs, setJobs] = useState([]);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [expandedJobTab, setExpandedJobTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS);
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          http.patch(DELIVERY_ENDPOINTS.UPDATE_LOCATION, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
    return undefined;
  }, []);

  const handleAccept = async (jobId) => {
    setAcceptingId(jobId);
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.ACCEPT_JOB, { job_id: jobId }));
      toast.success(tUi('ui.pages.driver.driverMap.jobAcceptedSuccessfully_f36ff52c4a'));
      setExpandedJobId(null);
      fetchJobs();
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to accept job';
      toast.error(errorMessage);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (jobId) => {
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.DECLINE_JOB, { job_id: jobId }));
      toast.info(tUi('ui.pages.driver.driverMap.jobDeclined_9191aaa2f6'));
      setExpandedJobId(null);
      fetchJobs();
    } catch (error) {
      toast.error(error.message || 'Failed to decline job');
    }
  };

  const toggleJob = (jobId) => {
    setExpandedJobTab('overview');
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const mapJobsTitle = tUi('ui.pages.driver.driverMap.findDeliveryJobs_cfe3d4c660');

  return (
    <div className="admin-page-shell adm-page drv-page drv-del-page drv-map-page">
      <PageHeader
        kicker={panelKicker}
        title={mapJobsTitle}
        subtitle={t('ui.pages.driver.map.subtitle')}
        actions={
          <span className="drv-header-pill">
            {jobs.length}
            {tUi('ui.pages.driver.driverMap.available_9488931dee')}
          </span>
        }
      />

      <section className="drv-del-section">
        {jobs.length === 0 ? (
          <div className="drv-del-empty">
            <p>{tUi('ui.pages.driver.driverMap.noDeliveryJobsAvailableRight_53630e0d5a')}</p>
          </div>
        ) : (
          <div className="drv-del-data-panel" role="region" aria-label={mapJobsTitle}>
            <table className="drv-del-table">
              <thead>
                <tr>
                  <th className="drv-del-col-id" scope="col">
                    {t('ui.pages.driver.list.jobId')}
                  </th>
                  <th className="drv-del-col-order" scope="col">
                    {tUi('ui.pages.driver.driverMap.order_78ea594e7c').replace('#', '').trim() || 'Order'}
                  </th>
                  <th className="drv-del-col-status" scope="col">
                    {t('ui.pages.driver.list.status')}
                  </th>
                  <th className="drv-del-col-address" scope="col">
                    {tUi('ui.pages.driver.driverMap.pickup_d73f705138')}
                  </th>
                  <th className="drv-del-col-address" scope="col">
                    {tUi('ui.pages.driver.driverMap.delivery_08ebebf690')}
                  </th>
                  <th className="drv-del-col-customer" scope="col">
                    {tUi('ui.pages.driver.driverMap.customer_d9db49ed61')}
                  </th>
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
                        <td className="drv-del-col-id drv-del-id" data-label={t('ui.pages.driver.list.jobId')}>
                          #{job.id}
                        </td>
                        <td className="drv-del-col-order" data-label="Order">
                          #{job.order_id}
                        </td>
                        <td className="drv-del-col-status" data-label={t('ui.pages.driver.list.status')}>
                          <span className={getDeliveryStatusClass(job.status)}>
                            {getDeliveryStatusLabel(job.status, t)}
                          </span>
                        </td>
                        <td className="drv-del-col-address" data-label="Pickup">
                          {job.pickup_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                        </td>
                        <td className="drv-del-col-address" data-label="Delivery">
                          {job.delivery_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                        </td>
                        <td className="drv-del-col-customer" data-label="Customer">
                          {customerName || <span className="drv-del-muted">{tUi('ui.pages.driver.driverMap.nA_de3570823c')}</span>}
                        </td>
                      </motion.tr>

                      {isExpanded && (
                        <tr className="drv-del-expanded-row">
                          <td colSpan="6">
                            <div
                              className="drv-del-job-detail"
                              onClick={(e) => e.stopPropagation()}
                              role="region"
                              aria-label={t('ui.pages.driver.list.jobDetails', { id: job.id })}
                            >
                              <header className="drv-del-job-header drv-map-detail-header">
                                <div className="drv-del-job-header-copy">
                                  <p className="drv-del-job-kicker">
                                    {t('ui.pages.driver.list.jobDetails', { id: job.id })}
                                  </p>
                                  <h3 className="drv-del-job-title">
                                    {tUi('ui.pages.driver.driverMap.deliveryJobOrder_41762bc75b')}
                                    {job.order_id}
                                  </h3>
                                </div>
                                <div className="drv-del-job-header-actions drv-map-detail-header-end">
                                  <div className="drv-map-detail-toolbar">
                                    <div className="drv-del-job-tabs drv-del-job-tabs--end" role="tablist">
                                      <button
                                        type="button"
                                        role="tab"
                                        aria-selected={expandedJobTab === 'overview'}
                                        className={expandedJobTab === 'overview' ? 'is-active' : ''}
                                        onClick={() => setExpandedJobTab('overview')}
                                      >
                                        {t('ui.pages.driver.list.tabOverview')}
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
                                    <div className="drv-map-detail-actions">
                                      <button
                                        type="button"
                                        className="drv-btn-success"
                                        onClick={() => handleAccept(job.id)}
                                        disabled={acceptingId === job.id}
                                      >
                                        {acceptingId === job.id
                                          ? tUi('ui.pages.driver.driverMap.accepting_40f0cb67bc')
                                          : tUi('ui.pages.driver.driverMap.acceptJob_83dec8187c')}
                                      </button>
                                      <button
                                        type="button"
                                        className="drv-btn-secondary"
                                        onClick={() => handleDecline(job.id)}
                                      >
                                        {tUi('ui.pages.driver.driverMap.decline_7e736d807b')}
                                      </button>
                                    </div>
                                  </div>
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

                              {expandedJobTab === 'overview' && (
                                <div className="drv-del-job-tab-panel">
                                  <div className="drv-del-detail-grid">
                                    <div className="drv-del-detail-card">
                                      <h4>{tUi('ui.pages.driver.driverMap.pickup_d73f705138')}</h4>
                                      <p>{job.pickup_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}</p>
                                    </div>
                                    <div className="drv-del-detail-card">
                                      <h4>{tUi('ui.pages.driver.driverMap.delivery_08ebebf690')}</h4>
                                      <p>{job.delivery_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}</p>
                                    </div>
                                    <div className="drv-del-detail-card">
                                      <h4>{tUi('ui.pages.driver.driverMap.customer_d9db49ed61')}</h4>
                                      <p>{customerName || tUi('ui.pages.driver.driverMap.nA_de3570823c')}</p>
                                    </div>
                                  </div>

                                  {job.items?.length > 0 && (
                                    <div className="drv-del-items-list drv-map-detail-items">
                                      {job.items.map((item, idx) => (
                                        <span key={idx} className="drv-del-item-tag">
                                          {item.product?.name} x{item.quantity}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {expandedJobTab === 'map' && (
                                <div className="drv-del-job-tab-panel drv-del-map-section">
                                  <OrderMapTracker deliveryJob={job} />
                                </div>
                              )}
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

export default DriverMap;
