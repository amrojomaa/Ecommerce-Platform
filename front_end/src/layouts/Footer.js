import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/Footer.css';

const Footer = () => {
  const { isDarkMode } = useTheme();

  return (
    <footer className={`footer ${isDarkMode ? 'dark' : ''}`}>
      <div className="footer-container">
        <div className="footer-section">
          <h3>E-Commerce</h3>
          <p>Your trusted online shopping destination</p>
        </div>
        
        <div className="footer-section">
          <h4>Quick Links</h4>
          <Link to="/products">Products</Link>
          <Link to="/">Home</Link>
        </div>
        
        <div className="footer-section">
          <h4>Account</h4>
          <Link to="/login">Login</Link>
          <Link to="/signup">Sign Up</Link>
        </div>
        
        <div className="footer-section">
          <h4>Contact</h4>
          <p>Email: support@ecommerce.com</p>
          <p>Phone: +1 (555) 123-4567</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} E-Commerce. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
