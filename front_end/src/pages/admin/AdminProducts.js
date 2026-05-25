import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FaArrowTrendUp,
  FaDownload,
  FaMagnifyingGlass,
  FaPlus,
  FaRegFaceFrown,
  FaRegFaceMeh,
  FaRegFaceSmile
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import API_BASE_URL, {
  ADMIN_SETTINGS_ENDPOINTS,
  CATEGORY_ENDPOINTS,
  COMMENT_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  buildUrl
} from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import ProductFormModal from '../../components/ProductFormModal';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminProductsPage.css';
import '../../styles/pages/admin/AdminProductsModal.css';
import '../../styles/pages/admin/AdminProducts.css';

const DEFAULT_ANALYTICS = {
  total_reviews: 0,
  positive_count: 0,
  neutral_count: 0,
  negative_count: 0
};

const AdminProducts = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isLowStockFilter, setIsLowStockFilter] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilters, setQuickFilters] = useState({
    lowstock: false,
    discounted: false
  });
  const [sentimentAnalytics, setSentimentAnalytics] = useState({});

  const routeBase = useMemo(() => {
    if (location.pathname.startsWith('/warehouse')) {
      return '/warehouse/products';
    }
    return '/admin/products';
  }, [location.pathname]);

  const commentsBase = location.pathname.startsWith('/support') ? '/support/comments' : '/admin/comments';

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const fromUrlLowStock = filterParam === 'lowstock';
    setIsLowStockFilter(fromUrlLowStock);

    let filteredProducts = [...allProducts];

    if (fromUrlLowStock || quickFilters.lowstock) {
      filteredProducts = filteredProducts.filter((product) => product.quantity < lowStockThreshold);
    }

    if (quickFilters.discounted) {
      filteredProducts = filteredProducts.filter((product) => product.discount_enabled);
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      filteredProducts = filteredProducts.filter((product) =>
        product.name?.toLowerCase().includes(normalizedQuery) ||
        product.category_name?.toLowerCase().includes(normalizedQuery)
      );
    }

    setProducts(filteredProducts);
  }, [allProducts, lowStockThreshold, quickFilters, searchParams, searchQuery]);

  const fetchLowStockThreshold = useCallback(async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      setLowStockThreshold(response.data.threshold);
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      setLowStockThreshold(10);
    }
  }, []);

  const fetchSentimentAnalytics = useCallback(async (productsToAnalyze) => {
    const analytics = {};

    await Promise.all(
      productsToAnalyze.map(async (product) => {
        try {
          const response = await http.get(
            buildUrl(COMMENT_ENDPOINTS.SENTIMENT_ANALYTICS, { product_id: product.id })
          );
          analytics[product.id] = response.data;
        } catch (error) {
          analytics[product.id] = DEFAULT_ANALYTICS;
        }
      })
    );

    setSentimentAnalytics(analytics);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const fetchedProducts = response.data || [];
      setAllProducts(fetchedProducts);
      await fetchSentimentAnalytics(fetchedProducts);
    } catch (error) {
      toast.error(tUi('ui.pages.admin.adminProducts.failedToFetchProducts_a8f46599c5'));
    } finally {
      setLoading(false);
    }
  }, [fetchSentimentAnalytics]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchLowStockThreshold();
    fetchProducts();
    fetchCategories();
  }, [fetchCategories, fetchLowStockThreshold, fetchProducts]);

  const calculateDiscountedPrice = (product) => {
    if (!product.discount_enabled) {
      return product.price;
    }

    if (typeof product.discounted_price === 'number') {
      return product.discounted_price;
    }

    if (product.discount_type === 'percentage') {
      return product.price - product.price * ((product.discount_value || 0) / 100);
    }

    if (product.discount_type === 'fixed') {
      return Math.max(0, product.price - (product.discount_value || 0));
    }

    return product.price;
  };

  const getImagePreviewUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const normalizedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const getSentimentSummary = (productId) => {
    const analytics = sentimentAnalytics[productId] || DEFAULT_ANALYTICS;
    const total = analytics.total_reviews || 0;
    const positiveRate = total > 0 ? Math.round((analytics.positive_count / total) * 100) : 0;

    return {
      ...analytics,
      positiveRate
    };
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: tUi('ui.pages.admin.adminProducts.deleteProduct_5d6cc29a29'),
      message: tUi('ui.pages.admin.adminProducts.areYouSureYouWant_4733cf098f'),
      confirmText: tUi('ui.pages.admin.adminProducts.delete_d93e34aa58'),
      cancelText: tUi('ui.pages.admin.adminProducts.cancel_bf8eef7581')
    });

    if (!confirmed) {
      return;
    }

    try {
      await http.delete(PRODUCT_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success(tUi('ui.pages.admin.adminProducts.productDeletedSuccessfully_f5f852a577'));
      await fetchProducts();
    } catch (error) {
      toast.error(error.message || 'Failed to delete product');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setShowModal(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleQuickFilterClick = (filterName) => {
    if (filterName === 'lowstock' && isLowStockFilter) {
      navigate(routeBase);
      return;
    }

    setQuickFilters((prev) => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const clearQuickFilters = () => {
    if (isLowStockFilter) {
      navigate(routeBase);
    }

    setQuickFilters({
      lowstock: false,
      discounted: false
    });
  };

  const handleExportCsv = () => {
    if (products.length === 0) {
      toast.info(tUi('ui.pages.admin.adminProducts.noProductsFound_3cff798862'));
      return;
    }

    const headers = ['Name', 'Category', 'Price', 'Discounted Price', 'Quantity', 'Discount Enabled'];
    const rows = products.map((product) => [
      `"${String(product.name || '').replaceAll('"', '""')}"`,
      `"${String(product.category_name || '').replaceAll('"', '""')}"`,
      product.price ?? '',
      calculateDiscountedPrice(product),
      product.quantity ?? '',
      product.discount_enabled ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalProducts = allProducts.length;
  const lowStockCount = allProducts.filter((product) => product.quantity < lowStockThreshold).length;
  const discountedCount = allProducts.filter((product) => product.discount_enabled).length;
  const isAnyQuickFilterActive = isLowStockFilter || quickFilters.lowstock || quickFilters.discounted;
  const isLowStockActive = isLowStockFilter || quickFilters.lowstock;
  const panelKicker = location.pathname.startsWith('/warehouse')
    ? t('ui.sidebar.panel.warehouse')
    : t('ui.sidebar.panel.admin');

  return (
    <div className="admin-products admin-products-shell admin-page-shell adm-page adm-products-page">
      <PageHeader
        kicker={panelKicker}
        title={tUi('ui.pages.admin.adminProducts.manageProducts_273cb9a998')}
        subtitle={tUi('ui.pages.admin.adminProducts.trackInventoryUpdateDetailsAnd_86a8fb17ed')}
        actions={
          <>
            <button type="button" className="adm-btn-secondary" onClick={handleExportCsv}>
              <FaDownload aria-hidden />
              <span>Export CSV</span>
            </button>
            <motion.button
              type="button"
              className="adm-btn-primary"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaPlus aria-hidden />
              <span>{tUi('ui.pages.admin.adminProducts.addProduct_2792a039d2').replace('+ ', '')}</span>
            </motion.button>
          </>
        }
      />

      <div className="adm-products-toolbar">
        <div className="adm-products-search-wrap">
          <div className="products-search products-search-panel products-search-inline">
            <FaMagnifyingGlass className="products-search-icon" aria-hidden />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={tUi('ui.pages.admin.adminProducts.searchByProductOrCategory_61793e3378')}
              aria-label={tUi('ui.pages.admin.adminProducts.searchProducts_ab5d94763a')}
            />
            {searchQuery ? (
              <button type="button" className="clear-search-btn clear-search-inline" onClick={clearSearch}>
                {tUi('ui.pages.admin.adminProducts.clear_049e273c52')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="adm-products-filters">
          <button
            type="button"
            className={`overview-item overview-pill ${!isAnyQuickFilterActive ? 'active' : ''}`}
            onClick={clearQuickFilters}
          >
            <span className="overview-pill-label">{tUi('ui.pages.admin.adminProducts.total_e2ad894d2e')}</span>
            <span className="overview-pill-value">{totalProducts}</span>
          </button>

          <button
            type="button"
            className={`overview-item overview-pill overview-pill-warn ${isLowStockActive ? 'active' : ''}`}
            onClick={() => handleQuickFilterClick('lowstock')}
          >
            <span className="overview-pill-label">{tUi('ui.pages.admin.adminProducts.lowStock_4da96beeec')}</span>
            <span className="overview-pill-value">{lowStockCount}</span>
          </button>

          <button
            type="button"
            className={`overview-item overview-pill overview-pill-sale ${quickFilters.discounted ? 'active' : ''}`}
            onClick={() => handleQuickFilterClick('discounted')}
          >
            <span className="overview-pill-dot" />
            <span className="overview-pill-label">{tUi('ui.pages.admin.adminProducts.discounted_0b5fed5eb6')}</span>
            <span className="overview-pill-value">{discountedCount}</span>
          </button>
        </div>
      </div>

      {isLowStockFilter ? (
        <p className="low-stock-banner adm-products-banner">
          {tUi('ui.pages.admin.adminProducts.showingLowStockItemsQuantity_52b64ac8b5')} {'<'} {lowStockThreshold})
        </p>
      ) : null}

      {loading ? (
        <div className="products-grid products-grid-dashboard">
          {[...Array(8)].map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="products-empty-state">
          <p className="products-empty-text">
            {isLowStockFilter
              ? tUi('ui.pages.admin.adminProducts.noLowStockItemsFound_5b5f901eef')
              : tUi('ui.pages.admin.adminProducts.noProductsFound_3cff798862')}
          </p>
          {isLowStockFilter ? (
            <button type="button" onClick={() => navigate(routeBase)} className="show-all-btn">
              {tUi('ui.pages.admin.adminProducts.showAllProducts_f65c4d16b1')}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="products-grid products-grid-dashboard">
          {products.map((product, index) => {
            const sentiment = getSentimentSummary(product.id);
            const discountedPrice = calculateDiscountedPrice(product);

            return (
              <motion.article
                key={product.id}
                className="admin-product-card admin-product-card-dashboard"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}>
                <div className="product-image product-image-dashboard">
                  <img
                    src={
                      product.images && product.images.length > 0
                        ? getImagePreviewUrl(product.images[0])
                        : `${API_BASE_URL}/images/placeholder.jpg`
                    }
                    alt={product.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = `${API_BASE_URL}/images/placeholder.jpg`;
                    }}
                  />

                  <div className="product-image-overlay">
                    <span className="product-category-badge">{product.category_name}</span>
                    {product.discount_enabled ? (
                      <span className="product-sale-badge">
                        {tUi('ui.pages.admin.adminProducts.discount_e4537e1136')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="product-info product-info-dashboard">
                  <div className="product-heading-row">
                    <h3>{product.name}</h3>
                  </div>

                  <div className="product-status-row product-status-row-dashboard">
                    {product.quantity < lowStockThreshold ? (
                      <span className="status-chip low">{tUi('ui.pages.admin.adminProducts.lowStock_4da96beeec')}</span>
                    ) : null}
                  </div>

                  <div className="product-metrics-row">
                    <div className="product-price-column">
                      <p className="product-metric-label">{tUi('ui.pages.admin.adminProducts.price_e83d5427d6')}</p>
                      <div className="product-price-stack">
                        <p className="product-price">
                          {formatCurrency(product.discount_enabled ? discountedPrice : product.price)}
                        </p>
                        <p className={`product-price-original ${product.discount_enabled ? '' : 'product-price-original-placeholder'}`}>
                          {product.discount_enabled ? formatCurrency(product.price) : formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>

                    <div className="product-stock-box">
                      <p className="product-metric-label">{tUi('ui.pages.admin.adminProducts.stock_04fad4218b').replace(':', '')}</p>
                      <p className="product-stock-value">{product.quantity}</p>
                    </div>
                  </div>

                  <div className="sentiment-analytics sentiment-analytics-dashboard">
                    <div className="sentiment-card-header">
                      <p className="sentiment-title">{tUi('ui.pages.admin.adminProducts.reviewSentiment_ab05791b1b')}</p>
                      <p className="sentiment-total">
                        {tUi('ui.pages.admin.adminProducts.total_e6ca32913e')} {sentiment.total_reviews}{' '}
                        {tUi('ui.pages.admin.adminProducts.reviews_1e5dd01879')}
                      </p>
                    </div>

                    <div className="sentiment-stats sentiment-stats-dashboard">
                      <span className="sentiment-positive">
                        <FaRegFaceSmile />
                        {sentiment.positive_count}
                      </span>
                      <span className="sentiment-neutral">
                        <FaRegFaceMeh />
                        {sentiment.neutral_count}
                      </span>
                      <span className="sentiment-negative">
                        <FaRegFaceFrown />
                        {sentiment.negative_count}
                      </span>
                    </div>

                    <div className="sentiment-chart">
                      <div className="sentiment-bar">
                        <div
                          className="sentiment-bar-positive"
                          style={{
                            width:
                              sentiment.total_reviews > 0
                                ? `${(sentiment.positive_count / sentiment.total_reviews) * 100}%`
                                : '0%'
                          }}
                        />
                        <div
                          className="sentiment-bar-neutral"
                          style={{
                            width:
                              sentiment.total_reviews > 0
                                ? `${(sentiment.neutral_count / sentiment.total_reviews) * 100}%`
                                : '0%'
                          }}
                        />
                        <div
                          className="sentiment-bar-negative"
                          style={{
                            width:
                              sentiment.total_reviews > 0
                                ? `${(sentiment.negative_count / sentiment.total_reviews) * 100}%`
                                : '0%'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="product-actions product-actions-dashboard">
                  <button
                    type="button"
                    onClick={() => navigate(`${commentsBase}/product/${product.id}`)}
                    className="reviews-btn"
                    title={tUi('ui.pages.admin.adminProducts.viewReviews_03abf00f90')}>
                    {tUi('ui.pages.admin.adminProducts.reviews_f2a6d42678')}
                  </button>
                  <button type="button" onClick={() => handleEdit(product)} className="edit-btn">
                    {tUi('ui.pages.admin.adminProducts.edit_6b4f086241')}
                  </button>
                  <button type="button" onClick={() => handleDelete(product.id)} className="delete-btn">
                    {tUi('ui.pages.admin.adminProducts.delete_d93e34aa58')}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="mobile-add-product-fab"
        onClick={() => {
          resetForm();
          setShowModal(true);
        }}>
        <FaPlus />
      </button>

      <ProductFormModal
        isOpen={showModal}
        onClose={resetForm}
        onSaved={fetchProducts}
        editingProduct={editingProduct}
        categories={categories}
        setCategories={setCategories}
        panelKicker={panelKicker}
      />
    </div>
  );
};

export default AdminProducts;
