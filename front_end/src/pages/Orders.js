import { tUi } from '../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FaArrowRight,
  FaBoxOpen,
  FaCreditCard,
  FaShoppingBag,
} from 'react-icons/fa';
import { FiChevronDown, FiMessageCircle } from 'react-icons/fi';
import http from '../services/http';
import { ORDER_ENDPOINTS, DELIVERY_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate, getImageUrl } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import DeliveryChatModal from '../components/DeliveryChatModal';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Orders.css';

const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  pending: 'ui.pages.orders.status.pending',
  paid: 'ui.pages.orders.status.paid',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
  canceled: 'ui.pages.orders.status.cancelled',
  failed: 'ui.pages.orders.status.failed',
  refunded: 'ui.pages.orders.status.refunded',
  preparing: 'ui.pages.orders.status.preparing',
  packed: 'ui.pages.orders.status.packed',
  ready_for_pickup: 'ui.pages.orders.status.readyForPickup',
};

const DELIVERY_STEP_LABEL_KEYS = {
  paid: 'ui.pages.orders.deliveryStep.paid',
  assigned: 'ui.pages.orders.deliveryStep.assigned',
  picked_up: 'ui.pages.orders.deliveryStep.pickedUp',
  delivering: 'ui.pages.orders.deliveryStep.delivering',
  delivered: 'ui.pages.orders.deliveryStep.delivered',
};

const DELIVERY_STEPS = ['paid', 'assigned', 'picked_up', 'delivering', 'delivered'];
const DELIVERY_STEP_ICONS = {
  paid: '💳',
  assigned: '👤',
  picked_up: '📦',
  delivering: '🚚',
  delivered: '✅',
};
const ACTIVE_DELIVERY_STATUSES = ['paid', 'assigned', 'picked_up', 'delivering', 'delivered'];

const getOrderStatusLabel = (status) => {
  const normalizedStatus = String(status || 'created').toLowerCase();
  const key = ORDER_STATUS_LABEL_KEYS[normalizedStatus];
  return key ? tUi(key) : normalizedStatus.replace(/_/g, ' ');
};

