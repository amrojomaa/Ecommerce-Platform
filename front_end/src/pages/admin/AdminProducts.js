import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import API_BASE_URL, { PRODUCT_ENDPOINTS, IMAGE_ENDPOINTS, CATEGORY_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS, COMMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { formatPrice } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';
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
    discount_value: '',
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isLowStockFilter, setIsLowStockFilter] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilters, setQuickFilters] = useState({
    lowstock: false,
    discounted: false,
  });
  const [sentimentAnalytics, setSentimentAnalytics] = useState({}); // { productId: { total, positive, neutral, negative } }
  const confirm = useConfirm();

  useEffect(() => {
    fetchLowStockThreshold();
    fetchProducts();
    fetchCategories();
  }, []);

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
      toast.error('Failed to fetch products');
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
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    // Check total images count (existing + new)
    const totalImages = images.length + files.length;
    if (totalImages > 3) {
      toast.error('Maximum 3 images allowed. Please remove some images first.');
      e.target.value = ''; // Reset file input
      return;
    }
    
    setUploading(true);
    
    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('image', file);
        return http.post(IMAGE_ENDPOINTS.UPLOAD, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      });

      const responses = await Promise.all(uploadPromises);
      const uploadedImages = responses.map(r => r.data.filename);
      setImages([...images, ...uploadedImages]);
      toast.success('Images uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload images');
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
      toast.error('At least one image is required');
      return;
    }
    
    if (images.length > 3) {
      toast.error('Maximum 3 images allowed');
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
          toast.error('Discount value is required when discount is enabled.');
          return;
        }
        if (!['percentage', 'fixed'].includes(discountType)) {
          toast.error('Please select a valid discount type.');
          return;
        }
        if (Number.isNaN(discountValue) || discountValue <= 0) {
          toast.error('Discount value must be greater than 0.');
          return;
        }
        if (discountType === 'percentage' && discountValue > 100) {
          toast.error('Percentage discount cannot be more than 100%.');
          return;
        }
        if (discountType === 'fixed' && discountValue > basePrice) {
          toast.error('Fixed discount cannot exceed the original price.');
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
        images: images,
      };
      
      if (editingProduct) {
        if (!editingProduct.id) {
          toast.error('Error: Product ID is missing. Please refresh and try again.');
          return;
        }
        await http.put(
          PRODUCT_ENDPOINTS.UPDATE.replace('{id}', editingProduct.id),
          productData
        );
        toast.success('Product updated successfully');
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, productData);
        toast.success('Product created successfully');
      }
      
      resetForm();
      await fetchProducts();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save product';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      quantity: product.quantity,
      category_name: product.category_name,
      discount_enabled: false,
      discount_type: 'percentage',
      discount_value: '',
    });
    // Load existing images
    setImages(product.images || []);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete product',
      message: 'Are you sure you want to delete this product?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    try {
      await http.delete(PRODUCT_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success('Product deleted successfully');
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
      discount_value: '',
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
      [filterName]: !prev[filterName],
    }));
  };

  const clearQuickFilters = () => {
    if (isLowStockFilter) {
      navigate('/admin/products');
    }
    setQuickFilters({
      lowstock: false,
      discounted: false,
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
          <h1>Manage Products</h1>
          <p className="admin-products-subtitle">Track inventory, update details, and manage your catalog faster.</p>
          <div className="products-overview">
            <button
              type="button"
              className={`overview-item ${!isAnyQuickFilterActive ? 'active' : ''}`}
              onClick={clearQuickFilters}
            >
              <span className="overview-label">Total</span>
              <span className="overview-value">{totalProducts}</span>
            </button>
            <button
              type="button"
              className={`overview-item ${isLowStockActive ? 'active warning' : ''}`}
              onClick={() => handleQuickFilterClick('lowstock')}
            >
              <span className="overview-label">Low Stock</span>
              <span className="overview-value warning">{lowStockCount}</span>
            </button>
            <button
              type="button"
              className={`overview-item ${quickFilters.discounted ? 'active success' : ''}`}
              onClick={() => handleQuickFilterClick('discounted')}
            >
              <span className="overview-label">Discounted</span>
              <span className="overview-value success">{discountedCount}</span>
            </button>
          </div>
          {isLowStockFilter && (
            <p className="low-stock-banner">
              ⚠️ Showing low stock items (quantity {'<'} {lowStockThreshold})
            </p>
          )}
          <div className="products-toolbar">
            <div className="products-search">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product or category..."
                aria-label="Search products"
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={clearSearch}>
                  Clear
                </button>
              )}
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
          whileTap={{ scale: 0.95 }}
        >
          + Add Product
        </motion.button>
      </div>

      {loading ? (
        <div className="products-grid">
          {[...Array(8)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="products-empty-state">
          <p className="products-empty-text">
            {isLowStockFilter 
              ? 'No low stock items found. All products have sufficient inventory.' 
              : 'No products found.'}
          </p>
          {isLowStockFilter && (
            <button
              onClick={() => navigate('/admin/products')}
              className="show-all-btn"
            >
              Show All Products
            </button>
          )}
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              className="admin-product-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="product-image">
                <img
                  src={product.images && product.images.length > 0 
                    ? getImagePreviewUrl(product.images[0])
                    : `${API_BASE_URL}/images/placeholder.jpg`}
                  alt={product.name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = `${API_BASE_URL}/images/placeholder.jpg`;
                  }}
                />
              </div>
              <div className="product-info">
                <div className="product-status-row">
                  {product.discount_enabled && <span className="status-chip discount">Discount</span>}
                  {product.quantity < lowStockThreshold && <span className="status-chip low">Low Stock</span>}
                </div>
                <h3>{product.name}</h3>
                <p className="product-category">{product.category_name}</p>
                {product.discount_enabled ? (
                  <div className="product-price-block">
                    <p className="product-price-original">{formatPrice(product.price)}</p>
                    <p className="product-price-discounted">{formatPrice(product.discounted_price ?? product.price)}</p>
                  </div>
                ) : (
                  <p className="product-price">{formatPrice(product.price)}</p>
                )}
                <p className="product-stock">Stock: {product.quantity}</p>
                {sentimentAnalytics[product.id] && (
                  <div className="sentiment-analytics">
                    <p className="sentiment-title">Review Sentiment:</p>
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
                    {sentimentAnalytics[product.id].total_reviews > 0 && (
                      <div className="sentiment-chart">
                        <div className="sentiment-bar">
                          <div
                            className="sentiment-bar-positive"
                            style={{
                              width: `${(sentimentAnalytics[product.id].positive_count / sentimentAnalytics[product.id].total_reviews) * 100}%`
                            }}
                          />
                          <div
                            className="sentiment-bar-neutral"
                            style={{
                              width: `${(sentimentAnalytics[product.id].neutral_count / sentimentAnalytics[product.id].total_reviews) * 100}%`
                            }}
                          />
                          <div
                            className="sentiment-bar-negative"
                            style={{
                              width: `${(sentimentAnalytics[product.id].negative_count / sentimentAnalytics[product.id].total_reviews) * 100}%`
                            }}
                          />
                        </div>
                        <p className="sentiment-total">
                          Total: {sentimentAnalytics[product.id].total_reviews} reviews
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="product-actions">
                <button 
                  onClick={() => navigate(`/admin/comments/product/${product.id}`)} 
                  className="reviews-btn"
                  title="View Reviews"
                >
                  Reviews
                </button>
                <button onClick={() => handleEdit(product)} className="edit-btn">
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows="4"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Price *</label>
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
                    <label>Quantity *</label>
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

                <div className="form-group">
                  <label>Category Name *</label>
                  <select
                    name="category_name"
                    value={formData.category_name}
                    onChange={handleInputChange}
                    required
                    className="category-select"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Product Images * (1-3 images required)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading || images.length >= 3}
                  />
                  <small className="image-hint">
                    {images.length === 0 && 'At least 1 image is required. '}
                    {images.length > 0 && `${images.length}/3 images selected. `}
                    {images.length < 3 && 'You can add more images.'}
                    {images.length >= 3 && 'Maximum 3 images reached.'}
                  </small>
                  {uploading && <LoadingSpinner size="small" />}
                  {images.length > 0 && (
                    <div className="uploaded-images">
                      {images.map((img, idx) => (
                        <div key={img || idx} className="image-tag">
                          <img
                            src={getImagePreviewUrl(img)}
                            alt={`Product ${idx + 1}`}
                            className="image-preview-thumb"
                          />
                          <span>{img.split('/').pop()}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="remove-image-btn"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!editingProduct && (
                  <div className="form-group discount-settings">
                    <label className="discount-toggle">
                      <input
                        type="checkbox"
                        name="discount_enabled"
                        checked={formData.discount_enabled}
                        onChange={handleInputChange}
                      />
                      Enable Discount
                    </label>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Discount Type</label>
                        <select
                          name="discount_type"
                          value={formData.discount_type}
                          onChange={handleInputChange}
                          disabled={!formData.discount_enabled}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>
                          Discount Value {formData.discount_type === 'percentage' ? '(%)' : '(Amount)'}
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
                )}

                <div className="modal-actions">
                  <button type="button" onClick={resetForm} className="cancel-btn">
                    Cancel
                  </button>
                  <button type="submit" className="save-btn">
                    {editingProduct ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminProducts;
