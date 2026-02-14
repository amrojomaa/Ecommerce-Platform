import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, IMAGE_ENDPOINTS } from '../../config/api';
import { formatPrice } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ProductCardSkeleton } from '../../components/Skeleton';
import '../../styles/pages/admin/AdminProducts.css';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    category_name: '',
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
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
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingProduct) {
        await http.put(
          PRODUCT_ENDPOINTS.UPDATE.replace('{id}', editingProduct.id),
          formData
        );
        toast.success('Product updated successfully');
      } else {
        await http.post(PRODUCT_ENDPOINTS.CREATE, formData);
        toast.success('Product created successfully');
      }
      
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error(error.message || 'Failed to save product');
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
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await http.delete(PRODUCT_ENDPOINTS.DELETE.replace('{id}', id));
      toast.success('Product deleted successfully');
      fetchProducts();
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
    });
    setImages([]);
    setEditingProduct(null);
    setShowModal(false);
  };

  return (
    <div className="admin-products">
      <div className="admin-products-header">
        <h1>Manage Products</h1>
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
                  src={`http://localhost:8000/images/placeholder.jpg`}
                  alt={product.name}
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/300x300?text=No+Image';
                  }}
                />
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="product-category">{product.category_name}</p>
                <p className="product-price">{formatPrice(product.price)}</p>
                <p className="product-stock">Stock: {product.quantity}</p>
              </div>
              <div className="product-actions">
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
                  <input
                    type="text"
                    name="category_name"
                    value={formData.category_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Product Images</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading && <LoadingSpinner size="small" />}
                  {images.length > 0 && (
                    <div className="uploaded-images">
                      {images.map((img, idx) => (
                        <span key={idx} className="image-tag">
                          {img.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

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
