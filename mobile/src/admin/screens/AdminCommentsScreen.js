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
import { colors } from '../styles/theme';
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

const AdminCommentsScreen = () => {
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
    const ok = await confirmAction('Delete comment', 'Delete this comment?');
    if (!ok) return;
    await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
    if (selectedProductId) {
      fetchComments(selectedProductId);
      fetchRatingSummary(selectedProductId);
    }
  };

  const selectedProduct = products.find((product) => product.id === selectedProductId);

  return (
    <AdminScreen title="Comments" subtitle="Moderate product reviews and ratings.">
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Pressable style={styles.filterChip} onPress={() => setCategoryFilter('')}>
          <Text style={styles.filterText}>{categoryFilter || 'All categories'}</Text>
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
              Avg {Number(ratingSummary?.average_rating || 0).toFixed(1)}
            </Text>
            <Text style={styles.summaryValue}>Ratings {ratingSummary?.total_ratings || 0}</Text>
          </View>
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
                {comment.user?.first_name || 'Customer'} {comment.user?.last_name || ''}
              </Text>
              <Text style={styles.commentMeta}>{formatDate(comment.created_at)}</Text>
              <Text style={styles.commentBody}>{comment.content}</Text>
              <View style={styles.commentFooter}>
                <Text style={styles.commentBadge}>{comment.sentiment || 'neutral'}</Text>
                <Pressable onPress={() => handleDelete(comment.id)}>
                  <Text style={styles.inlineButton}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {selectedProductId && !filteredComments.length ? (
            <Text style={styles.emptyText}>No comments found.</Text>
          ) : null}
        </View>
      )}
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
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
