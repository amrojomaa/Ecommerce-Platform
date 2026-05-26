import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import { colors, shadow } from '../styles/theme';
import http from '../../services/http';
import { POS_ENDPOINTS } from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';

const cashierName = (cashier) => {
  if (!cashier) return 'Unknown Cashier';
  return [cashier.first_name, cashier.last_name].filter(Boolean).join(' ') || 'Unknown Cashier';
};

const AdminPosAnalyticsScreen = ({ navigation }) => {
  const { formatCurrency } = useCurrency();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await http.get(POS_ENDPOINTS.SALES_ALL_TODAY);
        setSales(Array.isArray(response.data) ? response.data : []);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  const { totalRevenue, totalOrders, cashierStats } = useMemo(() => {
    const statsMap = {};
    let revenue = 0;

    sales.forEach((sale) => {
      const amount = Number(sale.total_amount) || 0;
      revenue += amount;

      const cashierId = sale.cashier?.id || 'unknown';
      if (!statsMap[cashierId]) {
        statsMap[cashierId] = {
          id: cashierId,
          name: cashierName(sale.cashier),
          totalOrders: 0,
          totalSales: 0,
        };
      }

      statsMap[cashierId].totalOrders += 1;
      statsMap[cashierId].totalSales += amount;
    });

    return {
      totalRevenue: revenue,
      totalOrders: sales.length,
      cashierStats: Object.values(statsMap).sort((a, b) => b.totalSales - a.totalSales),
    };
  }, [sales]);

  return (
    <AdminScreen
      kicker="POS Analytics"
      title="POS Analytics"
      subtitle="Supervise POS terminal operations and cashier performance for today."
      action={
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, styles.ordersIcon]}>
                <Feather name="clipboard" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{totalOrders}</Text>
              <Text style={styles.statLabel}>Total POS Orders Today</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, styles.revenueIcon]}>
                <Feather name="dollar-sign" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{formatCurrency(totalRevenue)}</Text>
              <Text style={styles.statLabel}>Total POS Revenue Today</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cashier Performance</Text>
          </View>
          {cashierStats.length === 0 ? (
            <Text style={styles.emptyText}>No POS sales recorded today.</Text>
          ) : (
            cashierStats.map((stat) => (
              <View key={stat.id} style={styles.rowCard}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{stat.name}</Text>
                  <Text style={styles.rowMeta}>{stat.totalOrders} orders processed</Text>
                </View>
                <Text style={styles.rowAmount}>{formatCurrency(stat.totalSales)}</Text>
              </View>
            ))
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent POS Transactions</Text>
          </View>
          {sales.length === 0 ? (
            <Text style={styles.emptyText}>No transactions today.</Text>
          ) : (
            sales.slice(0, 50).map((sale) => (
              <View key={sale.id} style={styles.rowCard}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>Order #{sale.id}</Text>
                  <Text style={styles.rowMeta}>
                    {sale.created_at ? new Date(sale.created_at).toLocaleTimeString() : 'No time'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {cashierName(sale.cashier)} • {sale.customer_name || 'Walk-in'}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{formatCurrency(Number(sale.total_amount) || 0)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
  backText: {
    color: colors.primary,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
    marginBottom: 12,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ordersIcon: {
    backgroundColor: '#DBEAFE',
  },
  revenueIcon: {
    backgroundColor: '#DCFCE7',
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    paddingVertical: 12,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
    marginBottom: 10,
  },
  rowMain: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  rowAmount: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AdminPosAnalyticsScreen;
