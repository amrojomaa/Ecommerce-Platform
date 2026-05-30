import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { COMMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { formatDate } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';

const TAB_OPTIONS = ['reported', 'all'];
const SENTIMENT_FILTERS = ['all', 'positive', 'neutral', 'negative'];

const SENTIMENT_LABEL_KEYS = {
  positive: 'ui.pages.admin.adminComments.sentimentPositive_70da220f7a',
  neutral: 'ui.pages.admin.adminComments.sentimentNeutral_1adf64fbd4',
  negative: 'ui.pages.admin.adminComments.sentimentNegative_78ec8a0d98',
};

const SupportManagerCommentsScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { isRtl, textAlign, row } = useRtlLayout();

  const [activeTab, setActiveTab] = useState('reported');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const getSentimentLabel = useCallback(
    (sentiment) => {
      if (!sentiment) return null;
      const key = SENTIMENT_LABEL_KEYS[String(sentiment).toLowerCase()];
      return key ? tUi(key) : sentiment;
    },
    [tUi]
  );

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        skip: 0,
        limit: 100,
        ...(activeTab === 'reported' ? { is_reported: true } : {}),
      };
      const response = await http.get(COMMENT_ENDPOINTS.ALL, { params });
      let data = response.data || [];

      if (sentimentFilter !== 'all' && activeTab === 'all') {
        data = data.filter(
          (comment) => String(comment.sentiment || '').toLowerCase() === sentimentFilter
        );
      }

      setComments(data);
    } catch (_) {
      setComments([]);
      Toast.show({ type: 'error', text1: tUi('ui.pages.support_manager.comments.loadFailed') });
    } finally {
      setLoading(false);
    }
  }, [activeTab, sentimentFilter, tUi]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDelete = async (commentId) => {
    const ok = await confirmAction(
      tUi('ui.pages.support_manager.comments.confirmDeleteTitle'),
      tUi('ui.pages.support_manager.comments.confirmDeleteMessage'),
      tUi('ui.pages.support_manager.comments.delete'),
      tUi('ui.pages.admin.adminComments.cancel_117ba1126e')
    );
    if (!ok) return;

    setDeletingId(commentId);
    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.support_manager.comments.deleteSuccess') });
      await fetchComments();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.pages.support_manager.comments.deleteFailed'),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleApprove = async (commentId) => {
    setApprovingId(commentId);
    try {
      await http.patch(buildUrl(COMMENT_ENDPOINTS.APPROVE, { comment_id: commentId }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.support_manager.comments.approveSuccess') });
      await fetchComments();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.pages.support_manager.comments.approveFailed'),
      });
    } finally {
      setApprovingId(null);
    }
  };

  const countLabel = useMemo(() => {
    const count = comments.length;
    return count === 1
      ? tUi('ui.pages.support_manager.comments.commentSingular')
      : tUi('ui.pages.support_manager.comments.commentPlural');
  }, [comments.length, tUi]);

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.support_manager.comments.title')}
      subtitle={tUi('ui.pages.support_manager.comments.subtitle')}
    >
      <View style={[styles.tabRow, { flexDirection: row }]}>
        {TAB_OPTIONS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
            onPress={() => {
              setActiveTab(tab);
              setSentimentFilter('all');
            }}
          >
            <Text style={[styles.tabChipText, activeTab === tab && styles.tabChipTextActive]}>
              {tab === 'reported'
                ? tUi('ui.pages.support_manager.comments.tab.reported')
                : tUi('ui.pages.support_manager.comments.tab.all')}
              {activeTab === tab ? ` (${comments.length})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'all' ? (
        <View style={styles.filterBlock}>
          <Text style={[styles.filterLabel, { textAlign }]}>
            {tUi('ui.pages.support_manager.comments.filter.sentiment')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.filterRow, { flexDirection: row }]}>
              {SENTIMENT_FILTERS.map((filter) => (
                <Pressable
                  key={filter}
                  style={[styles.filterChip, sentimentFilter === filter && styles.filterChipActive]}
                  onPress={() => setSentimentFilter(filter)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sentimentFilter === filter && styles.filterChipTextActive,
                    ]}
                  >
                    {filter === 'all'
                      ? tUi('ui.mobile.common.all')
                      : getSentimentLabel(filter)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={[styles.countText, { textAlign }]}>
            <Text style={styles.countStrong}>{comments.length}</Text> {countLabel}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{tUi('ui.pages.support_manager.comments.empty')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {comments.map((comment) => (
            <View
              key={comment.id}
              style={[
                styles.card,
                comment.is_reported ? styles.cardReported : null,
              ]}
            >
              <View style={[styles.cardHeader, { flexDirection: row }]}>
                <View style={styles.userBlock}>
                  <Text style={[styles.userName, { textAlign }]}>
                    {comment.user?.first_name} {comment.user?.last_name}
                  </Text>
                  <Text style={[styles.userMeta, { textAlign }]}>
                    {formatDate(comment.created_at)}
                  </Text>
                </View>
                {comment.sentiment ? (
                  <Text style={styles.sentimentPill}>{getSentimentLabel(comment.sentiment)}</Text>
                ) : null}
              </View>

              <Text style={[styles.commentBody, { textAlign }]}>{comment.content}</Text>

              {comment.is_reported ? (
                <Text style={[styles.reportBadge, { textAlign }]}>
                  {tUi('ui.pages.support_manager.comments.reported')}
                </Text>
              ) : null}

              <View style={[styles.actionsRow, { flexDirection: row }]}>
                <Pressable
                  style={[styles.approveButton, approvingId === comment.id && styles.buttonDisabled]}
                  onPress={() => handleApprove(comment.id)}
                  disabled={approvingId === comment.id}
                >
                  <Text style={styles.approveButtonText}>
                    {tUi('ui.pages.support_manager.comments.approve')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.deleteButton, deletingId === comment.id && styles.buttonDisabled]}
                  onPress={() => handleDelete(comment.id)}
                  disabled={deletingId === comment.id}
                >
                  <Text style={styles.deleteButtonText}>
                    {tUi('ui.pages.support_manager.comments.delete')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    tabRow: {
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    tabChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
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
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    tabChipTextActive: {
      color: colors.surface,
    },
    filterBlock: {
      marginBottom: 14,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 8,
    },
    filterRow: {
      gap: 8,
      paddingBottom: 4,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    filterChipTextActive: {
      color: colors.surface,
    },
    countText: {
      marginTop: 10,
      fontSize: 13,
      color: colors.muted,
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
      paddingVertical: 48,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    emptyText: {
      color: colors.muted,
      textAlign: 'center',
    },
    list: {
      gap: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow,
    },
    cardReported: {
      borderColor: isDark ? '#f87171' : '#dc2626',
    },
    cardHeader: {
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    userBlock: {
      flex: 1,
    },
    userName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    userMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.muted,
    },
    sentimentPill: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    commentBody: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 21,
    },
    reportBadge: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#f87171' : '#dc2626',
    },
    actionsRow: {
      marginTop: 14,
      gap: 10,
    },
    approveButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    approveButtonText: {
      fontWeight: '700',
      color: colors.text,
      fontSize: 13,
    },
    deleteButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: 'center',
      backgroundColor: isDark ? '#7f1d1d' : '#fee2e2',
    },
    deleteButtonText: {
      fontWeight: '700',
      color: isDark ? '#fecaca' : '#dc2626',
      fontSize: 13,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });

export default SupportManagerCommentsScreen;
