// import React, { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';
// import { useCart } from '../hooks/useCart';
// import { useTheme } from '../hooks/useTheme';
// import '../styles/layouts/Navbar.css';

// const Navbar = () => {
//   const { isAuthenticated, logout } = useAuth();
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     logout();        
//     navigate('/login'); 
//   };
//   // const cartItemCount = getCartItemCount();

//   return (
//     <nav className="navbar">
//       <div className="navbar-container">

//         <Link to="/" className="navbar-logo">
//           E-Commerce
//         </Link>

//         <div className="navbar-menu">
//           <Link to="/products" className="navbar-link">Products</Link>

//           {!isAuthenticated ? (
//             <>
//               <Link to="/login" className="navbar-link">
//                 Login
//               </Link>

//               <Link to="/signup" className="navbar-link signup-link">
//                 Sign Up
//               </Link>
//             </>
//           ) : (
//             <>
//             <Link to="/cart" className="navbar-link cart-link">
//                 Cart
//                {/* {cartItemCount > 0 && (
//                   <span className="cart-badge">{cartItemCount}</span>
//                 )} */}
//               </Link>
//               <Link to="/orders" className="navbar-link">
//                 My Orders
//               </Link>
//               <Link to="/profile" className="navbar-link">
//                 Profile
//               </Link>

//               <button onClick={handleLogout} className="navbar-link logout-btn">
//                 Logout
//               </button>
//             </>
//           )}

//         </div>
//       </div>
//     </nav>
//   );
// };

// export default Navbar;


















