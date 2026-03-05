import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';
import { formatPrice } from '../utils/helpers';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useWishlist } from '../hooks/useWishlist';
import { useCart } from '../hooks/useCart';
import StarRating from '../components/StarRating';
import { FaHeart, FaRegHeart, FaShoppingCart } from 'react-icons/fa';
import { toast } from 'react-toastify';
import '../styles/pages/Products.css';

const Products = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Refresh when navigating to products page

  // useEffect(() => {
  //   applyFilters();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [searchTerm, selectedCategory, minPrice, maxPrice]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let response;
      
      // Check if filters are applied
      const hasFilters = (searchTerm || selectedCategory || minPrice || maxPrice);
      
      if (hasFilters) {
        // Use filter endpoint (works for both authenticated and unauthenticated users)
        const endpoint = isAuthenticated 
          ? PRODUCT_ENDPOINTS.FILTER_USER 
          : PRODUCT_ENDPOINTS.FILTER;
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
          const uniqueCategories = [...new Set(fetchedProducts.map(p => p.category_name))];
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
        const uniqueCategories = [...new Set(fetchedProducts.map(p => p.category_name))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
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
    fetchProducts();
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

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>Products</h1>
        <p>Discover our amazing collection</p>
      </div>

      <div className="products-container">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar">
          <h3>Filters</h3>
          
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>

          <div className="filter-group">
            <label>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Price Range</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <button onClick={applyFilters} className="apply-filters-btn">
            Apply Filters
          </button>
        </aside>

        {/* Products Grid */}
        <main className="products-main">
          <div className="products-toolbar">
            <p className="products-count">
              {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''} found
            </p>
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Name</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="products-grid">
              {[...Array(12)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="empty-state">
              <p>No products found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {paginatedProducts.map((product, index) => (
                  <motion.div
                    key={product.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    whileHover={{ y: -5 }}
                    className="product-card-wrapper"
                  >
                    <Link
                      to={`/products/${encodeURIComponent(product.name)}`}
                      className="product-card"
                    >
                      <div className="product-image">
                        <img
                          src={product.images && product.images.length > 0
                            ? `http://localhost:8000/${product.images[0]}`
                            : `http://localhost:8000/images/placeholder.jpg`}
                          alt={product.name}
                          style={{ objectFit: 'cover' }}
                          // onError={(e) => {
                          //   e.target.src = 'https://via.placeholder.com/300x300?text=No+Image';
                          // }}
                        />
                        {isAuthenticated && (
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
                            title={isInWishlist(product.name) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            {isInWishlist(product.name) ? (
                              <FaHeart className="wishlist-icon-filled" />
                            ) : (
                              <FaRegHeart className="wishlist-icon-outline" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="product-info">
                        <h3>{product.name}</h3>
                        <p className="product-category">{product.category_name}</p>
                        {product.id && (
                          <div className="product-rating-container">
                            <StarRating productId={product.id} showLabel={false} interactive={false} size="small" />
                          </div>
                        )}
                        <div className="product-price-container">
                          <p className="product-price">{formatPrice(product.price)}</p>
                          {isAuthenticated && (
                            <button
                              className="product-add-to-cart-btn"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  await addToCart(product.name, 1);
                                  toast.success('Product added to cart!');
                                } catch (error) {
                                  toast.error(error.response?.data?.detail || 'Failed to add to cart');
                                }
                              }}
                              title="Add to cart"
                            >
                              <FaShoppingCart />
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    Previous
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
                          onClick={() => handlePageChange(page)}
                          className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page}>...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Products;
