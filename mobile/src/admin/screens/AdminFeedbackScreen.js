import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AdminScreen from '../components/AdminScreen';
import { colors } from '../styles/theme';
import http from '../../services/http';
import { FEEDBACK_ENDPOINTS } from '../../config/api';
import { formatDate } from '../utils/format';

const SENTIMENT_FILTERS = ['all', 'positive', 'neutral', 'negative'];
const RATING_FILTERS = ['all', 5, 4, 3, 2, 1];

const formatMonth = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, { year: 'numeric', month: 'long' });
};

const AdminFeedbackScreen = () => {
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      try {
        const response = await http.get(FEEDBACK_ENDPOINTS.ALL, { params: { skip: 0, limit: 1000 } });
        setFeedbackRows(response.data || []);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    feedbackRows.forEach((entry) => {
      const date = entry.created_at || entry.updated_at;
      const monthKey = date ? date.slice(0, 7) : 'unknown';
      if (!map.has(monthKey)) {
        map.set(monthKey, {
          key: monthKey,
          label: date ? formatMonth(date) : 'Unknown',
          entries: [],
        });
      }
      map.get(monthKey).entries.push(entry);
    });
    return Array.from(map.values()).sort((a, b) => (a.key > b.key ? -1 : 1));
  }, [feedbackRows]);

  const selectedGroup = grouped.find((group) => group.key === selectedMonth) || null;

  const ratingFilteredEntries = useMemo(() => {
    if (!selectedGroup) return [];
    if (ratingFilter === 'all') return selectedGroup.entries;
    return selectedGroup.entries.filter((entry) => Number(entry.rating) === ratingFilter);
  }, [ratingFilter, selectedGroup]);

  const filteredEntries = useMemo(() => {
    if (sentimentFilter === 'all') return ratingFilteredEntries;
    return ratingFilteredEntries.filter((entry) => entry.sentiment === sentimentFilter);
  }, [ratingFilteredEntries, sentimentFilter]);

  return (
    <AdminScreen title="Feedback" subtitle="Review customer feedback trends by month.">
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
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
                <Text style={styles.monthMeta}>{group.entries.length} entries</Text>
              </Pressable>
            ))}
          </View>

          {selectedGroup ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{selectedGroup.label}</Text>
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
                      {filter}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                      {filter === 'all' ? 'all ratings' : `${filter} stars`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {filteredEntries.map((entry) => (
                <View key={entry.id} style={styles.feedbackCard}>
                  <Text style={styles.feedbackTitle}>
                    {entry.user?.first_name || 'Customer'} {entry.user?.last_name || ''}
                  </Text>
                  <Text style={styles.feedbackMeta}>{formatDate(entry.created_at)}</Text>
                  <Text style={styles.feedbackBody}>
                    {entry.comment || 'No comment provided'}
                  </Text>
                  <View style={styles.feedbackFooter}>
                    <Text style={styles.feedbackBadge}>{`${entry.rating}/5`}</Text>
                    <Text style={styles.feedbackBadge}>{entry.sentiment || 'neutral'}</Text>
                  </View>
                </View>
              ))}
              {!filteredEntries.length ? (
                <Text style={styles.emptyText}>No feedback matches the selected filters.</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyText}>Select a month to review feedback.</Text>
          )}
        </View>
      )}
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
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
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
