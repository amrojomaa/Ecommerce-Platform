import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/Navbar.css';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();        
    navigate('/login'); 
  };
  // const cartItemCount = getCartItemCount();

  return (
    <nav className="navbar">
      <div className="navbar-container">

        <Link to="/" className="navbar-logo">
          E-Commerce
        </Link>

        <div className="navbar-menu">
          <Link to="/products" className="navbar-link">Products</Link>

          {!isAuthenticated ? (
            <>
              <Link to="/login" className="navbar-link">
                Login
              </Link>

              <Link to="/signup" className="navbar-link signup-link">
                Sign Up
              </Link>
            </>
          ) : (
            <>
            <Link to="/cart" className="navbar-link cart-link">
                Cart
               {/* {cartItemCount > 0 && (
                  <span className="cart-badge">{cartItemCount}</span>
                )} */}
              </Link>
              <Link to="/orders" className="navbar-link">
                My Orders
              </Link>
              <Link to="/profile" className="navbar-link">
                Profile
              </Link>

              <button onClick={handleLogout} className="navbar-link logout-btn">
                Logout
              </button>
            </>
          )}

        </div>
      </div>
    </nav>
  );
};

export default Navbar;


















// import React, { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';
// import { useCart } from '../hooks/useCart';
// import { useTheme } from '../hooks/useTheme';
// import '../styles/layouts/Navbar.css';

// const Navbar = () => {
//   const { isAuthenticated, user, logout, isAdmin } = useAuth();
//   const { getCartItemCount } = useCart();
//   const { isDarkMode, toggleTheme } = useTheme();
//   const navigate = useNavigate();
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

//   const handleLogout = () => {
//     logout();
//     navigate('/');
//   };

//   const cartItemCount = getCartItemCount();
  
//   // Safety check for isAdmin
//   const checkIsAdmin = () => {
//     return isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
//   };

//   return (
//     <nav className={`navbar ${isDarkMode ? 'dark' : ''}`}>
//       <div className="navbar-container">
//         <Link to="/" className="navbar-logo">
//           <span style={{ display: 'inline-block' }}>
//             E-Commerce
//           </span>
//         </Link>

//         <div className="navbar-menu">
//           <Link to="/products" className="navbar-link">
//             Products
//           </Link>
          
//           {isAuthenticated ? (
//             <>
//               <Link to="/cart" className="navbar-link cart-link">
//                 Cart
//                 {cartItemCount > 0 && (
//                   <span className="cart-badge">{cartItemCount}</span>
//                 )}
//               </Link>
//               <Link to="/orders" className="navbar-link">
//                 My Orders
//               </Link>
//               <Link to="/profile" className="navbar-link">
//                 Profile
//               </Link>
//               {checkIsAdmin() && (
//                 <Link to="/admin" className="navbar-link admin-link">
//                   Admin
//                 </Link>
//               )}
//               <div className="navbar-user">
//                 <span className="user-email">{user?.email}</span>
//                 <button onClick={handleLogout} className="logout-btn">
//                   Logout
//                 </button>
//               </div>
//             </>
//           ) : (
//             <>
//               <Link to="/login" className="navbar-link">
//                 Login
//               </Link>
//               <Link to="/signup" className="navbar-link signup-link">
//                 Sign Up
//               </Link>
//             </>
//           )}

//           <button
//             onClick={toggleTheme}
//             className="theme-toggle"
//             aria-label="Toggle theme"
//           >
//             {isDarkMode ? '☀️' : '🌙'}
//           </button>

//           <button
//             className="mobile-menu-toggle"
//             onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
//             aria-label="Toggle menu"
//           >
//             <span></span>
//             <span></span>
//             <span></span>
//           </button>
//         </div>
//       </div>

//       {mobileMenuOpen && (
//         <div className="mobile-menu">
//           <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
//             Products
//           </Link>
//           {isAuthenticated ? (
//             <>
//               <Link to="/cart" onClick={() => setMobileMenuOpen(false)}>
//                 Cart ({cartItemCount})
//               </Link>
//               <Link to="/orders" onClick={() => setMobileMenuOpen(false)}>
//                 My Orders
//               </Link>
//               <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
//                 Profile
//               </Link>
//               {checkIsAdmin() && (
//                 <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
//                   Admin
//                 </Link>
//               )}
//               <button onClick={handleLogout}>Logout</button>
//             </>
//           ) : (
//             <>
//               <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
//                 Login
//               </Link>
//               <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
//                 Sign Up
//               </Link>
//             </>
//           )}
//         </div>
//       )}
//     </nav>
//   );
// };

// export default Navbar;

