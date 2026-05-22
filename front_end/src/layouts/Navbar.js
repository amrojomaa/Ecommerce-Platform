import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import '../styles/layouts/Navbar.css';
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { FaShoppingCart, FaSignOutAlt, FaHeart } from "react-icons/fa";
import API_BASE_URL from '../config/api';
import { useWishlist } from '../hooks/useWishlist';
import { trackRecommendationEvent } from '../services/recommendations';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { tUi } from '../i18n/uiText';

const Navbar = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout, isAdmin, isSupportManager, isWarehouseManager } = useAuth();
  const { getCartItemCount } = useCart();
  const { getWishlistItemCount } = useWishlist();
  const { isDarkMode, toggleTheme } = useTheme();
  const { currentCurrency, setCurrency, supportedCurrencies } = useCurrency();
  const { unreadCount: unreadTicketsCount } = useUnreadTickets();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileDropdownRef = useRef(null);
  const isAdminArea = location.pathname.startsWith('/admin');
  const isDriverArea = location.pathname.startsWith('/driver');
  const isCashierArea = location.pathname.startsWith('/cashier');
  const isSupportAgentArea = location.pathname.startsWith('/support-agent');
  const isSupportManagerArea = location.pathname.startsWith('/support') && !location.pathname.startsWith('/support-agent');
  const isSellerArea = location.pathname.startsWith('/seller');
  const isWarehouseStaffArea = location.pathname.startsWith('/warehouse-staff');
  const isWarehouseManagerArea = location.pathname.startsWith('/warehouse') && !location.pathname.startsWith('/warehouse-staff');
  const isUserRestrictedByRole = user && (user.role === 'seller' || user.role === 'warehouse_staff' || user.role === 'warehouse_manager' || user.role === 'cashier' || user.role === 'driver' || user.role === 'support_agent' || user.role === 'support_manager');
  const isRestrictedArea = isAdminArea || isDriverArea || isCashierArea || isSupportAgentArea || isSupportManagerArea || isSellerArea || isWarehouseStaffArea || isWarehouseManagerArea || isUserRestrictedByRole;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const cartItemCount = getCartItemCount();
  const wishlistItemCount = getWishlistItemCount();
  const currencyOptions = Object.values(supportedCurrencies || {});
  const isOperationsManager = user?.role === 'operations_manager';
  const isRealAdmin = user?.role === 'admin';
  const adminPanelPath = user?.role === 'operations_manager' ? '/admin/orders' : '/admin';
  const adminPanelLabel = isOperationsManager ? t('navbar.operationsManager') : t('navbar.admin');
  const supportPanelPath = '/support';
  const warehouseManagerHomePath = '/warehouse';
  const adminHomePath = '/admin';
  const driverHomePath = '/driver';
  const cashierHomePath = '/cashier';
  const supportAgentHomePath = '/support-agent';
  const supportManagerHomePath = '/support';
  const sellerHomePath = '/seller';

  const getDashboardHomePath = () => {
    if (!user) return '/';
    if (user.role === 'admin' || user.role === 'operations_manager') return adminHomePath;
    if (user.role === 'driver') return driverHomePath;
    if (user.role === 'cashier') return cashierHomePath;
    if (user.role === 'support_agent') return supportAgentHomePath;
    if (user.role === 'support_manager') return supportManagerHomePath;
    if (user.role === 'warehouse_manager') return warehouseManagerHomePath;
    if (user.role === 'seller') return sellerHomePath;
    if (user.role === 'warehouse_staff') return '/warehouse-staff';
    return '/';
  };

  const handleLogoClick = (event) => {
    const logoPath = isRestrictedArea ? getDashboardHomePath() : '/';

    if (location.pathname !== logoPath) {
      return;
    }

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (location.hash) {
      window.history.replaceState(null, '', logoPath);
    }
  };

  useEffect(() => {
    if (location.pathname === '/products') {
      const params = new URLSearchParams(location.search);
      setSearchQuery(params.get('search') || '');
      return;
    }
    setSearchQuery('');
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmedQuery = searchQuery.trim();
    const params = new URLSearchParams();
    if (trimmedQuery) {
      params.set('search', trimmedQuery);
      if (isAuthenticated) {
        trackRecommendationEvent({ event_type: 'search', query_text: trimmedQuery });
      }
    }
    navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`);
    setMobileMenuOpen(false);
  };

  // Safety check for isAdmin
  const checkIsAdmin = () => {
    return isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
  };

  const checkIsSupportManager = () => {
    return isSupportManager && typeof isSupportManager === 'function' ? isSupportManager() : false;
  };

  const checkIsWarehouseManager = () => {
    return isWarehouseManager && typeof isWarehouseManager === 'function' ? isWarehouseManager() : false;
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
      }return imageUrl;} // Normalize path - remove leading slash if present to avoid double slashes
    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage; // Construct full URL for uploaded images
    const imageUrl = `${API_BASE_URL}/${normalizedPath}`;return imageUrl;}; // Close dropdown when clicking outside
  useEffect(() => {const handleClickOutside = (event) => {
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

  const handleCurrencyChange = (event) => {
    setCurrency(event.target.value);
  };

  return (
    <nav className={`navbar ${isDarkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        <Link
          to={isRestrictedArea ? getDashboardHomePath() : '/'}
          className="navbar-logo"
          onClick={handleLogoClick}>
          <span style={{ display: 'inline-block' }}>
            {t("app.brand")}
          </span>
        </Link>

        {!isRestrictedArea &&
        <form className="navbar-search" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("navbar.searchPlaceholder")}
            aria-label={t("navbar.searchAria")} />
          
          <button type="submit">{t("navbar.searchButton")}</button>
        </form>
        }

        <div className="navbar-menu">
          {!isRestrictedArea &&
          <Link to="/products" className="navbar-link">
            {t("navbar.products")}
          </Link>
          }
          
          {isAuthenticated ?
          <>
              {!isRestrictedArea &&
              <>
                <Link to="/cart" className="navbar-link cart-link">
                  <div className="cart-icon-wrapper">
                    <FaShoppingCart className="cart-icon" />
                    {cartItemCount > 0 &&
                  <span className="cart-badge">{cartItemCount}</span>
                  }
                  </div>
                </Link>
                <Link to="/wishlist" className="navbar-link wishlist-link">
                  <div className="wishlist-icon-wrapper">
                    <FaHeart className="wishlist-icon" />
                    {wishlistItemCount > 0 &&
                  <span className="wishlist-badge">{wishlistItemCount}</span>
                  }
                  </div>
                </Link>
                <Link to="/recommendations" className="navbar-link">
                  {t("navbar.forYou")}
                </Link>
                <Link to="/orders" className="navbar-link">
                  {t("navbar.myOrders")}
                </Link>
                {user?.role === "customer" &&
              <Link to="/installments" className="navbar-link">
                    {t("navbar.installments")}
                  </Link>
              }
                {user?.role === "customer" &&
              <Link to="/tickets" className="navbar-link">
                    <span>{t("navbar.tickets")}</span>
                    {unreadTicketsCount > 0 &&
                <span className="admin-badge">{unreadTicketsCount}</span>
                }
                  </Link>
              }
                {checkIsAdmin() &&
              <Link to={adminPanelPath} className="navbar-link admin-link">
                    <span>{adminPanelLabel}</span>
                    {unreadTicketsCount > 0 &&
                <span className="admin-badge">{unreadTicketsCount}</span>
                }
                  </Link>
              }
                {checkIsSupportManager() &&
              <Link to={supportPanelPath} className="navbar-link admin-link">
                    <span>{t("navbar.supportManager")}</span>
                    {unreadTicketsCount > 0 &&
                <span className="admin-badge">{unreadTicketsCount}</span>
                }
                  </Link>
              }
                {checkIsWarehouseManager() &&
              <Link to={warehouseManagerHomePath} className="navbar-link admin-link">
                    <span>{t("navbar.warehouseManager")}</span>
                  </Link>
              }
                {user?.role === "support_agent" && !checkIsAdmin() &&
              <Link to="/support-agent" className="navbar-link">
                    <span>{t("navbar.support_agent")}</span>
                    {unreadTicketsCount > 0 &&
                <span className="admin-badge">{unreadTicketsCount}</span>
                }
                  </Link>
              }
                {user?.role === "driver" &&
              <Link to="/driver" className="navbar-link">
                    <span>{t("navbar.driver")}</span>
                  </Link>
              }
                {user?.role === "cashier" &&
              <Link to="/cashier" className="navbar-link">
                    <span>{t("navbar.cashier")}</span>
                  </Link>
              }
                {user?.role === "seller" &&
              <Link to="/seller" className="navbar-link">
                    <span>Seller Panel</span>
                  </Link>
              }
                {user?.role === "warehouse_staff" &&
              <Link to="/warehouse-staff" className="navbar-link">
                    <span>Warehouse</span>
                  </Link>
              }
                {isRealAdmin &&
              <Link to="/cashier" className="navbar-link">
                    {t("navbar.pos")}
                  </Link>
              }
              </>
              }
              {isAdminArea &&
              <Link to={adminHomePath} className="navbar-link admin-link">
                  <span>{t("ui.sidebar.menu.dashboard")}</span>
                </Link>
              }
              {(isDriverArea || (user?.role === 'driver' && !isDriverArea)) &&
              <Link to={driverHomePath} className="navbar-link admin-link">
                  <span>{t("navbar.driver")} Dashboard</span>
                </Link>
              }
              {(isSupportAgentArea || (user?.role === 'support_agent' && !isSupportAgentArea)) &&
              <Link to={supportAgentHomePath} className="navbar-link admin-link">
                  <span>Support Agent Dashboard</span>
                </Link>
              }
              {(isSupportManagerArea || (user?.role === 'support_manager' && !isSupportManagerArea)) &&
              <Link to={supportManagerHomePath} className="navbar-link admin-link">
                  <span>Support Manager Dashboard</span>
                </Link>
              }
              {(isCashierArea || (user?.role === 'cashier' && !isCashierArea)) &&
              <Link to={cashierHomePath} className="navbar-link admin-link">
                  <span>{t("navbar.cashier")} Dashboard</span>
                </Link>
              }
              {(isSellerArea || (user?.role === 'seller' && !isSellerArea)) &&
              <Link to={sellerHomePath} className="navbar-link admin-link">
                  <span>Seller Dashboard</span>
                </Link>
              }
              {(isWarehouseStaffArea || (user?.role === 'warehouse_staff' && !isWarehouseStaffArea)) &&
              <Link to="/warehouse-staff" className="navbar-link admin-link">
                  <span>Warehouse Dashboard</span>
                </Link>
              }
              {(isWarehouseManagerArea || (user?.role === 'warehouse_manager' && !isWarehouseManagerArea)) &&
              <Link to={warehouseManagerHomePath} className="navbar-link admin-link">
                  <span>{t("navbar.warehouseManager")}</span>
                </Link>
              }
              <div className="navbar-user" ref={profileDropdownRef}>
                <div
                className="profile-image-wrapper"
                onClick={toggleProfileDropdown}
                onMouseEnter={() => setProfileDropdownOpen(true)}>
                
                  <img
                  key={`${user?.id || 'no-user'}-${user?.profile_image || 'default'}`}
                  src={getProfileImageUrl()}
                  alt={tUi("ui.layouts.navbar.profile_553de13c4b")}
                  className="navbar-profile-image"
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Always fallback to default image on error
                    if (e.target.src !== defaultProfileImage) {
                      e.target.src = defaultProfileImage;
                    }
                  }} />
                
                </div>
                {profileDropdownOpen &&
              <div className="profile-dropdown">
                    <div className="dropdown-item email-item">
                      <span className="dropdown-label">{t("navbar.email")}:</span>
                      <span className="dropdown-value">{user?.email}</span>
                    </div>
                    <Link to="/profile" className="dropdown-item"
                onClick={() => setProfileDropdownOpen(false)}>
                      {t("navbar.profile")}
                    </Link>
                    <div className="dropdown-item currency-item">
                      <span className="currency-label">{t("currency.label")}</span>
                      <select
                    className="currency-select"
                    value={currentCurrency}
                    onChange={handleCurrencyChange}>
                    
                        {currencyOptions.map((currency) =>
                    <option key={currency.code} value={currency.code}>
                            {t(`currency.${currency.code}`, { defaultValue: currency.label })}
                          </option>
                    )}
                      </select>
                    </div>
                    <div className="dropdown-item language-item">
                      <span className="currency-label">{t("language.label")}</span>
                      <LanguageSwitcher compact />
                    </div>
                    <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    handleLogout();
                  }}
                  className="dropdown-item logout-dropdown-btn">
                  
                      <FaSignOutAlt className="logout-icon" />
                      {t("navbar.logout")}
                    </button>
                  </div>
              }
              </div>
            </> :

          <>
              <Link to="/login" className="navbar-link">
                {t("navbar.login")}
              </Link>
              <Link to="/signup" className="navbar-link signup-link">
                {t("navbar.signup")}
              </Link>
            </>
          }

          <LanguageSwitcher compact className="navbar-language-switcher" />

          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={t("theme.toggle")}>
            
            {/* {isDarkMode ? '☀️' : '🌙'} */}
            {isDarkMode ? <MdLightMode /> : <MdDarkMode />}
          </button>

          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t("menu.toggle")}>
            
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {mobileMenuOpen &&
      <div className="mobile-menu">
          {!isRestrictedArea &&
          <>
            <form className="mobile-search" onSubmit={handleSearchSubmit}>
              <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("navbar.searchPlaceholder")}
              aria-label={t("navbar.searchAria")} />
            
              <button type="submit">{t("navbar.searchButton")}</button>
            </form>
            <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
              {t("navbar.products")}
            </Link>
          </>
          }
          {isAuthenticated ?
        <>
              {!isRestrictedArea &&
              <>
                <Link to="/cart" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.cart")} ({cartItemCount})
                </Link>
                <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.wishlist")} ({wishlistItemCount})
                </Link>
                <Link to="/recommendations" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.forYou")}
                </Link>
                <Link to="/orders" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.myOrders")}
                </Link>
                {user?.role === "customer" &&
            <Link to="/installments" onClick={() => setMobileMenuOpen(false)}>
                    {t("navbar.installments")}
                  </Link>
            }
                {user?.role === "customer" &&
            <Link to="/tickets" onClick={() => setMobileMenuOpen(false)}>
                    {t("navbar.tickets")} {unreadTicketsCount > 0 && tUi("ui.layouts.navbar.value_e8ebc826e7", { value0: unreadTicketsCount })}
                  </Link>
            }
              </>
              }
              {isAdminArea &&
              <Link to={adminHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {t("ui.sidebar.menu.dashboard")}
                </Link>
              }
              {isDriverArea &&
              <Link to={driverHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.driver")}
                </Link>
              }
              {isCashierArea &&
              <Link to={cashierHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.cashier")}
                </Link>
              }
              {isSupportAgentArea &&
              <Link to={supportAgentHomePath} onClick={() => setMobileMenuOpen(false)}>
                  Support Agent
                </Link>
              }
              {isSupportManagerArea &&
              <Link to={supportManagerHomePath} onClick={() => setMobileMenuOpen(false)}>
                  Support Manager
                </Link>
              }
              {isWarehouseManagerArea &&
              <Link to={warehouseManagerHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.warehouseManager")}
                </Link>
              }
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                {t("navbar.profile")}
              </Link>
              <div className="mobile-currency-switcher">
                <label htmlFor="mobile-currency">{t("currency.label")}</label>
                <select
              id="mobile-currency"
              value={currentCurrency}
              onChange={handleCurrencyChange}>
              
                  {currencyOptions.map((currency) =>
              <option key={currency.code} value={currency.code}>
                      {t(`currency.${currency.code}`, { defaultValue: currency.label })}
                    </option>
              )}
                </select>
              </div>
              <div className="mobile-language-switcher">
                <LanguageSwitcher />
              </div>
              {checkIsAdmin() &&
          <Link to={adminPanelPath} onClick={() => setMobileMenuOpen(false)}>
                  {adminPanelLabel} {unreadTicketsCount > 0 && tUi("ui.layouts.navbar.value_e8ebc826e7", { value0: unreadTicketsCount })}
                </Link>
          }
              {checkIsSupportManager() &&
          <Link to={supportPanelPath} onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.supportManager")} {unreadTicketsCount > 0 && tUi("ui.layouts.navbar.value_e8ebc826e7", { value0: unreadTicketsCount })}
                </Link>
          }
              {checkIsWarehouseManager() &&
          <Link to={warehouseManagerHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.warehouseManager")}
                </Link>
          }
              {user?.role === "support_agent" && !checkIsAdmin() &&
          <Link to="/support-agent" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.support_agent")} {unreadTicketsCount > 0 && tUi("ui.layouts.navbar.value_e8ebc826e7", { value0: unreadTicketsCount })}
                </Link>
          }
              {user?.role === "driver" &&
          <Link to="/driver" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.driver")}
                </Link>
          }
              {user?.role === "cashier" &&
          <Link to="/cashier" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.cashier")}
                </Link>
          }
              {isRealAdmin &&
          <Link to="/cashier" onClick={() => setMobileMenuOpen(false)}>
                  {t("navbar.pos")}
                </Link>
          }
              <div className="mobile-user-info">
                <span>{user?.email}</span>
              </div>
              <button onClick={handleLogout}>{t("navbar.logout")}</button>
            </> :

        <>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                {t("navbar.login")}
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                {t("navbar.signup")}
              </Link>
              <div className="mobile-language-switcher">
                <LanguageSwitcher />
              </div>
            </>
        }
        </div>
      }
    </nav>);

};

export default Navbar;
