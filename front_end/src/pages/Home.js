import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../services/http';
import { PRODUCT_ENDPOINTS } from '../config/api';
import { formatPrice } from '../utils/helpers';
import { ProductCardSkeleton } from '../components/Skeleton';
import '../styles/pages/Home.css';

const Home = () => {
  const location = useLocation();
  const [featuredProducts, setFeaturedProducts] = useState([]);
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
      
      // Extract unique categories
      const uniqueCategories = [...new Set(products.map(p => p.category_name))];
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
        transition={{ duration: 0.8 }}
      >
        <div className="hero-content">
          <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Welcome to Our Store
          </motion.h1>
          <motion.p
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Discover amazing products at unbeatable prices
          </motion.p>
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link to="/products" className="hero-button">
              Shop Now
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Featured Categories */}
      {categories.length > 0 && (
        <section className="categories-section">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Shop by Category
          </motion.h2>
          <div className="categories-grid">
            {categories.map((category, index) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
              >
                <Link to={`/products?category=${encodeURIComponent(category)}`} className="category-card">
                  <div className="category-icon">🏷️</div>
                  <h3>{category}</h3>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="featured-products-section">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Featured Products
        </motion.h2>
        {loading ? (
          <div className="products-grid">
            {[...Array(6)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="products-grid">
            {featuredProducts.map((product, index) => (
              <motion.div
                key={product.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -5 }}
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
                      // onError={(e) => {
                      //   e.target.src = 'https://via.placeholder.com/300x300?text=No+Image';
                      // }}
                    />
                  </div>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-category">{product.category_name}</p>
                    <p className="product-price">{formatPrice(product.price)}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Link to="/products" className="view-all-button">
            View All Products
          </Link>
        </motion.div>
      </section>
    </div>
  );
};

export default Home;
