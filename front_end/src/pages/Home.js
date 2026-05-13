import { tUi } from "../i18n/uiText";import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useWishlist } from '../hooks/useWishlist';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useCurrency } from '../hooks/useCurrency';
import StarRating from '../components/StarRating';
import { FaHeart, FaRegHeart, FaShoppingCart } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getImageUrl } from '../utils/helpers';
import '../styles/pages/Home.css';

const Home = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { formatCurrency } = useCurrency();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [discountedProducts, setDiscountedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProducts();
  }, [location.pathname]); // Refresh when navigating to home page

  const fetchFeaturedProducts = async () => {
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL);
      const products = response.data;
      // Get first 6 products as featured
      setFeaturedProducts(products.slice(0, 6));
      setDiscountedProducts(products.filter((p) => p.discount_enabled).slice(0, 6));

      // Extract unique categories
      const uniqueCategories = [...new Set(products.map((p) => p.category_name))];
      setCategories(uniqueCategories.slice(0, 4));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <motion.section
        className="hero-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}>
        
        <div className="hero-content">
          <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}>{tUi("ui.pages.home.welcomeToOurStore_fe0466a249")}


          </motion.h1>
          <motion.p
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}>{tUi("ui.pages.home.discoverAmazingProductsAtUnbeatable_e717e87b85")}


          </motion.p>
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}>
            
            <Link to="/products" className="hero-button">{tUi("ui.pages.home.shopNow_e58073dc0e")}

            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Featured Categories */}
      {categories.length > 0 &&
      <section className="categories-section">
          <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>{tUi("ui.pages.home.shopByCategory_dde1ec52b8")}


        </motion.h2>
          <div className="categories-grid">
            {categories.map((category, index) =>
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}>
            
                <Link to={`/products?category=${encodeURIComponent(category)}`} className="category-card">
                  <div className="category-icon">🏷️</div>
                  <h3>{category}</h3>
                </Link>
              </motion.div>
          )}
          </div>
        </section>
      }

      {/* Discounts */}
      {discountedProducts.length > 0 &&
      <section className="discounts-section">
          <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>{tUi("ui.pages.home.discounts_7c50f5ea26")}


        </motion.h2>
          {loading ?
        <div className="products-grid">
              {[...Array(6)].map((_, i) =>
          <ProductCardSkeleton key={i} />
          )}
            </div> :

        <div className="products-grid">
              {discountedProducts.map((product, index) =>
          <motion.div
            key={`discount-${product.name}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -5 }}
            className="product-card-wrapper">
            
                  <Link
              to={`/products/${encodeURIComponent(product.name)}`}
              className="product-card">
              
                    <div className="product-image">
                      <img
                  src={product.images && product.images.length > 0 ?
                  getImageUrl(product.images[0]) :
                  getImageUrl('/images/placeholder.jpg')}
                  alt={product.name}
                  style={{ objectFit: 'cover' }} />
                
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <p className="product-category">{product.category_name}</p>
                      <div className="product-price-container">
                        <div className="product-price-stack">
                          <p className="product-price-before">{formatCurrency(product.price)}</p>
                          <p className="product-price-discount">
                            {formatCurrency(product.discounted_price ?? product.price)}
                          </p>
                        </div>
                        {isAuthenticated &&
                  <button
                    className="product-add-to-cart-btn"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        await addToCart(product.name, 1);
                        toast.success(tUi("ui.pages.home.productAddedToCart_d4e0ddfeac"));
                      } catch (error) {
                        toast.error(error.response?.data?.detail || "Failed to add to cart");
                      }
                    }}
                    title={tUi("ui.pages.home.addToCart_db672a40f8")}>
                    
                            <FaShoppingCart />
                          </button>
                  }
                      </div>
                    </div>
                  </Link>
                </motion.div>
          )}
            </div>
        }
        </section>
      }

      {/* Featured Products */}
      <section className="featured-products-section">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}>{tUi("ui.pages.home.featuredProducts_666a6cab05")}


        </motion.h2>
        {loading ?
        <div className="products-grid">
            {[...Array(6)].map((_, i) =>
          <ProductCardSkeleton key={i} />
          )}
          </div> :

        <div className="products-grid">
            {featuredProducts.map((product, index) =>
          <motion.div
            key={product.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -5 }}
            className="product-card-wrapper">
            
                <Link
              to={`/products/${encodeURIComponent(product.name)}`}
              className="product-card">
              
                  <div className="product-image">
                    <img
                  src={product.images && product.images.length > 0 ?
                  getImageUrl(product.images[0]) :
                  getImageUrl('/images/placeholder.jpg')}
                  alt={product.name}
                  style={{ objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                  }} />
                
                    {isAuthenticated &&
                <button
                  className={`product-wishlist-btn ${isInWishlist(product.name) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isInWishlist(product.name)) {
                      removeFromWishlist(product.name);
                    } else {
                      addToWishlist(product);
                    }
                  }}
                  title={isInWishlist(product.name) ? tUi("ui.pages.home.removeFromWishlist_8663e14321") : tUi("ui.pages.home.addToWishlist_ace0a00bdf")}>
                  
                        {isInWishlist(product.name) ?
                  <FaHeart className="wishlist-icon-filled" /> :

                  <FaRegHeart className="wishlist-icon-outline" />
                  }
                      </button>
                }
                  </div>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-category">{product.category_name}</p>
                    {product.id &&
                <div className="product-rating-container">
                        <StarRating
                    productId={product.id}
                    showLabel={false}
                    interactive={false}
                    size="small"
                    initialAverageRating={product.average_rating}
                    initialTotalRatings={product.total_ratings}
                    fetchOnMount={!Number.isFinite(Number(product.average_rating))} />
                  
                      </div>
                }
                    <div className="product-price-container">
                      <div className="product-price-stack">
                        {product.discount_enabled ?
                    <>
                            <p className="product-price-before">{formatCurrency(product.price)}</p>
                            <p className="product-price-discount">
                              {formatCurrency(product.discounted_price ?? product.price)}
                            </p>
                          </> :

                    <p className="product-price">{formatCurrency(product.price)}</p>
                    }
                      </div>
                      {isAuthenticated &&
                  <button
                    className="product-add-to-cart-btn"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        await addToCart(product.name, 1);
                        toast.success(tUi("ui.pages.home.productAddedToCart_d4e0ddfeac"));
                      } catch (error) {
                        toast.error(error.response?.data?.detail || "Failed to add to cart");
                      }
                    }}
                    title={tUi("ui.pages.home.addToCart_db672a40f8")}>
                    
                          <FaShoppingCart />
                        </button>
                  }
                    </div>
                  </div>
                </Link>
              </motion.div>
          )}
          </div>
        }
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}>
          
          <Link to="/products" className="view-all-button">{tUi("ui.pages.home.viewAllProducts_e59509eaba")}

          </Link>
        </motion.div>
      </section>
    </div>);

};

export default Home;
