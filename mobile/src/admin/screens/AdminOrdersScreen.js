import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import OrderMapTracker from '../components/OrderMapTracker';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { ORDER_ENDPOINTS } from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';
import { usePanelRole } from '../hooks/usePanelRole';
import { buildImageUrl, formatDateTime } from '../utils/format';

const STATUS_FILTERS = [
  'all',
  'revenue',
  'pos',
  'created',
  'paid',
  'assigned',
  'picked_up',
  'delivering',
  'shipped',
  'delivered',
  'cancelled',
];

const ORDER_FILTER_LABEL_KEYS = {
  all: 'ui.mobile.common.all',
  revenue: 'ui.pages.admin.adminOrders.revenue_a1caf5553a',
  pos: 'ui.pages.admin.adminOrders.pos_a479fcd150',
  created: 'ui.pages.orders.status.created',
  paid: 'ui.pages.orders.status.paid',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
};

const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  paid: 'ui.pages.orders.status.paid',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
};

const statusToneMap = {
  paid: 'success',
  shipped: 'success',
  delivered: 'success',
  assigned: 'warning',
  picked_up: 'warning',
  delivering: 'warning',
  pending: 'warning',
  created: 'default',
  cancelled: 'danger',
};

const AdminOrdersScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const getOrderStatusLabel = useCallback(
    (status) => {
      const normalized = String(status || 'created').toLowerCase();
      const key = ORDER_STATUS_LABEL_KEYS[normalized];
      return key ? tUi(key) : normalized;
    },
    [tUi]
  );

  const getFilterLabel = useCallback(
    (filter) => {
      const key = ORDER_FILTER_LABEL_KEYS[filter];
      return key ? tUi(key) : filter.replace('_', ' ');
    },
    [tUi]
  );

  const { formatCurrency } = useCurrency();

  const mapLabels = useMemo(
    () => ({
      unavailable: tUi('ui.mobile.mapTracker.unavailable'),
      coordsUnavailable: tUi('ui.mobile.mapTracker.coordsUnavailable'),
      pickup: tUi('ui.mobile.mapTracker.pickupLocation'),
      delivery: tUi('ui.mobile.mapTracker.deliveryLocation'),
      driver: tUi('ui.mobile.mapTracker.driverLocation'),
      live: tUi('ui.mobile.mapTracker.liveTracking'),
      deliveryCompleted: tUi('ui.mobile.adminDeliveries.deliveryCompleted'),
      deliveryCancelled: tUi('ui.mobile.adminDeliveries.deliveryCancelled'),
      trackingDeliveredInactive: tUi('ui.mobile.adminDeliveries.trackingDeliveredInactive'),
      trackingCancelledInactive: tUi('ui.mobile.adminDeliveries.trackingCancelledInactive'),
    }),
    [tUi]
  );

  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedOrderTab, setExpandedOrderTab] = useState('details');
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
      const data = Array.isArray(response.data) ? response.data : response.data?.orders || [];
      setAllOrders(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    let list = [...allOrders];
    if (statusFilter === 'revenue') {
      list = list.filter((order) => ['paid', 'shipped', 'delivered'].includes(order.status));
    } else if (statusFilter === 'pos') {
      list = list.filter((order) => order.sale_channel === 'pos');
    } else if (statusFilter !== 'all') {
      list = list.filter((order) => (order.status || 'created') === statusFilter);
    }

    const term = searchQuery.trim().toLowerCase();
    if (term) {
      list = list.filter((order) => {
        const id = String(order.id || order.order_id || '').toLowerCase();
        const customer = String(order.customer_name || order.user?.email || '').toLowerCase();
        return id.includes(term) || customer.includes(term);
      });
    }

    setOrders(list);
  }, [allOrders, searchQuery, statusFilter]);

  const handleUpdateStatus = async (order, newStatus) => {
    if (!order || !newStatus) return;
    setUpdatingStatus(true);
    try {
      await http.patch(ORDER_ENDPOINTS.UPDATE_STATUS.replace('{order_id}', order.id), {
        status: newStatus,
      });
      const next = allOrders.map((item) =>
        item.id === order.id ? { ...item, status: newStatus } : item
      );
      setAllOrders(next);
      setStatusModalOrder(null);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getAvailableStatuses = (status) => {
    if (status === 'paid') return ['shipped', 'cancelled'];
    if (status === 'shipped') return ['delivered', 'cancelled'];
    if (['assigned', 'picked_up', 'delivering'].includes(status)) return ['cancelled'];
    return ['cancelled'];
  };

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === expandedOrderId) || null,
    [expandedOrderId, orders]
  );

  useEffect(() => {
    setExpandedOrderTab('details');
  }, [expandedOrderId]);

  const selectedDelivery = selectedOrder?.order_delivery || null;

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.admin.adminOrders.allOrders_4b39990b5b')}
      subtitle={tUi('ui.pages.admin.adminOrders.subtitle_1a2b3c4d5e')}
    >
      <Text style={styles.filterLabel}>{tUi('ui.pages.admin.adminOrders.filterByStatus_c0507d4cfa')}</Text>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text
              style={[styles.filterText, statusFilter === filter && styles.filterTextActive]}
            >
              {getFilterLabel(filter)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.mobile.common.search')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {orders.map((order) => {
            const status = order.status || 'created';
            const meta = `${formatCurrency(order.total_amount || 0)} | ${formatDateTime(
              order.created_at
            )}`;
            return (
              <AdminListItem
                key={order.id}
                title={tUi('ui.pages.admin.adminDeliveries.orderTitle_8e5d31f868', {
                  value0: order.id,
                })}
                subtitle={
                  order.sale_channel === 'pos'
                    ? order.customer_name || tUi('ui.pages.admin.adminOrders.inStorePosSale_28efdad1f0')
                    : order.user?.email || tUi('ui.pages.admin.adminOrders.customer_af49dd1c93')
                }
                meta={meta}
                status={getOrderStatusLabel(status)}
                statusTone={statusToneMap[status] || 'default'}
                onPress={() =>
                  setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                }
                right={
                  <Pressable onPress={() => setStatusModalOrder(order)}>
                    <Text style={styles.inlineButton}>{tUi('ui.pages.admin.adminOrders.changeStatus_82cd1fa50c')}</Text>
                  </Pressable>
                }
              />
            );
          })}
          {!orders.length ? (
            <Text style={styles.emptyText}>{tUi('ui.pages.admin.adminOrders.noOrdersFound_fc2cb6ab28')}</Text>
          ) : null}
        </View>
      )}

      {selectedOrder ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{tUi('ui.mobile.adminOrders.orderDetails')}</Text>
          <Text style={styles.detailMeta}>
            {tUi('ui.pages.admin.adminDeliveries.orderTitle_8e5d31f868', {
              value0: selectedOrder.id,
            })}
          </Text>
          <Text style={styles.detailMeta}>{formatDateTime(selectedOrder.created_at)}</Text>

          {selectedDelivery ? (
            <View style={[styles.tabRow, { flexDirection: row }]}>
              <Pressable
                style={[styles.tabChip, expandedOrderTab === 'details' && styles.tabChipActive]}
                onPress={() => setExpandedOrderTab('details')}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    expandedOrderTab === 'details' && styles.tabChipTextActive,
                  ]}
                >
                  {tUi('ui.mobile.adminOrders.tabDetails')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabChip, expandedOrderTab === 'report' && styles.tabChipActive]}
                onPress={() => setExpandedOrderTab('report')}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    expandedOrderTab === 'report' && styles.tabChipTextActive,
                  ]}
                >
                  {tUi('ui.pages.admin.adminOrders.driverReport_1685bd9703')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabChip, expandedOrderTab === 'map' && styles.tabChipActive]}
                onPress={() => setExpandedOrderTab('map')}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    expandedOrderTab === 'map' && styles.tabChipTextActive,
                  ]}
                >
                  {tUi('ui.pages.admin.adminOrders.liveTrackingMap_5e6f7a8b9c')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {expandedOrderTab === 'details' || !selectedDelivery ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminOrders.items_716d042f1e')}</Text>
              {(selectedOrder.items || selectedOrder.orderitems || []).map((item) => (
                <View key={item.id} style={[styles.detailRow, { flexDirection: row }]}>
                  <Text style={styles.detailValue}>
                    {item.product?.name || tUi('ui.pages.admin.adminOrders.nA_eb6526e85d')}
                  </Text>
                  <Text style={styles.detailValue}>{`${item.quantity} x ${formatCurrency(
                    item.price
                  )}`}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {expandedOrderTab === 'report' && selectedDelivery ? (
            <View style={styles.detailSection}>
              {selectedDelivery.issue_type ? (
                <Text style={styles.detailValue}>
                  <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminOrders.type_5479c42965')} </Text>
                  {String(selectedDelivery.issue_type).replace(/_/g, ' ')}
                </Text>
              ) : (
                <Text style={styles.detailMeta}>
                  {tUi('ui.pages.admin.adminOrders.noIssueTypeProvided_be64d46132')}
                </Text>
              )}
              {selectedDelivery.issue_description ? (
                <Text style={[styles.detailValue, { marginTop: 8 }]}>
                  <Text style={styles.detailLabel}>
                    {tUi('ui.pages.admin.adminOrders.description_ddd5e10a09')}{' '}
                  </Text>
                  {selectedDelivery.issue_description}
                </Text>
              ) : null}
              {Array.isArray(selectedDelivery.photos) && selectedDelivery.photos.length > 0 ? (
                <View style={[styles.photoGrid, { flexDirection: row }]}>
                  {selectedDelivery.photos.map((photo) => (
                    <View key={photo.id} style={styles.photoCard}>
                      <Image
                        source={{ uri: buildImageUrl(photo.image_path) }}
                        style={styles.photoImage}
                      />
                      <Text style={styles.photoCaption}>
                        {String(photo.photo_type || '').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {expandedOrderTab === 'map' && selectedDelivery ? (
            <View style={styles.detailSection}>
              <OrderMapTracker deliveryJob={selectedDelivery} labels={mapLabels} />
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal transparent visible={!!statusModalOrder} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setStatusModalOrder(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{tUi('ui.mobile.adminOrders.updateStatus')}</Text>
            {statusModalOrder &&
              getAvailableStatuses(statusModalOrder.status || 'created').map((status) => (
                <Pressable
                  key={status}
                  style={styles.modalOption}
                  onPress={() => handleUpdateStatus(statusModalOrder, status)}
                  disabled={updatingStatus}
                >
                  <Text style={styles.modalOptionText}>{getOrderStatusLabel(status)}</Text>
                </Pressable>
              ))}
            <Pressable style={styles.secondaryButton} onPress={() => setStatusModalOrder(null)}>
              <Text style={styles.secondaryButtonText}>{tUi('ui.mobile.common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.surface,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  inlineButton: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  detailMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  detailSection: {
    marginTop: 12,
  },
  tabRow: {
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  tabChipTextActive: {
    color: colors.surface,
  },
  photoGrid: {
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  photoCard: {
    width: 110,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  photoImage: {
    width: '100%',
    height: 90,
  },
  photoCaption: {
    fontSize: 11,
    color: colors.muted,
    padding: 6,
    textTransform: 'capitalize',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 10,
  },
  modalOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
});

export default AdminOrdersScreen;
