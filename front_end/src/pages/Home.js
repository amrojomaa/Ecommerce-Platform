import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaArrowRight,
  FaChevronLeft,
  FaChevronRight,
  FaHeart,
  FaRegHeart,
  FaShoppingCart,
} from 'react-icons/fa';
import { getCategoryIconComponent } from '../utils/categoryIcons';
import { toast } from 'react-toastify';
import { tUi } from '../i18n/uiText';
import http from '../services/http';
import { CATEGORY_ENDPOINTS, PRODUCT_ENDPOINTS } from '../config/api';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useWishlist } from '../hooks/useWishlist';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useCurrency } from '../hooks/useCurrency';
import StarRating from '../components/StarRating';
import { getCatalogImageUrl } from '../utils/helpers';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeCategoryName, localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Home.css';

const CATEGORIES_PER_PAGE = 5;
const PRODUCTS_PER_PAGE = 6;

const HomePaginatedShell = ({ page, totalPages, onPageChange, children }) => {
  if (totalPages <= 1) {
    return children;
  }

  return (
    <div className="home-paginated-section">
      <button
        type="button"
        className="home-section-pager-btn home-paginated-nav home-paginated-nav--prev"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={tUi('ui.pages.products.previous_6fad74798c')}
      >
        <FaChevronLeft aria-hidden="true" />
      </button>
      <div className="home-paginated-content">{children}</div>
      <button
        type="button"
        className="home-section-pager-btn home-paginated-nav home-paginated-nav--next"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={tUi('ui.pages.products.next_5a273f44ac')}
      >
        <FaChevronRight aria-hidden="true" />
      </button>
    </div>
  );
};

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
  const [allCategories, setAllCategories] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [discountCount, setDiscountCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [featuredTotal, setFeaturedTotal] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);
  const [featuredPage, setFeaturedPage] = useState(1);
  const [discountPage, setDiscountPage] = useState(1);
  const [statsLoading, setStatsLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [discountLoading, setDiscountLoading] = useState(true);

  const categoryTotalPages = Math.max(1, Math.ceil(allCategories.length / CATEGORIES_PER_PAGE));
  const featuredTotalPages = Math.max(1, Math.ceil(featuredTotal / PRODUCTS_PER_PAGE));
  const discountTotalPages = Math.max(1, Math.ceil(discountTotal / PRODUCTS_PER_PAGE));

  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * CATEGORIES_PER_PAGE;
    return allCategories.slice(start, start + CATEGORIES_PER_PAGE);
  }, [allCategories, categoryPage]);

  useEffect(() => {
    if (categoryPage > categoryTotalPages) {
      setCategoryPage(categoryTotalPages);
    }
  }, [categoryPage, categoryTotalPages]);

  useEffect(() => {
    if (featuredPage > featuredTotalPages) {
      setFeaturedPage(featuredTotalPages);
    }
  }, [featuredPage, featuredTotalPages]);

  useEffect(() => {
    if (discountPage > discountTotalPages) {
      setDiscountPage(discountTotalPages);
    }
  }, [discountPage, discountTotalPages]);

  const fetchHomeStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [summaryRes, categoriesRes] = await Promise.all([
        http.get(PRODUCT_ENDPOINTS.HOME_SUMMARY),
        http.get(CATEGORY_ENDPOINTS.ALL),
      ]);
      const summary = summaryRes.data || {};
      setProductCount(summary.product_count || 0);
      setDiscountCount(summary.discount_count || 0);
      setCategoryCount(summary.category_count || 0);
      setAllCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setCategoryPage(1);
    } catch (error) {
      console.error('Error fetching home stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchFeaturedPage = useCallback(async () => {
    setFeaturedLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.HOME_FEATURED, {
        params: { page: featuredPage, page_size: PRODUCTS_PER_PAGE },
      });
      const data = response.data || {};
      setFeaturedProducts(data.items || []);
      setFeaturedTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      setFeaturedProducts([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, [featuredPage]);

  const fetchDiscountPage = useCallback(async () => {
    setDiscountLoading(true);
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.HOME_DISCOUNTED, {
        params: { page: discountPage, page_size: PRODUCTS_PER_PAGE },
      });
      const data = response.data || {};
      setDiscountedProducts(data.items || []);
      setDiscountTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching discounted products:', error);
      setDiscountedProducts([]);
    } finally {
      setDiscountLoading(false);
    }
  }, [discountPage]);

  useEffect(() => {
    fetchHomeStats();
  }, [location.pathname, fetchHomeStats]);

  useEffect(() => {
    fetchFeaturedPage();
  }, [fetchFeaturedPage]);

  useEffect(() => {
    fetchDiscountPage();
  }, [fetchDiscountPage]);

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

    if (statsLoading || featuredLoading || discountLoading) {
      return;
    }

    scrollToHashTarget();
  }, [location.hash, statsLoading, featuredLoading, discountLoading]);

  const heroCtaPath = isAuthenticated ? '/recommendations' : '/signup';
  const heroCtaLabel = isAuthenticated ? tUi('navbar.forYou') : tUi('navbar.signup');
  const formatStatValue = (value) => {
    if (statsLoading) {
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
      {allCategories.length > 0 &&
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
            <HomePaginatedShell
              page={categoryPage}
              totalPages={categoryTotalPages}
              onPageChange={setCategoryPage}
            >
              <div className="home-categories-grid">
                {paginatedCategories.map((category, index) => {
                  const displayIndex = (categoryPage - 1) * CATEGORIES_PER_PAGE + index + 1;
                  const categoryLabel = localizeCategoryName(category, languageCode);
                  const CategoryIcon = getCategoryIconComponent(category, index, categoryLabel);
                  return (
                    <div key={category.id || category.name} className="home-category-card-wrapper">
                      <Link
                        to={`/products?category=${encodeURIComponent(category.name)}`}
                        className="home-category-card"
                      >
                        <span className="home-category-card-index">
                          {String(displayIndex).padStart(2, '0')}
                        </span>
                        <span className="home-category-icon" aria-hidden="true">
                          <CategoryIcon />
                        </span>
                        <div className="home-category-card-body">
                          <h3>{categoryLabel}</h3>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </HomePaginatedShell>
          </div>
        </section>
      }

      {/* Discounts */}
      {(discountCount > 0 || discountLoading) &&
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
            <HomePaginatedShell
              page={discountPage}
              totalPages={discountTotalPages}
              onPageChange={setDiscountPage}
            >
            {discountLoading ?
        <div className="home-discounts-grid">
              {[...Array(PRODUCTS_PER_PAGE)].map((_, i) =>
          <ProductCardSkeleton key={i} />
          )}
            </div> :

        <div className="home-discounts-grid">
              {discountedProducts.map((product) => {
                const localizedProduct = localizeProduct(product, languageCode);
                const discountPercent = getDiscountPercent(product);

                return (
          <div
            key={`discount-${product.name}`}
            className="discount-card-wrapper">
            
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
                  getCatalogImageUrl(product.images[0]) :
                  getCatalogImageUrl('/images/placeholder.jpg')}
                  alt={localizedProduct.localized_name}
                  loading="lazy" />
                
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
                </div>
                );
              })}
            </div>
        }
            </HomePaginatedShell>
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
          <HomePaginatedShell
            page={featuredPage}
            totalPages={featuredTotalPages}
            onPageChange={setFeaturedPage}
          >
          {featuredLoading ?
        <div className="featured-grid">
            {[...Array(PRODUCTS_PER_PAGE)].map((_, i) =>
          <ProductCardSkeleton key={i} />
          )}
          </div> :

        <div className="featured-grid">
            {featuredProducts.map((product) => {
              const localizedProduct = localizeProduct(product, languageCode);

              return (
          <div
            key={product.name}
            className="featured-card-wrapper">
            
                <Link
              to={`/products/${encodeURIComponent(product.name)}`}
              className="featured-card">
              
                  <div className="featured-card-media">
                    <span className="featured-card-media-category">{localizedProduct.localized_category_name}</span>
                    <img
                  src={product.images && product.images.length > 0 ?
                  getCatalogImageUrl(product.images[0]) :
                  getCatalogImageUrl('/images/placeholder.jpg')}
                  alt={localizedProduct.localized_name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getCatalogImageUrl('/images/placeholder.jpg');
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
                    fetchOnMount={false} />
                  
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
              </div>
              );
            })}
          </div>
        }
          </HomePaginatedShell>
        </div>
      </section>
    </div>);

};

export default Home;

