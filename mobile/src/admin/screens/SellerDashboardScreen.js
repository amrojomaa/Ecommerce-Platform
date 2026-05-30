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
  SELLER_ENDPOINTS,
} from '../../config/api';
import { usePanelRole } from '../hooks/usePanelRole';

const SellerDashboardScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';
  const navigation = useNavigation();
  const { panelKicker } = usePanelRole();

  const [stats, setStats] = useState({
    totalProducts: 0,
    discountedProducts: 0,
    incomingOrders: 0,
    preparingOrders: 0,
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

      const productsRes = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const lowStock = products.filter((p) => p.quantity > 0 && p.quantity < threshold);
      const outOfStock = products.filter((p) => p.quantity === 0);
      const discounted = products.filter((p) => p.discount_enabled);

      setLowStockItems(lowStock.slice(0, 8));

      let incomingOrders = 0;
      let preparingOrders = 0;
      try {
        const ordersRes = await http.get(SELLER_ENDPOINTS.ORDERS);
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        incomingOrders = orders.filter((o) => o.status === 'paid').length;
        preparingOrders = orders.filter((o) => o.status === 'preparing').length;
      } catch (_) {}

      setStats({
        totalProducts: products.length,
        discountedProducts: discounted.length,
        incomingOrders,
        preparingOrders,
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
        key: 'totalProducts',
        title: tUi('ui.pages.seller.sellerDashboard.statTotalProducts_a1b2c3d4e5'),
        value: stats.totalProducts,
        icon: 'package',
        target: 'SellerProducts',
        params: {},
      },
      {
        key: 'discounted',
        title: tUi('ui.pages.seller.sellerDashboard.statActiveDiscounts_f6g7h8i9j0'),
        value: stats.discountedProducts,
        icon: 'tag',
        target: 'SellerProducts',
        params: {},
      },
      {
        key: 'incoming',
        title: tUi('ui.pages.seller.sellerDashboard.statIncomingOrders_k1l2m3n4o5'),
        value: stats.incomingOrders,
        icon: 'clipboard',
        target: 'SellerOrders',
        params: { filter: 'paid' },
      },
      {
        key: 'preparing',
        title: tUi('ui.pages.seller.sellerDashboard.statPreparing_p5q6r7s8t9'),
        value: stats.preparingOrders,
        icon: 'clock',
        target: 'SellerOrders',
        params: { filter: 'preparing' },
      },
      {
        key: 'lowStock',
        title: tUi('ui.pages.seller.sellerDashboard.statLowStock_u1v2w3x4y5'),
        value: stats.lowStockProducts,
        icon: 'trending-down',
        target: 'SellerProducts',
        params: {},
        threshold: lowStockThreshold,
      },
      {
        key: 'outOfStock',
        title: tUi('ui.pages.seller.sellerDashboard.statOutOfStock_z6a7b8c9d0'),
        value: stats.outOfStockProducts,
        icon: 'x-circle',
        target: 'SellerProducts',
        params: {},
      },
    ],
    [lowStockThreshold, stats, tUi]
  );

  const actionCards = useMemo(
    () => [
      {
        key: 'products',
        title: tUi('ui.pages.seller.sellerDashboard.actionProductsTitle_e1f2g3h4i5'),
        desc: tUi('ui.pages.seller.sellerDashboard.actionProductsDesc_j6k7l8m9n0'),
        icon: 'package',
        target: 'SellerProducts',
        params: undefined,
      },
      {
        key: 'orders',
        title: tUi('ui.pages.seller.sellerDashboard.actionOrdersTitle_o1p2q3r4s5'),
        desc: tUi('ui.pages.seller.sellerDashboard.actionOrdersDesc_t6u7v8w9x0'),
        icon: 'clipboard',
        target: 'SellerOrders',
        params: undefined,
      },
    ],
    [tUi]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.seller.sellerDashboard.title_y1z2a3b4c5')}
      subtitle={tUi('ui.pages.seller.sellerDashboard.subtitle_d5e6f7g8h9')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.seller.sellerDashboard.sectionOverview_i0j1k2l3m4')}
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
                    {card.threshold != null ? (
                      <Text style={[styles.statMeta, { textAlign }]}>
                        {tUi('ui.pages.seller.sellerDashboard.thresholdLabel_n5o6p7q8r9')} {'<'} {card.threshold}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.statIcon}>
                    <Feather name={card.icon} size={22} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.seller.sellerDashboard.sectionQuickActions_s0t1u2v3w4')}
          </Text>
          <Text style={[styles.sectionSubtitle, { textAlign }]}>
            {tUi('ui.pages.seller.sellerDashboard.sectionQuickActionsDesc_x5y6z7a8b9')}
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
                {tUi('ui.pages.seller.sellerDashboard.sectionStockAlerts_c0d1e2f3g4')}
              </Text>
              {lowStockItems.length ? (
                lowStockItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.alertItem,
                      item.quantity === 0 ? styles.alertCritical : styles.alertWarn,
                    ]}
                    onPress={() => navigation.navigate('SellerProducts')}
                  >
                    <Text style={[styles.alertTitle, { textAlign }]}>{item.name}</Text>
                    <Text style={[styles.alertMeta, { textAlign }]}>
                      {item.quantity === 0
                        ? tUi('ui.pages.seller.sellerDashboard.stockOutOfStock_h5i6j7k8l9')
                        : tUi('ui.pages.seller.sellerDashboard.stockLowRemaining_m0n1o2p3q4', {
                            value0: item.quantity,
                          })}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.alertOk}>
                  <Text style={[styles.alertTitle, { textAlign }]}>
                    {tUi('ui.pages.seller.sellerDashboard.stockAllGood_r5s6t7u8v9')}
                  </Text>
                  <Text style={[styles.alertMeta, { textAlign }]}>
                    {tUi('ui.pages.seller.sellerDashboard.stockAllGoodDesc_w0x1y2z3a4', {
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
    statMeta: {
      marginTop: 4,
      fontSize: 11,
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

export default SellerDashboardScreen;
