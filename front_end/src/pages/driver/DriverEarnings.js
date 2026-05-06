import React, { useState, useEffect } from 'react';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import { toast } from 'react-toastify';
import { formatPrice } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/driver/DriverEarnings.css';

const DriverEarnings = () => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPayout, setProcessingPayout] = useState(false);

  useEffect(() => {
    const fetchEarningsData = async () => {
      try {
        const [summaryRes, historyRes] = await Promise.all([
          http.get(DELIVERY_ENDPOINTS.EARNINGS),
          http.get(DELIVERY_ENDPOINTS.EARNINGS_HISTORY)
        ]);
        setSummary(summaryRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        console.error('Error fetching earnings data:', error);
        toast.error('Failed to load earnings data');
      } finally {
        setLoading(false);
      }
    };
    fetchEarningsData();
  }, []);

  const handleRequestPayout = async () => {
    if (!summary || summary.pending_payout <= 0) {
      toast.info('No pending earnings to pay out');
      return;
    }

    setProcessingPayout(true);
    try {
      await http.post(DELIVERY_ENDPOINTS.PAYOUT, {});
      toast.success('Payout request submitted successfully!');
      
      // Refresh data
      const [summaryRes, historyRes] = await Promise.all([
        http.get(DELIVERY_ENDPOINTS.EARNINGS),
        http.get(DELIVERY_ENDPOINTS.EARNINGS_HISTORY)
      ]);
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
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="driver-earnings-page">
      <h1>Earnings & Payouts</h1>

      <div className="earnings-overview-grid">
        <div className="earnings-summary-card primary">
          <div className="card-label">Pending Payout</div>
          <div className="card-value large">{formatPrice(summary?.pending_payout || 0)}</div>
          <button 
            className="btn-payout" 
            onClick={handleRequestPayout}
            disabled={processingPayout || !summary || summary.pending_payout <= 0}
          >
            {processingPayout ? 'Processing...' : 'Request Payout'}
          </button>
        </div>

        <div className="earnings-summary-card">
          <div className="card-label">Today</div>
          <div className="card-value">{formatPrice(summary?.today || 0)}</div>
        </div>

        <div className="earnings-summary-card">
          <div className="card-label">This Week</div>
          <div className="card-value">{formatPrice(summary?.this_week || 0)}</div>
        </div>

        <div className="earnings-summary-card">
          <div className="card-label">This Month</div>
          <div className="card-value">{formatPrice(summary?.this_month || 0)}</div>
        </div>
      </div>

      <div className="earnings-stats-row">
        <div className="stat-item">
          <span className="stat-icon">📦</span>
          <div className="stat-text">
            <strong>{summary?.total_deliveries || 0}</strong>
            <span>Total Deliveries</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <div className="stat-text">
            <strong>{formatPrice(summary?.total || 0)}</strong>
            <span>Lifetime Earnings</span>
          </div>
        </div>
      </div>

      <div className="earnings-history-section">
        <h2>Earnings History</h2>
        {history.length === 0 ? (
          <div className="no-history-msg">No earnings history found.</div>
        ) : (
          <div className="earnings-table-container">
            <table className="earnings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order #</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.created_at).toLocaleDateString()}</td>
                    <td>#{record.delivery_job_id}</td>
                    <td className="amount-cell">{formatPrice(record.amount || 0)}</td>
                    <td>
                      <span className={`payout-status ${record.status}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverEarnings;
