import React, { useState, useEffect } from 'react';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/pages/driver/DriverJobHistory.css';

const DriverJobHistory = () => {
  const { formatCurrency } = useCurrency();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await http.get(DELIVERY_ENDPOINTS.JOB_HISTORY);
        setJobs(response.data);
      } catch (error) {
        console.error('Error fetching job history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const historyTitle = tUi('ui.pages.driver.driverJobHistory.deliveryHistory_ddfd66f8b3');

  return (
    <div className="page-shell job-history-page">
      <PageHeader
        kicker={historyTitle}
        title={historyTitle}
        actions={
          <div className="history-filters">
            <button
              type="button"
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {tUi('ui.pages.driver.driverJobHistory.all_8807f0de5d')}
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              {tUi('ui.pages.driver.driverJobHistory.delivered_08a781473b')}
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
              onClick={() => setFilter('cancelled')}
            >
              {tUi('ui.pages.driver.driverJobHistory.cancelled_3252a4cd97')}
            </button>
          </div>
        }
      />

      {filteredJobs.length === 0 ?
      <div className="no-history">
          <div className="no-history-icon">📋</div>
          <h2>{tUi("ui.pages.driver.driverJobHistory.noDeliveriesYet_3d3c839a33")}</h2>
          <p>{tUi("ui.pages.driver.driverJobHistory.yourCompletedDeliveriesWillAppear_d2de11ec07")}</p>
        </div> :

      <div className="history-list">
          {filteredJobs.map((job) =>
        <div key={job.id} className="history-card">
              <div className="history-card-header">
                <div className="history-order-info">
                  <span className="history-order-id">{tUi("ui.pages.driver.driverJobHistory.order_e3bc2a2215")}{job.order_id}</span>
                  <span className="history-date">
                    {formatDateTime(job.updated_at)}
                  </span>
                </div>
                <div className="history-right">
                  <span className={`history-status-badge ${job.status}`}>
                    {job.status === "delivered" ? tUi("ui.pages.driver.driverJobHistory.delivered_1ef054d0f6") : tUi("ui.pages.driver.driverJobHistory.cancelled_a33d0dba64")}
                  </span>
                  <span className="history-amount">{formatCurrency(job.payment_amount || 0)}</span>
                </div>
              </div>
              <div className="history-card-body">
                <div className="history-route">
                  <div className="route-point">
                    <span className="route-dot pickup-dot" />
                    <span>{job.pickup_address || tUi("ui.pages.driver.driverJobHistory.pickupLocation_04b6e477ab")}</span>
                  </div>
                  <div className="route-line" />
                  <div className="route-point">
                    <span className="route-dot delivery-dot" />
                    <span>{job.delivery_address || tUi("ui.pages.driver.driverJobHistory.deliveryLocation_ef31514d2e")}</span>
                  </div>
                </div>
                {job.customer &&
            <div className="history-customer">
                    👤 {job.customer.first_name} {job.customer.last_name}
                  </div>
            }
                {job.items && job.items.length > 0 &&
            <div className="history-items">
                    {job.items.map((item, idx) =>
              <span key={idx} className="history-item-tag">
                        {item.product?.name} x{item.quantity}
                      </span>
              )}
                  </div>
            }
              </div>
              {job.issue_description &&
          <div className="history-issue">{tUi("ui.pages.driver.driverJobHistory.issueReported_60b7dd8f5f")}
            {job.issue_description}
                </div>
          }
            </div>
        )}
        </div>
      }
    </div>);

};

export default DriverJobHistory;
