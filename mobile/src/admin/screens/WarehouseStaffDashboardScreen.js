import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import {
  ADMIN_SETTINGS_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  WAREHOUSE_ENDPOINTS,
} from '../../config/api';
import { usePanelRole } from '../hooks/usePanelRole';

const WarehouseStaffDashboardScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';
  const navigation = useNavigation();
  const { panelKicker } = usePanelRole();

  const [stats, setStats] = useState({
    preparingCount: 0,
    packedCount: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let threshold = 10;
      try {
        const threshRes = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
        threshold = threshRes.data.threshold;
        setLowStockThreshold(threshold);
      } catch (_) {}

      const [prepRes, packedRes, productsRes] = await Promise.all([
        http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_ORDERS),
        http.get(PRODUCT_ENDPOINTS.ALL_ADMIN),
      ]);

      const preparing = Array.isArray(prepRes.data) ? prepRes.data : [];
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const lowStock = products.filter((p) => p.quantity > 0 && p.quantity < threshold);
      const outOfStock = products.filter((p) => p.quantity === 0);

      setLowStockItems(lowStock.slice(0, 8));
      setStats({
        preparingCount: preparing.length,
        packedCount: packed.length,
        totalProducts: products.length,
        lowStockProducts: lowStock.length,
        outOfStockProducts: outOfStock.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = useMemo(
    () => [
      {
        key: 'preparing',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statToPack_a1b2c3d4e5'),
        value: stats.preparingCount,
        icon: 'clipboard',
        target: 'WarehouseStaffOrders',
        params: { filter: 'preparing' },
      },
      {
        key: 'packed',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statPacked_f6g7h8i9j0'),
        value: stats.packedCount,
        icon: 'check-circle',
        target: 'WarehouseStaffOrders',
        params: { filter: 'packed' },
      },
      {
        key: 'totalProducts',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statTotalProducts_a0b1c2d3e4'),
        value: stats.totalProducts,
        icon: 'package',
        target: 'WarehouseStaffProducts',
        params: {},
      },
      {
        key: 'lowStock',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statLowStock_f5g6h7i8j9'),
        value: stats.lowStockProducts,
        icon: 'trending-down',
        target: 'WarehouseStaffProducts',
        params: {},
      },
      {
        key: 'outOfStock',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.statOutOfStock_k0l1m2n3o4'),
        value: stats.outOfStockProducts,
        icon: 'x-circle',
        target: 'WarehouseStaffProducts',
        params: {},
      },
    ],
    [stats, tUi]
  );

  const actionCards = useMemo(
    () => [
      {
        key: 'products',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionProductsTitle_p5q6r7s8t9'),
        desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionProductsDesc_u0v1w2x3y4'),
        icon: 'package',
        target: 'WarehouseStaffProducts',
        params: undefined,
      },
      {
        key: 'pack',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackTitle_k1l2m3n4o5'),
        desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackDesc_p5q6r7s8t9'),
        icon: 'clipboard',
        target: 'WarehouseStaffOrders',
        params: { filter: 'preparing' },
      },
      {
        key: 'packed',
        title: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackedTitle_u1v2w3x4y5'),
        desc: tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.actionPackedDesc_z6a7b8c9d0'),
        icon: 'check-circle',
        target: 'WarehouseStaffOrders',
        params: { filter: 'packed' },
      },
    ],
    [tUi]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.title_e1f2g3h4i5')}
      subtitle={tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.subtitle_j6k7l8m9n0')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionOverview_o1p2q3r4s5')}
          </Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate(card.target, card.params)}
              >
                <View style={[styles.statTop, { flexDirection: row }]}>
                  <View style={styles.statMain}>
                    <Text style={[styles.statValue, { textAlign }]}>{card.value}</Text>
                    <Text style={[styles.statLabel, { textAlign }]}>{card.title}</Text>
                  </View>
                  <View style={styles.statIcon}>
                    <Feather name={card.icon} size={22} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionQuickActions_t6u7v8w9x0')}
          </Text>
          <Text style={[styles.sectionSubtitle, { textAlign }]}>
            {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionQuickActionsDesc_y1z2a3b4c5')}
          </Text>
          <View style={styles.actionsGrid}>
            {actionCards.map((action) => (
              <Pressable
                key={action.key}
                style={[styles.actionCard, { flexDirection: row }]}
                onPress={() => navigation.navigate(action.target, action.params)}
              >
                <View style={styles.actionIcon}>
                  <Feather name={action.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { textAlign }]}>{action.title}</Text>
                  <Text style={[styles.actionDesc, { textAlign }]}>{action.desc}</Text>
                </View>
                <Feather name={arrowIcon} size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          {(lowStockItems.length > 0 || stats.totalProducts > 0) && (
            <>
              <Text style={[styles.sectionTitle, { textAlign }]}>
                {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.sectionStockAlerts_z5a6b7c8d9')}
              </Text>
              {lowStockItems.length ? (
                lowStockItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.alertItem,
                      item.quantity === 0 ? styles.alertCritical : styles.alertWarn,
                    ]}
                    onPress={() => navigation.navigate('WarehouseStaffProducts')}
                  >
                    <Text style={[styles.alertTitle, { textAlign }]}>{item.name}</Text>
                    <Text style={[styles.alertMeta, { textAlign }]}>
                      {item.quantity === 0
                        ? tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockOutOfStock_e0f1g2h3i4')
                        : tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockLowRemaining_j5k6l7m8n9', {
                            value0: item.quantity,
                          })}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.alertOk}>
                  <Text style={[styles.alertTitle, { textAlign }]}>
                    {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockAllGood_o0p1q2r3s4')}
                  </Text>
                  <Text style={[styles.alertMeta, { textAlign }]}>
                    {tUi('ui.pages.warehouseStaff.warehouseStaffDashboard.stockAllGoodDesc_t5u6v7w8x9', {
                      value0: lowStockThreshold,
                    })}
                  </Text>
                </View>
              )}
            </>
          )}
        </>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      marginTop: 6,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    statCard: {
      flexBasis: '48%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      ...shadow,
    },
    statTop: {
      justifyContent: 'space-between',
    },
    statMain: {
      flex: 1,
      paddingRight: 8,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      marginTop: 4,
      fontSize: 13,
      color: colors.muted,
    },
    statIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
    },
    actionsGrid: {
      marginBottom: 12,
    },
    actionCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      ...shadow,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? `${colors.primary}22` : '#E0F2FE',
      marginRight: 12,
    },
    actionBody: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    actionDesc: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    alertItem: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
    },
    alertCritical: {
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEF2F2',
      borderColor: isDark ? 'rgba(220,38,38,0.35)' : '#FECACA',
    },
    alertWarn: {
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FFFBEB',
      borderColor: isDark ? 'rgba(217,119,6,0.35)' : '#FDE68A',
    },
    alertOk: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(22,163,74,0.3)' : '#BBF7D0',
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    alertMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
  });

export default WarehouseStaffDashboardScreen;
