import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, CATEGORY_ENDPOINTS, IMAGE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useCurrency } from '../../hooks/useCurrency';
import API_BASE_URL from '../../config/api';
import '../../styles/pages/seller/SellerProducts.css';

const SellerProducts = () => {
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'discount'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', price: '', quantity: '0',
    category_name: '', discount_enabled: false,
    discount_type: 'percentage', discount_value: '',
    images: [''],
  });

  const fetchProducts = useCallback(async () => {
    try {
      const res = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(res.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await http.get(CATEGORY_ENDPOINTS.ALL);
      setCategories(res.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || p.category_name === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (quantity) => {
    if (quantity === 0) return 'out-of-stock';
    if (quantity < 10) return 'low-stock';
    return 'in-stock';
  };

  const getStockLabel = (quantity) => {
    if (quantity === 0) return 'Out of Stock';
    if (quantity < 10) return `Low (${quantity})`;
    return quantity;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedProduct(null);
    setForm({
      name: '', description: '', price: '', quantity: '0',
      category_name: categories.length > 0 ? categories[0].name : '',
      discount_enabled: false, discount_type: 'percentage', discount_value: '',
      images: [''],
    });
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setModalMode('edit');
    setSelectedProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      quantity: String(product.quantity),
      category_name: product.category_name,
      discount_enabled: product.discount_enabled,
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value ? String(product.discount_value) : '',
      images: product.images && product.images.length > 0 ? [...product.images] : [''],
    });
    setShowModal(true);
  };

  const openDiscountModal = (product) => {
    setModalMode('discount');
    setSelectedProduct(product);
    setForm({
      ...form,
      discount_enabled: product.discount_enabled,
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value ? String(product.discount_value) : '',
    });
    setShowModal(true);
  };

  const handleImageChange = (index, value) => {
    const newImages = [...form.images];
    newImages[index] = value;
    setForm({ ...form, images: newImages });
  };

  const addImageField = () => {
    if (form.images.length < 3) {
      setForm({ ...form, images: [...form.images, ''] });
    }
  };

  const removeImageField = (index) => {
    if (form.images.length > 1) {
      const newImages = form.images.filter((_, i) => i !== index);
      setForm({ ...form, images: newImages });
    }
  };

  const handleImageUpload = async (index, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await http.post(IMAGE_ENDPOINTS.UPLOAD, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imgPath = res.data.filename || res.data.image_path || res.data.path || (typeof res.data === 'string' ? res.data : '');
      handleImageChange(index, imgPath);
      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validImages = form.images.filter((img) => typeof img === 'string' && img.trim() !== '');
      if (validImages.length === 0) {
        toast.error('At least one image is required');
        setSaving(false);
        return;
      }

      if (modalMode === 'discount') {
        // Discount-only update
        await http.patch(buildUrl(PRODUCT_ENDPOINTS.UPDATE_DISCOUNT, { id: selectedProduct.id }), {
          discount_enabled: form.discount_enabled,
          discount_type: form.discount_type,
          discount_value: form.discount_enabled ? parseFloat(form.discount_value) || 0 : 0,
        });
        toast.success('Discount updated');
      } else if (modalMode === 'create') {
        const payload = {
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity) || 0,
          category_name: form.category_name,
          discount_enabled: form.discount_enabled,
          discount_type: form.discount_type,
          discount_value: form.discount_enabled ? parseFloat(form.discount_value) || 0 : 0,
          images: validImages,
        };
        await http.post(PRODUCT_ENDPOINTS.CREATE, payload);
        toast.success('Product created');
      } else {
        // Edit — quantity is sent but backend strips it for seller role
        const payload = {
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity) || selectedProduct.quantity,
          category_name: form.category_name,
          discount_enabled: form.discount_enabled,
          discount_type: form.discount_type,
          discount_value: form.discount_enabled ? parseFloat(form.discount_value) || 0 : 0,
          images: validImages,
        };
        await http.put(buildUrl(PRODUCT_ENDPOINTS.UPDATE, { id: selectedProduct.id }), payload);
        toast.success('Product updated');
      }

      setShowModal(false);
      fetchProducts();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Operation failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This action cannot be undone.`)) return;
    try {
      await http.delete(buildUrl(PRODUCT_ENDPOINTS.DELETE, { id: product.id }));
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Delete failed';
      toast.error(msg);
    }
  };

  if (loading) {
    return <div className="page-loading seller-products-loading"><LoadingSpinner size="large" /></div>;
  }

  const productsTitle = 'Products';

  return (
    <div className="admin-page-shell seller-products">
      <PageHeader
        kicker={productsTitle}
        title={productsTitle}
        actions={
          <button type="button" className="add-product-btn" onClick={openCreateModal}>
            + Add Product
          </button>
        }
      />

      <div className="seller-products-filters">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="seller-products-empty">
          <div className="empty-icon">📦</div>
          <p>{products.length === 0 ? 'No products yet. Start by adding one!' : 'No products match your search.'}</p>
        </div>
      ) : (
        <table className="seller-products-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Discount</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0].startsWith('http') ? product.images[0] : `${API_BASE_URL}/${product.images[0]}`}
                      alt={product.name}
                      className="seller-product-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="seller-product-image" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>
                  )}
                </td>
                <td><span className="seller-product-name">{product.name}</span></td>
                <td>{product.category_name}</td>
                <td>
                  {product.discount_enabled && product.discounted_price < product.price ? (
                    <>
                      <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginRight: '0.5rem' }}>
                        {formatCurrency(product.price)}
                      </span>
                      {formatCurrency(product.discounted_price)}
                    </>
                  ) : (
                    formatCurrency(product.price)
                  )}
                </td>
                <td>
                  {product.discount_enabled ? (
                    <span className="seller-discount-badge">
                      {product.discount_type === 'percentage'
                        ? `${product.discount_value}% OFF`
                        : `${formatCurrency(product.discount_value)} OFF`
                      }
                    </span>
                  ) : '—'}
                </td>
                <td>
                  <span className={`seller-stock-badge ${getStockStatus(product.quantity)}`}>
                    {getStockLabel(product.quantity)}
                  </span>
                </td>
                <td>
                  <div className="seller-product-actions">
                    <button className="edit-btn" onClick={() => openEditModal(product)}>Edit</button>
                    <button className="discount-btn" onClick={() => openDiscountModal(product)}>Discount</button>
                    <button className="delete-btn" onClick={() => handleDelete(product)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {showModal && (
        <div className="seller-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="seller-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              {modalMode === 'create' ? 'Add New Product' : modalMode === 'edit' ? 'Edit Product' : 'Manage Discount'}
            </h2>

            {modalMode !== 'discount' && (
              <>
                <div className="form-group">
                  <label>Product Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter product name" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Enter description" />
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Stock Quantity {modalMode === 'edit' ? '(Read-only for sellers)' : ''}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className={modalMode === 'edit' ? 'readonly-field' : ''}
                    readOnly={modalMode === 'edit'}
                    title={modalMode === 'edit' ? 'Stock is managed by the Warehouse Manager' : ''}
                  />
                  {modalMode === 'edit' && (
                    <small style={{ color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                      Stock quantity is managed by the Warehouse Manager
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })}>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Images (1-3)</label>
                  <div className="seller-image-inputs">
                    {form.images.map((img, i) => (
                      <div key={i} className="seller-image-row">
                        <input
                          value={img}
                          onChange={(e) => handleImageChange(i, e.target.value)}
                          placeholder="Image URL or upload..."
                        />
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          id={`img-upload-${i}`}
                          onChange={(e) => handleImageUpload(i, e.target.files[0])}
                        />
                        <label htmlFor={`img-upload-${i}`} style={{ cursor: 'pointer', padding: '0.5rem', background: '#e0e7ff', borderRadius: '8px', fontSize: '0.8rem', color: '#4338ca' }}>📤</label>
                        {form.images.length > 1 && (
                          <button onClick={() => removeImageField(i)}>✕</button>
                        )}
                      </div>
                    ))}
                    {form.images.length < 3 && (
                      <button className="seller-add-image-btn" onClick={addImageField}>+ Add Image</button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Discount fields */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.discount_enabled}
                  onChange={(e) => setForm({ ...form, discount_enabled: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                Enable Discount
              </label>
            </div>

            {form.discount_enabled && (
              <>
                <div className="form-group">
                  <label>Discount Type</label>
                  <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    placeholder={form.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 5.00'}
                  />
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modalMode === 'create' ? 'Create Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProducts;
