import { tUi } from "../../i18n/uiText";import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { INSTALLMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate, getImageUrl } from '../../utils/helpers';
import { useCurrency } from '../../hooks/useCurrency';
import { useConfirm } from '../../hooks/useConfirm';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminInstallments.css';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];
const REQUIRED_DOCUMENT_TYPES = ['id_front', 'id_back', 'selfie_with_id'];
const DOCUMENT_TYPE_LABEL_KEYS = {
  id_front: 'ui.pages.installments.idFront_04251d900b',
  id_back: 'ui.pages.installments.idBack_399ed188f3',
  selfie_with_id: 'ui.pages.installments.selfieWithId_a6ec1c3822',
};

const INSTALLMENT_STATUS_LABEL_KEYS = {
  pending: 'ui.pages.installments.status.pending',
  approved: 'ui.pages.installments.status.approved',
  rejected: 'ui.pages.installments.status.rejected',
  cancelled: 'ui.pages.installments.status.cancelled',
  canceled: 'ui.pages.installments.status.cancelled',
  completed: 'ui.pages.installments.status.completed',
  paid: 'ui.pages.installments.status.paid',
  failed: 'ui.pages.installments.status.failed',
  created: 'ui.pages.installments.status.created',
};

const statusLabel = (status) => {
  const normalized = String(status || 'pending').toLowerCase();
  const key = INSTALLMENT_STATUS_LABEL_KEYS[normalized];
  if (key) return tUi(key);
  return normalized.replace(/_/g, ' ');
};

