import { tUi } from '../i18n/uiText';
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import http from '../services/http';
import { PRODUCT_ENDPOINTS, PROMOTION_ENDPOINTS } from '../config/api';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useWishlist } from '../hooks/useWishlist';
import { useCart } from '../hooks/useCart';
import { useCurrency } from '../hooks/useCurrency';
import StarRating from '../components/StarRating';
import { FaHeart, FaRegHeart, FaShoppingCart } from 'react-icons/fa';
import { toast } from 'react-toastify';
import '../styles/pages/Products.css';
import { trackRecommendationEvent } from '../services/recommendations';
import { getImageUrl } from '../utils/helpers';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';

const formatPromotionMessage = (message, languageCode) => {
  if (!message) {
    return '';
  }

  const selectedProductsMatch = message.match(
    /^Promotion available:\s*Spend\s*(?<target>.+?)\s*on selected products\s*\((?<items>.+?)\)\s*and get\s*(?<discount>.+?)\s*off\.$/i
  );

  if (selectedProductsMatch?.groups) {
    return tUi('ui.pages.products.promotionAvailableSelectedProducts', {
      target: selectedProductsMatch.groups.target,
      items: selectedProductsMatch.groups.items,
      discount: selectedProductsMatch.groups.discount,
    });
  }

  const selectedCategoriesMatch = message.match(
    /^Promotion available:\s*Spend\s*(?<target>.+?)\s*on selected categories\s*\((?<items>.+?)\)\s*and get\s*(?<discount>.+?)\s*off\.$/i
  );

  if (selectedCategoriesMatch?.groups) {
    return tUi('ui.pages.products.promotionAvailableSelectedCategories', {
      target: selectedCategoriesMatch.groups.target,
      items: selectedCategoriesMatch.groups.items,
      discount: selectedCategoriesMatch.groups.discount,
    });
  }

  return languageCode === 'en' ? message : tUi('ui.pages.products.promotionAvailableFallback');
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

const Products = () => {
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const { isAuthenticated } = useAuth();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [activePromotionMessage, setActivePromotionMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '');
    setSelectedCategory(searchParams.get('category') || '');
    setMinPrice(searchParams.get('min_price') || '');
    setMaxPrice(searchParams.get('max_price') || '');
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory, minPrice, maxPrice, isAuthenticated]);

  useEffect(() => {
    fetchActivePromotionMessage();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let response;
      const hasFilters = searchTerm || selectedCategory || minPrice || maxPrice;

      if (hasFilters) {
        const endpoint = isAuthenticated ?
          PRODUCT_ENDPOINTS.FILTER_USER :
          PRODUCT_ENDPOINTS.FILTER;
        const params = {};
        if (searchTerm) params.name = searchTerm;
        if (selectedCategory) params.category = selectedCategory;
        if (minPrice) params.min_price = minPrice;
        if (maxPrice) params.max_price = maxPrice;

        try {
          response = await http.get(endpoint, { params });
          const fetchedProducts = response.data;
          setProducts(fetchedProducts);
          const uniqueCategories = [...new Set(fetchedProducts.map((p) => p.category_name))];
          setCategories(uniqueCategories);
        } catch (error) {
          if (error.response?.status === 404 || error.status === 404) {
            setProducts([]);
            setCategories([]);
          } else {
            console.error('Error fetching products:', error);
            setProducts([]);
          }
        }
      } else {
        response = await http.get(PRODUCT_ENDPOINTS.ALL);
        const fetchedProducts = response.data;
        setProducts(fetchedProducts);
        const uniqueCategories = [...new Set(fetchedProducts.map((p) => p.category_name))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePromotionMessage = async () => {
    try {
      const response = await http.get(PROMOTION_ENDPOINTS.ACTIVE);
      const promotion = response?.data;
      setActivePromotionMessage(promotion?.customer_message || '');
    } catch {
      setActivePromotionMessage('');
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (selectedCategory) params.set('category', selectedCategory);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    setSearchParams(params);
    setCurrentPage(1);
    const qt = searchTerm.trim();
    if (isAuthenticated && qt) {
      trackRecommendationEvent({ event_type: 'search', query_text: qt });
    }
  };

  const sortedProducts = useMemo(() => {
    const sorted = [...products.map((product) => localizeProduct(product, languageCode))];
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case 'price-high':
        return sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case 'name':
      default:
        return sorted.sort((a, b) => a.localized_name.localeCompare(b.localized_name));
    }
  }, [products, sortBy, languageCode]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedProducts, currentPage]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const discountedProducts = useMemo(
    () => sortedProducts.filter((product) => product.discount_enabled),
    [sortedProducts]
  );
  const localizedPromotionMessage = useMemo(
    () => formatPromotionMessage(activePromotionMessage, languageCode),
    [activePromotionMessage, languageCode]
  );
  const promotionDisplay = useMemo(() => {
    if (!localizedPromotionMessage) {
      return null;
    }

    const colonIndex = localizedPromotionMessage.indexOf(':');
    if (colonIndex > 0 && colonIndex < 48) {
      return {
        kicker: localizedPromotionMessage.slice(0, colonIndex).trim(),
        body: localizedPromotionMessage.slice(colonIndex + 1).trim(),
      };
    }

    return {
      kicker: '',
      body: localizedPromotionMessage,
    };
  }, [localizedPromotionMessage]);

  const getCategoryLabel = (categoryValue) => {
    const matched = products.find((p) => p.category_name === categoryValue);
    if (!matched) return categoryValue;
    return localizeProduct(matched, languageCode).localized_category_name;
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const cartRes = await addToCart(product.name, 1);
      if (cartRes.success) {
        if (product.id) {
          trackRecommendationEvent({
            event_type: 'add_to_cart',
            product_id: product.id
          });
        }
        toast.success(tUi('ui.pages.products.productAddedToCart_577eece582'));
      } else {
        toast.error(cartRes.error || 'Failed to add to cart');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to cart');
    }
  };

  const renderDiscountCard = (product, index) => {
    const discountPercent = getDiscountPercent(product);

    return (
      <motion.div
        key={`discount-${product.name}`}
        className="products-discount-card-wrapper"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05, duration: 0.4 }}
        whileHover={{ y: -5 }}
      >
        <Link to={`/products/${encodeURIComponent(product.name)}`} className="products-discount-card">
          <div className="products-discount-card-media">
            <span className="products-discount-card-media-category">{product.localized_category_name}</span>
            {discountPercent > 0 &&
              <span className="products-discount-card-badge">-{discountPercent}%</span>
            }
            <img
              src={product.images && product.images.length > 0 ?
                getImageUrl(product.images[0]) :
                getImageUrl('/images/placeholder.jpg')}
              alt={product.localized_name}
            />
          </div>
          <div className="products-discount-card-body">
            <h3 className="products-discount-card-title">{product.localized_name}</h3>
            <div className="products-discount-card-pricing">
              <span className="products-discount-card-price">
                {formatCurrency(product.discounted_price ?? product.price)}
              </span>
              {product.discounted_price &&
                <span className="products-discount-card-price-before">{formatCurrency(product.price)}</span>
              }
            </div>
          </div>
          {isAuthenticated &&
            <button
              type="button"
              className="products-discount-card-cart-btn"
              onClick={(e) => handleAddToCart(e, product)}
              title={tUi('ui.pages.products.addToCart_0ebb524946')}
            >
              <FaShoppingCart />
            </button>
          }
        </Link>
      </motion.div>
    );
  };

  const renderProductCard = (product, index) => (
    <motion.div
      key={product.name}
      className="products-card-wrapper"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (index % itemsPerPage) * 0.04, duration: 0.4 }}
      whileHover={{ y: -5 }}
    >
      <Link to={`/products/${encodeURIComponent(product.name)}`} className="products-card">
        <div className="products-card-media">
          <span className="products-card-media-category">{product.localized_category_name}</span>
          <img
            src={product.images && product.images.length > 0 ?
              getImageUrl(product.images[0]) :
              getImageUrl('/images/placeholder.jpg')}
            alt={product.localized_name}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
            }}
          />
          {isAuthenticated &&
            <button
              type="button"
              className={`products-card-wishlist-btn ${isInWishlist(product.name) ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isInWishlist(product.name)) {
                  removeFromWishlist(product.name);
                } else {
                  addToWishlist(product);
                }
              }}
              title={isInWishlist(product.name) ?
                tUi('ui.pages.products.removeFromWishlist_7b86347347') :
                tUi('ui.pages.products.addToWishlist_e79ca5d19a')}
            >
              {isInWishlist(product.name) ?
                <FaHeart className="wishlist-icon-filled" /> :
                <FaRegHeart className="wishlist-icon-outline" />
              }
            </button>
          }
        </div>
        <div className="products-card-body">
          <h3 className="products-card-title">{product.localized_name}</h3>
          {product.id &&
            <div className="products-card-rating">
              <StarRating
                productId={product.id}
                showLabel={false}
                interactive={false}
                size="small"
                initialAverageRating={product.average_rating}
                initialTotalRatings={product.total_ratings}
                fetchOnMount={!Number.isFinite(Number(product.average_rating))}
              />
            </div>
          }
          <div className="products-card-footer">
            <div className="products-card-pricing">
              {product.discount_enabled ?
                <>
                  <span className="products-card-price products-card-price-sale">
                    {formatCurrency(product.discounted_price ?? product.price)}
                  </span>
                  <span className="products-card-price-before">{formatCurrency(product.price)}</span>
                </> :
                <span className="products-card-price">{formatCurrency(product.price)}</span>
              }
            </div>
            {isAuthenticated &&
              <button
                type="button"
                className="products-card-cart-btn"
                onClick={(e) => handleAddToCart(e, product)}
                title={tUi('ui.pages.products.addToCart_0ebb524946')}
              >
                <FaShoppingCart />
              </button>
            }
          </div>
        </div>
      </Link>
    </motion.div>
  );

  return (
    <div className="products-page">
      <header className="products-page-header">
        <div className="products-page-header-top">
          <div className="products-page-header-copy">
            <span className="products-kicker">{tUi('ui.pages.products.products_95d89e6fd4')}</span>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {tUi('ui.pages.products.products_95d89e6fd4')}
            </motion.h1>
            <p className="products-page-subtitle">
              {tUi('ui.pages.products.discoverOurAmazingCollection_79dc76c0e9')}
            </p>
          </div>
          {promotionDisplay &&
            <div className="products-promo-band" role="status" aria-live="polite">
              {promotionDisplay.kicker &&
                <span className="products-promo-kicker">{promotionDisplay.kicker}</span>
              }
              <p className="products-promo-message">{promotionDisplay.body}</p>
            </div>
          }
        </div>
      </header>

      <div className="products-layout">
        <aside className="products-filters">
          <span className="products-filters-kicker">{tUi('ui.pages.products.filters_d9c87b2abe')}</span>
          <h2 className="products-filters-title">{tUi('ui.pages.products.filters_d9c87b2abe')}</h2>

          <div className="products-filter-group">
            <label htmlFor="products-search">{tUi('ui.pages.products.search_1af3c5afd2')}</label>
            <input
              id="products-search"
              type="text"
              placeholder={tUi('ui.pages.products.searchProducts_9fe79fc282')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>

          <div className="products-filter-group">
            <label htmlFor="products-category">{tUi('ui.pages.products.category_a6c5fd855e')}</label>
            <select
              id="products-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">{tUi('ui.pages.products.allCategories_9fd1de45e8')}</option>
              {categories.map((cat) =>
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat)}
                </option>
              )}
            </select>
          </div>

          <div className="products-filter-group">
            <label>{tUi('ui.pages.products.priceRange_2f572dca61')}</label>
            <div className="products-price-inputs">
              <input
                type="number"
                placeholder={tUi('ui.pages.products.min_811224441b')}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                placeholder={tUi('ui.pages.products.max_efa3dd52b2')}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <button type="button" onClick={applyFilters} className="products-apply-btn">
            {tUi('ui.pages.products.applyFilters_6e513a0be6')}
          </button>
        </aside>

        <main className="products-main">
          <div className="products-toolbar">
            <p className="products-count">
              {sortedProducts.length}{tUi('ui.pages.products.product_5919708d8b')}
              {sortedProducts.length !== 1 ? 's' : ''}{tUi('ui.pages.products.found_1816a1653a')}
            </p>
            <div className="products-sort">
              <label htmlFor="products-sort">{tUi('ui.pages.products.sortBy_9713293ec0')}</label>
              <select id="products-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">{tUi('ui.pages.products.name_53f551ed5a')}</option>
                <option value="price-low">{tUi('ui.pages.products.priceLowToHigh_5592424a7e')}</option>
                <option value="price-high">{tUi('ui.pages.products.priceHighToLow_63247b2840')}</option>
              </select>
            </div>
          </div>

          {discountedProducts.length > 0 &&
            <section className="products-discounts-section">
              <div className="products-section-header">
                <span className="products-discounts-kicker">{tUi('ui.pages.products.discounts_6c46dcf595')}</span>
                <h2>{tUi('ui.pages.products.discounts_6c46dcf595')}</h2>
              </div>
              <div className="products-discounts-grid">
                {discountedProducts.slice(0, 4).map((product, index) => renderDiscountCard(product, index))}
              </div>
            </section>
          }

          {loading ?
            <div className="products-grid">
              {[...Array(12)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div> :
            paginatedProducts.length === 0 ?
              <div className="products-empty-state">
                <p>{tUi('ui.pages.products.noProductsFoundTryAdjusting_7d5a13e1ec')}</p>
              </div> :
              <>
                <div className="products-grid">
                  {paginatedProducts.map((product, index) => renderProductCard(product, index))}
                </div>

                {totalPages > 1 &&
                  <nav className="products-pagination" aria-label="Products pagination">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="products-pagination-btn"
                    >
                      {tUi('ui.pages.products.previous_6fad74798c')}
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => handlePageChange(page)}
                            className={`products-pagination-btn ${currentPage === page ? 'active' : ''}`}
                          >
                            {page}
                          </button>
                        );
                      }
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="products-pagination-ellipsis">...</span>;
                      }
                      return null;
                    })}
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="products-pagination-btn"
                    >
                      {tUi('ui.pages.products.next_5a273f44ac')}
                    </button>
                  </nav>
                }
              </>
          }
        </main>
      </div>
    </div>
  );
};

export default Products;
