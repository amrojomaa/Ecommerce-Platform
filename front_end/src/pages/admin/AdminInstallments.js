import { tUi } from '../../i18n/uiText';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { INSTALLMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate, getImageUrl } from '../../utils/helpers';
import { useCurrency } from '../../hooks/useCurrency';
import { useConfirm } from '../../hooks/useConfirm';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminInstallments.css';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];
const REQUIRED_DOCUMENT_TYPES = ['id_front', 'id_back', 'selfie_with_id'];
const DOCUMENT_TYPE_LABEL_KEYS = {
  id_front: 'ui.pages.installments.idFront_04251d900b',
  id_back: 'ui.pages.installments.idBack_399ed188f3',
  selfie_with_id: 'ui.pages.installments.selfieWithId_a6ec1c3822'
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
  created: 'ui.pages.installments.status.created'
};

const statusLabel = (status) => {
  const normalized = String(status || 'pending').toLowerCase();
  const key = INSTALLMENT_STATUS_LABEL_KEYS[normalized];
  if (key) return tUi(key);
  return normalized.replace(/_/g, ' ');
};

const formatFilterLabel = (status) => {
  if (status === 'all') return tUi('ui.pages.admin.adminInstallments.all_cbfec376e0');
  return statusLabel(status);
};

const AdminInstallments = () => {
  const { t } = useTranslation();
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
      title: tUi('ui.pages.admin.adminInstallments.cancelInstallmentRequest_258ff5e706'),
      message: `Cancel installment request #${selectedRequest.id}?`,
      confirmText: tUi('ui.pages.admin.adminInstallments.cancelRequest_a6b7885506'),
      cancelText: tUi('ui.pages.admin.adminInstallments.keepRequest_6a95cf977a')
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
      toast.success(tUi('ui.pages.admin.adminInstallments.installmentRequestCancelled_8b90ac9ba3'));
      fetchRequests();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel request');
    } finally {
      setCancellingRequest(false);
    }
  };

  const installmentTitle = tUi('ui.pages.admin.adminInstallments.installmentRequests_2fc67af45f');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });
  const requestCountLabel =
    requests.length === 1
      ? tUi('ui.pages.admin.adminInstallments.requestSingular_8a1b2c3d4e')
      : tUi('ui.pages.admin.adminInstallments.requestsPlural_9b2c3d4e5f');

  return (
    <div className="admin-page-shell adm-page adm-inst-page">
      <PageHeader
        kicker={panelKicker}
        title={installmentTitle}
        subtitle={tUi('ui.pages.admin.adminInstallments.subtitle_1a2b3c4d5f')}
        actions={
          <div className="adm-inst-header-filter">
            <div className="adm-inst-filter-row">
              <label className="adm-inst-filter-label" htmlFor="adm-inst-status-filter">
                {tUi('ui.pages.admin.adminInstallments.filterByStatus_c1d2e3f4a5')}
              </label>
              <select
                id="adm-inst-status-filter"
                className="adm-inst-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {formatFilterLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-inst-header-meta" aria-live="polite">
              <strong>{requests.length}</strong> {requestCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-inst-section">
        {loading ? (
          <div className="adm-inst-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : requests.length === 0 ? (
          <div className="adm-inst-empty">
            <p>{tUi('ui.pages.admin.adminInstallments.noInstallmentRequestsForThis_a2ec84d62f')}</p>
          </div>
        ) : (
          <div className="adm-inst-layout">
            <div className="adm-inst-list-panel">
              <div className="adm-inst-data-panel" role="region" aria-label={installmentTitle}>
                <table className="adm-inst-table">
                  <thead>
                    <tr>
                      <th className="adm-inst-col-id" scope="col">
                        {tUi('ui.common.id')}
                      </th>
                      <th className="adm-inst-col-customer" scope="col">
                        {tUi('ui.pages.admin.adminInstallments.customer_6bb072f714')}
                      </th>
                      <th className="adm-inst-col-order" scope="col">
                        {tUi('ui.pages.admin.adminInstallments.order_49f67d4db8')}
                      </th>
                      <th className="adm-inst-col-total" scope="col">
                        {tUi('ui.pages.admin.adminInstallments.total_e06af0484d')}
                      </th>
                      <th className="adm-inst-col-remaining" scope="col">
                        {tUi('ui.pages.admin.adminInstallments.remaining_4f3da92ffc')}
                      </th>
                      <th className="adm-inst-col-status" scope="col">
                        {tUi('ui.pages.admin.adminInstallments.status_757a85a464')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request, index) => (
                      <motion.tr
                        key={request.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={selectedRequestId === request.id ? 'is-selected' : ''}
                        onClick={() => setSelectedRequestId(request.id)}
                      >
                        <td className="adm-inst-col-id adm-inst-id">#{request.id}</td>
                        <td className="adm-inst-col-customer">
                          <div className="adm-inst-customer">
                            <span className="adm-inst-customer-name">
                              {request.user?.email ||
                                tUi('ui.pages.admin.adminInstallments.userValue_2bb65a2840', {
                                  value0: request.user_id
                                })}
                            </span>
                            {request.user?.phone && (
                              <span className="adm-inst-customer-meta">{request.user.phone}</span>
                            )}
                          </div>
                        </td>
                        <td className="adm-inst-col-order">#{request.order_id}</td>
                        <td className="adm-inst-col-total adm-inst-amount">
                          {formatCurrency(request.total_amount)}
                        </td>
                        <td className="adm-inst-col-remaining adm-inst-amount">
                          {formatCurrency(request.remaining_balance)}
                        </td>
                        <td className="adm-inst-col-status">
                          <span
                            className={`adm-inst-status adm-inst-status--${(request.status || 'pending').toLowerCase()}`}
                          >
                            {statusLabel(request.status)}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="adm-inst-detail-panel">
              {!selectedRequest ? (
                <div className="adm-inst-detail-empty">
                  <p>{tUi('ui.pages.admin.adminInstallments.selectARequestToView_bb8fcc17be')}</p>
                </div>
              ) : (
                <>
                  <header className="adm-inst-detail-header">
                    <h2 className="adm-inst-detail-title">
                      {tUi('ui.pages.admin.adminInstallments.request_be00a60c8a')}
                      {selectedRequest.id}
                      <span className="adm-inst-detail-subtitle">
                        {tUi('ui.pages.admin.adminInstallments.order_8e5d31f868')}
                        {selectedRequest.order_id}
                      </span>
                    </h2>
                    <span
                      className={`adm-inst-status adm-inst-status--${(selectedRequest.status || 'pending').toLowerCase()}`}
                    >
                      {statusLabel(selectedRequest.status)}
                    </span>
                  </header>

                  <div className="adm-inst-summary">
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.customer_0d91edca87')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {selectedRequest.user?.email ||
                          tUi('ui.pages.admin.adminInstallments.userValue_2bb65a2840', {
                            value0: selectedRequest.user_id
                          })}
                      </span>
                    </div>
                    {selectedRequest.user?.phone && (
                      <div className="adm-inst-summary-item">
                        <span className="adm-inst-summary-label">
                          {tUi('ui.pages.admin.adminInstallments.phone_792be90cbb')}
                        </span>
                        <span className="adm-inst-summary-value">{selectedRequest.user.phone}</span>
                      </div>
                    )}
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.duration_8a9f6bac49')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {selectedRequest.duration_months}
                        {tUi('ui.pages.admin.adminInstallments.months_194cd42615')}
                      </span>
                    </div>
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.totalAmount_bf522a1f51')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {formatCurrency(selectedRequest.total_amount)}
                      </span>
                    </div>
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.remainingBalance_546b92638c')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {formatCurrency(selectedRequest.remaining_balance)}
                      </span>
                    </div>
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.monthlyPayment_c6144d075c')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {formatCurrency(selectedRequest.monthly_payment)}
                      </span>
                    </div>
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.nextPaymentDate_dd7feff4cb')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {selectedRequest.next_payment_date
                          ? formatDate(selectedRequest.next_payment_date)
                          : tUi('ui.pages.admin.adminInstallments.notScheduled_983560543f')}
                      </span>
                    </div>
                    <div className="adm-inst-summary-item">
                      <span className="adm-inst-summary-label">
                        {tUi('ui.pages.admin.adminInstallments.created_bf6813b664')}
                      </span>
                      <span className="adm-inst-summary-value">
                        {formatDate(selectedRequest.created_at)}
                      </span>
                    </div>
                  </div>

                  {selectedRequest.user_note && (
                    <div className="adm-inst-note-block">
                      <strong>{tUi('ui.pages.admin.adminInstallments.userNote_9a1c56bb0b')}</strong>
                      <p>{selectedRequest.user_note}</p>
                    </div>
                  )}

                  <section className="adm-inst-documents-section">
                    <h3 className="adm-inst-section-title">
                      {tUi('ui.pages.admin.adminInstallments.verificationDocuments_b2c3d4e5f6')}
                    </h3>
                    <div className="adm-inst-documents-grid">
                      {REQUIRED_DOCUMENT_TYPES.map((documentType) => {
                        const document = (selectedRequest.documents || []).find(
                          (doc) => doc.document_type === documentType
                        );
                        const documentLabel = tUi(
                          DOCUMENT_TYPE_LABEL_KEYS[documentType] || documentType
                        );
                        if (!document) {
                          return (
                            <div key={`missing-${documentType}`} className="adm-inst-document-missing">
                              <strong>{documentLabel}</strong>
                              <span>{tUi('ui.pages.admin.adminInstallments.notUploaded_b78a3d1521')}</span>
                            </div>
                          );
                        }
                        return (
                          <a
                            key={document.id}
                            className="adm-inst-document-card"
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
                  </section>

                  {selectedRequest.status === 'pending' && (
                    <section className="adm-inst-review-section">
                      <label className="adm-inst-field-label" htmlFor="admin-note">
                        {tUi('ui.pages.admin.adminInstallments.adminNote_ea6470d41f')}
                      </label>
                      <textarea
                        id="admin-note"
                        className="adm-inst-textarea"
                        rows={3}
                        value={adminNote}
                        onChange={(event) => setAdminNote(event.target.value)}
                      />
                      <div className="adm-inst-review-actions">
                        <button
                          type="button"
                          className="adm-inst-btn-approve"
                          onClick={() => handleReview('approve')}
                          disabled={savingReview}
                        >
                          {tUi('ui.pages.admin.adminInstallments.approve_1d97c149aa')}
                        </button>
                        <button
                          type="button"
                          className="adm-inst-btn-reject"
                          onClick={() => handleReview('reject')}
                          disabled={savingReview}
                        >
                          {tUi('ui.pages.admin.adminInstallments.reject_b300f1d667')}
                        </button>
                      </div>
                    </section>
                  )}

                  {selectedRequest.status !== 'completed' &&
                    selectedRequest.status !== 'cancelled' &&
                    selectedRequest.status !== 'approved' && (
                      <section className="adm-inst-review-section">
                        <button
                          type="button"
                          className="adm-inst-btn-cancel"
                          onClick={handleCancelRequest}
                          disabled={cancellingRequest}
                        >
                          {cancellingRequest
                            ? tUi('ui.pages.admin.adminInstallments.cancelling_23939436ee')
                            : tUi('ui.pages.admin.adminInstallments.cancelRequest_a6b7885506')}
                        </button>
                      </section>
                    )}

                  {selectedRequest.schedules?.length > 0 && (
                    <section className="adm-inst-schedule-section">
                      <h3 className="adm-inst-section-title">
                        {tUi('ui.pages.admin.adminInstallments.paymentSchedule_779f92e1ea')}
                      </h3>
                      <div className="adm-inst-schedule-panel">
                        <table className="adm-inst-schedule-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>{tUi('ui.pages.admin.adminInstallments.dueDate_b86b269e67')}</th>
                              <th>{tUi('ui.pages.admin.adminInstallments.amount_f04179eb75')}</th>
                              <th>{tUi('ui.pages.admin.adminInstallments.status_757a85a464')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRequest.schedules.map((schedule) => (
                              <tr key={schedule.id}>
                                <td>{schedule.installment_number}</td>
                                <td>{formatDate(schedule.due_date)}</td>
                                <td>{formatCurrency(schedule.amount_due)}</td>
                                <td>
                                  <span
                                    className={`adm-inst-status adm-inst-status--${(schedule.status || 'pending').toLowerCase()}`}
                                  >
                                    {statusLabel(schedule.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {selectedRequest.payments?.length > 0 && (
                    <section className="adm-inst-history-section">
                      <h3 className="adm-inst-section-title">
                        {tUi('ui.pages.admin.adminInstallments.paymentHistory_f1eac32837')}
                      </h3>
                      <ul className="adm-inst-history-list">
                        {[...(selectedRequest.payments || [])]
                          .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                          .map((payment) => (
                            <li key={payment.id}>
                              {formatDate(payment.paid_at)} — {formatCurrency(payment.amount)}
                              {payment.note
                                ? tUi('ui.pages.admin.adminInstallments.value_0e4b2e2dbc', {
                                    value0: payment.note
                                  })
                                : ''}
                            </li>
                          ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminInstallments;
