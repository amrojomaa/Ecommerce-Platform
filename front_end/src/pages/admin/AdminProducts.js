import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import API_BASE_URL, { PRODUCT_ENDPOINTS, IMAGE_ENDPOINTS, CATEGORY_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS, COMMENT_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminProducts.css';

const AdminProducts = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState([]); // Store all products
  const [products, setProducts] = useState([]); // Filtered products
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    category_name: '',
    discount_enabled: false,
    discount_type: 'percentage',
    discount_value: ''
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isLowStockFilter, setIsLowStockFilter] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilters, setQuickFilters] = useState({
    lowstock: false,
    discounted: false
  });
  const [sentimentAnalytics, setSentimentAnalytics] = useState({}); // { productId: { total, positive, neutral, negative } }
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchLowStockThreshold();
    fetchProducts();
    fetchCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLowStockThreshold = async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      const threshold = response.data.threshold;
      setLowStockThreshold(threshold);
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      // Use default value of 10 if fetch fails
      setLowStockThreshold(10);
    }
  };

  // Check URL parameter and apply filter
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const isLowStock = filterParam === 'lowstock';
    setIsLowStockFilter(isLowStock);

    let filteredProducts = [...allProducts];

    if (isLowStock || quickFilters.lowstock) {
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
  }, [searchParams, allProducts, lowStockThreshold, searchQuery, quickFilters]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setAllProducts(response.data); // Store all products
      // Fetch sentiment analytics for all products
      await fetchSentimentAnalytics(response.data);
    } catch (error) {
      toast.error(tUi("ui.pages.admin.adminProducts.failedToFetchProducts_a8f46599c5"));
    } finally {
      setLoading(false);
    }
  };

  const fetchSentimentAnalytics = async (products) => {
    const analytics = {};
    const promises = products.map(async (product) => {
      try {
        const response = await http.get(
          buildUrl(COMMENT_ENDPOINTS.SENTIMENT_ANALYTICS, { product_id: product.id })
        );
        analytics[product.id] = response.data;
      } catch (error) {
        // If analytics endpoint fails, set default values
        analytics[product.id] = {
          total_reviews: 0,
          positive_count: 0,
          neutral_count: 0,
          negative_count: 0
        };
      }
    });
    await Promise.all(promises);
    setSentimentAnalytics(analytics);
  };

  const fetchCategories = async () => {
    try {
      const response = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      // Don't show alert for categories, just log error
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    // Check total images count (existing + new)
    const totalImages = images.length + files.length;
    if (totalImages > 3) {
      toast.error(tUi("ui.pages.admin.adminProducts.maximum3ImagesAllowedPlease_7319ac078b"));
      e.target.value = ''; // Reset file input
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = files.map((file) => {
        const formData = new FormData();
        formData.append('image', file);
        return http.post(IMAGE_ENDPOINTS.UPLOAD, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      });

      const responses = await Promise.all(uploadPromises);
      const uploadedImages = responses.map((r) => r.data.filename);
      setImages([...images, ...uploadedImages]);
      toast.success(tUi("ui.pages.admin.adminProducts.imagesUploadedSuccessfully_fee7383b18"));
    } catch (error) {
      toast.error(tUi("ui.pages.admin.adminProducts.failedToUploadImages_f707ddb8e2"));
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const getImagePreviewUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const normalizedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate images: must have at least 1 image
    if (images.length < 1) {
      toast.error(tUi("ui.pages.admin.adminProducts.atLeastOneImageIs_8b5c4f7485"));
      return;
    }

    if (images.length > 3) {
      toast.error(tUi("ui.pages.admin.adminProducts.maximum3ImagesAllowed_071181eac3"));
      return;
    }

    try {
      const basePrice = parseFloat(formData.price);
      let discountEnabled = Boolean(formData.discount_enabled);
      let discountType = formData.discount_type;
      let discountValue = parseFloat(formData.discount_value);

      // In edit mode, keep existing discount values as-is.
      if (editingProduct) {
        discountEnabled = Boolean(editingProduct.discount_enabled);
        discountType = editingProduct.discount_type;
        discountValue = editingProduct.discount_value ?? 0;
      } else if (discountEnabled) {
        const rawDiscountValue = formData.discount_value;
        if (rawDiscountValue === '' || rawDiscountValue === null || rawDiscountValue === undefined) {
          toast.error(tUi("ui.pages.admin.adminProducts.discountValueIsRequiredWhen_7037da0d1a"));
          return;
        }
        if (!['percentage', 'fixed'].includes(discountType)) {
          toast.error(tUi("ui.pages.admin.adminProducts.pleaseSelectAValidDiscount_b85b304c81"));
          return;
        }
        if (Number.isNaN(discountValue) || discountValue <= 0) {
          toast.error(tUi("ui.pages.admin.adminProducts.discountValueMustBeGreater_ef09745ad2"));
          return;
        }
        if (discountType === 'percentage' && discountValue > 100) {
          toast.error(tUi("ui.pages.admin.adminProducts.percentageDiscountCannotBeMore_fa2e324b58"));
          return;
        }
        if (discountType === 'fixed' && discountValue > basePrice) {
          toast.error(tUi("ui.pages.admin.adminProducts.fixedDiscountCannotExceedThe_499b7ac30a"));
          return;
        }
      }

      const productData = {
        ...formData,
        price: basePrice,
        quantity: parseInt(formData.quantity),
        discount_enabled: discountEnabled,
        discount_type: discountEnabled ? discountType : null,
        discount_value: discountEnabled ? discountValue : 0,
        images: images
      };

      if (editingProduct) {
        if (!editingProduct.id) {
          toast.error(tUi("ui.pages.admin.adminProducts.errorProductIdIsMissing_7f8228b6c4"));
          return;
        }
        await http.put(
          PRODUCT_ENDPOINTS.UPDATE.replace('{id}', editingProduct.id),
          productData
        );
        toast.success(tUi("ui.pages.admin.adminProducts.productUpdatedSuccessfully_32fdf252d5"));
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, productData);
        toast.success(tUi("ui.pages.admin.adminProducts.productCreatedSuccessfully_132827050a"));
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
      description: product.description,
      price: product.price,
      quantity: product.quantity,
      category_name: product.category_name,
      discount_enabled: false,
      discount_type: 'percentage',
      discount_value: ''
    });
    // Load existing images
    setImages(product.images || []);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: tUi("ui.pages.admin.adminProducts.deleteProduct_5d6cc29a29"),
      message: tUi("ui.pages.admin.adminProducts.areYouSureYouWant_4733cf098f"),
      confirmText: tUi("ui.pages.admin.adminProducts.delete_d93e34aa58"),
      cancelText: tUi("ui.pages.admin.adminProducts.cancel_bf8eef7581")
    });
    if (!confirmed) {
      return;
    }

    try {
      await http.delete(PRODUCT_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success(tUi("ui.pages.admin.adminProducts.productDeletedSuccessfully_f5f852a577"));
      await fetchProducts();
    } catch (error) {
      toast.error(error.message || 'Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
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
      navigate('/admin/products');
      return;
    }
    setQuickFilters((prev) => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const clearQuickFilters = () => {
    if (isLowStockFilter) {
      navigate('/admin/products');
    }
    setQuickFilters({
      lowstock: false,
      discounted: false
    });
  };

  const totalProducts = allProducts.length;
  const lowStockCount = allProducts.filter((product) => product.quantity < lowStockThreshold).length;
  const discountedCount = allProducts.filter((product) => product.discount_enabled).length;

  const isAnyQuickFilterActive = isLowStockFilter || quickFilters.lowstock || quickFilters.discounted;
  const isLowStockActive = isLowStockFilter || quickFilters.lowstock;

  return (
    <div className="admin-products">
      <div className="admin-products-header">
        <div className="header-left">
          <h1>{tUi("ui.pages.admin.adminProducts.manageProducts_273cb9a998")}</h1>
          <p className="admin-products-subtitle">{tUi("ui.pages.admin.adminProducts.trackInventoryUpdateDetailsAnd_86a8fb17ed")}</p>
          <div className="products-overview">
            <button
              type="button"
              className={`overview-item ${!isAnyQuickFilterActive ? 'active' : ''}`}
              onClick={clearQuickFilters}>
              
              <span className="overview-label">{tUi("ui.pages.admin.adminProducts.total_e2ad894d2e")}</span>
              <span className="overview-value">{totalProducts}</span>
            </button>
            <button
              type="button"
              className={`overview-item ${isLowStockActive ? 'active warning' : ''}`}
              onClick={() => handleQuickFilterClick("lowstock")}>
              
              <span className="overview-label">{tUi("ui.pages.admin.adminProducts.lowStock_4da96beeec")}</span>
              <span className="overview-value warning">{lowStockCount}</span>
            </button>
            <button
              type="button"
              className={`overview-item ${quickFilters.discounted ? 'active success' : ''}`}
              onClick={() => handleQuickFilterClick("discounted")}>
              
              <span className="overview-label">{tUi("ui.pages.admin.adminProducts.discounted_0b5fed5eb6")}</span>
              <span className="overview-value success">{discountedCount}</span>
            </button>
          </div>
          {isLowStockFilter &&
          <p className="low-stock-banner">{tUi("ui.pages.admin.adminProducts.showingLowStockItemsQuantity_52b64ac8b5")}
            {'<'} {lowStockThreshold})
            </p>
          }
          <div className="products-toolbar">
            <div className="products-search">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tUi("ui.pages.admin.adminProducts.searchByProductOrCategory_61793e3378")}
                aria-label={tUi("ui.pages.admin.adminProducts.searchProducts_ab5d94763a")} />
              
              {searchQuery &&
              <button type="button" className="clear-search-btn" onClick={clearSearch}>{tUi("ui.pages.admin.adminProducts.clear_049e273c52")}

              </button>
              }
            </div>
          </div>
        </div>
        <motion.button
          className="add-product-btn"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}>{tUi("ui.pages.admin.adminProducts.addProduct_2792a039d2")}


        </motion.button>
      </div>

      {loading ?
      <div className="products-grid">
          {[...Array(8)].map((_, i) =>
        <ProductCardSkeleton key={i} />
        )}
        </div> :
      products.length === 0 ?
      <div className="products-empty-state">
          <p className="products-empty-text">
            {isLowStockFilter ? tUi("ui.pages.admin.adminProducts.noLowStockItemsFound_5b5f901eef") : tUi("ui.pages.admin.adminProducts.noProductsFound_3cff798862")

          }
          </p>
          {isLowStockFilter &&
        <button
          onClick={() => navigate('/admin/products')}
          className="show-all-btn">{tUi("ui.pages.admin.adminProducts.showAllProducts_f65c4d16b1")}


        </button>
        }
        </div> :

      <div className="products-grid">
          {products.map((product, index) =>
        <motion.div
          key={product.id}
          className="admin-product-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}>
          
              <div className="product-image">
                <img
              src={product.images && product.images.length > 0 ?
              getImagePreviewUrl(product.images[0]) : `${
              API_BASE_URL}/images/placeholder.jpg`}
              alt={product.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = `${API_BASE_URL}/images/placeholder.jpg`;
              }} />
            
              </div>
              <div className="product-info">
                <div className="product-status-row">
                  {product.discount_enabled && <span className="status-chip discount">{tUi("ui.pages.admin.adminProducts.discount_e4537e1136")}</span>}
                  {product.quantity < lowStockThreshold && <span className="status-chip low">{tUi("ui.pages.admin.adminProducts.lowStock_4da96beeec")}</span>}
                </div>
                <h3>{product.name}</h3>
                <p className="product-category">{product.category_name}</p>
                {product.discount_enabled ?
            <div className="product-price-block">
                    <p className="product-price-original">{formatCurrency(product.price)}</p>
                    <p className="product-price-discounted">{formatCurrency(product.discounted_price ?? product.price)}</p>
                  </div> :

            <p className="product-price">{formatCurrency(product.price)}</p>
            }
                <p className="product-stock">{tUi("ui.pages.admin.adminProducts.stock_04fad4218b")}{product.quantity}</p>
                {sentimentAnalytics[product.id] &&
            <div className="sentiment-analytics">
                    <p className="sentiment-title">{tUi("ui.pages.admin.adminProducts.reviewSentiment_ab05791b1b")}</p>
                    <div className="sentiment-stats">
                      <span className="sentiment-positive">
                        👍 {sentimentAnalytics[product.id].positive_count}
                      </span>
                      <span className="sentiment-neutral">
                        😐 {sentimentAnalytics[product.id].neutral_count}
                      </span>
                      <span className="sentiment-negative">
                        👎 {sentimentAnalytics[product.id].negative_count}
                      </span>
                    </div>
                    {sentimentAnalytics[product.id].total_reviews > 0 &&
              <div className="sentiment-chart">
                        <div className="sentiment-bar">
                          <div
                    className="sentiment-bar-positive"
                    style={{
                      width: `${sentimentAnalytics[product.id].positive_count / sentimentAnalytics[product.id].total_reviews * 100}%`
                    }} />
                  
                          <div
                    className="sentiment-bar-neutral"
                    style={{
                      width: `${sentimentAnalytics[product.id].neutral_count / sentimentAnalytics[product.id].total_reviews * 100}%`
                    }} />
                  
                          <div
                    className="sentiment-bar-negative"
                    style={{
                      width: `${sentimentAnalytics[product.id].negative_count / sentimentAnalytics[product.id].total_reviews * 100}%`
                    }} />
                  
                        </div>
                        <p className="sentiment-total">{tUi("ui.pages.admin.adminProducts.total_e6ca32913e")}
                  {sentimentAnalytics[product.id].total_reviews}{tUi("ui.pages.admin.adminProducts.reviews_1e5dd01879")}
                </p>
                      </div>
              }
                  </div>
            }
              </div>
              <div className="product-actions">
                <button
              onClick={() => navigate(`/admin/comments/product/${product.id}`)}
              className="reviews-btn"
              title={tUi("ui.pages.admin.adminProducts.viewReviews_03abf00f90")}>{tUi("ui.pages.admin.adminProducts.reviews_f2a6d42678")}


            </button>
                <button onClick={() => handleEdit(product)} className="edit-btn">{tUi("ui.pages.admin.adminProducts.edit_6b4f086241")}

            </button>
                <button
              onClick={() => handleDelete(product.id)}
              className="delete-btn">{tUi("ui.pages.admin.adminProducts.delete_d93e34aa58")}


            </button>
              </div>
            </motion.div>
        )}
        </div>
      }

      <AnimatePresence>
        {showModal &&
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetForm}>
          
            <motion.div
            className="modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}>
            
              <h2>{editingProduct ? tUi("ui.pages.admin.adminProducts.editProduct_e63de796e6") : tUi("ui.pages.admin.adminProducts.addNewProduct_109f983c59")}</h2>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{tUi("ui.pages.admin.adminProducts.productName_f2fbd60c6e")}</label>
                  <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required />
                
                </div>

                <div className="form-group">
                  <label>{tUi("ui.pages.admin.adminProducts.description_92d5f9f27a")}</label>
                  <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows="4" />
                
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{tUi("ui.pages.admin.adminProducts.price_e83d5427d6")}</label>
                    <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    required />
                  
                  </div>

                  <div className="form-group">
                    <label>{tUi("ui.pages.admin.adminProducts.quantity_05a793b136")}</label>
                    <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    required />
                  
                  </div>
                </div>

                <div className="form-group">
                  <label>{tUi("ui.pages.admin.adminProducts.categoryName_d2ea6c7aa6")}</label>
                  <select
                  name="category_name"
                  value={formData.category_name}
                  onChange={handleInputChange}
                  required
                  className="category-select">
                  
                    <option value="">{tUi("ui.pages.admin.adminProducts.selectACategory_bb39da5ab8")}</option>
                    {categories.map((category) =>
                  <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                  )}
                  </select>
                </div>

                <div className="form-group">
                  <label>{tUi("ui.pages.admin.adminProducts.productImages13Images_b802fc6b5e")}</label>
                  <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading || images.length >= 3} />
                
                  <small className="image-hint">
                    {images.length === 0 && tUi("ui.pages.admin.adminProducts.atLeast1ImageIs_5c02b8c404")}
                    {images.length > 0 && tUi("ui.pages.admin.adminProducts.value3ImagesSelected_586058179b", { value0: images.length })}
                    {images.length < 3 && tUi("ui.pages.admin.adminProducts.youCanAddMoreImages_60be49e0df")}
                    {images.length >= 3 && tUi("ui.pages.admin.adminProducts.maximum3ImagesReached_b22426d304")}
                  </small>
                  {uploading && <LoadingSpinner size="small" />}
                  {images.length > 0 &&
                <div className="uploaded-images">
                      {images.map((img, idx) =>
                  <div key={img || idx} className="image-tag">
                          <img
                      src={getImagePreviewUrl(img)}
                      alt={tUi("ui.pages.admin.adminProducts.productValue_68027a6752", { value0: idx + 1 })}
                      className="image-preview-thumb" />
                    
                          <span>{img.split('/').pop()}</span>
                          <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="remove-image-btn"
                      title={tUi("ui.pages.admin.adminProducts.removeImage_f5462c1134")}>
                      
                            ×
                          </button>
                        </div>
                  )}
                    </div>
                }
                </div>

                {!editingProduct &&
              <div className="form-group discount-settings">
                    <label className="discount-toggle">
                      <input
                    type="checkbox"
                    name="discount_enabled"
                    checked={formData.discount_enabled}
                    onChange={handleInputChange} />{tUi("ui.pages.admin.adminProducts.enableDiscount_6f1ae41f4b")}


                </label>

                    <div className="form-row">
                      <div className="form-group">
                        <label>{tUi("ui.pages.admin.adminProducts.discountType_290629062f")}</label>
                        <select
                      name="discount_type"
                      value={formData.discount_type}
                      onChange={handleInputChange}
                      disabled={!formData.discount_enabled}>
                      
                          <option value="percentage">{tUi("ui.pages.admin.adminProducts.percentage_a8cb8ffe45")}</option>
                          <option value="fixed">{tUi("ui.pages.admin.adminProducts.fixedAmount_3189e1492d")}</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>{tUi("ui.pages.admin.adminProducts.discountValue_e3feb63e4a")}
                      {formData.discount_type === "percentage" ? '(%)' : tUi("ui.pages.admin.adminProducts.amount_877f16267e")}
                        </label>
                        <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      disabled={!formData.discount_enabled} />
                    
                      </div>
                    </div>
                  </div>
              }

                <div className="modal-actions">
                  <button type="button" onClick={resetForm} className="cancel-btn">{tUi("ui.pages.admin.adminProducts.cancel_bf8eef7581")}

                </button>
                  <button type="submit" className="save-btn">
                    {editingProduct ? tUi("ui.pages.admin.adminProducts.update_45dc0cf26a") : tUi("ui.pages.admin.adminProducts.create_a62a4e5374")}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

export default AdminProducts;
