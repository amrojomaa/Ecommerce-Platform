import React, { useState, useEffect } from 'react';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDate } from '../../utils/helpers';
import '../../styles/pages/driver/DriverEarnings.css';

const DriverEarnings = () => {
  const { formatCurrency } = useCurrency();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPayout, setProcessingPayout] = useState(false);

  useEffect(() => {
    const fetchEarningsData = async () => {
      try {
        const [summaryRes, historyRes] = await Promise.all([
        http.get(DELIVERY_ENDPOINTS.EARNINGS),
        http.get(DELIVERY_ENDPOINTS.EARNINGS_HISTORY)]
        );
        setSummary(summaryRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        console.error('Error fetching earnings data:', error);
        toast.error(tUi("ui.pages.driver.driverEarnings.failedToLoadEarningsData_e0e2fc8d66"));
      } finally {
        setLoading(false);
      }
    };
    fetchEarningsData();
  }, []);

  const handleRequestPayout = async () => {
    if (!summary || summary.pending_payout <= 0) {
      toast.info(tUi("ui.pages.driver.driverEarnings.noPendingEarningsToPay_e18855df13"));
      return;
    }

    setProcessingPayout(true);
    try {
      await http.post(DELIVERY_ENDPOINTS.PAYOUT, {});
      toast.success(tUi("ui.pages.driver.driverEarnings.payoutRequestSubmittedSuccessfully_2dbbb11a7a"));

      // Refresh data
      const [summaryRes, historyRes] = await Promise.all([
      http.get(DELIVERY_ENDPOINTS.EARNINGS),
      http.get(DELIVERY_ENDPOINTS.EARNINGS_HISTORY)]
      );
      setSummary(summaryRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request payout');
    } finally {
      setProcessingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const earningsTitle = tUi('ui.pages.driver.driverEarnings.earningsPayouts_cb8c09547c');

  return (
    <div className="page-shell driver-earnings-page">
      <PageHeader kicker={earningsTitle} title={earningsTitle} />

      <div className="earnings-overview-grid">
        <div className="earnings-summary-card primary">
          <div className="card-label">{tUi("ui.pages.driver.driverEarnings.pendingPayout_e57b17d964")}</div>
          <div className="card-value large">{formatCurrency(summary?.pending_payout || 0)}</div>
          <button
            className="btn-payout"
            onClick={handleRequestPayout}
            disabled={processingPayout || !summary || summary.pending_payout <= 0}>
            
            {processingPayout ? tUi("ui.pages.driver.driverEarnings.processing_6a4ff7de84") : tUi("ui.pages.driver.driverEarnings.requestPayout_af6c64d8c6")}
          </button>
        </div>

        <div className="earnings-summary-card">
          <div className="card-label">{tUi("ui.pages.driver.driverEarnings.today_0eb7833347")}</div>
          <div className="card-value">{formatCurrency(summary?.today || 0)}</div>
        </div>

        <div className="earnings-summary-card">
          <div className="card-label">{tUi("ui.pages.driver.driverEarnings.thisWeek_eaf4b87116")}</div>
          <div className="card-value">{formatCurrency(summary?.this_week || 0)}</div>
        </div>

        <div className="earnings-summary-card">
          <div className="card-label">{tUi("ui.pages.driver.driverEarnings.thisMonth_ea7f06a218")}</div>
          <div className="card-value">{formatCurrency(summary?.this_month || 0)}</div>
        </div>
      </div>

      <div className="earnings-stats-row">
        <div className="stat-item">
          <span className="stat-icon">📦</span>
          <div className="stat-text">
            <strong>{summary?.total_deliveries || 0}</strong>
            <span>{tUi("ui.pages.driver.driverEarnings.totalDeliveries_b28c9d3b84")}</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <div className="stat-text">
            <strong>{formatCurrency(summary?.total || 0)}</strong>
            <span>{tUi("ui.pages.driver.driverEarnings.lifetimeEarnings_3f9e4da8b0")}</span>
          </div>
        </div>
      </div>

      <div className="earnings-history-section">
        <h2>{tUi("ui.pages.driver.driverEarnings.earningsHistory_52e49ca4ea")}</h2>
        {history.length === 0 ?
        <div className="no-history-msg">{tUi("ui.pages.driver.driverEarnings.noEarningsHistoryFound_fcf8028cd4")}</div> :

        <div className="earnings-table-container">
            <table className="earnings-table">
              <thead>
                <tr>
                  <th>{tUi("ui.pages.driver.driverEarnings.date_253e342629")}</th>
                  <th>{tUi("ui.pages.driver.driverEarnings.order_4b6d66a536")}</th>
                  <th>{tUi("ui.pages.driver.driverEarnings.amount_69f15690a6")}</th>
                  <th>{tUi("ui.pages.driver.driverEarnings.status_84a968f338")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) =>
              <tr key={record.id}>
                    <td>{formatDate(record.created_at, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>#{record.delivery_job_id}</td>
                    <td className="amount-cell">{formatCurrency(record.amount || 0)}</td>
                    <td>
                      <span className={`payout-status ${record.status}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>);

};

export default DriverEarnings;