const Orders = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [activeChatJobId, setActiveChatJobId] = useState(null);
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

  const token = localStorage.getItem('token');
  const getUserIdFromToken = () => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id;
    } catch {
      return null;
    }
  };
  const currentUserId = getUserIdFromToken();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await http.get(ORDER_ENDPOINTS.MY_ORDERS);
      setOrders(response.data || []);
    } catch (error) {
      if (!error.response) {
        toast.error(tUi('ui.pages.orders.networkErrorUnableToConnect_96335b514f'));
        setOrders([]);
        return;
      }

      if (error.response?.status === 404) {
        setOrders([]);
      } else {
        const errorMsg = error.response?.data?.detail || error.message;
        toast.error(tUi('ui.pages.orders.failedToFetch_b4e8c2d3e3', { value0: errorMsg }));
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getHeaderSubtitle = () => {
    if (orders.length === 0) {
      return tUi('ui.pages.orders.subtitleEmpty_b4e8c2d3e1');
    }
    return tUi('ui.pages.orders.subtitleWithCount_b4e8c2d3e0', { count: orders.length });
  };

  const handleCancelOrder = async (orderId) => {
    const confirmed = await confirm({
      title: tUi('ui.pages.orders.cancelOrder_8a957aa9d2'),
      message: tUi('ui.pages.orders.cancelConfirmMessage_b4e8c2d3e2', { value0: orderId }),
      confirmText: tUi('ui.pages.orders.cancelOrder_8a957aa9d2'),
      cancelText: tUi('ui.pages.orders.keepOrder_49c5b284e1'),
    });

    if (!confirmed) {
      return;
    }

    setCancellingOrderId(orderId);
    try {
      const cancelUrl = ORDER_ENDPOINTS.CANCEL.replace('{order_id}', orderId);
      await http.patch(cancelUrl);

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: 'cancelled' } : order
        )
      );

      if (expandedOrderId === orderId) {
        setExpandedOrderId(null);
      }
      toast.success(tUi('ui.pages.orders.orderCancelledSuccessfully_5a659ac4b5'));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      toast.error(tUi('ui.pages.orders.failedToCancel_b4e8c2d3e4', { value0: errorMsg }));
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handlePayment = (order) => {
    navigate('/payment', {
      state: {
        amount: order.total_amount,
        orderId: order.id,
      },
    });
  };

  const handleRequestInstallment = (orderId) => {
    navigate(`/installments?orderId=${orderId}`);
  };

  const handleOpenDriverChat = async (orderId) => {
    try {
      const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.GET_JOB_BY_ORDER, { order_id: orderId }));
      setActiveChatJobId(response.data.id);
    } catch {
      toast.error(tUi('ui.pages.orders.couldNotLoadChatTry_4843980c57'));
    }
  };

  if (loading) {
    return (
      <div className="page-loading orders-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--storefront orders-page">
      <PageHeader
        title={tUi('ui.pages.orders.myOrders_9215f6342b')}
        subtitle={getHeaderSubtitle()}
        animate={false}
      />

      {orders.length === 0 ? (
        <motion.section
          className="orders-empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          aria-label={tUi('ui.pages.orders.emptyTitle_b4e8c2d3e5')}
        >
          <FaShoppingBag className="orders-empty-icon" aria-hidden="true" />
          <h2>{tUi('ui.pages.orders.emptyTitle_b4e8c2d3e5')}</h2>
          <p>{tUi('ui.pages.orders.youHavenTPlacedAny_7ac4ec05af')}</p>
          <Link to="/products" className="page-btn-primary orders-empty-cta">
            {tUi('ui.pages.orders.startShopping_aea59217fe')}
            <FaArrowRight aria-hidden="true" />
          </Link>
        </motion.section>
      ) : (
        <section className="orders-list-section" aria-label={tUi('ui.pages.orders.myOrders_9215f6342b')}>
          <div className="orders-list">
            {orders.map((order, index) => {
              if (!order || !order.id) {
                return null;
              }

              const isExpanded = expandedOrderId === order.id;
              const orderItems = order.items || order.orderitems || [];
              const normalizedStatus = String(order.status || 'created').toLowerCase();
              const isCreated = normalizedStatus === 'created';

              return (
                <motion.article
                  key={order.id}
                  className={`orders-card ${isExpanded ? 'orders-card--expanded' : ''}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.45 }}
                >
                  <button
                    type="button"
                    className="orders-card-summary"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`order-details-${order.id}`}
                  >
                    <div className="orders-card-main">
                      <span className="orders-card-kicker">
                        {tUi('ui.pages.orders.order_38ea576ed6')}
                        {order.id}
                      </span>
                      <h2 className="orders-card-title">
                        {formatCurrency(order.total_amount)}
                      </h2>
                      <p className="orders-card-meta">
                        {tUi('ui.pages.orders.createdAt_c1c945138d')}{' '}
                        {formatDate(order.created_at)}
                        {' · '}
                        {tUi('ui.pages.orders.itemCount_b4e8c2d3e8', { count: orderItems.length })}
                      </p>
                    </div>

                    <div className="orders-card-side">
                      <span className={`orders-status-badge orders-status-badge--${normalizedStatus}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                      <FiChevronDown
                        className={`orders-card-chevron ${isExpanded ? 'orders-card-chevron--open' : ''}`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  {isCreated && (
                    <div className="orders-card-actions">
                      <button
                        type="button"
                        className="orders-btn orders-btn--secondary"
                        onClick={() => handleRequestInstallment(order.id)}
                      >
                        {tUi('ui.pages.orders.installments_4c5bfead63')}
                      </button>
                      <button
                        type="button"
                        className="orders-btn orders-btn--primary"
                        onClick={() => handlePayment(order)}
                      >
                        <FaCreditCard aria-hidden="true" />
                        {tUi('ui.pages.orders.payNow_d00d5b40a5')}
                      </button>
                      <button
                        type="button"
                        className="orders-btn orders-btn--danger"
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingOrderId === order.id}
                      >
                        {cancellingOrderId === order.id
                          ? tUi('ui.pages.orders.cancelling_cc8321f695')
                          : tUi('ui.pages.orders.cancel_65fb3d7ea4')}
                      </button>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        id={`order-details-${order.id}`}
                        className="orders-card-details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                      >
                        <div className="orders-details-inner">
                          <section className="orders-detail-block">
                            <h3>{tUi('ui.pages.orders.orderInformation_f464cbfbf9')}</h3>
                            <dl className="orders-info-grid">
                              <div className="orders-info-row">
                                <dt>{tUi('ui.pages.orders.createdAt_4bb4a07af1')}</dt>
                                <dd>{formatDate(order.created_at)}</dd>
                              </div>
                              <div className="orders-info-row">
                                <dt>{tUi('ui.pages.orders.totalAmount_35b3b02116')}</dt>
                                <dd>{formatCurrency(order.total_amount)}</dd>
                              </div>
                              {order.promotion_discount > 0 && (
                                <div className="orders-info-row">
                                  <dt>{tUi('ui.pages.orders.promotionSaved_b4e8c2d3ea')}</dt>
                                  <dd>-{formatCurrency(order.promotion_discount)}</dd>
                                </div>
                              )}
                            </dl>
                          </section>

                          {ACTIVE_DELIVERY_STATUSES.includes(normalizedStatus) && (
                            <section className="orders-detail-block delivery-tracking-section">
                              <h4 className="delivery-tracking-heading">
                                <span className="delivery-tracking-icon" aria-hidden="true">🚚</span>
                                <span>{tUi('ui.pages.orders.deliveryTrackingTitle_b4e8c2d3ed')}</span>
                              </h4>
                              <div className="delivery-stepper">
                                {DELIVERY_STEPS.map((step, stepIndex) => {
                                  const currentIdx = DELIVERY_STEPS.indexOf(normalizedStatus);
                                  const isActive = stepIndex <= currentIdx;
                                  const isCurrent = stepIndex === currentIdx;
                                  return (
                                    <div
                                      key={step}
                                      className={`stepper-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
                                    >
                                      <span className="stepper-icon">{DELIVERY_STEP_ICONS[step]}</span>
                                      <span className="stepper-label">{tUi(DELIVERY_STEP_LABEL_KEYS[step])}</span>
                                      {stepIndex < DELIVERY_STEPS.length - 1 && (
                                        <span className={`stepper-line ${stepIndex < currentIdx ? 'active' : ''}`} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {order.delivery_address && (
                                <div className="info-row">
                                  <span className="info-label">{tUi('ui.pages.orders.deliveryAddress_45393d8d55')}</span>
                                  <span className="info-value">{order.delivery_address}</span>
                                </div>
                              )}
                              {['assigned', 'picked_up', 'delivering'].includes(normalizedStatus) && (
                                <div className="orders-delivery-chat">
                                  <button
                                    type="button"
                                    className="orders-btn orders-btn--success"
                                    onClick={() => handleOpenDriverChat(order.id)}
                                  >
                                    <FiMessageCircle aria-hidden="true" />
                                    {tUi('ui.pages.orders.chatWithDriver_3f7e508f43')}
                                  </button>
                                </div>
                              )}
                            </section>
                          )}

                          <section className="orders-detail-block">
                            <h3>
                              <FaBoxOpen aria-hidden="true" />
                              {tUi('ui.pages.orders.productsHeading_b4e8c2d3eb', { count: orderItems.length })}
                            </h3>
                            {orderItems.length === 0 ? (
                              <p className="orders-no-items">{tUi('ui.pages.orders.noProductsFoundInThis_be568ee99b')}</p>
                            ) : (
                              <ul className="orders-items-list">
                                {orderItems.map((item) => {
                                  const localized = localizeProduct(item.product || {}, languageCode);
                                  const productName = localized.localized_name || item.product?.name || tUi('ui.pages.orders.productFallback_b4e8c2d3ec');
                                  const productImage = item.product?.images?.length
                                    ? getImageUrl(item.product.images[0])
                                    : getImageUrl('/images/placeholder.jpg');

                                  return (
                                    <li key={item.id} className="orders-item">
                                      <Link
                                        to={`/products/${encodeURIComponent(item.product?.name || productName)}`}
                                        className="orders-item-image-link"
                                      >
                                        <img
                                          src={productImage}
                                          alt={productName}
                                          onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                                          }}
                                        />
                                      </Link>
                                      <div className="orders-item-copy">
                                        <Link to={`/products/${encodeURIComponent(item.product?.name || productName)}`}>
                                          <h4>{productName}</h4>
                                        </Link>
                                        <p>
                                          {tUi('ui.pages.orders.quantity_0d9a3fd69e')} {item.quantity}
                                        </p>
                                      </div>
                                      <div className="orders-item-pricing">
                                        <p>
                                          {formatCurrency(item.price)} {tUi('ui.pages.orders.each_4552f18ca7')}
                                        </p>
                                        <p className="orders-item-total">
                                          {tUi('ui.pages.orders.total_0b209e736b')} {formatCurrency(item.total)}
                                        </p>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </section>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>
        </section>
      )}

      {activeChatJobId && (
        <DeliveryChatModal
          isOpen={!!activeChatJobId}
          onClose={() => setActiveChatJobId(null)}
          jobId={activeChatJobId}
          token={token}
          currentUserId={currentUserId}
          isDriver={false}
        />
      )}
    </div>
  );
};

export default Orders;
