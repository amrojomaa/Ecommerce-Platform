import { tUi } from "../i18n/uiText";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { FaHeart, FaRegHeart, FaArrowLeft, FaShoppingCart } from 'react-icons/fa';
import '../styles/pages/ProductDetails.css';
import '../styles/pages/Products.css';
import { trackRecommendationEvent } from '../services/recommendations';
import { getImageUrl } from '../utils/helpers';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import PageHeader from '../components/PageHeader';

const ProductDetails = () => {
  const { name } = useParams();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
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
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
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

  useEffect(() => {
    if (!product?.category_name) {
      setRelatedProducts([]);
      return;
    }

    fetchRelatedProducts(product.category_name, product.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.category_name, product?.name, isAuthenticated, languageCode]);

  const fetchRelatedProducts = async (categoryName, currentProductName) => {
    setRelatedLoading(true);
    try {
      const endpoint = isAuthenticated ? PRODUCT_ENDPOINTS.FILTER_USER : PRODUCT_ENDPOINTS.FILTER;
      const response = await http.get(endpoint, {
        params: { category: categoryName },
      });
      const items = (response.data || [])
        .filter((item) => item.name !== currentProductName)
        .slice(0, 4);
      setRelatedProducts(items);
    } catch (error) {
      console.error('Error fetching related products:', error);
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  };

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
      <div className="page-shell product-details-page">
        <div className="page-loading">
          <LoadingSpinner size="large" />
        </div>
      </div>);

  }

  if (!product) {
    return null;
  }

  const localizedProduct = localizeProduct(product, languageCode);

  // Get product images from API response
  const productImages = product.images && product.images.length > 0 ?
  product.images.map((img) => getImageUrl(img)) :
  [getImageUrl('/images/placeholder.jpg')];

  // Get quantity from product, defaulting to 0 if not available
  const maxQuantity = product.quantity !== undefined && product.quantity !== null ? product.quantity : 0;
  const isOutOfStock = maxQuantity === 0;

  return (
    <div className="page-shell product-details-page">
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

        <PageHeader
          className="product-details-heading"
          kicker={localizedProduct.localized_category_name}
          title={localizedProduct.localized_name}
          subtitle={isOutOfStock ? tUi("ui.pages.productDetails.outOfStock_2f92caa56c") : undefined}
          animate={false}
        />

        <div className="product-details-grid">
          {/* Image Gallery */}
          <div className="product-images">
            <div className="main-image">
              <motion.img
                key={selectedImageIndex}
                src={productImages[selectedImageIndex]}
                alt={localizedProduct.localized_name}
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
                
                    <img src={img} alt={tUi("ui.pages.productDetails.valueValue_b44629bf6a", { value0: localizedProduct.localized_name, value1: index + 1 })} />
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
                  className={`wishlist-btn page-btn-secondary ${isInWishlist(product.name) ? 'active' : ''}`}
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
                  className="add-to-cart-btn page-btn-primary"
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
              <StarRating
                key={starRatingKey}
                productId={product.id}
                showLabel={true}
                interactive={false}
                size="large"
                initialAverageRating={product.average_rating}
                initialTotalRatings={product.total_ratings} />
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
              <p>{localizedProduct.localized_description}</p>
            </motion.div>
          </div>
        </div>

        {/* Comments Section */}
        {product && product.id &&
        <div className="product-comments-section">
            <button
            type="button"
            className="product-comments-toggle-btn page-btn-secondary"
            onClick={() => setIsCommentsOpen((prev) => !prev)}>
              {isCommentsOpen ?
              tUi("ui.pages.productDetails.hideCommentsReviews_695cb75f4d") :
              tUi("ui.pages.productDetails.openCommentsReviews_2a13485a67")}
            </button>

            {isCommentsOpen &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}>
                <CommentSection
                  productId={product.id}
                  variant="productDetails"
                  onReviewsChanged={() => setStarRatingKey((key) => key + 1)} />
              </motion.div>
          }
          </div>
        }

        {(relatedLoading || relatedProducts.length > 0) && (
          <section className="pd-related-section">
            <div className="pd-related-header">
              <span className="page-kicker">{localizedProduct.localized_category_name}</span>
              <h2 className="pd-related-title">{tUi('ui.pages.productDetails.sameCategoryTitle_b4e8a1c2d5')}</h2>
              <p className="pd-related-subtitle">{tUi('ui.pages.productDetails.sameCategorySubtitle_b4e8a1c2d6')}</p>
            </div>

            {relatedLoading ? (
              <div className="page-loading pd-related-loading">
                <LoadingSpinner size="large" />
              </div>
            ) : (
              <div className="products-grid pd-related-grid">
                {relatedProducts.map((relatedProduct, index) => {
                  const localizedRelated = localizeProduct(relatedProduct, languageCode);
                  return (
                    <motion.div
                      key={relatedProduct.name}
                      className="products-card-wrapper"
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05, duration: 0.4 }}
                      whileHover={{ y: -5 }}
                    >
                      <Link to={`/products/${encodeURIComponent(relatedProduct.name)}`} className="products-card">
                        <div className="products-card-media">
                          <span className="products-card-media-category">{localizedRelated.localized_category_name}</span>
                          <img
                            src={
                              relatedProduct.images?.length
                                ? getImageUrl(relatedProduct.images[0])
                                : getImageUrl('/images/placeholder.jpg')
                            }
                            alt={localizedRelated.localized_name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                            }}
                          />
                        </div>
                        <div className="products-card-body">
                          <h3 className="products-card-title">{localizedRelated.localized_name}</h3>
                          {relatedProduct.id && (
                            <div className="products-card-rating">
                              <StarRating
                                productId={relatedProduct.id}
                                showLabel={false}
                                interactive={false}
                                size="small"
                                initialAverageRating={relatedProduct.average_rating}
                                initialTotalRatings={relatedProduct.total_ratings}
                                fetchOnMount={!Number.isFinite(Number(relatedProduct.average_rating))}
                              />
                            </div>
                          )}
                          <div className="products-card-footer">
                            <div className="products-card-pricing">
                              {relatedProduct.discount_enabled ? (
                                <>
                                  <span className="products-card-price products-card-price-sale">
                                    {formatCurrency(relatedProduct.discounted_price ?? relatedProduct.price)}
                                  </span>
                                  <span className="products-card-price-before">{formatCurrency(relatedProduct.price)}</span>
                                </>
                              ) : (
                                <span className="products-card-price">{formatCurrency(relatedProduct.price)}</span>
                              )}
                            </div>
                            {isAuthenticated && (
                              <button
                                type="button"
                                className="products-card-cart-btn"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const result = await addToCart(relatedProduct.name, 1);
                                  if (result.success) {
                                    toast.success(tUi('ui.pages.products.productAddedToCart_577eece582'));
                                  } else {
                                    toast.error(result.error || tUi('ui.pages.productDetails.failedToAddToCart_b4e8a1c2d7'));
                                  }
                                }}
                                title={tUi('ui.pages.products.addToCart_0ebb524946')}
                              >
                                <FaShoppingCart />
                              </button>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </motion.div>
    </div>);

};

export default ProductDetails;
