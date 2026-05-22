import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaArrowTrendUp,
  FaDownload,
  FaMagnifyingGlass,
  FaPlus,
  FaRegFaceFrown,
  FaRegFaceMeh,
  FaRegFaceSmile,
  FaXmark
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import API_BASE_URL, {
  ADMIN_SETTINGS_ENDPOINTS,
  CATEGORY_ENDPOINTS,
  COMMENT_ENDPOINTS,
  IMAGE_ENDPOINTS,
  PRODUCT_ENDPOINTS,
  buildUrl
} from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminProducts.css';

const DEFAULT_ANALYTICS = {
  total_reviews: 0,
  positive_count: 0,
  neutral_count: 0,
  negative_count: 0
};

const AdminProducts = () => {
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
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isLowStockFilter, setIsLowStockFilter] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilters, setQuickFilters] = useState({
    lowstock: false,
    discounted: false
  });
  const [sentimentAnalytics, setSentimentAnalytics] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    name_fr: '',
    description: '',
    description_ar: '',
    description_fr: '',
    price: '',
    quantity: '',
    category_name: '',
    discount_enabled: false,
    discount_type: 'percentage',
    discount_value: ''
  });

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

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    const totalImages = images.length + files.length;

    if (totalImages > 3) {
      toast.error(tUi('ui.pages.admin.adminProducts.maximum3ImagesAllowedPlease_7319ac078b'));
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const responses = await Promise.all(
        files.map((file) => {
          const uploadData = new FormData();
          uploadData.append('image', file);
          return http.post(IMAGE_ENDPOINTS.UPLOAD, uploadData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        })
      );

      const uploadedImages = responses.map((response) => response.data.filename);
      setImages((prev) => [...prev, ...uploadedImages]);
      toast.success(tUi('ui.pages.admin.adminProducts.imagesUploadedSuccessfully_fee7383b18'));
    } catch (error) {
      toast.error(tUi('ui.pages.admin.adminProducts.failedToUploadImages_f707ddb8e2'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  };

  const getImagePreviewUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const normalizedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

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

  const getSentimentSummary = (productId) => {
    const analytics = sentimentAnalytics[productId] || DEFAULT_ANALYTICS;
    const total = analytics.total_reviews || 0;
    const positiveRate = total > 0 ? Math.round((analytics.positive_count / total) * 100) : 0;

    return {
      ...analytics,
      positiveRate
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (images.length < 1) {
      toast.error(tUi('ui.pages.admin.adminProducts.atLeastOneImageIs_8b5c4f7485'));
      return;
    }

    if (images.length > 3) {
      toast.error(tUi('ui.pages.admin.adminProducts.maximum3ImagesAllowed_071181eac3'));
      return;
    }

    try {
      const basePrice = parseFloat(formData.price);
      let discountEnabled = Boolean(formData.discount_enabled);
      let discountType = formData.discount_type;
      let discountValue = parseFloat(formData.discount_value);

      if (editingProduct) {
        discountEnabled = Boolean(editingProduct.discount_enabled);
        discountType = editingProduct.discount_type;
        discountValue = editingProduct.discount_value ?? 0;
      } else if (discountEnabled) {
        const rawDiscountValue = formData.discount_value;
        if (rawDiscountValue === '' || rawDiscountValue === null || rawDiscountValue === undefined) {
          toast.error(tUi('ui.pages.admin.adminProducts.discountValueIsRequiredWhen_7037da0d1a'));
          return;
        }
        if (!['percentage', 'fixed'].includes(discountType)) {
          toast.error(tUi('ui.pages.admin.adminProducts.pleaseSelectAValidDiscount_b85b304c81'));
          return;
        }
        if (Number.isNaN(discountValue) || discountValue <= 0) {
          toast.error(tUi('ui.pages.admin.adminProducts.discountValueMustBeGreater_ef09745ad2'));
          return;
        }
        if (discountType === 'percentage' && discountValue > 100) {
          toast.error(tUi('ui.pages.admin.adminProducts.percentageDiscountCannotBeMore_fa2e324b58'));
          return;
        }
        if (discountType === 'fixed' && discountValue > basePrice) {
          toast.error(tUi('ui.pages.admin.adminProducts.fixedDiscountCannotExceedThe_499b7ac30a'));
          return;
        }
      }

      const productData = {
        ...formData,
        price: basePrice,
        quantity: parseInt(formData.quantity, 10),
        discount_enabled: discountEnabled,
        discount_type: discountEnabled ? discountType : null,
        discount_value: discountEnabled ? discountValue : 0,
        images
      };

      if (editingProduct) {
        if (!editingProduct.id) {
          toast.error(tUi('ui.pages.admin.adminProducts.errorProductIdIsMissing_7f8228b6c4'));
          return;
        }

        await http.put(PRODUCT_ENDPOINTS.UPDATE.replace('{id}', editingProduct.id), productData);
        toast.success(tUi('ui.pages.admin.adminProducts.productUpdatedSuccessfully_32fdf252d5'));
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, productData);
        toast.success(tUi('ui.pages.admin.adminProducts.productCreatedSuccessfully_132827050a'));
      }

      resetForm();
      await fetchProducts();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save product';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (product) => {
    if (product.category_name && !categories.some((category) => category.name === product.category_name)) {
      setCategories((prev) => [
        ...prev,
        { id: `current-${product.category_name}`, name: product.category_name, description: '' }
      ]);
    }

    setEditingProduct(product);
    setFormData({
      name: product.name,
      name_ar: product.name_ar || '',
      name_fr: product.name_fr || '',
      description: product.description,
      description_ar: product.description_ar || '',
      description_fr: product.description_fr || '',
      price: product.price,
      quantity: product.quantity,
      category_name: product.category_name,
      discount_enabled: false,
      discount_type: 'percentage',
      discount_value: ''
    });
    setImages(product.images || []);
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
    setFormData({
      name: '',
      name_ar: '',
      name_fr: '',
      description: '',
      description_ar: '',
      description_fr: '',
      price: '',
      quantity: '',
      category_name: '',
      discount_enabled: false,
      discount_type: 'percentage',
      discount_value: ''
    });
    setImages([]);
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

  return (
    <div className="admin-products admin-products-shell">
      <section className="admin-products-hero">
        <div className="admin-products-hero-main">
          <div className="admin-products-hero-top">
            <div className="admin-products-hero-copy">
              <span className="admin-products-eyebrow">Catalog control center</span>
              <h1>{tUi('ui.pages.admin.adminProducts.manageProducts_273cb9a998')}</h1>
              <p className="admin-products-subtitle">
                Track inventory, update details, and manage your catalog faster.
              </p>
            </div>

            <div className="admin-products-hero-actions">
              <button type="button" className="products-ghost-button" onClick={handleExportCsv}>
                <FaDownload />
                <span>Export CSV</span>
              </button>
              <motion.button
                type="button"
                className="add-product-btn add-product-btn-hero"
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}>
                <FaPlus />
                <span>{tUi('ui.pages.admin.adminProducts.addProduct_2792a039d2').replace('+ ', '')}</span>
              </motion.button>
            </div>
          </div>

          <div className="admin-products-hero-bottom">
            <div className="products-overview products-overview-panel products-overview-inline">
              <button
                type="button"
                className={`overview-item overview-pill ${!isAnyQuickFilterActive ? 'active' : ''}`}
                onClick={clearQuickFilters}>
                <span className="overview-pill-label">{tUi('ui.pages.admin.adminProducts.total_e2ad894d2e')}</span>
                <span className="overview-pill-value">{totalProducts}</span>
              </button>

              <button
                type="button"
                className={`overview-item overview-pill overview-pill-warn ${isLowStockActive ? 'active' : ''}`}
                onClick={() => handleQuickFilterClick('lowstock')}>
                <span className="overview-pill-label">{tUi('ui.pages.admin.adminProducts.lowStock_4da96beeec')}</span>
                <span className="overview-pill-value">{lowStockCount}</span>
              </button>

              <button
                type="button"
                className={`overview-item overview-pill overview-pill-sale ${quickFilters.discounted ? 'active' : ''}`}
                onClick={() => handleQuickFilterClick('discounted')}>
                <span className="overview-pill-dot" />
                <span className="overview-pill-label">{tUi('ui.pages.admin.adminProducts.discounted_0b5fed5eb6')}</span>
                <span className="overview-pill-value">{discountedCount}</span>
              </button>
            </div>

            <div className="products-toolbar products-toolbar-panel products-toolbar-inline">
              <div className="products-search products-search-panel products-search-inline">
                <FaMagnifyingGlass className="products-search-icon" />
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
          </div>

          {isLowStockFilter ? (
            <p className="low-stock-banner admin-products-hero-banner">
              {tUi('ui.pages.admin.adminProducts.showingLowStockItemsQuantity_52b64ac8b5')} {'<'}{' '}
              {lowStockThreshold})
            </p>
          ) : null}
        </div>
      </section>

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
                        {product.discount_type === 'percentage'
                          ? `-${Math.round(product.discount_value || 0)}%`
                          : tUi('ui.pages.admin.adminProducts.discount_e4537e1136')}
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

      <AnimatePresence>
        {showModal ? (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}>
            <motion.div
              className="modal-content"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="modal-eyebrow">{editingProduct ? 'Catalog update' : 'New catalog item'}</span>
                  <h2>
                    {editingProduct
                      ? tUi('ui.pages.admin.adminProducts.editProduct_e63de796e6')
                      : tUi('ui.pages.admin.adminProducts.addNewProduct_109f983c59')}
                  </h2>
                </div>
                <button type="button" className="modal-close-button" onClick={resetForm}>
                  <FaXmark />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{tUi('ui.pages.admin.adminProducts.productName_f2fbd60c6e')}</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>

                <div className="form-grid-triple">
                  <div className="form-group">
                    <label>Product Name (Arabic)</label>
                    <input type="text" name="name_ar" value={formData.name_ar} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Product Name (French)</label>
                    <input type="text" name="name_fr" value={formData.name_fr} onChange={handleInputChange} />
                  </div>
                  <div className="form-group form-group-highlight">
                    <label>{tUi('ui.pages.admin.adminProducts.categoryName_d2ea6c7aa6')}</label>
                    <select
                      name="category_name"
                      value={formData.category_name}
                      onChange={handleInputChange}
                      required>
                      <option value="">{tUi('ui.pages.admin.adminProducts.selectACategory_bb39da5ab8')}</option>
                      {categories.map((category) => (
                        <option key={category.name} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>{tUi('ui.pages.admin.adminProducts.description_92d5f9f27a')}</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows="4"
                  />
                </div>

                <div className="form-grid-double">
                  <div className="form-group">
                    <label>Description (Arabic)</label>
                    <textarea name="description_ar" value={formData.description_ar} onChange={handleInputChange} rows="3" />
                  </div>
                  <div className="form-group">
                    <label>Description (French)</label>
                    <textarea name="description_fr" value={formData.description_fr} onChange={handleInputChange} rows="3" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{tUi('ui.pages.admin.adminProducts.price_e83d5427d6')}</label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>{tUi('ui.pages.admin.adminProducts.quantity_05a793b136')}</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div className="form-group upload-panel">
                  <label>{tUi('ui.pages.admin.adminProducts.productImages13Images_b802fc6b5e')}</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading || images.length >= 3}
                  />

                  <small className="image-hint">
                    {images.length === 0 && tUi('ui.pages.admin.adminProducts.atLeast1ImageIs_5c02b8c404')}
                    {images.length > 0 &&
                      tUi('ui.pages.admin.adminProducts.value3ImagesSelected_586058179b', { value0: images.length })}
                    {' '}
                    {images.length < 3 && tUi('ui.pages.admin.adminProducts.youCanAddMoreImages_60be49e0df')}
                    {images.length >= 3 && tUi('ui.pages.admin.adminProducts.maximum3ImagesReached_b22426d304')}
                  </small>

                  {uploading ? <LoadingSpinner size="small" /> : null}

                  {images.length > 0 ? (
                    <div className="uploaded-images">
                      {images.map((img, index) => (
                        <div key={img || index} className="image-tag">
                          <img
                            src={getImagePreviewUrl(img)}
                            alt={tUi('ui.pages.admin.adminProducts.productValue_68027a6752', { value0: index + 1 })}
                            className="image-preview-thumb"
                          />
                          <span>{img.split('/').pop()}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="remove-image-btn"
                            title={tUi('ui.pages.admin.adminProducts.removeImage_f5462c1134')}>
                            <FaXmark />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {!editingProduct ? (
                  <div className="form-group discount-settings">
                    <label className="discount-toggle">
                      <input
                        type="checkbox"
                        name="discount_enabled"
                        checked={formData.discount_enabled}
                        onChange={handleInputChange}
                      />
                      {tUi('ui.pages.admin.adminProducts.enableDiscount_6f1ae41f4b')}
                    </label>

                    <div className="form-row">
                      <div className="form-group">
                        <label>{tUi('ui.pages.admin.adminProducts.discountType_290629062f')}</label>
                        <select
                          name="discount_type"
                          value={formData.discount_type}
                          onChange={handleInputChange}
                          disabled={!formData.discount_enabled}>
                          <option value="percentage">{tUi('ui.pages.admin.adminProducts.percentage_a8cb8ffe45')}</option>
                          <option value="fixed">{tUi('ui.pages.admin.adminProducts.fixedAmount_3189e1492d')}</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>
                          {tUi('ui.pages.admin.adminProducts.discountValue_e3feb63e4a')}
                          {formData.discount_type === 'percentage'
                            ? ' (%)'
                            : ` ${tUi('ui.pages.admin.adminProducts.amount_877f16267e')}`}
                        </label>
                        <input
                          type="number"
                          name="discount_value"
                          value={formData.discount_value}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          disabled={!formData.discount_enabled}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="modal-actions">
                  <button type="button" onClick={resetForm} className="cancel-btn">
                    {tUi('ui.pages.admin.adminProducts.cancel_bf8eef7581')}
                  </button>
                  <button type="submit" className="save-btn">
                    {editingProduct
                      ? tUi('ui.pages.admin.adminProducts.update_45dc0cf26a')
                      : tUi('ui.pages.admin.adminProducts.create_a62a4e5374')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AdminProducts;