import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useTheme } from '../hooks/useTheme';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useLanguage } from '../hooks/useLanguage';
import '../styles/layouts/Navbar.css';
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { FaShoppingCart, FaSignOutAlt, FaHeart } from "react-icons/fa";
import API_BASE_URL from '../config/api';
import { useWishlist } from '../hooks/useWishlist';

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const { getCartItemCount } = useCart();
  const { getWishlistItemCount } = useWishlist();
  const { isDarkMode, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  const { unreadCount: unreadTicketsCount } = useUnreadTickets();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch) {
      navigate(`/products?search=${encodeURIComponent(trimmedSearch)}`);
      return;
    }
    navigate('/products');
  };

  const cartItemCount = getCartItemCount();
  const wishlistItemCount = getWishlistItemCount();
  
  // Safety check for isAdmin
  const checkIsAdmin = () => {
    return isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
  };
  
  // Default profile image (same as Profile page)
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';
  
  const getProfileImageUrl = () => {
    // Return default if no user
    if (!user) {
      return defaultProfileImage;
    }
    
    // Check if profile_image exists and is not empty/null
    const profileImage = user.profile_image;
    
    if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
      return defaultProfileImage;
    }
    
    // Check if it's already a full URL (e.g., Google profile image)
    // Handle both http:// and https:// URLs
    if (typeof profileImage === 'string' && (profileImage.startsWith('http://') || profileImage.startsWith('https://'))) {
      // For Google images, ensure we use the correct format
      // Google URLs sometimes need to be modified to work properly
      let imageUrl = profileImage;
      
      // If it's a Googleusercontent URL, make sure it's accessible
      if (imageUrl.includes('googleusercontent.com')) {
        // Remove any size restrictions that might cause issues (=s96-c)
        // Or keep them if they work - Google images should work as-is
        // The URL format is usually fine, but we can modify if needed
      }
      
      return imageUrl;
    }
    
    // Normalize path - remove leading slash if present to avoid double slashes
    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage;
    // Construct full URL for uploaded images
    const imageUrl = `${API_BASE_URL}/${normalizedPath}`;
    return imageUrl;
  };


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  return (
    <nav className={`navbar ${isDarkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span style={{ display: 'inline-block' }}>
            {t('brand', 'E-Commerce')}
          </span>
        </Link>

        <form className="navbar-search-form" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            className="navbar-search-input"
            placeholder={t('searchProducts', 'Search products...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('search', 'Search')}
          />
          <button type="submit" className="navbar-search-btn">
            {t('search', 'Search')}
          </button>
        </form>

        <div className="navbar-menu">
          <Link to="/products" className="navbar-link">
            {t('products', 'Products')}
          </Link>
          
          {isAuthenticated ? (
            <>
              <Link to="/cart" className="navbar-link cart-link">
                {/* Cart
                {cartItemCount > 0 && (
                  <span className="cart-badge">{cartItemCount}</span>
                )} */}
                <div className="cart-icon-wrapper">
                  <FaShoppingCart className="cart-icon" />
                  {cartItemCount > 0 && (
                  <span className="cart-badge">{cartItemCount}</span>
                  )}
                </div>
              </Link>
              <Link to="/wishlist" className="navbar-link wishlist-link">
                <div className="wishlist-icon-wrapper">
                  <FaHeart className="wishlist-icon" />
                  {wishlistItemCount > 0 && (
                  <span className="wishlist-badge">{wishlistItemCount}</span>
                  )}
                </div>
              </Link>
              <Link to="/orders" className="navbar-link">
                {t('myOrders', 'My Orders')}
              </Link>
              {user?.role === 'customer' && (
                <Link to="/tickets" className="navbar-link">
                  <span>{t('tickets', 'Tickets')}</span>
                  {unreadTicketsCount > 0 && (
                    <span className="admin-badge">{unreadTicketsCount}</span>
                  )}
                </Link>
              )}
              {checkIsAdmin() && (
                <Link to="/admin" className="navbar-link admin-link">
                  <span>{t('admin', 'Admin')}</span>
                  {unreadTicketsCount > 0 && (
                    <span className="admin-badge">{unreadTicketsCount}</span>
                  )}
                </Link>
              )}
              {user?.role === 'employee' && !checkIsAdmin() && (
                <Link to="/employee" className="navbar-link">
                  <span>{t('employee', 'Employee')}</span>
                  {unreadTicketsCount > 0 && (
                    <span className="admin-badge">{unreadTicketsCount}</span>
                  )}
                </Link>
              )}
              <div className="navbar-user" ref={profileDropdownRef}>
                <div 
                  className="profile-image-wrapper"
                  onClick={toggleProfileDropdown}
                  onMouseEnter={() => setProfileDropdownOpen(true)}
                >
                  <img 
                    key={`${user?.id || 'no-user'}-${user?.profile_image || 'default'}`}
                    src={getProfileImageUrl()} 
                    alt="Profile" 
                    className="navbar-profile-image"
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Always fallback to default image on error
                      if (e.target.src !== defaultProfileImage) {
                        e.target.src = defaultProfileImage;
                      }
                    }}
                  />
                </div>
                {profileDropdownOpen && (
                  <div className="profile-dropdown">
                    <div className="dropdown-item email-item">
                      <span className="dropdown-label">{t('email', 'Email')}:</span>
                      <span className="dropdown-value">{user?.email}</span>
                    </div>
                    <Link to="/profile"  className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}>
                      {t('profile', 'Profile')}
                    </Link>
                    <button
                      onClick={toggleLanguage}
                      className="dropdown-item language-dropdown-btn"
                    >
                      {`${t('language', 'Language')}: ${language === 'ar' ? 'Arabic' : 'English'}`}
                    </button>
                    <button 
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }} 
                      className="dropdown-item logout-dropdown-btn"
                    >
                      <FaSignOutAlt className="logout-icon" />
                      {t('logout', 'Logout')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                {t('login', 'Login')}
              </Link>
              <Link to="/signup" className="navbar-link signup-link">
                {t('signUp', 'Sign Up')}
              </Link>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
          >
            {/* {isDarkMode ? '☀️' : '🌙'} */}
            {isDarkMode ? <MdLightMode/> : <MdDarkMode/>}
          </button>

          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
            {t('products', 'Products')}
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/cart" onClick={() => setMobileMenuOpen(false)}>
                {`${t('cart', 'Cart')} (${cartItemCount})`}
              </Link>
              <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)}>
                {`${t('wishlist', 'Wishlist')} (${wishlistItemCount})`}
              </Link>
              <Link to="/orders" onClick={() => setMobileMenuOpen(false)}>
                {t('myOrders', 'My Orders')}
              </Link>
              {user?.role === 'customer' && (
                <Link to="/tickets" onClick={() => setMobileMenuOpen(false)}>
                  {t('tickets', 'Tickets')} {unreadTicketsCount > 0 && `(${unreadTicketsCount})`}
                </Link>
              )}
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                {t('profile', 'Profile')}
              </Link>
              {checkIsAdmin() && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                  {t('admin', 'Admin')} {unreadTicketsCount > 0 && `(${unreadTicketsCount})`}
                </Link>
              )}
              {user?.role === 'employee' && !checkIsAdmin() && (
                <Link to="/employee" onClick={() => setMobileMenuOpen(false)}>
                  {t('employee', 'Employee')} {unreadTicketsCount > 0 && `(${unreadTicketsCount})`}
                </Link>
              )}
              <div className="mobile-user-info">
                <span>{user?.email}</span>
              </div>
              <button onClick={handleLogout}>{t('logout', 'Logout')}</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                {t('login', 'Login')}
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                {t('signUp', 'Sign Up')}
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

