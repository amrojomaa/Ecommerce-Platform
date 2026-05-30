import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDateTime } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';
import { useWarehouseOpenIssueCount } from '../../hooks/useWarehouseOpenIssueCount';

const ISSUE_FILTERS = ['open', 'resolved', 'all'];

const WarehouseIssuesScreen = () => {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { textAlign, row, isRtl } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };
  const { refresh: refreshOpenIssueCount } = useWarehouseOpenIssueCount();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = route.params?.filter;
    return ISSUE_FILTERS.includes(filter) ? filter : 'open';
  });
  const [resolveNotes, setResolveNotes] = useState({});
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    const filter = route.params?.filter;
    if (ISSUE_FILTERS.includes(filter)) {
      setActiveTab(filter);
    }
  }, [route.params?.filter]);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get(WAREHOUSE_ENDPOINTS.ALL_ISSUES);
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouse.warehouseIssues.toast.failedToLoad'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const filtered = useMemo(
    () => issues.filter((issue) => (activeTab === 'all' ? true : issue.status === activeTab)),
    [activeTab, issues]
  );

  const getIssueTypeLabel = (type) => {
    const key = `ui.pages.warehouse.warehouseIssues.type.${type}`;
    const label = tUi(key);
    return label === key ? type : label;
  };
  const getStatusLabel = (status) => {
    const key = `ui.pages.warehouse.warehouseIssues.status.${status}`;
    const label = tUi(key);
    return label === key ? status : label;
  };

  const formatFilterLabel = (value) => {
    if (value === 'resolved') return tUi('ui.pages.warehouse.warehouseIssues.tab.resolved');
    if (value === 'all') return tUi('ui.pages.warehouse.warehouseIssues.tab.all');
    return tUi('ui.pages.warehouse.warehouseIssues.tab.open');
  };

  const handleResolve = async (issueId) => {
    const note = resolveNotes[issueId]?.trim();
    if (!note) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.warehouse.warehouseIssues.toast.missingNote'),
      });
      return;
    }
    setResolvingId(issueId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.RESOLVE_ISSUE, { issue_id: issueId }), {
        resolution_note: note,
      });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.warehouse.warehouseIssues.toast.resolved'),
      });
      setResolveNotes((prev) => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
      fetchIssues();
      refreshOpenIssueCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouse.warehouseIssues.toast.failedToResolve'),
      });
    } finally {
      setResolvingId(null);
    }
  };

  const emptyMessage =
    activeTab === 'open'
      ? tUi('ui.pages.warehouse.warehouseIssues.empty.open')
      : tUi('ui.pages.warehouse.warehouseIssues.empty.all');

  const issueCountLabel =
    filtered.length === 1
      ? tUi('ui.pages.warehouse.warehouseIssues.issueCountOne')
      : tUi('ui.pages.warehouse.warehouseIssues.issueCountMany');

  const filterBar = (
    <View style={styles.filterWrap}>
      <View style={styles.filterRow}>
        {ISSUE_FILTERS.map((value) => (
          <Pressable
            key={value}
            style={[styles.filterChip, activeTab === value && styles.filterChipActive]}
            onPress={() => setActiveTab(value)}
          >
            <Text style={[styles.filterChipText, activeTab === value && styles.filterChipTextActive]}>
              {formatFilterLabel(value)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.countMeta}>
        <Text style={styles.countStrong}>{filtered.length}</Text> {issueCountLabel}
      </Text>
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouse.warehouseIssues.title')}
      subtitle={tUi('ui.pages.warehouse.warehouseIssues.subtitle')}
      action={filterBar}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={[styles.emptyText, { textAlign }]}>{emptyMessage}</Text>
      ) : (
        filtered.map((issue) => (
          <View key={issue.id} style={styles.issueCard}>
            <View style={[styles.issueHeader, { flexDirection: row }]}>
              <Text style={styles.issueType}>{getIssueTypeLabel(issue.issue_type)}</Text>
              <Text style={styles.issueStatus}>{getStatusLabel(issue.status)}</Text>
            </View>

            <Text style={[styles.issueOrder, { textAlign }]}>
              {tUi('ui.pages.warehouse.warehouseIssues.orderId', { id: issue.order_id })}
              {issue.order_item_id
                ? ` · ${tUi('ui.pages.warehouse.warehouseIssues.itemId', { id: issue.order_item_id })}`
                : ''}
            </Text>
            <Text style={[styles.issueDesc, { textAlign }]}>{issue.description}</Text>

            {issue.status === 'resolved' && issue.resolution_note ? (
              <Text style={[styles.resolutionLine, { textAlign }]}>
                <Text style={styles.resolutionLabel}>
                  {tUi('ui.pages.warehouse.warehouseIssues.resolution')}
                </Text>{' '}
                {issue.resolution_note}
              </Text>
            ) : null}

            <Text style={[styles.issueDate, { textAlign }]}>
              {tUi('ui.pages.warehouse.warehouseIssues.reported', {
                date: formatDateTime(issue.created_at),
              })}
              {issue.resolved_at
                ? ` · ${tUi('ui.pages.warehouse.warehouseIssues.resolvedAt', {
                    date: formatDateTime(issue.resolved_at),
                  })}`
                : ''}
            </Text>

            {issue.status === 'open' ? (
              <View style={styles.resolveForm}>
                <TextInput
                  style={[styles.noteInput, inputRtlStyle]}
                  placeholder={tUi('ui.pages.warehouse.warehouseIssues.placeholder.note')}
                  placeholderTextColor={colors.muted}
                  value={resolveNotes[issue.id] || ''}
                  onChangeText={(value) =>
                    setResolveNotes((prev) => ({ ...prev, [issue.id]: value }))
                  }
                  multiline
                />
                <Pressable
                  style={[
                    styles.resolveButton,
                    (resolvingId === issue.id || !resolveNotes[issue.id]?.trim()) &&
                      styles.resolveButtonDisabled,
                  ]}
                  onPress={() => handleResolve(issue.id)}
                  disabled={resolvingId === issue.id || !resolveNotes[issue.id]?.trim()}
                >
                  <Text style={styles.resolveButtonText}>
                    {resolvingId === issue.id
                      ? tUi('ui.pages.warehouse.warehouseIssues.resolving')
                      : tUi('ui.pages.warehouse.warehouseIssues.button.resolve')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
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
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      paddingVertical: 20,
    },
    issueCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      ...shadow,
    },
    issueHeader: {
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    issueType: {
      fontSize: 12,
      fontWeight: '700',
      color: '#d97706',
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    issueStatus: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    issueOrder: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    issueDesc: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
      marginBottom: 8,
    },
    resolutionLine: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 8,
    },
    resolutionLabel: {
      fontWeight: '700',
      color: colors.text,
    },
    issueDate: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 8,
    },
    resolveForm: {
      gap: 8,
      marginTop: 4,
    },
    noteInput: {
      minHeight: 80,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#fff',
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
    },
    resolveButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    resolveButtonDisabled: {
      opacity: 0.6,
    },
    resolveButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
  });

export default WarehouseIssuesScreen;
