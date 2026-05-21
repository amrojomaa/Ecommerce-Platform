import { tUi } from "../i18n/uiText";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import i18n from 'i18next';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import http from '../services/http';
import { INSTALLMENT_ENDPOINTS, ORDER_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate, getImageUrl } from '../utils/helpers';
import { useCurrency } from '../hooks/useCurrency';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Installments.css';
import PageHeader from '../components/PageHeader';

const DURATION_OPTIONS = [3, 6, 9, 12, 18, 24];
const REQUIRED_DOCUMENT_TYPES = ['id_front', 'id_back', 'selfie_with_id'];
const DOCUMENT_TYPE_LABEL_KEYS = {
  id_front: 'ui.pages.installments.idFront_04251d900b',
  id_back: 'ui.pages.installments.idBack_399ed188f3',
  selfie_with_id: 'ui.pages.installments.selfieWithId_a6ec1c3822',
};

const INSTALLMENT_STATUS_KEYS = {
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
  const normalizedStatus = String(status || 'pending').toLowerCase();
  const key = INSTALLMENT_STATUS_KEYS[normalizedStatus];
  if (key) {
    return tUi(key);
  }
  return normalizedStatus.replace(/_/g, ' ');
};

const Installments = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = Number(searchParams.get('orderId') || 0);
  const { formatCurrency } = useCurrency();
  const { fetchUserInfo } = useAuth();
  const { clearCart, fetchCart } = useCart();

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
    selfie_with_id: null
  });
  const [filePreviews, setFilePreviews] = useState({
    id_front: '',
    id_back: '',
    selfie_with_id: ''
  });
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(() => Boolean(orderIdFromUrl));
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [useDownPayment, setUseDownPayment] = useState(false);
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
  const installmentTotalAmount = useMemo(
    () => useDownPayment ? selectedItemsTotal * 0.7 : selectedItemsTotal,
    [useDownPayment, selectedItemsTotal]
  );
  const estimatedMonthlyPayment = useMemo(() => {
    if (!durationMonths) return 0;
    return installmentTotalAmount / durationMonths;
  }, [durationMonths, installmentTotalAmount]);
  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );
  const getEditingDocument = (documentType) => {
    if (!editingRequestId || !selectedRequest || selectedRequest.id !== editingRequestId) {
      return null;
    }
    return (
      selectedRequest.documents?.find((document) => document.document_type === documentType) || null);

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
    () => requests.some((request) => Number(request.order_id) === Number(selectedOrderId) && ['pending', 'approved'].includes(request.status)),
    [requests, selectedOrderId]
  );
  const hasLatePayment = useMemo(() => {
    if (!selectedRequest?.schedules) return false;
    const now = new Date();
    return selectedRequest.schedules.some(
      (schedule) => schedule.status !== 'paid' && new Date(schedule.due_date) < now
    );
  }, [selectedRequest]);
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

    const preferredOrder = orderIdFromUrl && orders.some((order) => Number(order.id) === orderIdFromUrl) ?
    String(orderIdFromUrl) :
    String(orders[0].id);
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

  useEffect(() => {
    if (orderIdFromUrl) {
      setIsCreateFormOpen(true);
    }
  }, [orderIdFromUrl]);

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
        [field]: file ? URL.createObjectURL(file) : ''
      };
    });
    setFiles((prev) => ({
      ...prev,
      [field]: file || null
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
        selfie_with_id: ''
      };
    });
    setFiles({
      id_front: null,
      id_back: null,
      selfie_with_id: null
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
      [field]: null
    }));
    setFilePreviews((prev) => {
      if (prev[field]) {
        URL.revokeObjectURL(prev[field]);
      }
      return {
        ...prev,
        [field]: ''
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedPhoneForRequest = (phoneForRequest || '').trim();
    if (!editingRequestId && hasPendingOrApprovedRequest) {
      toast.error(tUi("ui.pages.installments.youAlreadyHaveAPending_74e63cf891"));
      return;
    }
    if (!selectedOrderId) {
      toast.error(tUi("ui.pages.installments.pleaseSelectAnOrder_21c4f575dd"));
      return;
    }
    if (!editingRequestId && (!files.id_front || !files.id_back || !files.selfie_with_id)) {
      toast.error(tUi("ui.pages.installments.allVerificationDocumentsAreRequired_bcfa92ae42"));
      return;
    }
    if (!editingRequestId && !profilePhone && !normalizedPhoneForRequest) {
      toast.error(tUi("ui.pages.installments.pleaseAddYourPhoneNumber_a88335d685"));
      return;
    }
    if (!isInformationConfirmed) {
      toast.error(tUi("ui.pages.installments.pleaseConfirmThatYourInformation_ae331a0143"));
      return;
    }

    setSubmitting(true);
    try {
      let createdRequestId = null;
      if (editingRequestId) {
        const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_UPDATE_REQUEST, {
          request_id: editingRequestId
        });
        await http.patch(endpoint, {
          duration_months: Number(durationMonths),
          user_note: userNote
        });

        const editDocumentEntries = [
        { type: 'id_front', file: files.id_front },
        { type: 'id_back', file: files.id_back },
        { type: 'selfie_with_id', file: files.selfie_with_id }]
        .filter((entry) => !!entry.file);

        for (const entry of editDocumentEntries) {
          const docPayload = new FormData();
          docPayload.append('file', entry.file);
          const docEndpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_UPSERT_DOCUMENT, {
            request_id: editingRequestId,
            document_type: entry.type
          });
          await http.patch(docEndpoint, docPayload, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }

        toast.success(tUi("ui.pages.installments.installmentRequestUpdated_8d435c4aa7"));
        setEditingRequestId(null);
        setIsCreateFormOpen(false);
      } else {
        const payload = new FormData();
        payload.append('order_id', String(selectedOrderId));
        payload.append('duration_months', String(durationMonths));
        payload.append('use_down_payment', String(useDownPayment));
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
            'Content-Type': 'multipart/form-data'
          }
        });
        createdRequestId = response?.data?.id || null;
        if (!profilePhone && normalizedPhoneForRequest) {
          setProfilePhone(normalizedPhoneForRequest);
          await fetchUserInfo();
        }
        toast.success(tUi("ui.pages.installments.installmentRequestSubmittedSuccessfully_8b973f374e"));
        setIsCreateFormOpen(false);
        resetUploadFields();

        try {
          const cartResponse = await http.get('/showmecart');
          if (cartResponse.data?.items?.length > 0) {
            const cartId = cartResponse.data.items[0]?.cart_id || cartResponse.data.cart_id;
            if (cartId) {
              await clearCart(cartId);
            }
          }
        } catch (error) {
          console.error('Error clearing cart:', error);
        } finally {
          await fetchCart();
        }
      }

      setUserNote('');
      setUseDownPayment(false);
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
      title: tUi("ui.pages.installments.cancelInstallmentRequest_d0153ff51b"),
      message: `Are you sure you want to cancel Request #${requestId}?`,
      confirmText: tUi("ui.pages.installments.cancelRequest_8ed95dc39e"),
      cancelText: tUi("ui.pages.installments.keepRequest_c9958ccfab")
    });
    if (!confirmed) {
      return;
    }

    setCancellingRequestId(requestId);
    try {
      const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_CANCEL, {
        request_id: requestId
      });
      await http.patch(endpoint);
      if (editingRequestId === requestId) {
        setEditingRequestId(null);
        setIsCreateFormOpen(false);
        resetUploadFields();
      }
      toast.success(tUi("ui.pages.installments.installmentRequestCancelled_348c4c2825"));
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
        installmentScheduleId: schedule.id
      }
    });
  };

  const handlePayRemainingWithStripe = (requestId, remainingBalance) => {
    navigate('/payment', {
      state: {
        amount: Number(remainingBalance || 0),
        installmentRequestId: requestId,
        installmentScheduleId: null
      }
    });
  };

  if (loadingOrders || loadingRequests || loadingProfile) {
    return (
      <div className="page-shell installments-page">
        <div className="page-loading">
          <LoadingSpinner size="large" />
        </div>
      </div>);

  }

  return (
    <div className="page-shell installments-page">
      <PageHeader
        kicker={tUi("ui.pages.installments.installmentPayments_2b8fec206d")}
        title={tUi("ui.pages.installments.installmentPayments_2b8fec206d")}
        subtitle={tUi("ui.pages.installments.requestAPlanUploadYour_362dac0d89")}
        animate={false}
      />

      <div className="installment-create-toggle">
        <button
          type="button"
          className="primary-btn page-btn-primary installments-main-toggle-btn"
          disabled={hasPendingOrApprovedRequest && !editingRequestId}
          onClick={() => setIsCreateFormOpen((prev) => !prev)}>
          
          {editingRequestId ? tUi("ui.pages.installments.editingRequestValue_f47b4032cb", { value0:
            editingRequestId }) :
          hasPendingOrApprovedRequest ? tUi("ui.pages.installments.newRequestUnavailablePendingApproved_430157ba94") :

          isCreateFormOpen ? tUi("ui.pages.installments.hideNewInstallmentRequest_cdf088530f") : tUi("ui.pages.installments.openNewInstallmentRequest_46b153cb23")

          }
        </button>
      </div>

      {isCreateFormOpen && (!hasPendingOrApprovedRequest || Boolean(editingRequestId)) &&
      <section className="installment-request-card page-card page-card--static">
          <h2 className="page-section-title">{editingRequestId ? tUi("ui.pages.installments.editRequestValue_5d45eca176", { value0: editingRequestId }) : tUi("ui.pages.installments.newInstallmentRequest_d768e2332d")}</h2>
          {orders.length === 0 ?
        <div className="page-empty installments-empty-msg"><p className="empty-state">{tUi("ui.pages.installments.youNeedAnOrderBefore_a494dca334")}</p></div> :

        <form onSubmit={handleSubmit}>
              {orderIdFromUrl && selectedOrder && (
                <div className="active-order-banner">
                  <span>ℹ️ {i18n.language && i18n.language.startsWith('ar') ? 'تقوم حالياً بتقديم طلب تقسيط للطلب رقم:' : i18n.language && i18n.language.startsWith('fr') ? 'Vous demandez des versements pour la commande :' : 'You are requesting installments for Order:'} <strong>#{selectedOrder.id}</strong> ({formatCurrency(selectedOrder.total_amount)})</span>
                </div>
              )}

              <div className="form-grid">
                {!orderIdFromUrl && (
                  <div className="form-group">
                    <label htmlFor="order-select">{tUi("ui.pages.installments.order_362b958f76")}</label>
                    <select
                      id="order-select"
                      value={selectedOrderId}
                      onChange={handleOrderChange}
                      disabled={Boolean(editingRequestId)}>
                      {orders.map((order) =>
                        <option key={order.id} value={order.id}>
                          #{order.id} - {formatCurrency(order.total_amount)} ({statusLabel(order.status)})
                        </option>
                      )}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="duration">{tUi("ui.pages.installments.durationMonths_4816202198")}</label>
                  <select
                    id="duration"
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(Number(event.target.value))}>
                    {DURATION_OPTIONS.map((months) =>
                      <option key={months} value={months}>
                        {months}{tUi("ui.pages.installments.months_5fe93aa9a9")}
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group installment-plan-selector">
                <label style={{ fontWeight: 600, fontSize: '1rem', display: 'block', marginBottom: '8px' }}>
                  {i18n.language && i18n.language.startsWith('ar') ? 'اختر خيار خطة التقسيط:' : i18n.language && i18n.language.startsWith('fr') ? 'Choisissez l\'option du plan de paiement :' : 'Select Installment Plan Option:'}
                </label>
                <div className="plan-options-grid">
                  <label className={`plan-option-card ${!useDownPayment ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="useDownPayment"
                      checked={!useDownPayment}
                      onChange={() => setUseDownPayment(false)}
                      disabled={Boolean(editingRequestId)}
                    />
                    <div className="plan-option-info">
                      <span className="plan-title">
                        {i18n.language && i18n.language.startsWith('ar') ? 'الخيار أ: خطة تقسيط عادية' : i18n.language && i18n.language.startsWith('fr') ? 'Option A : Plan de versement standard' : 'Option A: Standard Installment Plan'}
                      </span>
                      <span className="plan-desc">
                        {i18n.language && i18n.language.startsWith('ar') 
                          ? 'ادفع 100٪ من المبلغ الإجمالي على أقساط شهرية متساوية. لا يلزم دفع دفعة أولى مقدمة.'
                          : i18n.language && i18n.language.startsWith('fr')
                          ? 'Payez 100% du montant total en mensualités. Aucun acompte requis.'
                          : 'Pay 100% of the total amount in monthly installments. No upfront down payment required.'
                        }
                      </span>
                    </div>
                  </label>
                  <label className={`plan-option-card ${useDownPayment ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="useDownPayment"
                      checked={useDownPayment}
                      onChange={() => setUseDownPayment(true)}
                      disabled={Boolean(editingRequestId)}
                    />
                    <div className="plan-option-info">
                      <span className="plan-title">
                        {i18n.language && i18n.language.startsWith('ar') ? 'الخيار ب: خطة الدفعة الأولى (30٪ مقدماً)' : i18n.language && i18n.language.startsWith('fr') ? 'Option B : Plan avec acompte (30% d\'acompte)' : 'Option B: Down Payment Plan (30% Upfront)'}
                      </span>
                      <span className="plan-desc">
                        {i18n.language && i18n.language.startsWith('ar')
                          ? `ادفع دفعة أولى بنسبة 30٪ (${formatCurrency(selectedItemsTotal * 0.3)}) مقدماً، وادفع فقط نسبة 70٪ المتبقية على أقساط شهرية متساوية.`
                          : i18n.language && i18n.language.startsWith('fr')
                          ? `Payez un acompte de 30% (${formatCurrency(selectedItemsTotal * 0.3)}) au départ, et payez le reste de 70% en mensualités.`
                          : `Pay a 30% down payment (${formatCurrency(selectedItemsTotal * 0.3)}) upfront, and pay only the remaining 70% in monthly installments.`
                        }
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="estimated-payment-box">
                <span>{useDownPayment ? (i18n.language && i18n.language.startsWith('ar') ? 'القسط الشهري المقدر (على الـ 70٪ المتبقية):' : i18n.language && i18n.language.startsWith('fr') ? 'Mensualité estimée (sur le reste de 70%) :' : 'Estimated Monthly Payment (on 70% remainder):') : tUi("ui.pages.installments.estimatedMonthlyPayment_b73a6228aa")}</span>
                <strong>{formatCurrency(estimatedMonthlyPayment)}</strong>
              </div>

              <div className="selected-order-summary">
                <h3>{tUi("ui.pages.installments.orderSummary_769a830dc6")}</h3>
                {!selectedOrderItems.length ?
            <p className="empty-state">{tUi("ui.pages.installments.noProductsFoundForThis_d778cbaa03")}</p> :

            <>
                    <div className="selected-order-summary-row">
                      <span>{tUi("ui.pages.installments.subtotal_54aa05a071")}</span>
                      <strong>{formatCurrency(selectedItemsSubtotal)}</strong>
                    </div>
                    <div className="selected-order-summary-row">
                      <span>{tUi("ui.pages.installments.promotion_c14f0c7ef9")}</span>
                      <strong>-{formatCurrency(selectedItemsDiscount)}</strong>
                    </div>
                    <div className="selected-order-summary-total">
                      <span>{tUi("ui.pages.installments.total_d43747f6b3")}</span>
                      <strong>{formatCurrency(selectedItemsTotal)}</strong>
                    </div>
                    {useDownPayment && (
                      <>
                        <div className="selected-order-summary-row down-payment-row">
                          <span>{i18n.language && i18n.language.startsWith('ar') ? 'الدفعة الأولى (30٪ مقدماً):' : i18n.language && i18n.language.startsWith('fr') ? 'Acompte (30% au départ) :' : 'Down Payment (30% Upfront):'}</span>
                          <strong className="down-payment-value">{formatCurrency(selectedItemsTotal * 0.3)}</strong>
                        </div>
                        <div className="selected-order-summary-total installment-total-row">
                          <span>{i18n.language && i18n.language.startsWith('ar') ? 'قيمة الأقساط المتبقية (70٪):' : i18n.language && i18n.language.startsWith('fr') ? 'Montant restant du versement (70%) :' : 'Remaining Installment Amount (70%):'}</span>
                          <strong>{formatCurrency(selectedItemsTotal * 0.7)}</strong>
                        </div>
                      </>
                    )}
                  </>
            }
              </div>

              {!editingRequestId && !profilePhone &&
          <div className="form-group">
                  <label htmlFor="request-phone">{tUi("ui.pages.installments.phoneNumberRequired_d66830a326")}</label>
                  <input
              id="request-phone"
              type="tel"
              value={phoneForRequest}
              onChange={(event) => setPhoneForRequest(event.target.value)}
              placeholder={tUi("ui.pages.installments.enterYourPhoneNumber_405e0f4cd6")}
              required />
            
                  <small className="request-phone-hint">{tUi("ui.pages.installments.thisPhoneNumberWillBe_a8c2efd7a1")}

            </small>
                </div>
          }

              <div className="upload-grid">
                <div className="form-group">
                  <label htmlFor="id-front">{tUi("ui.pages.installments.idFront_04251d900b")}</label>
                  <div className="upload-input-inline">
                    <input
                  id="id-front"
                  ref={idFrontInputRef}
                  type="file"
                  className="upload-file-input"
                  accept="image/*"
                  onChange={(event) => handleFileChange("id_front", event.target.files?.[0])}
                  aria-label={tUi("ui.pages.installments.idFront_04251d900b")} />
                    <div className="upload-file-controls">
                      <button type="button" className="upload-file-trigger" onClick={() => idFrontInputRef.current?.click()}>
                        {tUi("ui.pages.installments.chooseFile_09bcb9ed31")}
                      </button>
                      <span className="upload-file-name">
                        {files.id_front?.name || tUi("ui.pages.installments.noFileChosen_31d6d17f8f")}
                      </span>
                    </div>
                
                    {idFrontPreviewSrc &&
                <div className="upload-preview-card">
                        <img
                    src={idFrontPreviewSrc}
                    alt={filePreviews.id_front ? tUi("ui.pages.installments.idFrontPreview_12073109cf") : tUi("ui.pages.installments.currentIdFront_06c47a54b8")} />
                  
                        {filePreviews.id_front &&
                  <button
                    type="button"
                    className="upload-preview-remove"
                    onClick={() => removeSelectedFile("id_front")}
                    aria-label={tUi("ui.pages.installments.removeIdFrontImage_a829064149")}>
                    
                            ×
                          </button>
                  }
                      </div>
                }
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="id-back">{tUi("ui.pages.installments.idBack_399ed188f3")}</label>
                  <div className="upload-input-inline">
                    <input
                  id="id-back"
                  ref={idBackInputRef}
                  type="file"
                  className="upload-file-input"
                  accept="image/*"
                  onChange={(event) => handleFileChange("id_back", event.target.files?.[0])}
                  aria-label={tUi("ui.pages.installments.idBack_399ed188f3")} />
                    <div className="upload-file-controls">
                      <button type="button" className="upload-file-trigger" onClick={() => idBackInputRef.current?.click()}>
                        {tUi("ui.pages.installments.chooseFile_09bcb9ed31")}
                      </button>
                      <span className="upload-file-name">
                        {files.id_back?.name || tUi("ui.pages.installments.noFileChosen_31d6d17f8f")}
                      </span>
                    </div>
                
                    {idBackPreviewSrc &&
                <div className="upload-preview-card">
                        <img
                    src={idBackPreviewSrc}
                    alt={filePreviews.id_back ? tUi("ui.pages.installments.idBackPreview_1223acfa0d") : tUi("ui.pages.installments.currentIdBack_b7d3ea7672")} />
                  
                        {filePreviews.id_back &&
                  <button
                    type="button"
                    className="upload-preview-remove"
                    onClick={() => removeSelectedFile("id_back")}
                    aria-label={tUi("ui.pages.installments.removeIdBackImage_f569fd2602")}>
                    
                            ×
                          </button>
                  }
                      </div>
                }
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="id-selfie">{tUi("ui.pages.installments.selfieWithId_a6ec1c3822")}</label>
                  <div className="upload-input-inline">
                    <input
                  id="id-selfie"
                  ref={selfieInputRef}
                  type="file"
                  className="upload-file-input"
                  accept="image/*"
                  onChange={(event) => handleFileChange("selfie_with_id", event.target.files?.[0])}
                  aria-label={tUi("ui.pages.installments.selfieWithId_a6ec1c3822")} />
                    <div className="upload-file-controls">
                      <button type="button" className="upload-file-trigger" onClick={() => selfieInputRef.current?.click()}>
                        {tUi("ui.pages.installments.chooseFile_09bcb9ed31")}
                      </button>
                      <span className="upload-file-name">
                        {files.selfie_with_id?.name || tUi("ui.pages.installments.noFileChosen_31d6d17f8f")}
                      </span>
                    </div>
                
                    {selfiePreviewSrc &&
                <div className="upload-preview-card">
                        <img
                    src={selfiePreviewSrc}
                    alt={filePreviews.selfie_with_id ? tUi("ui.pages.installments.selfieWithIdPreview_c1e10bafe5") : tUi("ui.pages.installments.currentSelfieWithId_44761d5ecd")} />
                  
                        {filePreviews.selfie_with_id &&
                  <button
                    type="button"
                    className="upload-preview-remove"
                    onClick={() => removeSelectedFile("selfie_with_id")}
                    aria-label={tUi("ui.pages.installments.removeSelfieWithIdImage_a7dec17624")}>
                    
                            ×
                          </button>
                  }
                      </div>
                }
                  </div>
                </div>
              </div>

              <label className="request-confirmation-check">
                <input
              type="checkbox"
              checked={isInformationConfirmed}
              onChange={(event) => setIsInformationConfirmed(event.target.checked)} />
            
                <span className="request-confirmation-text">{tUi("ui.pages.installments.iAmCertainThatAll_7cde4172d3")}


            </span>
              </label>

              <div className="form-group">
                <label htmlFor="user-note">{tUi("ui.pages.installments.optionalNote_f4eb00a51f")}</label>
                <textarea
              id="user-note"
              value={userNote}
              onChange={(event) => setUserNote(event.target.value)}
              rows={3}
              placeholder={tUi("ui.pages.installments.addExtraDetailsForAdmin_25d686c776")} />
            
              </div>

              <div className="request-actions-row">
                <button type="submit" className="primary-btn page-btn-primary installments-submit-btn" disabled={submitting}>
                  {submitting ?
              editingRequestId ? tUi("ui.pages.installments.saving_c071a70304") : tUi("ui.pages.installments.submitting_3eccdd056d") :
              editingRequestId ? tUi("ui.pages.installments.saveRequest_b99556ff31") : tUi("ui.pages.installments.submitRequest_60d31e50ea")}
                </button>
                {editingRequestId &&
            <button
              type="button"
              className="request-cancel-btn page-btn-secondary installments-cancel-edit-btn"
              onClick={cancelEditRequest}
              disabled={submitting}>{tUi("ui.pages.installments.cancelEdit_030775d3ab")}


            </button>
            }
              </div>
            </form>
        }
        </section>
      }

      <section className="installment-history-card page-card page-card--static installments-history-panel">
        <div className="installment-history-header">
          <h2 className="page-section-title">{tUi("ui.pages.installments.myInstallmentRequests_64898be0d0")}</h2>
          <button
            type="button"
            className="request-sort-btn page-btn-secondary installments-sort-btn"
            onClick={() =>
            setRequestSortDirection((prev) => prev === "desc" ? "asc" : "desc")
            }>{tUi("ui.pages.installments.sort_54ae76991c")}

            {requestSortDirection === "desc" ? tUi("ui.pages.installments.newest_e25ae45f0d") : tUi("ui.pages.installments.oldest_803a161793")}
          </button>
        </div>
        {!requests.length ?
        <div className="page-empty installments-requests-empty"><p className="empty-state">{tUi("ui.pages.installments.noInstallmentRequestsYet_45b14f592d")}</p></div> :

        <div className="requests-master-detail">
            <aside className="request-lines-panel">
              {sortedRequests.map((request) =>
            <button
              key={`line-${request.id}`}
              type="button"
              className={`request-line ${selectedRequest?.id === request.id ? 'active' : ''}`}
              onClick={() => setSelectedRequestId(request.id)}>
              
                  <div className="request-line-top">
                    <strong>{tUi("ui.pages.installments.request_02f116d6ec")}{request.id}</strong>
                    <span className={`status-pill status-${request.status}`}>{statusLabel(request.status)}</span>
                  </div>
                  <div className="request-line-bottom">
                    <span>{tUi("ui.pages.installments.order_1aa126a282")}{request.order_id}</span>
                    <span>{formatCurrency(request.total_amount)}</span>
                  </div>
                </button>
            )}
            </aside>

            <div className="request-details-panel">
              {!selectedRequest ?
            <div className="page-empty installments-detail-empty"><p className="empty-state">{tUi("ui.pages.installments.selectARequestToView_8857e15043")}</p></div> :

            <article className="request-card installments-request-detail-card">
                  <header className="request-header">
                    <div>
                      <h3>{tUi("ui.pages.installments.request_02f116d6ec")}{selectedRequest.id}</h3>
                      <p>{tUi("ui.pages.installments.order_1aa126a282")}{selectedRequest.order_id}</p>
                    </div>
                    <span className={`status-pill status-${selectedRequest.status}`}>
                      {statusLabel(selectedRequest.status)}
                    </span>
                  </header>

                  {selectedRequest.status === 'approved' && hasLatePayment && (
                    <div className="installment-warning-alert">
                      {i18n.language && i18n.language.startsWith('ar')
                        ? '⚠️ لديك دفعة أقساط متأخرة أو أكثر. يرجى سداد الدفعة في أقرب وقت لتجنب أي رسوم إضافية.'
                        : i18n.language && i18n.language.startsWith('fr')
                        ? '⚠️ Vous avez un ou plusieurs paiements de versement en retard. Veuillez régler votre paiement dès que possible pour éviter des pénalités.'
                        : '⚠️ You have one or more late installment payments. Please complete your payment as soon as possible to avoid penalties.'}
                    </div>
                  )}

                  <div className="request-summary">
                    <p>{tUi("ui.pages.installments.totalAmount_d385a44df2")}{formatCurrency(selectedRequest.total_amount)}</p>
                    <p>{tUi("ui.pages.installments.remainingBalance_d3650ec158")}{formatCurrency(selectedRequest.remaining_balance)}</p>
                    <p>{tUi("ui.pages.installments.monthlyPayment_1a4e9d4b7f")}{formatCurrency(selectedRequest.monthly_payment)}</p>
                    <p>{tUi("ui.pages.installments.duration_b94d9fd57c")}{selectedRequest.duration_months}{tUi("ui.pages.installments.months_5fe93aa9a9")}</p>
                    <p>{tUi("ui.pages.installments.createdAt_dfe3a853f9")}{formatDate(selectedRequest.created_at)}</p>
                    <p>{tUi("ui.pages.installments.nextPayment_6af2ec4a0c")}
                  {' '}
                      {selectedRequest.next_payment_date ?
                  formatDate(selectedRequest.next_payment_date) : tUi("ui.pages.installments.notScheduledYet_11bbc129cd")
                  }
                    </p>
                  </div>

                  {selectedRequest.admin_note &&
              <p className="request-note">
                      <strong>{tUi("ui.pages.installments.adminNote_b26f3baaff")}</strong> {selectedRequest.admin_note}
                    </p>
              }

                  {selectedRequest.status === "pending" &&
              <div className="request-actions-row">
                      <button
                  type="button"
                  className="request-edit-btn page-btn-secondary installments-request-edit-btn"
                  onClick={() => startEditRequest(selectedRequest)}
                  disabled={cancellingRequestId === selectedRequest.id}>{tUi("ui.pages.installments.editRequest_d5ef80e7be")}


                </button>
                      <button
                  type="button"
                  className="request-cancel-btn page-btn-danger installments-request-cancel-inner"
                  onClick={() => handleCancelRequest(selectedRequest.id)}
                  disabled={cancellingRequestId === selectedRequest.id}>
                  
                        {cancellingRequestId === selectedRequest.id ? tUi("ui.pages.installments.cancelling_f6d87cb315") : tUi("ui.pages.installments.cancelRequest_ac8b2c6262")}
                      </button>
                    </div>
              }

                  <div className="documents-grid">
                    {REQUIRED_DOCUMENT_TYPES.map((documentType) => {
                  const existingDoc = (selectedRequest.documents || []).find(
                    (doc) => doc.document_type === documentType
                  );
                  const documentLabel = tUi(DOCUMENT_TYPE_LABEL_KEYS[documentType] || documentType);

                  return (
                    <div key={`${selectedRequest.id}-${documentType}`} className="document-card">
                          <h5>{documentLabel}</h5>
                          {existingDoc ?
                      <>
                              <a
                          href={getImageUrl(existingDoc.file_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="document-preview-link">
                          
                                <img src={getImageUrl(existingDoc.file_path)} alt={documentLabel} />
                                <span>{tUi("ui.pages.installments.viewFullImage_3509b6d706")}</span>
                              </a>
                            </> :

                      <div className="document-missing">{tUi("ui.pages.installments.notUploaded_b311e45a8b")}</div>
                      }
                        </div>);

                })}
                  </div>

                  {selectedRequest.status === "approved" && Number(selectedRequest.remaining_balance) > 0 && (
                    <div className="pay-remaining-box">
                      <div className="pay-remaining-details">
                        <h4>{i18n.language && i18n.language.startsWith('ar') ? '💡 ادفع باقي الأقساط دفعة واحدة واحصل على خصم 10%!' : i18n.language && i18n.language.startsWith('fr') ? '💡 Payez le solde restant immédiatement et profitez de 10% de réduction !' : '💡 Pay Remaining Balance at Once & Get a 10% Discount!'}</h4>
                        <p>
                          {i18n.language && i18n.language.startsWith('ar') 
                            ? `إذا قمت بدفع المبلغ المتبقي المستحق وقدره ${formatCurrency(selectedRequest.remaining_balance)} الآن، فستحصل على خصم فوري بنسبة 10٪.`
                            : i18n.language && i18n.language.startsWith('fr')
                            ? `Si vous payez votre solde restant de ${formatCurrency(selectedRequest.remaining_balance)} maintenant, vous bénéficierez d'une réduction immédiate de 10%.`
                            : `If you pay your outstanding balance of ${formatCurrency(selectedRequest.remaining_balance)} now, you will get an immediate 10% discount.`
                          }
                        </p>
                        <div className="pay-remaining-pricing">
                          <span className="original-price">{i18n.language && i18n.language.startsWith('ar') ? 'الأصلي: ' : i18n.language && i18n.language.startsWith('fr') ? 'Original: ' : 'Original: '}{formatCurrency(selectedRequest.remaining_balance)}</span>
                          <span className="arrow">→</span>
                          <span className="discounted-price">{i18n.language && i18n.language.startsWith('ar') ? 'ادفع فقط: ' : i18n.language && i18n.language.startsWith('fr') ? 'Payez seulement: ' : 'Pay Only: '}<strong>{formatCurrency(Number(selectedRequest.remaining_balance) * 0.9)}</strong></span>
                          <span className="saved-badge">{i18n.language && i18n.language.startsWith('ar') ? 'وفر ' : i18n.language && i18n.language.startsWith('fr') ? 'Économisez ' : 'Save '}{formatCurrency(Number(selectedRequest.remaining_balance) * 0.1)}!</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="pay-remaining-btn page-btn-primary installments-pay-remaining-btn"
                        onClick={() => handlePayRemainingWithStripe(selectedRequest.id, selectedRequest.remaining_balance)}
                      >
                        {i18n.language && i18n.language.startsWith('ar') ? 'ادفع المبلغ المتبقي الآن' : i18n.language && i18n.language.startsWith('fr') ? 'Payer le solde restant maintenant' : 'Pay Remaining Balance Now'}
                      </button>
                    </div>
                  )}

                  {selectedRequest.schedules?.length > 0 &&
              <div className="schedule-table-wrapper">
                      <h4>{tUi("ui.pages.installments.paymentSchedule_8ad1376ad9")}</h4>
                      <table className="schedule-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{tUi("ui.pages.installments.dueDate_6b89b824ab")}</th>
                            <th>{tUi("ui.pages.installments.amount_759c0495fe")}</th>
                            <th>{tUi("ui.pages.installments.status_698c50f25c")}</th>
                            <th>{tUi("ui.pages.installments.action_059ef12de6")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRequest.schedules.map((schedule) =>
                    <tr key={schedule.id}>
                              <td>{schedule.installment_number}</td>
                              <td>{formatDate(schedule.due_date)}</td>
                              <td>{formatCurrency(schedule.amount_due)}</td>
                              <td>{statusLabel(schedule.status)}</td>
                              <td>
                                {schedule.status === "paid" ?
                        <span>{tUi("ui.pages.installments.paid_14ded06957")}</span> :
                        selectedRequest.status === "approved" ?
                        <div className="schedule-pay-action">
                                    <button
                            type="button"
                            className="page-btn-primary installments-schedule-pay-btn"
                            onClick={() => handlePayWithStripe(selectedRequest.id, schedule)}>{tUi("ui.pages.installments.payWithStripe_1e1b16dbd9")}


                          </button>
                                  </div> :

                        <span>-</span>
                        }
                              </td>
                            </tr>
                    )}
                        </tbody>
                      </table>
                    </div>
              }

                  {selectedRequest.payments?.length > 0 &&
              <div className="payment-history">
                      <h4>{tUi("ui.pages.installments.paymentHistory_e7ac75ab18")}</h4>
                      <ul>
                        {[...(selectedRequest.payments || [])]
                  .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                  .map((payment) =>
                  <li key={payment.id}>
                              {formatDate(payment.paid_at)} - {formatCurrency(payment.amount)}
                              {payment.note ? tUi("ui.pages.installments.value_d6b4a5b70f", { value0: payment.note }) : ''}
                            </li>
                  )}
                      </ul>
                    </div>
              }
                </article>
            }
            </div>
          </div>
        }
      </section>
    </div>);

};

export default Installments;
