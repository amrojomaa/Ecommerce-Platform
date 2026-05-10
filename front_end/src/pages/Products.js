import { tUi } from "../i18n/uiText";import React, { useState, useEffect, useMemo } from 'react';
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

  // Filter states
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

  // useEffect(() => {
  //   applyFilters();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [searchTerm, selectedCategory, minPrice, maxPrice]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let response;

      // Check if filters are applied
      const hasFilters = searchTerm || selectedCategory || minPrice || maxPrice;

      if (hasFilters) {
        // Use filter endpoint (works for both authenticated and unauthenticated users)
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

          // Extract unique categories
          const uniqueCategories = [...new Set(fetchedProducts.map((p) => p.category_name))];
          setCategories(uniqueCategories);
        } catch (error) {
          // Handle 404 - no products found
          if (error.response?.status === 404 || error.status === 404) {
            setProducts([]);
            setCategories([]);
          } else {
            console.error('Error fetching products:', error);
            // On other errors, keep existing products or set empty
            setProducts([]);
          }
        }
      } else {
        // Use regular endpoint when no filters
        const endpoint = PRODUCT_ENDPOINTS.ALL;
        response = await http.get(endpoint);
        const fetchedProducts = response.data;
        setProducts(fetchedProducts);

        // Extract unique categories
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
    const sorted = [...products];
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case 'price-high':
        return sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case 'name':
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [products, sortBy]);

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

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>{tUi("ui.pages.products.products_95d89e6fd4")}</h1>
        <p>{tUi("ui.pages.products.discoverOurAmazingCollection_79dc76c0e9")}</p>
      </div>

      <div className="products-container">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar">
          <h3>{tUi("ui.pages.products.filters_d9c87b2abe")}</h3>
          
          <div className="filter-group">
            <label>{tUi("ui.pages.products.search_1af3c5afd2")}</label>
            <input
              type="text"
              placeholder={tUi("ui.pages.products.searchProducts_9fe79fc282")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && applyFilters()} />
            
          </div>

          <div className="filter-group">
            <label>{tUi("ui.pages.products.category_a6c5fd855e")}</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}>
              
              <option value="">{tUi("ui.pages.products.allCategories_9fd1de45e8")}</option>
              {categories.map((cat) =>
              <option key={cat} value={cat}>
                  {cat}
                </option>
              )}
            </select>
          </div>

          <div className="filter-group">
            <label>{tUi("ui.pages.products.priceRange_2f572dca61")}</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder={tUi("ui.pages.products.min_811224441b")}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)} />
              
              <span>-</span>
              <input
                type="number"
                placeholder={tUi("ui.pages.products.max_efa3dd52b2")}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)} />
              
            </div>
          </div>

          <button onClick={applyFilters} className="apply-filters-btn">{tUi("ui.pages.products.applyFilters_6e513a0be6")}

          </button>
        </aside>

        {/* Products Grid */}
        <main className="products-main">
          {localizedPromotionMessage &&
          <div className="promotion-available-banner" role="status" aria-live="polite">
              <span>{localizedPromotionMessage}</span>
            </div>
          }

          <div className="products-toolbar">
            <p className="products-count">
              {sortedProducts.length}{tUi("ui.pages.products.product_5919708d8b")}{sortedProducts.length !== 1 ? 's' : ''}{tUi("ui.pages.products.found_1816a1653a")}
            </p>
            <div className="sort-controls">
              <label>{tUi("ui.pages.products.sortBy_9713293ec0")}</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">{tUi("ui.pages.products.name_53f551ed5a")}</option>
                <option value="price-low">{tUi("ui.pages.products.priceLowToHigh_5592424a7e")}</option>
                <option value="price-high">{tUi("ui.pages.products.priceHighToLow_63247b2840")}</option>
              </select>
            </div>
          </div>

          {discountedProducts.length > 0 &&
          <section className="discounts-section">
              <h2>{tUi("ui.pages.products.discounts_6c46dcf595")}</h2>
              <div className="discounts-grid">
                {discountedProducts.slice(0, 4).map((product, index) =>
              <motion.div
                key={`discount-${product.name}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ y: -5 }}
                className="product-card-wrapper">
                
                    <Link to={`/products/${encodeURIComponent(product.name)}`} className="product-card">
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
                            <p className="product-price-discount">{formatCurrency(product.discounted_price ?? product.price)}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
              )}
              </div>
            </section>
          }

          {loading ?
          <div className="products-grid">
              {[...Array(12)].map((_, i) =>
            <ProductCardSkeleton key={i} />
            )}
            </div> :
          paginatedProducts.length === 0 ?
          <div className="empty-state">
              <p>{tUi("ui.pages.products.noProductsFoundTryAdjusting_7d5a13e1ec")}</p>
            </div> :

          <>
              <div className="products-grid">
                {paginatedProducts.map((product, index) =>
              <motion.div
                key={product.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
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
                      title={isInWishlist(product.name) ? tUi("ui.pages.products.removeFromWishlist_7b86347347") : tUi("ui.pages.products.addToWishlist_e79ca5d19a")}>
                      
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
                                <p className="product-price-discount">{formatCurrency(product.discounted_price ?? product.price)}</p>
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
                            const cartRes = await addToCart(product.name, 1);
                            if (cartRes.success) {
                              if (product.id) {
                                trackRecommendationEvent({
                                  event_type: 'add_to_cart',
                                  product_id: product.id
                                });
                              }
                              toast.success(tUi("ui.pages.products.productAddedToCart_577eece582"));
                            } else {
                              toast.error(cartRes.error || "Failed to add to cart");
                            }
                          } catch (error) {
                            toast.error(error.response?.data?.detail || "Failed to add to cart");
                          }
                        }}
                        title={tUi("ui.pages.products.addToCart_0ebb524946")}>
                        
                              <FaShoppingCart />
                            </button>
                      }
                        </div>
                      </div>
                    </Link>
                  </motion.div>
              )}
              </div>

              {/* Pagination */}
              {totalPages > 1 &&
            <div className="pagination">
                  <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-btn">{tUi("ui.pages.products.previous_6fad74798c")}


              </button>
                  {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1))
                {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`pagination-btn ${currentPage === page ? 'active' : ''}`}>
                      
                          {page}
                        </button>);

                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page}>...</span>;
                }
                return null;
              })}
                  <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-btn">{tUi("ui.pages.products.next_5a273f44ac")}


              </button>
                </div>
            }
            </>
          }
        </main>
      </div>
    </div>);

};

export default Products;
