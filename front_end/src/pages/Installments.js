import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import http from '../services/http';
import { INSTALLMENT_ENDPOINTS, ORDER_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate, getImageUrl } from '../utils/helpers';
import { useCurrency } from '../hooks/useCurrency';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Installments.css';

const DURATION_OPTIONS = [3, 6, 9, 12, 18, 24];
const REQUIRED_DOCUMENT_TYPES = ['id_front', 'id_back', 'selfie_with_id'];
const DOCUMENT_TYPE_LABELS = {
  id_front: 'ID Front',
  id_back: 'ID Back',
  selfie_with_id: 'Selfie with ID',
};

const statusLabel = (status) => {
  if (!status) return 'pending';
  return status.replace(/_/g, ' ');
};

const Installments = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = Number(searchParams.get('orderId') || 0);
  const { formatCurrency } = useCurrency();
  const { fetchUserInfo } = useAuth();

  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [durationMonths, setDurationMonths] = useState(6);
  const [userNote, setUserNote] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [phoneForRequest, setPhoneForRequest] = useState('');
  const [isInformationConfirmed, setIsInformationConfirmed] = useState(false);
  const [files, setFiles] = useState({
    id_front: null,
    id_back: null,
    selfie_with_id: null,
  });
  const [filePreviews, setFilePreviews] = useState({
    id_front: '',
    id_back: '',
    selfie_with_id: '',
  });
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(() => Boolean(orderIdFromUrl));
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [requestSortDirection, setRequestSortDirection] = useState('desc');
  const idFrontInputRef = useRef(null);
  const idBackInputRef = useRef(null);
  const selfieInputRef = useRef(null);
  const previousStatusesRef = useRef({});
  const confirm = useConfirm();

  const selectedOrder = useMemo(
    () => orders.find((order) => Number(order.id) === Number(selectedOrderId)),
    [orders, selectedOrderId]
  );
  const selectedOrderItems = useMemo(
    () => selectedOrder?.items || selectedOrder?.orderitems || [],
    [selectedOrder]
  );
  const selectedItemsSubtotal = useMemo(
    () => selectedOrderItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [selectedOrderItems]
  );
  const selectedItemsDiscount = useMemo(() => {
    const orderSubtotal = selectedOrderItems.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0
    );
    const orderPromotionDiscount = Number(selectedOrder?.promotion_discount || 0);
    if (orderSubtotal <= 0 || orderPromotionDiscount <= 0) return 0;
    const ratio = Math.min(Math.max(selectedItemsSubtotal / orderSubtotal, 0), 1);
    return orderPromotionDiscount * ratio;
  }, [selectedOrderItems, selectedOrder?.promotion_discount, selectedItemsSubtotal]);
  const selectedItemsTotal = useMemo(
    () => Math.max(selectedItemsSubtotal - selectedItemsDiscount, 0),
    [selectedItemsSubtotal, selectedItemsDiscount]
  );
  const estimatedMonthlyPayment = useMemo(() => {
    if (!durationMonths) return 0;
    return selectedItemsTotal / durationMonths;
  }, [durationMonths, selectedItemsTotal]);
  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );
  const getEditingDocument = (documentType) => {
    if (!editingRequestId || !selectedRequest || selectedRequest.id !== editingRequestId) {
      return null;
    }
    return (
      selectedRequest.documents?.find((document) => document.document_type === documentType) || null
    );
  };
  const editingIdFrontDoc = getEditingDocument('id_front');
  const editingIdBackDoc = getEditingDocument('id_back');
  const editingSelfieDoc = getEditingDocument('selfie_with_id');
  const idFrontPreviewSrc = filePreviews.id_front || (editingIdFrontDoc ? getImageUrl(editingIdFrontDoc.file_path) : '');
  const idBackPreviewSrc = filePreviews.id_back || (editingIdBackDoc ? getImageUrl(editingIdBackDoc.file_path) : '');
  const selfiePreviewSrc =
    filePreviews.selfie_with_id || (editingSelfieDoc ? getImageUrl(editingSelfieDoc.file_path) : '');
  const sortedRequests = useMemo(() => {
    const list = [...requests];
    list.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return requestSortDirection === 'desc' ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [requests, requestSortDirection]);
  const hasPendingOrApprovedRequest = useMemo(
    () => requests.some((request) => ['pending', 'approved'].includes(request.status)),
    [requests]
  );
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await http.get(ORDER_ENDPOINTS.MY_ORDERS);
      const source = Array.isArray(response.data) ? response.data : [];
      const eligible = source.filter((order) => order.status === 'created');
      setOrders(eligible);
    } catch (error) {
      toast.error(error.message || 'Failed to load your orders');
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchRequests = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoadingRequests(true);
    }
    try {
      const response = await http.get(INSTALLMENT_ENDPOINTS.MY_REQUESTS);
      const nextRequests = Array.isArray(response.data) ? response.data : [];

      nextRequests.forEach((request) => {
        const previousStatus = previousStatusesRef.current[request.id];
        if (previousStatus === 'pending' && request.status === 'approved') {
          toast.success(`Installment request #${request.id} approved by admin`);
        }
      });
      previousStatusesRef.current = nextRequests.reduce((acc, request) => {
        acc[request.id] = request.status;
        return acc;
      }, {});

      setRequests(nextRequests);
    } catch (error) {
      if (showLoader) {
        toast.error(error.message || 'Failed to load installment requests');
        setRequests([]);
      }
    } finally {
      if (showLoader) {
        setLoadingRequests(false);
      }
    }
  }, []);

  const fetchMyInformation = async () => {
    setLoadingProfile(true);
    try {
      const response = await http.get(USER_ENDPOINTS.ME);
      const phone = (response?.data?.phone || '').trim();
      setProfilePhone(phone);
      if (phone) {
        setPhoneForRequest(phone);
      }
    } catch (error) {
      setProfilePhone('');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRequests(true);
    fetchMyInformation();
  }, [fetchRequests]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      fetchRequests(false);
    }, 20000);

    return () => window.clearInterval(refreshInterval);
  }, [fetchRequests]);

  useEffect(() => {
    if (!orders.length) {
      setSelectedOrderId('');
      return;
    }

    const preferredOrder = orderIdFromUrl && orders.some((order) => Number(order.id) === orderIdFromUrl)
      ? String(orderIdFromUrl)
      : String(orders[0].id);
    setSelectedOrderId(preferredOrder);
  }, [orders, orderIdFromUrl]);

  useEffect(() => {
    if (!requests.length) {
      setSelectedRequestId(null);
      setEditingRequestId(null);
      return;
    }
    if (!selectedRequestId || !requests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    if (hasPendingOrApprovedRequest && isCreateFormOpen && !editingRequestId) {
      setIsCreateFormOpen(false);
    }
  }, [hasPendingOrApprovedRequest, isCreateFormOpen, editingRequestId]);

  const handleOrderChange = (event) => {
    setSelectedOrderId(event.target.value);
  };

  const handleFileChange = (field, file) => {
    setFilePreviews((prev) => {
      if (prev[field]) {
        URL.revokeObjectURL(prev[field]);
      }
      return {
        ...prev,
        [field]: file ? URL.createObjectURL(file) : '',
      };
    });
    setFiles((prev) => ({
      ...prev,
      [field]: file || null,
    }));
  };

  const resetUploadFields = () => {
    if (idFrontInputRef.current) idFrontInputRef.current.value = '';
    if (idBackInputRef.current) idBackInputRef.current.value = '';
    if (selfieInputRef.current) selfieInputRef.current.value = '';

    setFilePreviews((prev) => {
      Object.values(prev).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      return {
        id_front: '',
        id_back: '',
        selfie_with_id: '',
      };
    });
    setFiles({
      id_front: null,
      id_back: null,
      selfie_with_id: null,
    });
  };

  useEffect(() => {
    return () => {
      Object.values(filePreviews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeSelectedFile = (field) => {
    if (field === 'id_front' && idFrontInputRef.current) {
      idFrontInputRef.current.value = '';
    } else if (field === 'id_back' && idBackInputRef.current) {
      idBackInputRef.current.value = '';
    } else if (field === 'selfie_with_id' && selfieInputRef.current) {
      selfieInputRef.current.value = '';
    }

    setFiles((prev) => ({
      ...prev,
      [field]: null,
    }));
    setFilePreviews((prev) => {
      if (prev[field]) {
        URL.revokeObjectURL(prev[field]);
      }
      return {
        ...prev,
        [field]: '',
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedPhoneForRequest = (phoneForRequest || '').trim();
    if (!editingRequestId && hasPendingOrApprovedRequest) {
      toast.error('You already have a pending or approved installment request.');
      return;
    }
    if (!selectedOrderId) {
      toast.error('Please select an order');
      return;
    }
    if (!editingRequestId && (!files.id_front || !files.id_back || !files.selfie_with_id)) {
      toast.error('All verification documents are required');
      return;
    }
    if (!editingRequestId && !profilePhone && !normalizedPhoneForRequest) {
      toast.error('Please add your phone number before submitting the request');
      return;
    }
    if (!isInformationConfirmed) {
      toast.error('Please confirm that your information is correct before submitting');
      return;
    }

    setSubmitting(true);
    try {
      let createdRequestId = null;
      if (editingRequestId) {
        const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_UPDATE_REQUEST, {
          request_id: editingRequestId,
        });
        await http.patch(endpoint, {
          duration_months: Number(durationMonths),
          user_note: userNote,
        });

        const editDocumentEntries = [
          { type: 'id_front', file: files.id_front },
          { type: 'id_back', file: files.id_back },
          { type: 'selfie_with_id', file: files.selfie_with_id },
        ].filter((entry) => !!entry.file);

        for (const entry of editDocumentEntries) {
          const docPayload = new FormData();
          docPayload.append('file', entry.file);
          const docEndpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_UPSERT_DOCUMENT, {
            request_id: editingRequestId,
            document_type: entry.type,
          });
          await http.patch(docEndpoint, docPayload, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        }

        toast.success('Installment request updated');
        setEditingRequestId(null);
        setIsCreateFormOpen(false);
      } else {
        const payload = new FormData();
        payload.append('order_id', String(selectedOrderId));
        payload.append('duration_months', String(durationMonths));
        if (userNote.trim()) {
          payload.append('user_note', userNote.trim());
        }
        if (!profilePhone && normalizedPhoneForRequest) {
          payload.append('phone', normalizedPhoneForRequest);
        }
        payload.append('id_front', files.id_front);
        payload.append('id_back', files.id_back);
        payload.append('selfie_with_id', files.selfie_with_id);

        const response = await http.post(INSTALLMENT_ENDPOINTS.CREATE_REQUEST, payload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        createdRequestId = response?.data?.id || null;
        if (!profilePhone && normalizedPhoneForRequest) {
          setProfilePhone(normalizedPhoneForRequest);
          await fetchUserInfo();
        }
        toast.success('Installment request submitted successfully');
        setIsCreateFormOpen(false);
        resetUploadFields();
      }

      setUserNote('');
      setIsInformationConfirmed(false);
      if (!createdRequestId) {
        setPhoneForRequest(profilePhone || '');
      }
      await fetchRequests();
      if (createdRequestId) {
        setRequestSortDirection('desc');
        setSelectedRequestId(createdRequestId);
      }
    } catch (error) {
      toast.error(error.message || (editingRequestId ? 'Failed to update request' : 'Failed to create installment request'));
    } finally {
      setSubmitting(false);
    }
  };

  const startEditRequest = (request) => {
    setSelectedRequestId(request.id);
    setEditingRequestId(request.id);
    setSelectedOrderId(String(request.order_id));
    setDurationMonths(request.duration_months || 6);
    setUserNote(request.user_note || '');
    setIsInformationConfirmed(false);
    setIsCreateFormOpen(true);
    resetUploadFields();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditRequest = () => {
    setEditingRequestId(null);
    setIsCreateFormOpen(false);
    setUserNote('');
    setIsInformationConfirmed(false);
    resetUploadFields();
  };

  const handleCancelRequest = async (requestId) => {
    const confirmed = await confirm({
      title: 'Cancel installment request',
      message: `Are you sure you want to cancel Request #${requestId}?`,
      confirmText: 'Cancel request',
      cancelText: 'Keep request',
    });
    if (!confirmed) {
      return;
    }

    setCancellingRequestId(requestId);
    try {
      const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_CANCEL, {
        request_id: requestId,
      });
      await http.patch(endpoint);
      if (editingRequestId === requestId) {
        setEditingRequestId(null);
        setIsCreateFormOpen(false);
        resetUploadFields();
      }
      toast.success('Installment request cancelled');
      await fetchRequests();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel installment request');
    } finally {
      setCancellingRequestId(null);
    }
  };

  const handlePayWithStripe = (requestId, schedule) => {
    navigate('/payment', {
      state: {
        amount: Number(schedule.amount_due || 0),
        installmentRequestId: requestId,
        installmentScheduleId: schedule.id,
      },
    });
  };

  if (loadingOrders || loadingRequests || loadingProfile) {
    return (
      <div className="installments-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="installments-page">
      <h1>Installment Payments</h1>
      <p className="installments-subtitle">
        Request a plan, upload your verification documents, and track your payment schedule.
      </p>

      <div className="installment-create-toggle">
        <button
          type="button"
          className="primary-btn"
          disabled={hasPendingOrApprovedRequest && !editingRequestId}
          onClick={() => setIsCreateFormOpen((prev) => !prev)}
        >
          {editingRequestId
            ? `Editing Request #${editingRequestId}`
            : hasPendingOrApprovedRequest
            ? 'New request unavailable (pending/approved exists)'
            : isCreateFormOpen
              ? 'Hide New Installment Request'
              : 'Open New Installment Request'}
        </button>
      </div>

      {isCreateFormOpen && (!hasPendingOrApprovedRequest || Boolean(editingRequestId)) && (
        <section className="installment-request-card">
          <h2>{editingRequestId ? `Edit Request #${editingRequestId}` : 'New Installment Request'}</h2>
          {orders.length === 0 ? (
            <p className="empty-state">You need an order before requesting installments.</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="order-select">Order</label>
                  <select
                    id="order-select"
                    value={selectedOrderId}
                    onChange={handleOrderChange}
                    disabled={Boolean(editingRequestId)}
                  >
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        #{order.id} - {formatCurrency(order.total_amount)} ({order.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="duration">Duration (months)</label>
                  <select
                    id="duration"
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(Number(event.target.value))}
                  >
                    {DURATION_OPTIONS.map((months) => (
                      <option key={months} value={months}>
                        {months} months
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="estimated-payment-box">
                <span>Estimated monthly payment</span>
                <strong>{formatCurrency(estimatedMonthlyPayment)}</strong>
              </div>

              <div className="selected-order-summary">
                <h3>Order Summary</h3>
                {!selectedOrderItems.length ? (
                  <p className="empty-state">No products found for this order.</p>
                ) : (
                  <>
                    <div className="selected-order-summary-row">
                      <span>Subtotal</span>
                      <strong>{formatCurrency(selectedItemsSubtotal)}</strong>
                    </div>
                    <div className="selected-order-summary-row">
                      <span>Promotion</span>
                      <strong>-{formatCurrency(selectedItemsDiscount)}</strong>
                    </div>
                    <div className="selected-order-summary-total">
                      <span>Total</span>
                      <strong>{formatCurrency(selectedItemsTotal)}</strong>
                    </div>
                  </>
                )}
              </div>

              {!editingRequestId && !profilePhone && (
                <div className="form-group">
                  <label htmlFor="request-phone">Phone number (required)</label>
                  <input
                    id="request-phone"
                    type="tel"
                    value={phoneForRequest}
                    onChange={(event) => setPhoneForRequest(event.target.value)}
                    placeholder="Enter your phone number"
                    required
                  />
                  <small className="request-phone-hint">
                    This phone number will be saved to your personal information.
                  </small>
                </div>
              )}

              <div className="upload-grid">
                <div className="form-group">
                  <label htmlFor="id-front">ID front</label>
                  <div className="upload-input-inline">
                    <input
                      id="id-front"
                      ref={idFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange('id_front', event.target.files?.[0])}
                      required={!editingRequestId}
                    />
                    {idFrontPreviewSrc && (
                      <div className="upload-preview-card">
                        <img
                          src={idFrontPreviewSrc}
                          alt={filePreviews.id_front ? 'ID front preview' : 'Current ID front'}
                        />
                        {filePreviews.id_front && (
                          <button
                            type="button"
                            className="upload-preview-remove"
                            onClick={() => removeSelectedFile('id_front')}
                            aria-label="Remove ID front image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="id-back">ID back</label>
                  <div className="upload-input-inline">
                    <input
                      id="id-back"
                      ref={idBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange('id_back', event.target.files?.[0])}
                      required={!editingRequestId}
                    />
                    {idBackPreviewSrc && (
                      <div className="upload-preview-card">
                        <img
                          src={idBackPreviewSrc}
                          alt={filePreviews.id_back ? 'ID back preview' : 'Current ID back'}
                        />
                        {filePreviews.id_back && (
                          <button
                            type="button"
                            className="upload-preview-remove"
                            onClick={() => removeSelectedFile('id_back')}
                            aria-label="Remove ID back image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="id-selfie">Selfie with ID</label>
                  <div className="upload-input-inline">
                    <input
                      id="id-selfie"
                      ref={selfieInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange('selfie_with_id', event.target.files?.[0])}
                      required={!editingRequestId}
                    />
                    {selfiePreviewSrc && (
                      <div className="upload-preview-card">
                        <img
                          src={selfiePreviewSrc}
                          alt={filePreviews.selfie_with_id ? 'Selfie with ID preview' : 'Current selfie with ID'}
                        />
                        {filePreviews.selfie_with_id && (
                          <button
                            type="button"
                            className="upload-preview-remove"
                            onClick={() => removeSelectedFile('selfie_with_id')}
                            aria-label="Remove selfie with ID image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <label className="request-confirmation-check">
                <input
                  type="checkbox"
                  checked={isInformationConfirmed}
                  onChange={(event) => setIsInformationConfirmed(event.target.checked)}
                />
                <span className="request-confirmation-text">
                  I am certain that all the information I have provided is correct to the best of my
                  knowledge, and that the application will be rejected if there are any problems.
                </span>
              </label>

              <div className="form-group">
                <label htmlFor="user-note">Optional note</label>
                <textarea
                  id="user-note"
                  value={userNote}
                  onChange={(event) => setUserNote(event.target.value)}
                  rows={3}
                  placeholder="Add extra details for admin review..."
                />
              </div>

              <div className="request-actions-row">
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting
                    ? (editingRequestId ? 'Saving...' : 'Submitting...')
                    : (editingRequestId ? 'Save request' : 'Submit request')}
                </button>
                {editingRequestId && (
                  <button
                    type="button"
                    className="request-cancel-btn"
                    onClick={cancelEditRequest}
                    disabled={submitting}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      <section className="installment-history-card">
        <div className="installment-history-header">
          <h2>My Installment Requests</h2>
          <button
            type="button"
            className="request-sort-btn"
            onClick={() =>
              setRequestSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
            }
          >
            Sort: {requestSortDirection === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>
        {!requests.length ? (
          <p className="empty-state">No installment requests yet.</p>
        ) : (
          <div className="requests-master-detail">
            <aside className="request-lines-panel">
              {sortedRequests.map((request) => (
                <button
                  key={`line-${request.id}`}
                  type="button"
                  className={`request-line ${selectedRequest?.id === request.id ? 'active' : ''}`}
                  onClick={() => setSelectedRequestId(request.id)}
                >
                  <div className="request-line-top">
                    <strong>Request #{request.id}</strong>
                    <span className={`status-pill status-${request.status}`}>{statusLabel(request.status)}</span>
                  </div>
                  <div className="request-line-bottom">
                    <span>Order #{request.order_id}</span>
                    <span>{formatCurrency(request.total_amount)}</span>
                  </div>
                </button>
              ))}
            </aside>

            <div className="request-details-panel">
              {!selectedRequest ? (
                <p className="empty-state">Select a request to view details.</p>
              ) : (
                <article className="request-card">
                  <header className="request-header">
                    <div>
                      <h3>Request #{selectedRequest.id}</h3>
                      <p>Order #{selectedRequest.order_id}</p>
                    </div>
                    <span className={`status-pill status-${selectedRequest.status}`}>
                      {statusLabel(selectedRequest.status)}
                    </span>
                  </header>

                  <div className="request-summary">
                    <p>Total amount: {formatCurrency(selectedRequest.total_amount)}</p>
                    <p>Remaining balance: {formatCurrency(selectedRequest.remaining_balance)}</p>
                    <p>Monthly payment: {formatCurrency(selectedRequest.monthly_payment)}</p>
                    <p>Duration: {selectedRequest.duration_months} months</p>
                    <p>Created at: {formatDate(selectedRequest.created_at)}</p>
                    <p>
                      Next payment:{' '}
                      {selectedRequest.next_payment_date
                        ? formatDate(selectedRequest.next_payment_date)
                        : 'Not scheduled yet'}
                    </p>
                  </div>

                  {selectedRequest.admin_note && (
                    <p className="request-note">
                      <strong>Admin note:</strong> {selectedRequest.admin_note}
                    </p>
                  )}

                  {selectedRequest.status === 'pending' && (
                    <div className="request-actions-row">
                      <button
                        type="button"
                        className="request-edit-btn"
                        onClick={() => startEditRequest(selectedRequest)}
                        disabled={cancellingRequestId === selectedRequest.id}
                      >
                        Edit Request
                      </button>
                      <button
                        type="button"
                        className="request-cancel-btn"
                        onClick={() => handleCancelRequest(selectedRequest.id)}
                        disabled={cancellingRequestId === selectedRequest.id}
                      >
                        {cancellingRequestId === selectedRequest.id ? 'Cancelling...' : 'Cancel Request'}
                      </button>
                    </div>
                  )}

                  <div className="documents-grid">
                    {REQUIRED_DOCUMENT_TYPES.map((documentType) => {
                      const existingDoc = (selectedRequest.documents || []).find(
                        (doc) => doc.document_type === documentType
                      );
                      const documentLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;

                      return (
                        <div key={`${selectedRequest.id}-${documentType}`} className="document-card">
                          <h5>{documentLabel}</h5>
                          {existingDoc ? (
                            <>
                              <a
                                href={getImageUrl(existingDoc.file_path)}
                                target="_blank"
                                rel="noreferrer"
                                className="document-preview-link"
                              >
                                <img src={getImageUrl(existingDoc.file_path)} alt={documentLabel} />
                                <span>View full image</span>
                              </a>
                            </>
                          ) : (
                            <div className="document-missing">Not uploaded</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selectedRequest.schedules?.length > 0 && (
                    <div className="schedule-table-wrapper">
                      <h4>Payment Schedule</h4>
                      <table className="schedule-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Due date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRequest.schedules.map((schedule) => (
                            <tr key={schedule.id}>
                              <td>{schedule.installment_number}</td>
                              <td>{formatDate(schedule.due_date)}</td>
                              <td>{formatCurrency(schedule.amount_due)}</td>
                              <td>{statusLabel(schedule.status)}</td>
                              <td>
                                {schedule.status === 'paid' ? (
                                  <span>Paid</span>
                                ) : selectedRequest.status === 'approved' ? (
                                  <div className="schedule-pay-action">
                                    <button
                                      type="button"
                                      onClick={() => handlePayWithStripe(selectedRequest.id, schedule)}
                                    >
                                      Pay with Stripe
                                    </button>
                                  </div>
                                ) : (
                                  <span>-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedRequest.payments?.length > 0 && (
                    <div className="payment-history">
                      <h4>Payment History</h4>
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
                </article>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Installments;
