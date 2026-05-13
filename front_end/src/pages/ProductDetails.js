import { tUi } from "../i18n/uiText";import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { useCurrency } from '../hooks/useCurrency';
import LoadingSpinner from '../components/LoadingSpinner';
import CommentSection from '../components/CommentSection';
import StarRating from '../components/StarRating';
import { FaHeart, FaRegHeart, FaArrowLeft } from 'react-icons/fa';
import '../styles/pages/ProductDetails.css';
import { trackRecommendationEvent } from '../services/recommendations';
import { getImageUrl } from '../utils/helpers';

const ProductDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { formatCurrency } = useCurrency();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [starRatingKey, setStarRatingKey] = useState(0);
  const viewTrackedRef = useRef(null);

  useEffect(() => {
    fetchProduct();
    setIsCommentsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Reset selected image index when product images change
  useEffect(() => {
    if (product) {
      const productImages = product.images && product.images.length > 0 ?
      product.images :
      [];
      if (selectedImageIndex >= productImages.length) {
        setSelectedImageIndex(0);
      }
    }
  }, [product, selectedImageIndex]);

  useEffect(() => {
    if (!product?.id || !isAuthenticated) return;
    if (viewTrackedRef.current === product.id) return;
    viewTrackedRef.current = product.id;
    trackRecommendationEvent({ event_type: 'view', product_id: product.id });
  }, [product, isAuthenticated]);

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
      toast.error(tUi("ui.pages.productDetails.productNotFound_6a7319bc51"));
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.info(tUi("ui.pages.productDetails.pleaseLoginToAddItems_ded862e3e0"));
      navigate('/login');
      return;
    }

    setAddingToCart(true);
    const result = await addToCart(product.name, quantity);

    if (result.success) {
      if (product.id) trackRecommendationEvent({ event_type: 'add_to_cart', product_id: product.id });
      toast.success(`Added ${quantity} ${product.name} to cart!`);
      // Animation feedback
    } else {
      toast.error(result.error || 'Failed to add to cart');
    }
    setAddingToCart(false);
  };

  const handleToggleWishlist = async () => {
    if (!product) return;

    if (isInWishlist(product.name)) {
      removeFromWishlist(product.name);
      toast.success(`${product.name} removed from wishlist`);
    } else {
      const r = await addToWishlist(product);
      if (r.success) {
        toast.success(`${product.name} added to wishlist`);
      } else {
        toast.error(r.error || 'Could not add to wishlist');
      }
    }
  };

  if (loading) {
    return (
      <div className="product-details-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  if (!product) {
    return null;
  }

  // Get product images from API response
  const productImages = product.images && product.images.length > 0 ?
  product.images.map((img) => getImageUrl(img)) :
  [getImageUrl('/images/placeholder.jpg')];

  // Get quantity from product, defaulting to 0 if not available
  const maxQuantity = product.quantity !== undefined && product.quantity !== null ? product.quantity : 0;
  const isOutOfStock = maxQuantity === 0;

  return (
    <div className="product-details-page">
      <motion.div
        className="product-details-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}>
        
        {/* Back Button */}
        <motion.button
          className="back-button"
          onClick={() => navigate('/products')}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={tUi("ui.pages.productDetails.backToProducts_354bdfbc98")}>
          
          <FaArrowLeft />
          <span>{tUi("ui.pages.productDetails.backToProducts_349cc09ded")}</span>
        </motion.button>

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
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                }} />
              
            </div>
            {productImages.length > 1 &&
            <div className="image-thumbnails">
                {productImages.map((img, index) =>
              <motion.button
                key={index}
                className={`thumbnail ${selectedImageIndex === index ? 'active' : ''}`}
                onClick={() => setSelectedImageIndex(index)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}>
                
                    <img src={img} alt={tUi("ui.pages.productDetails.valueValue_b44629bf6a", { value0: product.name, value1: index + 1 })} />
                  </motion.button>
              )}
              </div>
            }
          </div>

          {/* Product Info */}
          <div className="product-info">
            {/* Quantity and Add to Cart */}
            <motion.div
              className="product-actions"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}>
              
              {isAuthenticated &&
              <div className="wishlist-button-container">
                  <motion.button
                  className={`wishlist-btn ${isInWishlist(product.name) ? 'active' : ''}`}
                  onClick={handleToggleWishlist}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title={isInWishlist(product.name) ? tUi("ui.pages.productDetails.removeFromWishlist_6c3e57631c") : tUi("ui.pages.productDetails.addToWishlist_5c31978d93")}>
                  
                    {isInWishlist(product.name) ?
                  <FaHeart className="wishlist-icon-filled" /> :

                  <FaRegHeart className="wishlist-icon-outline" />
                  }
                    <span>{isInWishlist(product.name) ? tUi("ui.pages.productDetails.removeFromWishlist_5fe25f164f") : tUi("ui.pages.productDetails.addToWishlist_19396088e9")}</span>
                  </motion.button>
                </div>
              }
              <div className="add-to-cart-container">
                <div className="quantity-controls">
                  <label>{tUi("ui.pages.productDetails.quantity_de67f4b600")}</label>
                  <div className="quantity-input">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1 || isOutOfStock}
                      className="quantity-btn">
                      
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
                      }} />
                    
                    <button
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      disabled={quantity >= maxQuantity || isOutOfStock}
                      className="quantity-btn">
                      
                      +
                    </button>
                  </div>
                </div>

                <motion.button
                  className="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={addingToCart || isOutOfStock}
                  whileHover={{ scale: isOutOfStock ? 1 : 1.05 }}
                  whileTap={{ scale: isOutOfStock ? 1 : 0.95 }}>
                  
                  {addingToCart ?
                  <>
                      <LoadingSpinner size="small" />{tUi("ui.pages.productDetails.adding_257a62f16d")}

                  </> :
                  isOutOfStock ? tUi("ui.pages.productDetails.outOfStock_2f92caa56c") : tUi("ui.pages.productDetails.addToCart_39ede17f50")



                  }
                </motion.button>
              </div>
            </motion.div>

            <motion.h1
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}>
              
              {product.name}
            </motion.h1>

            <motion.p
              className="product-category"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}>
              
              {product.category_name}
            </motion.p>

            <motion.div
              className="product-price"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}>
              
              {product.discount_enabled ?
              <div>
                  <div className="product-price-before">{formatCurrency(product.price)}</div>
                  <div className="product-price-discount">{formatCurrency(product.discounted_price ?? product.price)}</div>
                </div> :

              formatCurrency(product.price)
              }
            </motion.div>

            <motion.div
              className="product-rating"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}>
              
              {product && product.id &&
              <StarRating productId={product.id} showLabel={true} interactive={true} size="large" />
              }
            </motion.div>

            <motion.div
              className="product-stock"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}>
              
              {isOutOfStock ?
              <span className="out-of-stock">{tUi("ui.pages.productDetails.outOfStock_2f92caa56c")}</span> :

              <span className="in-stock">{tUi("ui.pages.productDetails.available_d8d9652e8f")}

              </span>
              }
            </motion.div>

            <motion.div
              className="product-description"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}>
              
              <h3>{tUi("ui.pages.productDetails.description_173378af63")}</h3>
              <p>{product.description}</p>
            </motion.div>
          </div>
        </div>

        {/* Comments Section */}
        {product && product.id &&
        <div className="product-comments-section">
            <button
            type="button"
            className="product-comments-toggle-btn"
            onClick={() => setIsCommentsOpen((prev) => !prev)}>
              {isCommentsOpen ? 'Hide Comments & Reviews' : 'Open Comments & Reviews'}
            </button>

            {isCommentsOpen &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}>
                <CommentSection productId={product.id} variant="productDetails" />
              </motion.div>
          }
          </div>
        }
      </motion.div>
    </div>);

};

export default ProductDetails;
