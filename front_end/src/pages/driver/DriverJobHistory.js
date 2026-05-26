import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaXmark } from 'react-icons/fa6';
import { FiClipboard } from 'react-icons/fi';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDateTime } from '../../utils/helpers';
import { getDeliveryStatusClass, getDeliveryStatusLabel } from '../../utils/driverDeliveryStatus';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/support-manager/SupportPanel.css';
import '../../styles/pages/driver/DriverPanel.css';
import '../../styles/pages/driver/DriverDeliveries.css';

const DriverJobHistory = () => {
  const { t } = useTranslation();
  const panelKicker = t('ui.sidebar.panel.driver');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await http.get(DELIVERY_ENDPOINTS.JOB_HISTORY);
        setJobs(response.data || []);
      } catch (error) {
        console.error('Error fetching job history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((job) => job.status === filter);

  const tabs = [
    { id: 'all', label: tUi('ui.pages.driver.driverJobHistory.all_8807f0de5d') },
    { id: 'delivered', label: tUi('ui.pages.driver.driverJobHistory.delivered_08a781473b') },
    { id: 'cancelled', label: tUi('ui.pages.driver.driverJobHistory.cancelled_3252a4cd97') },
  ];

  const toggleJob = (jobId) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const historyTitle = tUi('ui.pages.driver.driverJobHistory.deliveryHistory_ddfd66f8b3');

  return (
    <div className="admin-page-shell adm-page drv-page drv-del-page drv-history-page">
      <PageHeader
        kicker={panelKicker}
        title={historyTitle}
        subtitle={t('ui.pages.driver.history.subtitle')}
        actions={
          <div className="spm-pill-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={`spm-pill-tab${filter === tab.id ? ' is-active' : ''}`}
                aria-selected={filter === tab.id}
                onClick={() => {
                  setFilter(tab.id);
                  setExpandedJobId(null);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <section className="drv-del-section">
        {filteredJobs.length === 0 ? (
          <div className="drv-del-empty">
            <FiClipboard aria-hidden />
            <h2>{tUi('ui.pages.driver.driverJobHistory.noDeliveriesYet_3d3c839a33')}</h2>
            <p>{tUi('ui.pages.driver.driverJobHistory.yourCompletedDeliveriesWillAppear_d2de11ec07')}</p>
          </div>
        ) : (
          <div className="drv-del-data-panel" role="region" aria-label={historyTitle}>
            <table className="drv-del-table">
              <thead>
                <tr>
                  <th className="drv-del-col-id" scope="col">{t('ui.pages.driver.list.jobId')}</th>
                  <th className="drv-del-col-order" scope="col">Order</th>
                  <th className="drv-del-col-status" scope="col">{t('ui.pages.driver.list.status')}</th>
                  <th className="drv-del-col-address" scope="col">
                    {tUi('ui.pages.driver.driverJobHistory.pickupLocation_04b6e477ab')}
                  </th>
                  <th className="drv-del-col-address" scope="col">
                    {tUi('ui.pages.driver.driverJobHistory.deliveryLocation_ef31514d2e')}
                  </th>
                  <th className="drv-del-col-date" scope="col">{t('ui.pages.driver.list.updated')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job, index) => {
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
                          {job.pickup_address || tUi('ui.pages.driver.driverJobHistory.pickupLocation_04b6e477ab')}
                        </td>
                        <td className="drv-del-col-address">
                          {job.delivery_address || tUi('ui.pages.driver.driverJobHistory.deliveryLocation_ef31514d2e')}
                        </td>
                        <td className="drv-del-col-date">{formatDateTime(job.updated_at)}</td>
                      </motion.tr>

                      {isExpanded && (
                        <tr className="drv-del-expanded-row">
                          <td colSpan="6">
                            <div
                              className="drv-del-job-detail"
                              onClick={(e) => e.stopPropagation()}
                              role="region"
                            >
                              <header className="drv-del-job-header">
                                <div className="drv-del-job-header-copy">
                                  <p className="drv-del-job-kicker">
                                    {t('ui.pages.driver.list.jobDetails', { id: job.id })}
                                  </p>
                                  <h3 className="drv-del-job-title">
                                    {tUi('ui.pages.driver.driverJobHistory.order_e3bc2a2215')}
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

                              <div className="drv-del-detail-grid">
                                <div className="drv-del-detail-card">
                                  <h4>{tUi('ui.pages.driver.driverJobHistory.pickupLocation_04b6e477ab')}</h4>
                                  <p>{job.pickup_address || tUi('ui.pages.driver.driverJobHistory.pickupLocation_04b6e477ab')}</p>
                                </div>
                                <div className="drv-del-detail-card">
                                  <h4>{tUi('ui.pages.driver.driverJobHistory.deliveryLocation_ef31514d2e')}</h4>
                                  <p>{job.delivery_address || tUi('ui.pages.driver.driverJobHistory.deliveryLocation_ef31514d2e')}</p>
                                </div>
                                <div className="drv-del-detail-card">
                                  <h4>{t('ui.pages.driver.list.customer')}</h4>
                                  <p>{customerName || tUi('ui.pages.driver.driverMap.nA_de3570823c')}</p>
                                </div>
                                <div className="drv-del-detail-card">
                                  <h4>{t('ui.pages.driver.list.updated')}</h4>
                                  <p>{formatDateTime(job.updated_at)}</p>
                                </div>
                              </div>

                              {job.items?.length > 0 && (
                                <div className="drv-del-items-list">
                                  {job.items.map((item, idx) => (
                                    <span key={idx} className="drv-del-item-tag">
                                      {item.product?.name} x{item.quantity}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {job.issue_description && (
                                <div className="drv-del-detail-card">
                                  <h4>{tUi('ui.pages.driver.driverJobHistory.issueReported_60b7dd8f5f')}</h4>
                                  <p>{job.issue_description}</p>
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

export default DriverJobHistory;