const AdminInstallments = () => {
  const { formatCurrency } = useCurrency();
  const confirm = useConfirm();
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
        request_id: selectedRequest.id
      });
      await http.patch(url, {
        action,
        admin_note: adminNote.trim() || null
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
    const confirmed = await confirm({
      title: tUi("ui.pages.admin.adminInstallments.cancelInstallmentRequest_258ff5e706"),
      message: `Cancel installment request #${selectedRequest.id}?`,
      confirmText: tUi("ui.pages.admin.adminInstallments.cancelRequest_a6b7885506"),
      cancelText: tUi("ui.pages.admin.adminInstallments.keepRequest_6a95cf977a")
    });
    if (!confirmed) return;

    setCancellingRequest(true);
    try {
      const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.ADMIN_CANCEL, {
        request_id: selectedRequest.id
      });
      await http.patch(endpoint, {
        admin_note: adminNote.trim() || null
      });
      toast.success(tUi("ui.pages.admin.adminInstallments.installmentRequestCancelled_8b90ac9ba3"));
      fetchRequests();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel request');
    } finally {
      setCancellingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading admin-installments-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  const installmentTitle = tUi("ui.pages.admin.adminInstallments.installmentRequests_2fc67af45f");

  return (
    <div className="admin-page-shell admin-installments-page">
      <PageHeader
        kicker={installmentTitle}
        title={installmentTitle}
        actions={
        <div className="filter-group">
          <label htmlFor="status-filter">{tUi("ui.pages.admin.adminInstallments.status_757a85a464")}</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}>
            
            {STATUS_FILTERS.map((status) =>
            <option key={status} value={status}>
                {status === "all" ? tUi("ui.pages.admin.adminInstallments.all_cbfec376e0") : statusLabel(status)}
              </option>
            )}
          </select>
        </div>
        }
      />

      {requests.length === 0 ?
      <p className="empty-state">{tUi("ui.pages.admin.adminInstallments.noInstallmentRequestsForThis_a2ec84d62f")}</p> :

      <div className="admin-installments-grid">
          <section className="request-list-panel">
            <table>
              <thead>
                <tr>
                  <th>{tUi('ui.common.id')}</th>
                  <th>{tUi("ui.pages.admin.adminInstallments.customer_6bb072f714")}</th>
                  <th>{tUi("ui.pages.admin.adminInstallments.order_49f67d4db8")}</th>
                  <th>{tUi("ui.pages.admin.adminInstallments.total_e06af0484d")}</th>
                  <th>{tUi("ui.pages.admin.adminInstallments.remaining_4f3da92ffc")}</th>
                  <th>{tUi("ui.pages.admin.adminInstallments.status_757a85a464")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) =>
              <tr
                key={request.id}
                className={selectedRequestId === request.id ? "selected" : ''}
                onClick={() => setSelectedRequestId(request.id)}>
                
                    <td>#{request.id}</td>
                    <td>
                      <div>{request.user?.email || tUi("ui.pages.admin.adminInstallments.userValue_2bb65a2840", { value0: request.user_id })}</div>
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
              )}
              </tbody>
            </table>
          </section>

          <section className="request-details-panel">
            {!selectedRequest ?
          <p className="empty-state">{tUi("ui.pages.admin.adminInstallments.selectARequestToView_bb8fcc17be")}</p> :

          <>
                <h2>{tUi("ui.pages.admin.adminInstallments.request_be00a60c8a")}
              {selectedRequest.id}{tUi("ui.pages.admin.adminInstallments.order_8e5d31f868")}{selectedRequest.order_id}
                </h2>
                <div className="request-summary">
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.customer_0d91edca87")}</strong>{' '}
                    {selectedRequest.user?.email || tUi("ui.pages.admin.adminInstallments.userValue_2bb65a2840", { value0: selectedRequest.user_id })}
                  </p>
                  {selectedRequest.user?.phone &&
              <p>
                      <strong>{tUi("ui.pages.admin.adminInstallments.phone_792be90cbb")}</strong> {selectedRequest.user.phone}
                    </p>
              }
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.duration_8a9f6bac49")}</strong> {selectedRequest.duration_months}{tUi("ui.pages.admin.adminInstallments.months_194cd42615")}
              </p>
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.totalAmount_bf522a1f51")}</strong> {formatCurrency(selectedRequest.total_amount)}
                  </p>
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.remainingBalance_546b92638c")}</strong> {formatCurrency(selectedRequest.remaining_balance)}
                  </p>
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.monthlyPayment_c6144d075c")}</strong> {formatCurrency(selectedRequest.monthly_payment)}
                  </p>
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.nextPaymentDate_dd7feff4cb")}</strong>{' '}
                    {selectedRequest.next_payment_date ?
                formatDate(selectedRequest.next_payment_date) : tUi("ui.pages.admin.adminInstallments.notScheduled_983560543f")
                }
                  </p>
                  <p>
                    <strong>{tUi("ui.pages.admin.adminInstallments.created_bf6813b664")}</strong> {formatDate(selectedRequest.created_at)}
                  </p>
                </div>

                {selectedRequest.user_note &&
            <p className="note-block">
                    <strong>{tUi("ui.pages.admin.adminInstallments.userNote_9a1c56bb0b")}</strong> {selectedRequest.user_note}
                  </p>
            }

                <div className="documents-grid">
                  {REQUIRED_DOCUMENT_TYPES.map((documentType) => {
                const document = (selectedRequest.documents || []).find(
                  (doc) => doc.document_type === documentType
                );
                const documentLabel = tUi(DOCUMENT_TYPE_LABEL_KEYS[documentType] || documentType);
                if (!document) {
                  return (
                    <div key={`missing-${documentType}`} className="admin-document-missing">
                          <strong>{documentLabel}</strong>
                          <span>{tUi("ui.pages.admin.adminInstallments.notUploaded_b78a3d1521")}</span>
                        </div>);

                }
                return (
                  <a
                    key={document.id}
                    href={getImageUrl(document.file_path)}
                    target="_blank"
                    rel="noreferrer">
                    
                        <img src={getImageUrl(document.file_path)} alt={documentLabel} />
                        <span>{documentLabel}</span>
                      </a>);

              })}
                </div>

                {selectedRequest.status === "pending" &&
            <div className="review-section">
                    <label htmlFor="admin-note">{tUi("ui.pages.admin.adminInstallments.adminNote_ea6470d41f")}</label>
                    <textarea
                id="admin-note"
                rows={3}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)} />
              
                    <div className="review-actions">
                      <button
                  className="btn-approve"
                  onClick={() => handleReview("approve")}
                  disabled={savingReview}>{tUi("ui.pages.admin.adminInstallments.approve_1d97c149aa")}


                </button>
                      <button
                  className="btn-reject"
                  onClick={() => handleReview("reject")}
                  disabled={savingReview}>{tUi("ui.pages.admin.adminInstallments.reject_b300f1d667")}


                </button>
                    </div>
                  </div>
            }

                {selectedRequest.status !== "completed" && selectedRequest.status !== "cancelled" && selectedRequest.status !== "approved" &&
            <div className="review-section">
                    <button
                className="btn-cancel-request"
                onClick={handleCancelRequest}
                disabled={cancellingRequest}>
                
                      {cancellingRequest ? tUi("ui.pages.admin.adminInstallments.cancelling_23939436ee") : tUi("ui.pages.admin.adminInstallments.cancelRequest_a6b7885506")}
                    </button>
                  </div>
            }

                {selectedRequest.schedules?.length > 0 &&
            <div className="schedule-section">
                    <h3>{tUi("ui.pages.admin.adminInstallments.paymentSchedule_779f92e1ea")}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{tUi("ui.pages.admin.adminInstallments.dueDate_b86b269e67")}</th>
                          <th>{tUi("ui.pages.admin.adminInstallments.amount_f04179eb75")}</th>
                          <th>{tUi("ui.pages.admin.adminInstallments.status_757a85a464")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.schedules.map((schedule) =>
                  <tr key={schedule.id}>
                            <td>{schedule.installment_number}</td>
                            <td>{formatDate(schedule.due_date)}</td>
                            <td>{formatCurrency(schedule.amount_due)}</td>
                            <td>{statusLabel(schedule.status)}</td>
                          </tr>
                  )}
                      </tbody>
                    </table>
                  </div>
            }

                {selectedRequest.payments?.length > 0 &&
            <div className="history-section">
                    <h3>{tUi("ui.pages.admin.adminInstallments.paymentHistory_f1eac32837")}</h3>
                    <ul>
                      {[...(selectedRequest.payments || [])]
                .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                .map((payment) =>
                <li key={payment.id}>
                          {formatDate(payment.paid_at)} - {formatCurrency(payment.amount)}
                          {payment.note ? tUi("ui.pages.admin.adminInstallments.value_0e4b2e2dbc", { value0: payment.note }) : ''}
                        </li>
                )}
                    </ul>
                  </div>
            }
              </>
          }
          </section>
        </div>
      }
    </div>);

};

export default AdminInstallments;
