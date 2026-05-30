import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import http from '../../services/http';
import { FEEDBACK_ENDPOINTS } from '../../config/api';
import { formatDate } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';

const SENTIMENT_FILTERS = ['all', 'positive', 'neutral', 'negative'];
const RATING_FILTERS = ['all', 5, 4, 3, 2, 1];

const AdminFeedbackScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { language } = useLanguage();

  const [feedbackRows, setFeedbackRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  const formatMonth = useCallback(
    (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e');
      return date.toLocaleString(language, { year: 'numeric', month: 'long' });
    },
    [language, tUi]
  );

  const getSentimentLabel = useCallback(
    (sentiment) => {
      if (sentiment === 'positive') {
        return tUi('ui.pages.admin.adminComments.sentimentPositive_70da220f7a');
      }
      if (sentiment === 'negative') {
        return tUi('ui.pages.admin.adminComments.sentimentNegative_78ec8a0d98');
      }
      return tUi('ui.pages.admin.adminComments.sentimentNeutral_1adf64fbd4');
    },
    [tUi]
  );

  const getEntryCountLabel = useCallback(
    (count) =>
      tUi('ui.pages.admin.adminUsers.valueValue_e33c0a89f9', {
        value0: count,
        value1:
          count === 1
            ? tUi('ui.pages.admin.adminFeedback.comment_9e8582da81')
            : tUi('ui.pages.admin.adminFeedback.comments_2c5add3272'),
      }),
    [tUi]
  );

  const getRatingCountLabel = useCallback(
    (count) =>
      tUi('ui.pages.admin.adminUsers.valueValue_e33c0a89f9', {
        value0: count,
        value1:
          count === 1
            ? tUi('ui.pages.admin.adminFeedback.rating_f79d1f1958')
            : tUi('ui.pages.admin.adminFeedback.ratings_1c705eb178'),
      }),
    [tUi]
  );

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      try {
        const response = await http.get(FEEDBACK_ENDPOINTS.ALL, { params: { skip: 0, limit: 1000 } });
        setFeedbackRows(response.data || []);
      } catch (error) {
        Toast.show({
          type: 'error',
          text1:
            error.response?.data?.detail ||
            tUi('ui.pages.admin.adminFeedback.failedToLoadCustomerFeedback_8a3ede622c'),
        });
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, [tUi]);

  const grouped = useMemo(() => {
    const map = new Map();
    feedbackRows.forEach((entry) => {
      const date = entry.created_at || entry.updated_at;
      const monthKey = date ? date.slice(0, 7) : 'unknown';
      if (!map.has(monthKey)) {
        map.set(monthKey, {
          key: monthKey,
          label: date ? formatMonth(date) : tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e'),
          entries: [],
        });
      }
      map.get(monthKey).entries.push(entry);
    });
    return Array.from(map.values()).sort((a, b) => (a.key > b.key ? -1 : 1));
  }, [feedbackRows, formatMonth, tUi]);

  const selectedGroup = grouped.find((group) => group.key === selectedMonth) || null;

  const selectedAverageRating = useMemo(() => {
    if (!selectedGroup?.entries.length) return null;
    const total = selectedGroup.entries.reduce((sum, entry) => sum + (Number(entry.rating) || 0), 0);
    return total / selectedGroup.entries.length;
  }, [selectedGroup]);

  const ratingFilteredEntries = useMemo(() => {
    if (!selectedGroup) return [];
    if (ratingFilter === 'all') return selectedGroup.entries;
    return selectedGroup.entries.filter((entry) => Number(entry.rating) === ratingFilter);
  }, [ratingFilter, selectedGroup]);

  const filteredEntries = useMemo(() => {
    if (sentimentFilter === 'all') return ratingFilteredEntries;
    return ratingFilteredEntries.filter((entry) => entry.sentiment === sentimentFilter);
  }, [ratingFilteredEntries, sentimentFilter]);

  const emptyFilterHint = useMemo(() => {
    const parts = [];
    if (sentimentFilter !== 'all') {
      parts.push(
        tUi('ui.pages.admin.adminComments.withValueSentiment_41ae6e47d3', {
          value0: getSentimentLabel(sentimentFilter).toLowerCase(),
        })
      );
    }
    if (ratingFilter !== 'all') {
      parts.push(
        tUi('ui.pages.admin.adminFeedback.withValueRating_l0m1n2o3p4', { value0: ratingFilter })
      );
    }
    return parts.join(' ');
  }, [getSentimentLabel, ratingFilter, sentimentFilter, tUi]);

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.admin.adminFeedback.customerFeedback_4fd4bfed76')}
      subtitle={tUi('ui.pages.admin.adminFeedback.ratingsAndComments_9672ebdf0c')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{tUi('ui.pages.admin.adminFeedback.monthCatalog_e3f4a5b6c7')}</Text>
            <Text style={styles.sectionMeta}>
              {tUi('ui.pages.admin.adminUsers.valueValue_e33c0a89f9', {
                value0: grouped.length,
                value1:
                  grouped.length === 1
                    ? tUi('ui.pages.admin.adminFeedback.monthSingular_j8k9l0m1n2')
                    : tUi('ui.pages.admin.adminFeedback.monthPlural_k9l0m1n2o3'),
              })}
            </Text>
          </View>

          <View style={styles.monthRow}>
            {grouped.map((group) => (
              <Pressable
                key={group.key}
                style={[styles.monthCard, selectedMonth === group.key && styles.monthCardActive]}
                onPress={() => {
                  setSelectedMonth(group.key);
                  setSentimentFilter('all');
                  setRatingFilter('all');
                }}
              >
                <Text style={styles.monthTitle}>{group.label}</Text>
                <Text style={styles.monthMeta}>{getEntryCountLabel(group.entries.length)}</Text>
              </Pressable>
            ))}
          </View>

          {selectedGroup ? (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderMain}>
                  <Text style={styles.detailTitle}>
                    {tUi('ui.pages.admin.adminFeedback.feedbackDetail_h6i7j8k9l0')}
                  </Text>
                  <Text style={styles.detailSubtitle}>{selectedGroup.label}</Text>
                  {selectedAverageRating != null ? (
                    <Text style={styles.detailAverage}>
                      {tUi('ui.pages.admin.adminFeedback.monthAverageRating_i7j8k9l0m1')}:{' '}
                      {tUi('ui.pages.admin.adminFeedback.avg_88b67561cc')}{' '}
                      {selectedAverageRating.toFixed(1)} · {getRatingCountLabel(selectedGroup.entries.length)}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.clearMonthButton}
                  onPress={() => {
                    setSelectedMonth(null);
                    setSentimentFilter('all');
                    setRatingFilter('all');
                  }}
                >
                  <Text style={styles.clearMonthText}>
                    {tUi('ui.pages.admin.adminFeedback.clearMonth_f4a5b6c7d8')}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.filterLabel}>
                {tUi('ui.pages.admin.adminComments.filterBySentiment_c7d8e9f0a1')}
              </Text>
              <View style={styles.filterRow}>
                {SENTIMENT_FILTERS.map((filter) => (
                  <Pressable
                    key={filter}
                    style={[styles.filterChip, sentimentFilter === filter && styles.filterChipActive]}
                    onPress={() => setSentimentFilter(filter)}
                  >
                    <Text
                      style={[styles.filterText, sentimentFilter === filter && styles.filterTextActive]}
                    >
                      {filter === 'all'
                        ? tUi('ui.mobile.common.all')
                        : getSentimentLabel(filter)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filterLabel}>
                {tUi('ui.pages.admin.adminFeedback.filterByRating_d2e3f4a5b6')}
              </Text>
              <View style={styles.filterRow}>
                {RATING_FILTERS.map((filter) => (
                  <Pressable
                    key={String(filter)}
                    style={[styles.filterChip, ratingFilter === filter && styles.filterChipActive]}
                    onPress={() => setRatingFilter(filter)}
                  >
                    <Text
                      style={[styles.filterText, ratingFilter === filter && styles.filterTextActive]}
                    >
                      {filter === 'all'
                        ? tUi('ui.pages.admin.adminFeedback.allRatings_839197b0a4')
                        : tUi('ui.pages.admin.adminFeedback.valueStars_91b0a7fe89', { value0: filter })}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {filteredEntries.map((entry) => (
                <View key={entry.id} style={styles.feedbackCard}>
                  <Text style={styles.feedbackTitle}>
                    {[entry.user?.first_name, entry.user?.last_name].filter(Boolean).join(' ') ||
                      tUi('ui.mobile.common.unnamedUser')}
                  </Text>
                  <Text style={styles.feedbackMeta}>{formatDate(entry.created_at)}</Text>
                  <Text style={styles.feedbackBody}>
                    {entry.comment || tUi('ui.pages.admin.adminFeedback.noCommentProvided_041e34567f')}
                  </Text>
                  <View style={styles.feedbackFooter}>
                    <Text style={styles.feedbackBadge}>
                      {tUi('ui.pages.admin.adminFeedback.valueOutOf5_9ae6dcd335', {
                        value0: entry.rating,
                      })}
                    </Text>
                    <Text style={styles.feedbackBadge}>
                      {getSentimentLabel(entry.sentiment || 'neutral')}
                    </Text>
                  </View>
                </View>
              ))}
              {!filteredEntries.length ? (
                <Text style={styles.emptyText}>
                  {tUi('ui.pages.admin.adminFeedback.noCustomerFeedbackFoundFor_97a65aec8e')}
                  {emptyFilterHint ? ` ${emptyFilterHint}` : ''}
                </Text>
              ) : null}
            </View>
          ) : grouped.length ? (
            <Text style={styles.emptyText}>
              {tUi('ui.pages.admin.adminFeedback.monthCatalog_e3f4a5b6c7')}
            </Text>
          ) : (
            <Text style={styles.emptyText}>
              {tUi('ui.pages.admin.adminFeedback.noCustomerFeedbackFoundFor_97a65aec8e')}
            </Text>
          )}
        </View>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  monthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  monthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
    marginBottom: 12,
    minWidth: 140,
  },
  monthCardActive: {
    borderColor: colors.primary,
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  monthMeta: {
    marginTop: 4,
    fontSize: 11,
    color: colors.muted,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailHeaderMain: {
    flex: 1,
    paddingRight: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  detailSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  detailAverage: {
    marginTop: 6,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  clearMonthButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearMonthText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
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
  feedbackCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  feedbackMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.muted,
  },
  feedbackBody: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text,
  },
  feedbackFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feedbackBadge: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 16,
  },
});

export default AdminFeedbackScreen;
