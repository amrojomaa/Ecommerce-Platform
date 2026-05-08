import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { INSTALLMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate, getImageUrl } from '../../utils/helpers';
import { useCurrency } from '../../hooks/useCurrency';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminInstallments.css';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];
const REQUIRED_DOCUMENT_TYPES = ['id_front', 'id_back', 'selfie_with_id'];
const DOCUMENT_TYPE_LABELS = {
  id_front: 'ID Front',
  id_back: 'ID Back',
  selfie_with_id: 'Selfie with ID',
};

const statusLabel = (status) => (status || '').replace(/_/g, ' ') || 'pending';

const AdminInstallments = () => {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') {
        params.status_filter = statusFilter;
      }
      const response = await http.get(INSTALLMENT_ENDPOINTS.ADMIN_REQUESTS, { params });
      const next = Array.isArray(response.data) ? response.data : [];
      setRequests(next);

      if (!next.length) {
        setSelectedRequestId(null);
        setAdminNote('');
      } else if (!selectedRequestId || !next.some((entry) => entry.id === selectedRequestId)) {
        setSelectedRequestId(next[0].id);
        setAdminNote(next[0].admin_note || '');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load installment requests');
      setRequests([]);
      setSelectedRequestId(null);
      setAdminNote('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setAdminNote(selectedRequest?.admin_note || '');
  }, [selectedRequestId, selectedRequest?.admin_note]);

  const handleReview = async (action) => {
    if (!selectedRequest) return;

    setSavingReview(true);
    try {
      const url = buildUrl(INSTALLMENT_ENDPOINTS.ADMIN_REVIEW, {
        request_id: selectedRequest.id,
      });
      await http.patch(url, {
        action,
        admin_note: adminNote.trim() || null,
      });
      toast.success(`Request ${action}d successfully`);
      fetchRequests();
    } catch (error) {
      toast.error(error.message || `Failed to ${action} request`);
    } finally {
      setSavingReview(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedRequest) return;
    const confirmed = window.confirm(
      `Cancel installment request #${selectedRequest.id}?`
    );
    if (!confirmed) return;

    setCancellingRequest(true);
    try {
      const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.ADMIN_CANCEL, {
        request_id: selectedRequest.id,
      });
      await http.patch(endpoint, {
        admin_note: adminNote.trim() || null,
      });
      toast.success('Installment request cancelled');
      fetchRequests();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel request');
    } finally {
      setCancellingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-installments-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-installments-page">
      <div className="admin-installments-header">
        <h1>Installment Requests</h1>
        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All' : statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="empty-state">No installment requests for this filter.</p>
      ) : (
        <div className="admin-installments-grid">
          <section className="request-list-panel">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Total</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className={selectedRequestId === request.id ? 'selected' : ''}
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    <td>#{request.id}</td>
                    <td>
                      <div>{request.user?.email || `User #${request.user_id}`}</div>
                      {request.user?.phone && <small>{request.user.phone}</small>}
                    </td>
                    <td>#{request.order_id}</td>
                    <td>{formatCurrency(request.total_amount)}</td>
                    <td>{formatCurrency(request.remaining_balance)}</td>
                    <td>
                      <span className={`status-pill status-${request.status}`}>
                        {statusLabel(request.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="request-details-panel">
            {!selectedRequest ? (
              <p className="empty-state">Select a request to view details.</p>
            ) : (
              <>
                <h2>
                  Request #{selectedRequest.id} - Order #{selectedRequest.order_id}
                </h2>
                <div className="request-summary">
                  <p>
                    <strong>Customer:</strong>{' '}
                    {selectedRequest.user?.email || `User #${selectedRequest.user_id}`}
                  </p>
                  {selectedRequest.user?.phone && (
                    <p>
                      <strong>Phone:</strong> {selectedRequest.user.phone}
                    </p>
                  )}
                  <p>
                    <strong>Duration:</strong> {selectedRequest.duration_months} months
                  </p>
                  <p>
                    <strong>Total amount:</strong> {formatCurrency(selectedRequest.total_amount)}
                  </p>
                  <p>
                    <strong>Remaining balance:</strong> {formatCurrency(selectedRequest.remaining_balance)}
                  </p>
                  <p>
                    <strong>Monthly payment:</strong> {formatCurrency(selectedRequest.monthly_payment)}
                  </p>
                  <p>
                    <strong>Next payment date:</strong>{' '}
                    {selectedRequest.next_payment_date
                      ? formatDate(selectedRequest.next_payment_date)
                      : 'Not scheduled'}
                  </p>
                  <p>
                    <strong>Created:</strong> {formatDate(selectedRequest.created_at)}
                  </p>
                </div>

                {selectedRequest.user_note && (
                  <p className="note-block">
                    <strong>User note:</strong> {selectedRequest.user_note}
                  </p>
                )}

                <div className="documents-grid">
                  {REQUIRED_DOCUMENT_TYPES.map((documentType) => {
                    const document = (selectedRequest.documents || []).find(
                      (doc) => doc.document_type === documentType
                    );
                    const documentLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;
                    if (!document) {
                      return (
                        <div key={`missing-${documentType}`} className="admin-document-missing">
                          <strong>{documentLabel}</strong>
                          <span>Not uploaded</span>
                        </div>
                      );
                    }
                    return (
                      <a
                        key={document.id}
                        href={getImageUrl(document.file_path)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={getImageUrl(document.file_path)} alt={documentLabel} />
                        <span>{documentLabel}</span>
                      </a>
                    );
                  })}
                </div>

                {selectedRequest.status === 'pending' && (
                  <div className="review-section">
                    <label htmlFor="admin-note">Admin note</label>
                    <textarea
                      id="admin-note"
                      rows={3}
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                    />
                    <div className="review-actions">
                      <button
                        className="btn-approve"
                        onClick={() => handleReview('approve')}
                        disabled={savingReview}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-reject"
                        onClick={() => handleReview('reject')}
                        disabled={savingReview}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {selectedRequest.status !== 'completed' && selectedRequest.status !== 'cancelled' && (
                  <div className="review-section">
                    <button
                      className="btn-cancel-request"
                      onClick={handleCancelRequest}
                      disabled={cancellingRequest}
                    >
                      {cancellingRequest ? 'Cancelling...' : 'Cancel request'}
                    </button>
                  </div>
                )}

                {selectedRequest.schedules?.length > 0 && (
                  <div className="schedule-section">
                    <h3>Payment Schedule</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Due date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.schedules.map((schedule) => (
                          <tr key={schedule.id}>
                            <td>{schedule.installment_number}</td>
                            <td>{formatDate(schedule.due_date)}</td>
                            <td>{formatCurrency(schedule.amount_due)}</td>
                            <td>{statusLabel(schedule.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedRequest.payments?.length > 0 && (
                  <div className="history-section">
                    <h3>Payment History</h3>
                    <ul>
                      {[...(selectedRequest.payments || [])]
                        .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                        .map((payment) => (
                        <li key={payment.id}>
                          {formatDate(payment.paid_at)} - {formatCurrency(payment.amount)}
                          {payment.note ? ` (${payment.note})` : ''}
                        </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminInstallments;
