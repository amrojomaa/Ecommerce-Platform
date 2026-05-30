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
  COMMENT_ENDPOINTS,
  FEEDBACK_ENDPOINTS,
  TICKET_ENDPOINTS,
  USER_ENDPOINTS,
} from '../../config/api';
import { usePanelRole } from '../hooks/usePanelRole';

const SupportManagerDashboardScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';
  const navigation = useNavigation();
  const { panelKicker } = usePanelRole();

  const [stats, setStats] = useState({
    openTickets: 0,
    reportedComments: 0,
    avgRating: 0,
    activeAgents: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, commentsRes, feedbackRes, usersRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ALL).catch(() => ({ data: [] })),
        http.get(COMMENT_ENDPOINTS.ALL, { params: { is_reported: true } }).catch(() => ({ data: [] })),
        http.get(FEEDBACK_ENDPOINTS.ALL, { params: { limit: 100 } }).catch(() => ({ data: [] })),
        http.get(USER_ENDPOINTS.ALL).catch(() => ({ data: [] })),
      ]);

      const tickets = ticketsRes.data || [];
      const reported = commentsRes.data || [];
      const feedback = feedbackRes.data || [];
      const users = usersRes.data || [];

      const avg =
        feedback.length > 0
          ? (feedback.reduce((acc, item) => acc + (item.rating || 0), 0) / feedback.length).toFixed(1)
          : '0';

      setStats({
        openTickets: tickets.filter((ticket) => ticket.status === 'Open').length,
        reportedComments: reported.length,
        avgRating: avg,
        activeAgents: users.filter((user) => user.role === 'support_agent').length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = useMemo(
    () => [
      {
        key: 'openTickets',
        title: tUi('ui.pages.support_manager.dashboard.openTickets'),
        value: stats.openTickets,
        icon: 'tag',
        target: 'AdminTickets',
      },
      {
        key: 'reportedComments',
        title: tUi('ui.pages.support_manager.dashboard.reportedComments'),
        value: stats.reportedComments,
        icon: 'message-square',
        target: 'SupportManagerComments',
      },
      {
        key: 'avgRating',
        title: tUi('ui.pages.support_manager.dashboard.avgRating'),
        value: stats.avgRating,
        icon: 'star',
        target: 'AdminFeedback',
      },
      {
        key: 'activeAgents',
        title: tUi('ui.pages.support_manager.dashboard.activeAgents'),
        value: stats.activeAgents,
        icon: 'headphones',
        target: 'AdminTickets',
      },
    ],
    [stats, tUi]
  );

  const actionCards = useMemo(
    () => [
      {
        key: 'tickets',
        title: tUi('ui.pages.support_manager.dashboard.assignTickets'),
        desc: tUi('ui.pages.support_manager.dashboard.assignTicketsDesc'),
        icon: 'tag',
        target: 'AdminTickets',
      },
      {
        key: 'comments',
        title: tUi('ui.pages.support_manager.dashboard.moderateComments'),
        desc: tUi('ui.pages.support_manager.dashboard.moderateCommentsDesc'),
        icon: 'message-square',
        target: 'SupportManagerComments',
      },
      {
        key: 'feedback',
        title: tUi('ui.pages.support_manager.dashboard.analyzeFeedback'),
        desc: tUi('ui.pages.support_manager.dashboard.analyzeFeedbackDesc'),
        icon: 'star',
        target: 'AdminFeedback',
      },
    ],
    [tUi]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.support_manager.dashboard.title')}
      subtitle={tUi('ui.pages.support_manager.dashboard.subtitle')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.support_manager.dashboard.section.overview')}
          </Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate(card.target)}
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
            {tUi('ui.pages.support_manager.dashboard.section.quickActions')}
          </Text>
          <Text style={[styles.sectionSubtitle, { textAlign }]}>
            {tUi('ui.pages.support_manager.dashboard.section.quickActionsDesc')}
          </Text>
          <View style={styles.actionsGrid}>
            {actionCards.map((action) => (
              <Pressable
                key={action.key}
                style={[styles.actionCard, { flexDirection: row }]}
                onPress={() => navigation.navigate(action.target)}
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
  });

export default SupportManagerDashboardScreen;
