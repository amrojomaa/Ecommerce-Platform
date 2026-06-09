import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { navigateToCustomerTab } from '../navigation/customerNavigation';
import CustomerScreen from '../components/CustomerScreen';
import DeliveryChatModal from '../../admin/components/DeliveryChatModal';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import { useLanguage } from '../../context/LanguageContext';
import { localizeProduct } from '../../utils/localizedContent';
import { buildImageUrl, formatDateTime } from '../../admin/utils/format';
import { confirmAction } from '../../admin/utils/confirm';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, ORDER_ENDPOINTS, buildUrl } from '../../config/api';

const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  pending: 'ui.pages.orders.status.pending',
  paid: 'ui.pages.orders.status.paid',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
  canceled: 'ui.pages.orders.status.cancelled',
  failed: 'ui.pages.orders.status.failed',
  packed: 'ui.pages.orders.status.packed',
  preparing: 'ui.pages.orders.status.preparing',
};

const OrdersScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { row, textAlign } = useRtlLayout();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [activeChatJobId, setActiveChatJobId] = useState(null);

  const getStatusLabel = (status) => {
    const key = ORDER_STATUS_LABEL_KEYS[String(status || 'created').toLowerCase()];
    return key ? tUi(key) : String(status || '').replace(/_/g, ' ');
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(ORDER_ENDPOINTS.MY_ORDERS);
      setOrders(response.data || []);
    } catch (error) {
      if (error.response?.status === 404) {
        setOrders([]);
      } else {
        Toast.show({
          type: 'error',
          text1: tUi('ui.pages.orders.failedToFetch_b4e8c2d3e3', {
            value0: error.response?.data?.detail || error.message,
          }),
        });
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancel = async (orderId) => {
    const confirmed = await confirmAction(
      tUi('ui.pages.orders.cancelOrder_8a957aa9d2'),
      tUi('ui.pages.orders.cancelConfirmMessage_b4e8c2d3e2', { value0: orderId }),
      tUi('ui.pages.orders.cancelOrder_8a957aa9d2'),
      tUi('ui.pages.orders.keepOrder_49c5b284e1')
    );
    if (!confirmed) return;

    setCancellingOrderId(orderId);
    try {
      await http.patch(buildUrl(ORDER_ENDPOINTS.CANCEL, { order_id: orderId }));
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
      );
      Toast.show({ type: 'success', text1: tUi('ui.pages.orders.orderCancelledSuccessfully_5a659ac4b5') });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.orders.failedToCancel_b4e8c2d3e4', {
          value0: error.response?.data?.detail || error.message,
        }),
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const openDriverChat = async (orderId) => {
    try {
      const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.GET_JOB_BY_ORDER, { order_id: orderId }));
      setActiveChatJobId(response.data.id);
    } catch (_) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.orders.couldNotLoadChatTry_4843980c57') });
    }
  };

  const subtitle =
    orders.length === 0
      ? tUi('ui.pages.orders.subtitleEmpty_b4e8c2d3e1')
      : tUi(
          orders.length === 1
            ? 'ui.pages.orders.subtitleWithCount_b4e8c2d3e0'
            : 'ui.pages.orders.subtitleWithCount_b4e8c2d3e0_plural',
          { count: orders.length }
        );

  return (
    <CustomerScreen showBack title={tUi('ui.pages.orders.myOrders_9215f6342b')} subtitle={subtitle}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text, textAlign }]}>{tUi('ui.pages.orders.emptyTitle_b4e8c2d3e5')}</Text>
          <Pressable onPress={() => navigateToCustomerTab(navigation, 'Products')}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{tUi('ui.pages.orders.startShopping_aea59217fe')}</Text>
          </Pressable>
        </View>
      ) : (
        orders.map((order) => {
          const expanded = expandedOrderId === order.id;
          const canCancel = String(order.status).toLowerCase() === 'created';
          const canPay = ['created', 'pending'].includes(String(order.status).toLowerCase());
          const showChat = ['paid', 'assigned', 'picked_up', 'delivering', 'delivered'].includes(
            String(order.status).toLowerCase()
          );

          return (
            <View
              key={order.id}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Pressable onPress={() => setExpandedOrderId(expanded ? null : order.id)}>
                <View style={[styles.cardHeader, { flexDirection: row }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.orderId, { color: colors.text }]}>
                      {tUi('ui.pages.orders.order_38ea576ed6')}{order.id}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDateTime(order.created_at)}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${colors.primary}18` }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
                </View>
                <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 8 }}>
                  {formatCurrency(order.total_amount)}
                </Text>
              </Pressable>

              {expanded ? (
                <View style={styles.details}>
                  {order.orderitems?.length ? (
                    order.orderitems.map((item) => {
                      const localized = localizeProduct(item.product, language);
                      return (
                        <View key={item.id} style={[styles.lineItem, { flexDirection: row }]}>
                          <Image
                            source={{ uri: buildImageUrl(item.product?.images?.[0]) }}
                            style={styles.lineImage}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>
                              {localized?.localized_name || item.product?.name}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>
                              {tUi('ui.pages.orders.quantity_0d9a3fd69e')} {item.quantity}
                            </Text>
                          </View>
                          <Text style={{ color: colors.text, fontWeight: '600' }}>
                            {formatCurrency(item.price * item.quantity)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ color: colors.muted }}>{tUi('ui.pages.orders.noProductsFoundInThis_be568ee99b')}</Text>
                  )}

                  <View style={[styles.actions, { flexDirection: row }]}>
                    {canPay ? (
                      <Pressable
                        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                        onPress={() =>
                          navigation.navigate('Payment', {
                            amount: order.total_amount,
                            orderId: order.id,
                          })
                        }
                      >
                        <Text style={styles.primaryBtnText}>{tUi('ui.pages.orders.payNow_d00d5b40a5')}</Text>
                      </Pressable>
                    ) : null}
                    {canCancel ? (
                      <Pressable
                        style={[styles.outlineBtn, { borderColor: colors.border }]}
                        onPress={() => handleCancel(order.id)}
                        disabled={cancellingOrderId === order.id}
                      >
                        <Text style={{ color: colors.danger, fontWeight: '600' }}>
                          {cancellingOrderId === order.id
                            ? tUi('ui.pages.orders.cancelling_cc8321f695')
                            : tUi('ui.pages.orders.cancel_65fb3d7ea4')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <Pressable
                    style={[styles.linkBtn, { borderColor: colors.border }]}
                    onPress={() => navigation.navigate('Installments', { orderId: order.id })}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {tUi('ui.pages.orders.requestInstallmentPlan_b342be35bd')}
                    </Text>
                  </Pressable>

                  {showChat ? (
                    <Pressable style={[styles.linkBtn, { borderColor: colors.border }]} onPress={() => openDriverChat(order.id)}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        {tUi('ui.pages.orders.chatWithDriver_3f7e508f43')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <DeliveryChatModal
        visible={Boolean(activeChatJobId)}
        jobId={activeChatJobId}
        onClose={() => setActiveChatJobId(null)}
      />
    </CustomerScreen>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    card: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      ...shadow,
    },
    cardHeader: { alignItems: 'center', gap: 8 },
    orderId: { fontSize: 16, fontWeight: '700' },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    details: { marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    lineItem: { gap: 10, alignItems: 'center', marginBottom: 8 },
    lineImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.surfaceAlt },
    actions: { flexWrap: 'wrap', gap: 8, marginTop: 8 },
    primaryBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    outlineBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
    linkBtn: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
  });

export default OrdersScreen;
