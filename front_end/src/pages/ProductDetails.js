import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';
import { formatPrice } from '../utils/helpers';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/ProductDetails.css';

const ProductDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Reset selected image index when product images change
  useEffect(() => {
    if (product) {
      const productImages = product.images && product.images.length > 0
        ? product.images
        : [];
      if (selectedImageIndex >= productImages.length) {
        setSelectedImageIndex(0);
      }
    }
  }, [product, selectedImageIndex]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const decodedName = decodeURIComponent(name);
      const response = await http.get(PRODUCT_ENDPOINTS.BY_NAME, {
        params: { name: decodedName }
      });
      setProduct(response.data);
      // Debug: Log product data to verify quantity is included
      console.log('Product data:', response.data);
    } catch (error) {
      console.error('Error fetching product:', error);
      // toast.error('Product not found');
      alert('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      // toast.info('Please login to add items to cart');
      alert('Please login to add items to cart');
      navigate('/login');
      return;
    }

    setAddingToCart(true);
    const result = await addToCart(product.name, quantity);
    
    if (result.success) {
      // toast.success(`Added ${quantity} ${product.name} to cart!`);
      alert(`Added ${quantity} ${product.name} to cart!`);
      // Animation feedback
    } else {
      // toast.error(result.error || 'Failed to add to cart');
      alert(result.error || 'Failed to add to cart');
    }
    setAddingToCart(false);
  };

  if (loading) {
    return (
      <div className="product-details-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  // Get product images from API response
  const productImages = product.images && product.images.length > 0
    ? product.images.map(img => `http://localhost:8000/${img}`)
    : [`http://localhost:8000/images/placeholder.jpg`];

  // Get quantity from product, defaulting to 0 if not available
  const maxQuantity = product.quantity !== undefined && product.quantity !== null ? product.quantity : 0;
  const isOutOfStock = maxQuantity === 0;

  return (
    <div className="product-details-page">
      <motion.div
        className="product-details-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="product-details-grid">
          {/* Image Gallery */}
          <div className="product-images">
            <div className="main-image">
              <motion.img
                key={selectedImageIndex}
                src={productImages[selectedImageIndex]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/600x600?text=No+Image';
                }}
              />
            </div>
            {productImages.length > 1 && (
              <div className="image-thumbnails">
                {productImages.map((img, index) => (
                  <motion.button
                    key={index}
                    className={`thumbnail ${selectedImageIndex === index ? 'active' : ''}`}
                    onClick={() => setSelectedImageIndex(index)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img src={img} alt={`${product.name} ${index + 1}`} />
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="product-info">
            <motion.h1
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {product.name}
            </motion.h1>
            
            <motion.p
              className="product-category"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {product.category_name}
            </motion.p>

            <motion.div
              className="product-price"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {formatPrice(product.price)}
            </motion.div>

            <motion.div
              className="product-stock"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {isOutOfStock ? (
                <span className="out-of-stock">Out of Stock</span>
              ) : (
                <span className="in-stock">
                  Available
                </span>
              )}
            </motion.div>

            <motion.div
              className="product-description"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <h3>Description</h3>
              <p>{product.description}</p>
            </motion.div>

            {/* Quantity and Add to Cart */}
            <motion.div
              className="product-actions"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="add-to-cart-container">
                <div className="quantity-controls">
                  <label>Quantity:</label>
                  <div className="quantity-input">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1 || isOutOfStock}
                      className="quantity-btn"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxQuantity}
                      value={quantity}
                      disabled={isOutOfStock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantity(Math.min(maxQuantity, Math.max(1, val)));
                      }}
                    />
                    <button
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      disabled={quantity >= maxQuantity || isOutOfStock}
                      className="quantity-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <motion.button
                  className="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={addingToCart || isOutOfStock}
                  whileHover={{ scale: isOutOfStock ? 1 : 1.05 }}
                  whileTap={{ scale: isOutOfStock ? 1 : 0.95 }}
                >
                  {addingToCart ? (
                    <>
                      <LoadingSpinner size="small" />
                      Adding...
                    </>
                  ) : isOutOfStock ? (
                    'Out of Stock'
                  ) : (
                    'Add to Cart'
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProductDetails;
