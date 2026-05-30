import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import {
  COMMENT_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  RATING_ENDPOINTS,
  buildUrl,
} from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { buildImageUrl, formatDate } from '../utils/format';
import { useCurrency } from '../../hooks/useCurrency';
import { AuthContext } from '../../context/AuthContext';

const SENTIMENT_FILTERS = ['all', 'positive', 'neutral', 'negative'];

const SENTIMENT_LABEL_KEYS = {
  positive: 'ui.pages.admin.adminComments.sentimentPositive_70da220f7a',
  neutral: 'ui.pages.admin.adminComments.sentimentNeutral_1adf64fbd4',
  negative: 'ui.pages.admin.adminComments.sentimentNegative_78ec8a0d98',
};

const AdminCommentsScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl, textAlign } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const { formatCurrency } = useCurrency();
  const { user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [comments, setComments] = useState([]);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('all');

  const getSentimentLabel = useCallback(
    (sentiment) => {
      const key = SENTIMENT_LABEL_KEYS[sentiment] || SENTIMENT_LABEL_KEYS.neutral;
      return tUi(key);
    },
    [tUi]
  );

  const getSentimentFilterLabel = useCallback(
    (filter) => {
      if (filter === 'all') {
        return tUi('ui.mobile.common.all');
      }
      return getSentimentLabel(filter);
    },
    [getSentimentLabel, tUi]
  );

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const endpoint = user?.role === 'support_manager' ? PRODUCT_ENDPOINTS.ALL : PRODUCT_ENDPOINTS.ALL_ADMIN;
      const response = await http.get(endpoint);
      setProducts(response.data || []);
    } finally {
      setLoadingProducts(false);
    }
  }, [user?.role]);

  const fetchComments = useCallback(async (productId) => {
    if (!productId) return;
    setLoadingComments(true);
    try {
      const response = await http.get(buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: productId }), {
        params: { skip: 0, limit: 200 },
      });
      setComments(response.data || []);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const fetchRatingSummary = useCallback(async (productId) => {
    if (!productId) return;
    try {
      const response = await http.get(buildUrl(RATING_ENDPOINTS.GET_PRODUCT, { product_id: productId }));
      setRatingSummary(response.data || null);
    } catch (_) {
      setRatingSummary(null);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (selectedProductId) {
      fetchComments(selectedProductId);
      fetchRatingSummary(selectedProductId);
    } else {
      setComments([]);
      setRatingSummary(null);
    }
  }, [fetchComments, fetchRatingSummary, selectedProductId]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category_name).filter(Boolean))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !term || product.name?.toLowerCase().includes(term);
      const matchesCategory = !categoryFilter || product.category_name === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, products, searchQuery]);

  const filteredComments = useMemo(() => {
    if (sentimentFilter === 'all') return comments;
    return comments.filter((comment) => comment.sentiment === sentimentFilter);
  }, [comments, sentimentFilter]);

  const handleDelete = async (commentId) => {
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminComments.deleteComment_d6666490e7'),
      tUi('ui.pages.admin.adminComments.areYouSureYouWant_b3d0559f52'),
      tUi('ui.pages.admin.adminComments.delete_66f5dde37d'),
      tUi('ui.pages.admin.adminComments.cancel_117ba1126e')
    );
    if (!ok) return;
    await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
    if (selectedProductId) {
      fetchComments(selectedProductId);
      fetchRatingSummary(selectedProductId);
    }
  };

  const selectedProduct = products.find((product) => product.id === selectedProductId);

  return (
    <AdminScreen title={tUi('ui.pages.admin.adminComments.manageReviews_9e45000031')} subtitle={tUi('ui.pages.admin.adminComments.subtitle_b4e8c1d2f3')}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.pages.admin.adminComments.searchByProductName_7e4227491a')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Pressable style={styles.filterChip} onPress={() => setCategoryFilter('')}>
          <Text style={styles.filterText}>{categoryFilter || tUi('ui.mobile.common.all')}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScroll}>
        {loadingProducts ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          filteredProducts.map((product) => (
            <Pressable
              key={product.id}
              style={[styles.productCard, selectedProductId === product.id && styles.productCardActive]}
              onPress={() => setSelectedProductId(product.id)}
            >
              <Image
                source={{ uri: buildImageUrl(product.images?.[0]) }}
                style={styles.productImage}
              />
              <Text style={styles.productTitle}>{product.name}</Text>
              <Text style={styles.productMeta}>{formatCurrency(product.price)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      {selectedProduct ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{selectedProduct.name}</Text>
          <Text style={styles.summaryMeta}>{selectedProduct.category_name}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>
              {`${tUi('ui.pages.admin.adminFeedback.avg_88b67561cc')} ${Number(
                ratingSummary?.average_rating || 0
              ).toFixed(1)}`}
            </Text>
            <Text style={styles.summaryValue}>
              {tUi('ui.mobile.adminComments.ratingsCount', {
                value0: ratingSummary?.total_ratings || 0,
              })}
            </Text>
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
                  {getSentimentFilterLabel(filter)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {loadingComments ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {filteredComments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <Text style={styles.commentTitle}>
                {comment.user?.first_name || tUi('roles.customer')}{' '}
                {comment.user?.last_name || ''}
              </Text>
              <Text style={styles.commentMeta}>{formatDate(comment.created_at)}</Text>
              <Text style={styles.commentBody}>{comment.content}</Text>
              <View style={styles.commentFooter}>
                <Text style={styles.commentBadge}>
                  {getSentimentLabel(comment.sentiment || 'neutral')}
                </Text>
                <Pressable onPress={() => handleDelete(comment.id)}>
                  <Text style={styles.inlineButton}>{tUi('ui.pages.admin.adminComments.delete_66f5dde37d')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {selectedProductId && !filteredComments.length ? (
            <Text style={styles.emptyText}>{tUi('ui.pages.admin.adminComments.noReviewsFound_6ae1b83edd')}</Text>
          ) : null}
        </View>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  productScroll: {
    marginBottom: 16,
  },
  productCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  productCardActive: {
    borderColor: colors.primary,
  },
  productImage: {
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  productTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  productMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.muted,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  summaryMeta: {
    marginTop: 4,
    color: colors.muted,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 10,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  commentCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  commentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  commentMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.muted,
  },
  commentBody: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text,
  },
  commentFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commentBadge: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  inlineButton: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 12,
  },
});

export default AdminCommentsScreen;
