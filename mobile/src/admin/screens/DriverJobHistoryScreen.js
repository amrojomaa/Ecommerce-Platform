import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import { formatDateTime } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';
import { getDeliveryStatusLabel, getDeliveryStatusTone } from '../../utils/driverDeliveryStatus';

const HISTORY_FILTERS = ['all', 'delivered', 'cancelled'];

const DriverJobHistoryScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { textAlign, row } = useRtlLayout();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await http.get(DELIVERY_ENDPOINTS.JOB_HISTORY);
        setJobs(Array.isArray(response.data) ? response.data : []);
      } catch (_) {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    return jobs.filter((job) => String(job.status || '').toLowerCase() === filter);
  }, [filter, jobs]);

  const tabs = useMemo(
    () => [
      { id: 'all', label: tUi('ui.pages.driver.driverJobHistory.all_8807f0de5d') },
      { id: 'delivered', label: tUi('ui.pages.driver.driverJobHistory.delivered_08a781473b') },
      { id: 'cancelled', label: tUi('ui.pages.driver.driverJobHistory.cancelled_3252a4cd97') },
    ],
    [tUi]
  );

  const tabBar = (
    <View style={[styles.tabRow, { flexDirection: row }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          style={[styles.tabChip, filter === tab.id && styles.tabChipActive]}
          onPress={() => {
            setFilter(tab.id);
            setExpandedJobId(null);
          }}
        >
          <Text style={[styles.tabChipText, filter === tab.id && styles.tabChipTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const statusStyle = (status) => {
    const tone = getDeliveryStatusTone(status);
    if (tone === 'delivered') return styles.statusDelivered;
    if (tone === 'cancelled') return styles.statusCancelled;
    return styles.statusDefault;
  };

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.driver.driverJobHistory.deliveryHistory_ddfd66f8b3')}
      subtitle={tUi('ui.pages.driver.history.subtitle')}
      action={tabBar}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredJobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="clipboard" size={32} color={colors.muted} />
          <Text style={[styles.emptyTitle, { textAlign }]}>
            {tUi('ui.pages.driver.driverJobHistory.noDeliveriesYet_3d3c839a33')}
          </Text>
          <Text style={[styles.emptyText, { textAlign }]}>
            {tUi('ui.pages.driver.driverJobHistory.yourCompletedDeliveriesWillAppear_d2de11ec07')}
          </Text>
        </View>
      ) : (
        filteredJobs.map((job) => {
          const isExpanded = expandedJobId === job.id;
          const customerName = job.customer
            ? `${job.customer.first_name} ${job.customer.last_name}`.trim()
            : null;

          return (
            <View key={job.id} style={styles.jobCard}>
              <Pressable onPress={() => setExpandedJobId(isExpanded ? null : job.id)}>
                <View style={[styles.jobHeader, { flexDirection: row }]}>
                  <View style={styles.jobMain}>
                    <Text style={[styles.jobId, { textAlign }]}>
                      {tUi('ui.pages.driver.list.jobId')} #{job.id}
                    </Text>
                    <Text style={[styles.jobMeta, { textAlign }]}>
                      {tUi('ui.pages.driver.driverJobHistory.order_e3bc2a2215')}
                      {job.order_id}
                    </Text>
                    <Text style={[styles.jobMeta, { textAlign }]}>
                      {formatDateTime(job.updated_at)}
                    </Text>
                  </View>
                  <Text style={[styles.statusBadge, statusStyle(job.status)]}>
                    {getDeliveryStatusLabel(job.status, tUi)}
                  </Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.detailWrap}>
                  <View style={styles.detailCard}>
                    <Text style={[styles.detailLabel, { textAlign }]}>
                      {tUi('ui.pages.driver.driverJobHistory.pickupLocation_04b6e477ab')}
                    </Text>
                    <Text style={[styles.detailValue, { textAlign }]}>
                      {job.pickup_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                    </Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={[styles.detailLabel, { textAlign }]}>
                      {tUi('ui.pages.driver.driverJobHistory.deliveryLocation_ef31514d2e')}
                    </Text>
                    <Text style={[styles.detailValue, { textAlign }]}>
                      {job.delivery_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                    </Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={[styles.detailLabel, { textAlign }]}>
                      {tUi('ui.pages.driver.list.customer')}
                    </Text>
                    <Text style={[styles.detailValue, { textAlign }]}>
                      {customerName || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                    </Text>
                  </View>
                  {job.items?.length > 0 && (
                    <View style={[styles.tagsRow, { flexDirection: row }]}>
                      {job.items.map((item, idx) => (
                        <Text key={idx} style={styles.itemTag}>
                          {item.product?.name} x{item.quantity}
                        </Text>
                      ))}
                    </View>
                  )}
                  {job.issue_description ? (
                    <View style={styles.issueCard}>
                      <Text style={[styles.detailLabel, { textAlign }]}>
                        {tUi('ui.pages.driver.driverJobHistory.issueReported_60b7dd8f5f')}
                      </Text>
                      <Text style={[styles.detailValue, { textAlign }]}>{job.issue_description}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          );
        })
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    tabRow: { flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: 360 },
    tabChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    tabChipTextActive: { color: '#fff' },
    loadingWrap: { paddingVertical: 40, alignItems: 'center' },
    emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptyText: { fontSize: 13, color: colors.muted, maxWidth: 280 },
    jobCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      ...shadow,
    },
    jobHeader: { alignItems: 'flex-start', gap: 12 },
    jobMain: { flex: 1 },
    jobId: { fontSize: 16, fontWeight: '700', color: colors.text },
    jobMeta: { marginTop: 4, fontSize: 12, color: colors.muted },
    statusBadge: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    statusDelivered: { color: '#16a34a', backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#DCFCE7' },
    statusCancelled: { color: '#dc2626', backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2' },
    statusDefault: { color: colors.muted, backgroundColor: colors.background },
    detailWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    detailCard: { marginBottom: 10 },
    detailLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
    detailValue: { marginTop: 4, fontSize: 14, color: colors.text },
    tagsRow: { flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    itemTag: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    issueCard: {
      marginTop: 4,
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(217,119,6,0.3)' : '#FDE68A',
    },
  });

export default DriverJobHistoryScreen;
