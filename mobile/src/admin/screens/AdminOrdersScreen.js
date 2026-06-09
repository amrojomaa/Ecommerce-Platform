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
import {
  TIME_PERIODS,
  getDefaultTimeValue,
  orderMatchesTimePeriod,
} from '../../utils/orderTimeFilter';
import {
  ADMIN_ORDER_STATUS_FILTERS,
  ORDER_STATUS_LABEL_KEYS,
  filterOrdersByStatus,
  getAvailableOrderStatusTransitions,
} from '../../utils/orderStatuses';

const TIME_PERIOD_LABEL_KEYS = {
  all: 'ui.pages.admin.adminOrders.timePeriodAll_a1b2c3d4e5',
  day: 'ui.pages.admin.adminOrders.timePeriodDay_f6g7h8i9j0',
  month: 'ui.pages.admin.adminOrders.timePeriodMonth_k1l2m3n4o5',
  year: 'ui.pages.admin.adminOrders.timePeriodYear_p6q7r8s9t0',
};

const ORDER_FILTER_LABEL_KEYS = {
  all: 'ui.mobile.common.all',
  revenue: 'ui.pages.admin.adminOrders.revenue_a1caf5553a',
  pos: 'ui.pages.admin.adminOrders.pos_a479fcd150',
  created: 'ui.pages.orders.status.created',
  paid: 'ui.pages.orders.status.paid',
  preparing: 'ui.pages.orders.status.preparing',
  packed: 'ui.pages.orders.status.packed',
  ready_for_pickup: 'ui.pages.orders.status.readyForPickup',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
};

const statusToneMap = {
  paid: 'success',
  delivered: 'success',
  packed: 'warning',
  ready_for_pickup: 'warning',
  preparing: 'warning',
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

  const getTimePeriodLabel = useCallback(
    (period) => {
      const key = TIME_PERIOD_LABEL_KEYS[period];
      return key ? tUi(key) : period;
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
  const [timePeriod, setTimePeriod] = useState('all');
  const [timeValue, setTimeValue] = useState('');
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
    let list = filterOrdersByStatus(allOrders, statusFilter);
    list = list.filter((order) => orderMatchesTimePeriod(order, timePeriod, timeValue));

    const term = searchQuery.trim().toLowerCase();
    if (term) {
      list = list.filter((order) => {
        const id = String(order.id || order.order_id || '').toLowerCase();
        const customer = String(order.customer_name || order.user?.email || '').toLowerCase();
        return id.includes(term) || customer.includes(term);
      });
    }

    setOrders(list);
  }, [allOrders, searchQuery, statusFilter, timePeriod, timeValue]);

  const handleTimePeriodSelect = (period) => {
    const nextValue = period === 'all' ? '' : getDefaultTimeValue(period);
    setTimePeriod(period);
    setTimeValue(nextValue);
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setTimePeriod('all');
    setTimeValue('');
    setSearchQuery('');
  };

  const hasActiveFilters =
    statusFilter !== 'all' || timePeriod !== 'all' || searchQuery.trim().length > 0;

  const getEmptyMessage = () => {
    if (timePeriod !== 'all') {
      return tUi('ui.pages.admin.adminOrders.noOrdersFoundForTime_u1v2w3x4y5');
    }
    return tUi('ui.pages.admin.adminOrders.noOrdersFound_fc2cb6ab28');
  };

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

  const getAvailableStatuses = (order) =>
    getAvailableOrderStatusTransitions(order?.status, { saleChannel: order?.sale_channel });

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
        {ADMIN_ORDER_STATUS_FILTERS.map((filter) => (
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

      <Text style={styles.filterLabel}>
        {tUi('ui.pages.admin.adminOrders.filterByTime_z6a7b8c9d0')}
      </Text>
      <View style={styles.filterRow}>
        {TIME_PERIODS.map((period) => (
          <Pressable
            key={period}
            style={[styles.filterChip, timePeriod === period && styles.filterChipActive]}
            onPress={() => handleTimePeriodSelect(period)}
          >
            <Text
              style={[styles.filterText, timePeriod === period && styles.filterTextActive]}
            >
              {getTimePeriodLabel(period)}
            </Text>
          </Pressable>
        ))}
      </View>

      {timePeriod === 'day' ? (
        <View style={[styles.dateRow, { flexDirection: row }]}>
          <Feather name="calendar" size={16} color={colors.muted} />
          <TextInput
            style={[styles.dateInput, inputRtlStyle]}
            value={timeValue}
            onChangeText={setTimeValue}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={tUi('ui.pages.admin.adminOrders.selectDay_e1f2g3h4i5')}
          />
        </View>
      ) : null}

      {timePeriod === 'month' ? (
        <View style={[styles.dateRow, { flexDirection: row }]}>
          <Feather name="calendar" size={16} color={colors.muted} />
          <TextInput
            style={[styles.dateInput, inputRtlStyle]}
            value={timeValue}
            onChangeText={setTimeValue}
            placeholder="YYYY-MM"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={tUi('ui.pages.admin.adminOrders.selectMonth_j6k7l8m9n0')}
          />
        </View>
      ) : null}

      {timePeriod === 'year' ? (
        <View style={[styles.dateRow, { flexDirection: row }]}>
          <Feather name="calendar" size={16} color={colors.muted} />
          <TextInput
            style={[styles.dateInput, inputRtlStyle]}
            value={timeValue}
            onChangeText={setTimeValue}
            placeholder="YYYY"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel={tUi('ui.pages.admin.adminOrders.selectYear_o1p2q3r4s5')}
          />
        </View>
      ) : null}

      {hasActiveFilters ? (
        <Pressable style={styles.clearFiltersButton} onPress={clearAllFilters}>
          <Text style={styles.clearFiltersText}>
            {tUi('ui.pages.admin.adminOrders.showAllOrders_a234fdd874')}
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.searchRow, { flexDirection: row }]}>
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
            <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
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
              getAvailableStatuses(statusModalOrder).map((status) => (
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
  dateRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
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
