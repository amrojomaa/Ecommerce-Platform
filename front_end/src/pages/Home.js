import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHeadset, FaHeart, FaRegHeart, FaShieldAlt, FaShoppingCart, FaTruck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { tUi } from '../i18n/uiText';
import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useWishlist } from '../hooks/useWishlist';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useCurrency } from '../hooks/useCurrency';
import StarRating from '../components/StarRating';
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
  const [productCount, setProductCount] = useState(0);
  const [discountCount, setDiscountCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProducts();
  }, [location.pathname]); // Refresh when navigating to home page

  const fetchFeaturedProducts = async () => {
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL);
      const products = response.data;
      const discounts = products.filter((product) => product.discount_enabled);
      const uniqueCategories = [...new Set(products.map((product) => product.category_name))];

      // Get first 6 products as featured
      setFeaturedProducts(products.slice(0, 6));
      setDiscountedProducts(discounts.slice(0, 6));
      setCategories(uniqueCategories.slice(0, 4));
      setProductCount(products.length);
      setDiscountCount(discounts.length);
      setCategoryCount(uniqueCategories.length);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const heroCtaPath = isAuthenticated ? '/recommendations' : '/signup';
  const heroCtaLabel = isAuthenticated ? tUi('navbar.forYou') : tUi('navbar.signup');
  const formatStatValue = (value) => {
    if (loading) {
      return '...';
    }
    return value > 0 ? `${value}+` : '0';
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <motion.section
        className="hero-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}>
        <div className="hero-grid">
          <div className="hero-content">
            <span className="hero-kicker">{tUi("ui.pages.home.heroKicker_2e51d0c3a7")}</span>
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
              className="hero-cta-row"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}>
              
              <Link to="/products" className="hero-button">
                {tUi("ui.pages.home.shopNow_e58073dc0e")}
              </Link>
              <Link to={heroCtaPath} className="hero-button secondary">
                {heroCtaLabel}
              </Link>
            </motion.div>
            <p className="hero-note">{tUi("ui.pages.home.heroNote_1c0a3b7d12")}</p>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-value">{formatStatValue(productCount)}</span>
                <span className="hero-stat-label">{tUi("navbar.products")}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{formatStatValue(categoryCount)}</span>
                <span className="hero-stat-label">{tUi("legacy.Categories")}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{formatStatValue(discountCount)}</span>
                <span className="hero-stat-label">{tUi("ui.pages.home.discounts_7c50f5ea26")}</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-orb orb-one"></div>
            <div className="hero-orb orb-two"></div>
            <motion.div
              className="hero-card hero-card-primary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}>
              
              <span className="hero-card-label">{tUi("ui.pages.home.featuredProducts_666a6cab05")}</span>
              <div className="hero-card-metric">
                <span className="hero-card-value">{formatStatValue(productCount)}</span>
                <span className="hero-card-caption">{tUi("navbar.products")}</span>
              </div>
            </motion.div>
            <motion.div
              className="hero-card hero-card-secondary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}>
              
              <span className="hero-card-label">{tUi("ui.pages.home.discounts_7c50f5ea26")}</span>
              <div className="hero-card-metric">
                <span className="hero-card-value">{formatStatValue(discountCount)}</span>
                <span className="hero-card-caption">{tUi("ui.pages.home.discounts_7c50f5ea26")}</span>
              </div>
            </motion.div>
            <motion.div
              className="hero-card hero-card-tertiary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}>
              
              <span className="hero-card-label">{tUi("ui.pages.home.shopByCategory_dde1ec52b8")}</span>
              <div className="hero-card-metric">
                <span className="hero-card-value">{formatStatValue(categoryCount)}</span>
                <span className="hero-card-caption">{tUi("legacy.Categories")}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <section className="value-props-section">
        <div className="section-header">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}>{tUi("ui.pages.home.valuePropsTitle_f8f0c4ad1a")}


          </motion.h2>
          <p className="section-subtitle">{tUi("ui.pages.home.valuePropsSubtitle_0aa1c14a1b")}</p>
        </div>
        <div className="value-props-grid">
          <motion.article
            className="value-prop-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}>
            
            <span className="value-prop-icon">
              <FaTruck />
            </span>
            <h3>{tUi("ui.pages.home.valuePropDeliveryTitle_1d1ac5c1d0")}</h3>
            <p>{tUi("ui.pages.home.valuePropDeliveryBody_2c33b0dd6f")}</p>
          </motion.article>
          <motion.article
            className="value-prop-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.4 }}>
            
            <span className="value-prop-icon">
              <FaShieldAlt />
            </span>
            <h3>{tUi("ui.pages.home.valuePropPaymentsTitle_7f8b4c3d2a")}</h3>
            <p>{tUi("ui.pages.home.valuePropPaymentsBody_3e51c43f90")}</p>
          </motion.article>
          <motion.article
            className="value-prop-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.4 }}>
            
            <span className="value-prop-icon">
              <FaHeadset />
            </span>
            <h3>{tUi("ui.pages.home.valuePropSupportTitle_7a8f1b90ad")}</h3>
            <p>{tUi("ui.pages.home.valuePropSupportBody_1b8b2d09d8")}</p>
          </motion.article>
        </div>
      </section>

      <section className="promo-band">
        <div className="promo-content">
          <div>
            <h3>{tUi("ui.pages.home.promoTitle_5f7b0db4da")}</h3>
            <p>{tUi("ui.pages.home.promoBody_0dc5f5e2c8")}</p>
          </div>
          <Link to="/products" className="promo-cta">
            {tUi("ui.pages.home.promoCta_32bb6c9d5d")}
          </Link>
        </div>
      </section>

      {/* Featured Categories */}
      {categories.length > 0 &&
      <section className="categories-section" id="categories">
          <div className="section-header">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}>{tUi("ui.pages.home.shopByCategory_dde1ec52b8")}


            </motion.h2>
            <p className="section-subtitle">{tUi("ui.pages.home.categoriesSubtitle_0a7d16c8f1")}</p>
          </div>
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
      <section className="discounts-section" id="discounts">
          <div className="section-header">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}>{tUi("ui.pages.home.discounts_7c50f5ea26")}


            </motion.h2>
            <p className="section-subtitle">{tUi("ui.pages.home.discountsSubtitle_9a4b3d5b2f")}</p>
          </div>
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
      <section className="featured-products-section" id="featured">
        <div className="section-header">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}>{tUi("ui.pages.home.featuredProducts_666a6cab05")}


          </motion.h2>
          <p className="section-subtitle">{tUi("ui.pages.home.featuredSubtitle_6d8a2e0a4e")}</p>
        </div>
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
