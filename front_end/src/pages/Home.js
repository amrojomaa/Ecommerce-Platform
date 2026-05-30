import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaHeart, FaRegHeart, FaShoppingCart, FaTag } from 'react-icons/fa';
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
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Home.css';

const Home = () => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
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
  }, [location.pathname, languageCode]); // Refresh when navigating to home page

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const sectionId = location.hash.replace('#', '');
    const scrollToHashTarget = () => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    if (loading) {
      return;
    }

    scrollToHashTarget();
  }, [location.hash, loading]);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL);
      const products = response.data;
      const discounts = products.filter((product) => product.discount_enabled);
      const uniqueCategories = [...new Set(products.map((product) => product.category_name))];

      // Get first 6 products as featured
      setFeaturedProducts(products.slice(0, 6));
      setDiscountedProducts(discounts.slice(0, 6));
      const localizedCategories = uniqueCategories.map((categoryValue) => {
        const matched = products.find((p) => p.category_name === categoryValue);
        const localized = matched ? localizeProduct(matched, languageCode).localized_category_name : categoryValue;
        return { value: categoryValue, label: localized };
      });
      setCategories(localizedCategories.slice(0, 4));
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

  const getDiscountPercent = (product) => {
    if (!product?.discount_enabled || !product.price || !product.discounted_price) {
      return 0;
    }
    if (product.discounted_price >= product.price) {
      return 0;
    }
    return Math.round((1 - product.discounted_price / product.price) * 100);
  };

  const scrollToSection = (sectionId) => (event) => {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${sectionId}`);
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
            <motion.a
              href="#featured"
              className="hero-card hero-card-primary hero-card-link"
              onClick={scrollToSection('featured')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}>
              
              <span className="hero-card-label">{tUi("ui.pages.home.featuredProducts_666a6cab05")}</span>
              <div className="hero-card-metric">
                <span className="hero-card-value">{formatStatValue(productCount)}</span>
                <span className="hero-card-caption">{tUi("navbar.products")}</span>
              </div>
            </motion.a>
            <motion.a
              href="#discounts"
              className="hero-card hero-card-secondary hero-card-link"
              onClick={scrollToSection('discounts')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}>
              
              <span className="hero-card-label">{tUi("ui.pages.home.discounts_7c50f5ea26")}</span>
              <div className="hero-card-metric">
                <span className="hero-card-value">{formatStatValue(discountCount)}</span>
                <span className="hero-card-caption">{tUi("ui.pages.home.discounts_7c50f5ea26")}</span>
              </div>
            </motion.a>
            <motion.a
              href="#categories"
              className="hero-card hero-card-tertiary hero-card-link"
              onClick={scrollToSection('categories')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}>
              
              <span className="hero-card-label">{tUi("ui.pages.home.shopByCategory_dde1ec52b8")}</span>
              <div className="hero-card-metric">
                <span className="hero-card-value">{formatStatValue(categoryCount)}</span>
                <span className="hero-card-caption">{tUi("legacy.Categories")}</span>
              </div>
            </motion.a>
          </div>
        </div>
      </motion.section>

      {/* Featured Categories */}
      {categories.length > 0 &&
      <section className="categories-section" id="categories">
          <div className="categories-band">
            <div className="section-header">
              <motion.h2
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}>{tUi("ui.pages.home.shopByCategory_dde1ec52b8")}


              </motion.h2>
              <p className="section-subtitle">{tUi("ui.pages.home.categoriesSubtitle_0a7d16c8f1")}</p>
            </div>
            <div className="home-categories-grid">
              {categories.map((category, index) =>
          <motion.div
            key={category.value}
            className="home-category-card-wrapper"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -5 }}>
            
                <Link to={`/products?category=${encodeURIComponent(category.value)}`} className="home-category-card">
                  <span className="home-category-card-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="home-category-icon" aria-hidden="true">
                    <FaTag />
                  </span>
                  <div className="home-category-card-body">
                    <h3>{category.label}</h3>
                  </div>
                  <span className="home-category-card-arrow" aria-hidden="true">
                    <FaArrowRight />
                  </span>
                </Link>
              </motion.div>
          )}
            </div>
          </div>
        </section>
      }

      {/* Discounts */}
      {discountedProducts.length > 0 &&
      <section className="discounts-section" id="discounts">
          <div className="discounts-band">
            <div className="discounts-band-header">
              <div className="section-header">
                <motion.h2
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}>{tUi("ui.pages.home.discounts_7c50f5ea26")}


                </motion.h2>
                <p className="section-subtitle">{tUi("ui.pages.home.discountsSubtitle_9a4b3d5b2f")}</p>
              </div>
              <Link to="/products" className="discounts-cta">
                {tUi("ui.pages.home.promoCta_32bb6c9d5d")}
                <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
            {loading ?
        <div className="home-discounts-grid">
              {[...Array(6)].map((_, i) =>
          <ProductCardSkeleton key={i} />
          )}
            </div> :

        <div className="home-discounts-grid">
              {discountedProducts.map((product, index) => {
                const localizedProduct = localizeProduct(product, languageCode);
                const discountPercent = getDiscountPercent(product);

                return (
          <motion.div
            key={`discount-${product.name}`}
            className="discount-card-wrapper"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -5 }}>
            
                  <Link
              to={`/products/${encodeURIComponent(product.name)}`}
              className="discount-card">
              
                    <div className="discount-card-media">
                      <span className="discount-card-media-category">{localizedProduct.localized_category_name}</span>
                      {discountPercent > 0 &&
                <span className="discount-card-badge">-{discountPercent}%</span>
                }
                      <img
                  src={product.images && product.images.length > 0 ?
                  getImageUrl(product.images[0]) :
                  getImageUrl('/images/placeholder.jpg')}
                  alt={localizedProduct.localized_name} />
                
                    </div>
                    <div className="discount-card-body">
                      <h3 className="discount-card-title">{localizedProduct.localized_name}</h3>
                      <div className="discount-card-pricing">
                        <span className="discount-card-price">
                          {formatCurrency(product.discounted_price ?? product.price)}
                        </span>
                        {product.discounted_price &&
                  <span className="discount-card-price-before">{formatCurrency(product.price)}</span>
                  }
                      </div>
                    </div>
                    {isAuthenticated &&
              <button
                className="discount-card-cart-btn"
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
                  </Link>
                </motion.div>
                );
              })}
            </div>
        }
          </div>
        </section>
      }

      {/* Featured Products */}
      <section className="featured-products-section" id="featured">
        <div className="featured-band">
          <div className="featured-band-header">
            <div className="section-header">
              <motion.h2
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}>{tUi("ui.pages.home.featuredProducts_666a6cab05")}


              </motion.h2>
              <p className="section-subtitle">{tUi("ui.pages.home.featuredSubtitle_6d8a2e0a4e")}</p>
            </div>
            <Link to="/products" className="featured-cta">
              {tUi("ui.pages.home.viewAllProducts_e59509eaba")}
              <FaArrowRight aria-hidden="true" />
            </Link>
          </div>
          {loading ?
        <div className="featured-grid">
            {[...Array(6)].map((_, i) =>
          <ProductCardSkeleton key={i} />
          )}
          </div> :

        <div className="featured-grid">
            {featuredProducts.map((product, index) => {
              const localizedProduct = localizeProduct(product, languageCode);

              return (
          <motion.div
            key={product.name}
            className="featured-card-wrapper"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -5 }}>
            
                <Link
              to={`/products/${encodeURIComponent(product.name)}`}
              className="featured-card">
              
                  <div className="featured-card-media">
                    <span className="featured-card-media-category">{localizedProduct.localized_category_name}</span>
                    <img
                  src={product.images && product.images.length > 0 ?
                  getImageUrl(product.images[0]) :
                  getImageUrl('/images/placeholder.jpg')}
                  alt={localizedProduct.localized_name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                  }} />
                
                    {isAuthenticated &&
                <button
                  className={`featured-card-wishlist-btn ${isInWishlist(product.name) ? 'active' : ''}`}
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
                  <div className="featured-card-body">
                    <h3 className="featured-card-title">{localizedProduct.localized_name}</h3>
                    {product.id &&
                <div className="featured-card-rating">
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
                    <div className="featured-card-footer">
                      <div className="featured-card-pricing">
                        {product.discount_enabled ?
                    <>
                            <span className="featured-card-price">{formatCurrency(product.discounted_price ?? product.price)}</span>
                            <span className="featured-card-price-before">{formatCurrency(product.price)}</span>
                          </> :

                    <span className="featured-card-price">{formatCurrency(product.price)}</span>
                    }
                      </div>
                      {isAuthenticated &&
                  <button
                    className="featured-card-cart-btn"
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
              );
            })}
          </div>
        }
        </div>
      </section>
    </div>);

};

export default Home;

