import React, { useCallback, useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import { buildImageUrl, formatDateTime } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';
import { useWarehousePreparingCount } from '../../hooks/useWarehousePreparingCount';

const ORDER_STATUS_LABEL_KEYS = {
  preparing: 'ui.pages.orders.status.preparing',
  packed: 'ui.pages.orders.status.packed',
  ready_for_pickup: 'ui.pages.orders.status.readyForPickup',
};

const ORDER_FILTERS = ['preparing', 'packed'];

const ISSUE_TYPES = [
  { value: 'damaged', labelKey: 'ui.pages.warehouseStaff.warehouseStaffOrders.issueDamaged_p5q6r7s8t9' },
  { value: 'missing', labelKey: 'ui.pages.warehouseStaff.warehouseStaffOrders.issueMissing_u0v1w2x3y4' },
  { value: 'other', labelKey: 'ui.pages.warehouseStaff.warehouseStaffOrders.issueOther_z5a6b7c8d9' },
];

const WarehouseStaffOrdersScreen = () => {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { textAlign, row, isRtl } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };
  const { refresh: refreshPreparingCount } = useWarehousePreparingCount();

  const [orders, setOrders] = useState([]);
  const [packedOrders, setPackedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = route.params?.filter;
    return ORDER_FILTERS.includes(filter) ? filter : 'preparing';
  });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [verifications, setVerifications] = useState({});
  const [packingOrderId, setPackingOrderId] = useState(null);
  const [issueModal, setIssueModal] = useState(null);
  const [issueForm, setIssueForm] = useState({ issue_type: 'damaged', description: '' });
  const [submittingIssue, setSubmittingIssue] = useState(false);

  useEffect(() => {
    const filter = route.params?.filter;
    if (ORDER_FILTERS.includes(filter)) {
      setActiveTab(filter);
    }
  }, [route.params?.filter]);

  const getOrderStatusLabel = useCallback(
    (status) => {
      const normalized = String(status || 'preparing').toLowerCase();
      const key = ORDER_STATUS_LABEL_KEYS[normalized];
      return key ? tUi(key) : normalized.replace(/_/g, ' ');
    },
    [tUi]
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [prepRes, packedRes] = await Promise.all([
        http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_ORDERS),
      ]);
      setOrders(Array.isArray(prepRes.data) ? prepRes.data : []);
      setPackedOrders(Array.isArray(packedRes.data) ? packedRes.data : []);
    } catch (_) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.warehouseStaff.warehouseStaffOrders.loadFailed_a1b2c3d4e5'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const loadVerifications = useCallback(async (orderId) => {
    try {
      const res = await http.get(buildUrl(WAREHOUSE_ENDPOINTS.GET_VERIFICATIONS, { order_id: orderId }));
      const vMap = res.data?.verifications || {};
      setVerifications((prev) => ({ ...prev, [orderId]: vMap }));
    } catch (_) {}
  }, []);

  const toggleExpand = (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!verifications[orderId]) {
      loadVerifications(orderId);
    }
  };

  const handleVerifyItem = async (orderId, orderItemId, verified) => {
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.VERIFY_ITEM, { order_id: orderId }), {
        order_item_id: orderItemId,
        verified,
      });
      setVerifications((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          [orderItemId]: verified ? { verified: true } : { verified: false },
        },
      }));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyFailed_f6g7h8i9j0'),
      });
    }
  };

  const isItemVerified = (orderId, itemId) => verifications[orderId]?.[itemId]?.verified === true;

  const getVerifiedCount = (orderId, items) => {
    if (!items || !verifications[orderId]) return 0;
    return items.filter((item) => verifications[orderId]?.[item.id]?.verified === true).length;
  };

  const handlePackOrder = async (orderId) => {
    setPackingOrderId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.PACK_ORDER, { order_id: orderId }));
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packSuccess_k1l2m3n4o5'),
      });
      setExpandedOrder(null);
      fetchOrders();
      refreshPreparingCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packFailed_p5q6r7s8t9'),
      });
    } finally {
      setPackingOrderId(null);
    }
  };

  const openIssueModal = (orderId, orderItemId, productName) => {
    setIssueModal({ orderId, orderItemId, productName });
    setIssueForm({ issue_type: 'damaged', description: '' });
  };

  const handleSubmitIssue = async () => {
    if (!issueForm.description.trim()) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDescRequired_u1v2w3x4y5'),
      });
      return;
    }
    setSubmittingIssue(true);
    try {
      await http.post(buildUrl(WAREHOUSE_ENDPOINTS.REPORT_ISSUE, { order_id: issueModal.orderId }), {
        order_item_id: issueModal.orderItemId,
        issue_type: issueForm.issue_type,
        description: issueForm.description,
      });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueReported_z6a7b8c9d0'),
      });
      setIssueModal(null);
      fetchOrders();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueFailed_e1f2g3h4i5'),
      });
    } finally {
      setSubmittingIssue(false);
    }
  };

  const displayOrders = activeTab === 'preparing' ? orders : packedOrders;
  const emptyMessage =
    activeTab === 'preparing'
      ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.emptyPreparing_t6u7v8w9x0')
      : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.emptyPacked_y1z2a3b4c5');

  const orderCountLabel =
    displayOrders.length === 1
      ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.orderCountOne_d5e6f7g8h9')
      : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.orderCountMany_i0j1k2l3m4');

  const filterBar = (
    <View style={styles.filterWrap}>
      <View style={styles.filterRow}>
        {ORDER_FILTERS.map((value) => (
          <Pressable
            key={value}
            style={[styles.filterChip, activeTab === value && styles.filterChipActive]}
            onPress={() => {
              setActiveTab(value);
              setExpandedOrder(null);
            }}
          >
            <Text style={[styles.filterChipText, activeTab === value && styles.filterChipTextActive]}>
              {value === 'preparing'
                ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.filterPreparing_j6k7l8m9n0')
                : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.filterPacked_o1p2q3r4s5')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.countMeta}>
        <Text style={styles.countStrong}>{displayOrders.length}</Text> {orderCountLabel}
      </Text>
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouseStaff.warehouseStaffOrders.title_n5o6p7q8r9')}
      subtitle={tUi('ui.pages.warehouseStaff.warehouseStaffOrders.subtitle_s0t1u2v3w4')}
      action={filterBar}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : displayOrders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="package" size={32} color={colors.muted} />
          <Text style={[styles.emptyText, { textAlign }]}>{emptyMessage}</Text>
        </View>
      ) : (
        displayOrders.map((order) => {
          const orderItems = order.items || order.orderitems || [];
          const isExpanded = expandedOrder === order.id;
          const verifiedCount = getVerifiedCount(order.id, orderItems);
          const allVerified = orderItems.length > 0 && verifiedCount >= orderItems.length;
          const hasOpenIssues =
            Array.isArray(order.warehouse_issues) &&
            order.warehouse_issues.some((issue) => issue.status === 'open');
          const progressPct =
            orderItems.length > 0 ? Math.round((verifiedCount / orderItems.length) * 100) : 0;

          return (
            <View key={order.id} style={styles.orderCard}>
              <Pressable
                style={[styles.orderHeader, { flexDirection: row }]}
                onPress={() => toggleExpand(order.id)}
              >
                <View style={styles.orderMain}>
                  <Text style={[styles.orderId, { textAlign }]}>
                    {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.orderLabel_c0d1e2f3g4', {
                      value0: order.id,
                    })}
                  </Text>
                  <Text style={[styles.orderMeta, { textAlign }]}>
                    {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.metaLine_h5i6j7k8l9', {
                      value0: orderItems.length,
                      value1: formatDateTime(order.created_at),
                    })}
                  </Text>
                </View>
                <View style={styles.orderEnd}>
                  <Text style={styles.statusPill}>{getOrderStatusLabel(order.status)}</Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.muted}
                  />
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.orderDetail}>
                  {order.user ? (
                    <View style={[styles.customerRow, { flexDirection: row }]}>
                      <Feather name="user" size={16} color={colors.primary} />
                      <Text style={[styles.customerText, { textAlign }]}>
                        <Text style={styles.customerLabel}>
                          {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.customer_a0b1c2d3e4')}:{' '}
                        </Text>
                        {[order.user.first_name, order.user.last_name].filter(Boolean).join(' ') ||
                          tUi('ui.pages.warehouseStaff.warehouseStaffOrders.customerNameFallback_a1b2c3d4e5')}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.verifyHead, { flexDirection: row }]}>
                    <Text style={styles.verifyTitle}>
                      {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyTitle_m0n1o2p3q4')}
                    </Text>
                    {order.status === 'preparing' && orderItems.length > 0 ? (
                      <Text style={[styles.verifyBadge, allVerified && styles.verifyBadgeComplete]}>
                        {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyProgress_g0h1i2j3k4', {
                          value0: verifiedCount,
                          value1: orderItems.length,
                        })}
                      </Text>
                    ) : null}
                  </View>

                  {orderItems.map((item) => {
                    const verified = isItemVerified(order.id, item.id);
                    const stockOnHand = item.product?.quantity ?? 0;
                    const imageSrc = item.product?.images?.[0]
                      ? buildImageUrl(item.product.images[0])
                      : null;

                    return (
                      <View
                        key={item.id}
                        style={[styles.verifyItem, verified && styles.verifyItemDone]}
                      >
                        <View style={[styles.verifyItemMain, { flexDirection: row }]}>
                          {order.status === 'preparing' ? (
                            <Switch
                              value={verified}
                              onValueChange={(value) => handleVerifyItem(order.id, item.id, value)}
                              trackColor={{ false: colors.border, true: colors.primary }}
                            />
                          ) : null}
                          {imageSrc ? (
                            <Image source={{ uri: imageSrc }} style={styles.itemImage} />
                          ) : (
                            <View style={styles.itemImagePlaceholder}>
                              <Feather name="package" size={16} color={colors.muted} />
                            </View>
                          )}
                          <View style={styles.itemBody}>
                            <Text style={[styles.itemName, { textAlign }]} numberOfLines={2}>
                              {item.product?.name ||
                                tUi('ui.pages.warehouseStaff.warehouseStaffOrders.productFallback_r5s6t7u8v9')}
                            </Text>
                            <Text style={[styles.itemMeta, { textAlign }]}>
                              {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.itemStockLine_b6c7d8e9f0', {
                                value0: item.quantity,
                                value1: stockOnHand,
                              })}
                            </Text>
                          </View>
                        </View>
                        {order.status === 'preparing' ? (
                          <Pressable
                            style={styles.reportButton}
                            onPress={() =>
                              openIssueModal(order.id, item.id, item.product?.name)
                            }
                          >
                            <Feather name="alert-triangle" size={14} color="#d97706" />
                            <Text style={styles.reportButtonText}>
                              {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.reportIssue_b5c6d7e8f9')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}

                  {order.status === 'preparing' ? (
                    <View style={styles.packSection}>
                      {orderItems.length > 0 ? (
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              allVerified && styles.progressFillComplete,
                              { width: `${progressPct}%` },
                            ]}
                          />
                        </View>
                      ) : null}
                      <View style={[styles.packRow, { flexDirection: row }]}>
                        <Text style={styles.progressLabel}>
                          {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.verifyProgress_g0h1i2j3k4', {
                            value0: verifiedCount,
                            value1: orderItems.length,
                          })}
                        </Text>
                        <Pressable
                          style={[
                            styles.packButton,
                            (verifiedCount < orderItems.length ||
                              packingOrderId === order.id ||
                              hasOpenIssues) &&
                              styles.packButtonDisabled,
                          ]}
                          onPress={() => handlePackOrder(order.id)}
                          disabled={
                            verifiedCount < orderItems.length ||
                            packingOrderId === order.id ||
                            hasOpenIssues
                          }
                        >
                          <Text style={styles.packButtonText}>
                            {packingOrderId === order.id
                              ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packing_l5m6n7o8p9')
                              : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.packOrder_q0r1s2t3u4')}
                          </Text>
                        </Pressable>
                      </View>
                      {hasOpenIssues ? (
                        <View style={styles.issueBanner}>
                          <Feather name="alert-triangle" size={14} color="#d97706" />
                          <Text style={styles.issueBannerText}>
                            {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.openIssuesBlock_v5w6x7y8z9')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Modal transparent visible={!!issueModal} animationType="fade" onRequestClose={() => setIssueModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIssueModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { textAlign }]}>
              {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueModalTitle_f5g6h7i8j9', {
                value0:
                  issueModal?.productName ||
                  tUi('ui.pages.warehouseStaff.warehouseStaffOrders.productFallback_r5s6t7u8v9'),
              })}
            </Text>

            <Text style={styles.fieldLabel}>
              {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueType_k0l1m2n3o4')}
            </Text>
            <View style={styles.issueTypeRow}>
              {ISSUE_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.issueTypeChip,
                    issueForm.issue_type === type.value && styles.issueTypeChipActive,
                  ]}
                  onPress={() => setIssueForm((prev) => ({ ...prev, issue_type: type.value }))}
                >
                  <Text
                    style={[
                      styles.issueTypeText,
                      issueForm.issue_type === type.value && styles.issueTypeTextActive,
                    ]}
                  >
                    {tUi(type.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDescription_e0f1g2h3i4')}
            </Text>
            <TextInput
              style={[styles.noteInput, inputRtlStyle]}
              placeholder={tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueDescPlaceholder_j5k6l7m8n9')}
              placeholderTextColor={colors.muted}
              value={issueForm.description}
              onChangeText={(description) => setIssueForm((prev) => ({ ...prev, description }))}
              multiline
            />

            <View style={[styles.modalActions, { flexDirection: row }]}>
              <Pressable style={styles.cancelButton} onPress={() => setIssueModal(null)}>
                <Text style={styles.cancelButtonText}>
                  {tUi('ui.pages.warehouseStaff.warehouseStaffOrders.cancel_y0z1a2b3c4')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.submitButton,
                  (submittingIssue || !issueForm.description.trim()) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitIssue}
                disabled={submittingIssue || !issueForm.description.trim()}
              >
                <Text style={styles.submitButtonText}>
                  {submittingIssue
                    ? tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueSubmitting_o0p1q2r3s4')
                    : tUi('ui.pages.warehouseStaff.warehouseStaffOrders.issueSubmit_t5u6v7w8x9')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    filterWrap: {
      alignItems: 'flex-end',
      maxWidth: 360,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      marginBottom: 6,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    filterChipTextActive: {
      color: '#fff',
    },
    countMeta: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'right',
    },
    countStrong: {
      fontWeight: '700',
      color: colors.text,
    },
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 12,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
    },
    orderCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: 'hidden',
      ...shadow,
    },
    orderHeader: {
      alignItems: 'center',
      padding: 14,
      gap: 10,
    },
    orderMain: {
      flex: 1,
    },
    orderEnd: {
      alignItems: 'flex-end',
      gap: 4,
    },
    orderId: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    orderMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    statusPill: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    orderDetail: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 14,
      gap: 10,
    },
    customerRow: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    customerText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
    },
    customerLabel: {
      fontWeight: '700',
    },
    verifyHead: {
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    verifyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    verifyBadge: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      backgroundColor: isDark ? colors.background : '#F1F5F9',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    verifyBadgeComplete: {
      color: '#16a34a',
      backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#DCFCE7',
    },
    verifyItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      marginBottom: 8,
      backgroundColor: isDark ? colors.background : '#FAFAFA',
    },
    verifyItemDone: {
      borderColor: isDark ? 'rgba(22,163,74,0.4)' : '#BBF7D0',
    },
    verifyItemMain: {
      alignItems: 'center',
      gap: 10,
    },
    itemImage: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.border,
    },
    itemImagePlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: isDark ? colors.surface : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBody: {
      flex: 1,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    itemMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.muted,
    },
    reportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    reportButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#d97706',
    },
    packSection: {
      marginTop: 8,
      gap: 10,
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: isDark ? colors.border : '#E2E8F0',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 999,
    },
    progressFillComplete: {
      backgroundColor: '#16a34a',
    },
    packRow: {
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    progressLabel: {
      flex: 1,
      fontSize: 12,
      color: colors.muted,
    },
    packButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    packButtonDisabled: {
      opacity: 0.5,
    },
    packButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    issueBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FFFBEB',
    },
    issueBannerText: {
      flex: 1,
      fontSize: 12,
      color: '#d97706',
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.55)',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 8,
    },
    issueTypeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    issueTypeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    issueTypeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    issueTypeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    issueTypeTextActive: {
      color: '#fff',
    },
    noteInput: {
      minHeight: 90,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#fff',
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
      marginBottom: 16,
    },
    modalActions: {
      justifyContent: 'flex-end',
      gap: 10,
    },
    cancelButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      color: colors.text,
      fontWeight: '600',
    },
    submitButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: '#fff',
      fontWeight: '700',
    },
  });

export default WarehouseStaffOrdersScreen;
