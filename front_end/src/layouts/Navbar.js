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
import '../styles/layouts/Navbar.css';
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { FaShoppingCart, FaSignOutAlt } from "react-icons/fa";
import API_BASE_URL from '../config/api';

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const { getCartItemCount } = useCart();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const cartItemCount = getCartItemCount();
  
  // Safety check for isAdmin
  const checkIsAdmin = () => {
    return isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
  };
  
  // Default profile image (same as Profile page)
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';
  
  const getProfileImageUrl = () => {
    if (user?.profile_image) {
      // Check if it's already a full URL (e.g., Google profile image)
      if (user.profile_image.startsWith('http://') || user.profile_image.startsWith('https://')) {
        return user.profile_image;
      }
      // Otherwise, it's a relative path from our server
      return `${API_BASE_URL}/${user.profile_image}`;
    }
    return defaultProfileImage;
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
            E-Commerce
          </span>
        </Link>

        <div className="navbar-menu">
          <Link to="/products" className="navbar-link">
            Products
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
              <Link to="/orders" className="navbar-link">
                My Orders
              </Link>
              {checkIsAdmin() && (
                <Link to="/admin" className="navbar-link admin-link">
                  Admin
                </Link>
              )}
              <div className="navbar-user" ref={profileDropdownRef}>
                <div 
                  className="profile-image-wrapper"
                  onClick={toggleProfileDropdown}
                  onMouseEnter={() => setProfileDropdownOpen(true)}
                >
                  <img 
                    src={getProfileImageUrl()} 
                    alt="Profile" 
                    className="navbar-profile-image"
                    onError={(e) => {
                      e.target.src = defaultProfileImage;
                    }}
                  />
                </div>
                {profileDropdownOpen && (
                  <div className="profile-dropdown">
                    <div className="dropdown-item email-item">
                      <span className="dropdown-label">Email:</span>
                      <span className="dropdown-value">{user?.email}</span>
                    </div>
                    <Link to="/profile"  className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}>
                      Profile
                    </Link>
                    <button 
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }} 
                      className="dropdown-item logout-dropdown-btn"
                    >
                      <FaSignOutAlt className="logout-icon" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                Login
              </Link>
              <Link to="/signup" className="navbar-link signup-link">
                Sign Up
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
            Products
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/cart" onClick={() => setMobileMenuOpen(false)}>
                Cart ({cartItemCount})
              </Link>
              <Link to="/orders" onClick={() => setMobileMenuOpen(false)}>
                My Orders
              </Link>
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                Profile
              </Link>
              {checkIsAdmin() && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                  Admin
                </Link>
              )}
              <div className="mobile-user-info">
                <span>{user?.email}</span>
              </div>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                Login
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

