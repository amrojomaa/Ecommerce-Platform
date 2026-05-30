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
import { TICKET_ENDPOINTS } from '../../config/api';
import { formatDate } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';

const normalizeTicketStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const SupportAgentDashboardScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';
  const navigation = useNavigation();
  const { panelKicker } = usePanelRole();

  const [stats, setStats] = useState({
    managerAssigned: 0,
    selfClaimed: 0,
    available: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [activeTickets, setActiveTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const getStatusLabel = useCallback(
    (status) => {
      const normalized = normalizeTicketStatus(status);
      const key = TICKET_STATUS_LABEL_KEYS[normalized];
      return key ? tUi(key) : status || normalized.replace(/_/g, ' ');
    },
    [tUi]
  );

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [assignedRes, unassignedRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ASSIGNED),
        http.get(TICKET_ENDPOINTS.UNASSIGNED),
      ]);

      const assigned = assignedRes.data || [];
      const unassigned = unassignedRes.data || [];
      const allTickets = [...assigned, ...unassigned];

      const counts = allTickets.reduce(
        (acc, ticket) => {
          if (!ticket.employee_id) {
            acc.available += 1;
          } else {
            const isActive = ticket.status !== 'Resolved' && ticket.status !== 'Closed';

            if (isActive) {
              if (
                ticket.assigned_by_user &&
                (ticket.assigned_by_user.role === 'support_manager' ||
                  ticket.assigned_by_user.role === 'admin')
              ) {
                acc.managerAssigned += 1;
              } else if (ticket.assigned_by === ticket.employee_id) {
                acc.selfClaimed += 1;
              } else {
                acc.managerAssigned += 1;
              }
            }

            if (ticket.status === 'In Progress') acc.inProgress += 1;
            else if (ticket.status === 'Resolved' || ticket.status === 'Closed') acc.resolved += 1;
          }
          return acc;
        },
        { managerAssigned: 0, selfClaimed: 0, available: 0, inProgress: 0, resolved: 0 }
      );

      setStats(counts);
      setActiveTickets(
        assigned.filter((ticket) => ticket.status !== 'Closed' && ticket.status !== 'Resolved').slice(0, 5)
      );
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = useMemo(
    () => [
      {
        key: 'managerAssigned',
        title: tUi('ui.pages.support_agent.dashboard.managerAssigned'),
        value: stats.managerAssigned,
        icon: 'briefcase',
        tab: 'assigned',
      },
      {
        key: 'selfClaimed',
        title: tUi('ui.pages.support_agent.dashboard.selfClaimed'),
        value: stats.selfClaimed,
        icon: 'target',
        tab: 'assigned',
      },
      {
        key: 'available',
        title: tUi('ui.pages.support_agent.dashboard.available'),
        value: stats.available,
        icon: 'layers',
        tab: 'unassigned',
      },
      {
        key: 'inProgress',
        title: tUi('ui.pages.support_agent.dashboard.inProgress'),
        value: stats.inProgress,
        icon: 'zap',
        tab: 'assigned',
      },
      {
        key: 'resolved',
        title: tUi('ui.pages.support_agent.dashboard.resolved'),
        value: stats.resolved,
        icon: 'check-circle',
        tab: 'completed',
      },
    ],
    [stats, tUi]
  );

  const actionCards = useMemo(
    () => [
      {
        key: 'tickets',
        title: tUi('ui.pages.support_agent.dashboard.viewAllTickets'),
        desc: tUi('ui.pages.support_agent.dashboard.viewAllTicketsDesc'),
        icon: 'tag',
        target: 'SupportAgentTickets',
        params: { tab: 'assigned' },
      },
      {
        key: 'chats',
        title: tUi('ui.pages.support_agent.dashboard.activeChats'),
        desc: tUi('ui.pages.support_agent.dashboard.activeChatsDesc'),
        icon: 'message-square',
        target: 'SupportAgentChats',
        params: undefined,
      },
    ],
    [tUi]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.support_agent.dashboard.title')}
      subtitle={tUi('ui.pages.support_agent.dashboard.subtitle')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.support_agent.dashboard.section.overview')}
          </Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate('SupportAgentTickets', { tab: card.tab })}
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
            {tUi('ui.pages.support_agent.dashboard.section.quickActions')}
          </Text>
          <Text style={[styles.sectionSubtitle, { textAlign }]}>
            {tUi('ui.pages.support_agent.dashboard.section.quickActionsDesc')}
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

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.support_agent.dashboard.section.activeTickets')}
          </Text>
          {activeTickets.length ? (
            activeTickets.map((ticket) => (
              <Pressable
                key={ticket.id}
                style={[styles.activeCard, { flexDirection: row }]}
                onPress={() => navigation.navigate('SupportAgentTickets', { tab: 'assigned' })}
              >
                <View style={styles.activeMain}>
                  <Text style={[styles.activeTitle, { textAlign }]} numberOfLines={1}>
                    {ticket.title}
                  </Text>
                  <Text style={[styles.activeMeta, { textAlign }]} numberOfLines={1}>
                    {ticket.customer?.email}
                  </Text>
                </View>
                <View style={styles.activeEnd}>
                  <Text style={styles.statusPill}>{getStatusLabel(ticket.status)}</Text>
                  <Text style={styles.activeDate}>{formatDate(ticket.created_at)}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={[styles.emptyText, { textAlign }]}>
              {tUi('ui.pages.support_agent.dashboard.noActiveTickets')}
            </Text>
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
    activeCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      ...shadow,
    },
    activeMain: {
      flex: 1,
      paddingRight: 10,
    },
    activeTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    activeMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    activeEnd: {
      alignItems: 'flex-end',
      maxWidth: '38%',
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
    activeDate: {
      marginTop: 4,
      fontSize: 11,
      color: colors.muted,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      marginBottom: 12,
    },
  });

export default SupportAgentDashboardScreen;
