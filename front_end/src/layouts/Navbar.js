import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { FiClock, FiSearch } from 'react-icons/fi';
import API_BASE_URL from '../config/api';
import { DEFAULT_PROFILE_IMAGE, resolveProfileImageUrl } from '../utils/helpers';
import { getRoleDashboardPath } from '../utils/roleDashboard';
import { useWishlist } from '../hooks/useWishlist';
import { trackRecommendationEvent } from '../services/recommendations';
import { addRecentSearch, filterRecentSearches } from '../utils/recentSearches';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { tUi } from '../i18n/uiText';
import { useCashierPos } from '../context/CashierPosContext';

const Navbar = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout, isAdmin, isOperationsManager, isSupportManager, isWarehouseManager } = useAuth();
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
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [recentSearchRevision, setRecentSearchRevision] = useState(0);
  const profileDropdownRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const ignoreOutsideClickRef = useRef(false);
  const cashierPos = useCashierPos();
  const isAdminArea = location.pathname.startsWith('/admin');
  const isOperationsArea = location.pathname.startsWith('/operations');
  const isDriverArea = location.pathname.startsWith('/driver');
  const isCashierArea = location.pathname.startsWith('/cashier');
  const isSupportAgentArea = location.pathname.startsWith('/support-agent');
  const isSupportManagerArea = location.pathname.startsWith('/support') && !location.pathname.startsWith('/support-agent');
  const isSellerArea = location.pathname.startsWith('/seller');
  const isWarehouseStaffArea = location.pathname.startsWith('/warehouse-staff');
  const isWarehouseManagerArea = location.pathname.startsWith('/warehouse') && !location.pathname.startsWith('/warehouse-staff');
  const isUserRestrictedByRole = user && (user.role === 'seller' || user.role === 'warehouse_staff' || user.role === 'warehouse_manager' || user.role === 'cashier' || user.role === 'driver' || user.role === 'support_agent' || user.role === 'support_manager');
  const isRestrictedArea = isAdminArea || isOperationsArea || isDriverArea || isCashierArea || isSupportAgentArea || isSupportManagerArea || isSellerArea || isWarehouseStaffArea || isWarehouseManagerArea || isUserRestrictedByRole;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const cartItemCount = getCartItemCount();
  const wishlistItemCount = getWishlistItemCount();
  const currencyOptions = Object.values(supportedCurrencies || {});
  const isRealAdmin = user?.role === 'admin';
  const adminPanelPath = '/admin';
  const adminPanelLabel = t('navbar.admin');
  const adminNavDashboardLabel = t('ui.pages.admin.adminDashboard.adminDashboard_16654f6473');
  const operationsPanelPath = '/operations';
  const operationsHomePath = '/operations';
  const operationsNavDashboardLabel = t('ui.pages.admin.operationsManagerDashboard.title');
  const supportPanelPath = '/support';
  const warehouseManagerHomePath = '/warehouse';
  const adminHomePath = '/admin';
  const driverHomePath = '/driver';
  const driverNavDashboardLabel = t('navbar.driverDashboard');
  const cashierHomePath = '/cashier';
  const cashierNavDashboardLabel = t('navbar.cashierDashboard');
  const supportAgentHomePath = '/support-agent';
  const supportManagerHomePath = '/support';
  const sellerHomePath = '/seller';

  const getDashboardHomePath = () => getRoleDashboardPath(user?.role) || '/';

  const getProfilePath = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return '/admin/profile';
    if (path.startsWith('/operations')) return '/operations/profile';
    if (path.startsWith('/support-agent')) return '/support-agent/profile';
    if (path.startsWith('/support')) return '/support/profile';
    if (path.startsWith('/warehouse-staff')) return '/warehouse-staff/profile';
    if (path.startsWith('/warehouse')) return '/warehouse/profile';
    if (path.startsWith('/driver')) return '/driver/profile';
    if (path.startsWith('/cashier')) return '/cashier/profile';
    if (path.startsWith('/seller')) return '/seller/profile';
    if (user?.role === 'admin') return '/admin/profile';
    if (user?.role === 'operations_manager') return '/operations/profile';
    if (user?.role === 'support_manager') return '/support/profile';
    if (user?.role === 'support_agent') return '/support-agent/profile';
    if (user?.role === 'warehouse_manager') return '/warehouse/profile';
    if (user?.role === 'warehouse_staff') return '/warehouse-staff/profile';
    if (user?.role === 'driver') return '/driver/profile';
    if (user?.role === 'cashier') return '/cashier/profile';
    if (user?.role === 'seller') return '/seller/profile';
    return '/profile';
  };

  const profilePath = getProfilePath();

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

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeMenuIfDesktop = () => {
      const shouldUseMobileMenu = isRestrictedArea
        ? window.innerWidth <= 768
        : window.innerWidth <= 1100;

      if (!shouldUseMobileMenu) {
        setMobileMenuOpen(false);
      }
    };

    closeMenuIfDesktop();
    window.addEventListener('resize', closeMenuIfDesktop);

    return () => window.removeEventListener('resize', closeMenuIfDesktop);
  }, [isRestrictedArea]);

  const filteredRecentSearches = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }
    return filterRecentSearches(searchQuery, user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, searchQuery, user?.id, recentSearchRevision]);

  const showSearchSuggestions = isAuthenticated
    && searchSuggestionsOpen
    && filteredRecentSearches.length > 0;

  const runProductSearch = (query) => {
    const trimmedQuery = query.trim();
    const params = new URLSearchParams();
    if (trimmedQuery) {
      params.set('search', trimmedQuery);
      if (isAuthenticated) {
        addRecentSearch(trimmedQuery, user?.id);
        setRecentSearchRevision((prev) => prev + 1);
        trackRecommendationEvent({ event_type: 'search', query_text: trimmedQuery });
      }
    }
    setSearchQuery(trimmedQuery);
    setSearchSuggestionsOpen(false);
    navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`);
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    runProductSearch(searchQuery);
  };

  const handleRecentSearchSelect = (query) => {
    runProductSearch(query);
  };

  const handleSearchFocus = () => {
    if (isAuthenticated) {
      setSearchSuggestionsOpen(true);
    }
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    if (isAuthenticated) {
      setSearchSuggestionsOpen(true);
    }
  };

  const renderSearchSuggestions = (listClassName) => {
    if (!showSearchSuggestions) {
      return null;
    }

    return (
      <div className={`navbar-search-suggestions ${listClassName || ''}`} role="listbox" aria-label={t('navbar.recentSearches')}>
        <p className="navbar-search-suggestions-title">{t('navbar.recentSearches')}</p>
        <ul className="navbar-search-suggestions-list">
          {filteredRecentSearches.map((term) => (
            <li key={term}>
              <button
                type="button"
                className="navbar-search-suggestion-item"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleRecentSearchSelect(term)}
              >
                <FiClock className="navbar-search-suggestion-icon" aria-hidden />
                <span className="navbar-search-suggestion-text">{term}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Safety check for isAdmin
  const checkIsAdmin = () => {
    return isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
  };

  const checkIsOperationsManager = () => {
    return isOperationsManager && typeof isOperationsManager === 'function' ? isOperationsManager() : false;
  };

  const checkIsSupportManager = () => {
    return isSupportManager && typeof isSupportManager === 'function' ? isSupportManager() : false;
  };

  const checkIsWarehouseManager = () => {
    return isWarehouseManager && typeof isWarehouseManager === 'function' ? isWarehouseManager() : false;
  };

  const getProfileImageUrl = () =>
    resolveProfileImageUrl(user?.profile_image, {
      apiBaseUrl: API_BASE_URL,
      defaultImage: DEFAULT_PROFILE_IMAGE,
    });

  useEffect(() => {
    if (!profileDropdownOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (ignoreOutsideClickRef.current) {
        return;
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside, true);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (!searchSuggestionsOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      const inDesktop = desktopSearchRef.current?.contains(event.target);
      const inMobile = mobileSearchRef.current?.contains(event.target);
      if (!inDesktop && !inMobile) {
        setSearchSuggestionsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSearchSuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [searchSuggestionsOpen]);

  const toggleProfileDropdown = (event) => {
    event.stopPropagation();
    ignoreOutsideClickRef.current = true;
    setProfileDropdownOpen((prev) => !prev);
    window.requestAnimationFrame(() => {
      ignoreOutsideClickRef.current = false;
    });
  };

  const handleCurrencyChange = (event) => {
    setCurrency(event.target.value);
  };

  return (
    <nav className={`navbar ${isDarkMode ? 'dark' : ''} ${isRestrictedArea ? 'navbar--panel' : ''}`}>
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
        <form className="navbar-search" ref={desktopSearchRef} onSubmit={handleSearchSubmit}>
          <div className="navbar-search-field">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              placeholder={t("navbar.searchPlaceholder")}
              aria-label={t("navbar.searchAria")}
              aria-expanded={showSearchSuggestions}
              aria-autocomplete="list"
              autoComplete="off"
            />
            {renderSearchSuggestions()}
          </div>
          <button type="submit">{t("navbar.searchButton")}</button>
        </form>
        }

        {isCashierArea && cashierPos &&
        <div className="navbar-pos-search">
          <FiSearch className="navbar-pos-search-icon" aria-hidden />
          <input
            type="search"
            value={cashierPos.search}
            onChange={(event) => cashierPos.setSearch(event.target.value)}
            placeholder={tUi('ui.pages.cashier.posTerminal.searchByName_1a90c9550d')}
            aria-label={tUi('ui.pages.cashier.posTerminal.searchProducts_ac70437f7f')}
          />
        </div>
        }

        <div className="navbar-menu">
          {!isRestrictedArea &&
          <>
            <Link to="/products" className="navbar-link">
              {t("navbar.products")}
            </Link>
            <Link to="/about" className="navbar-link">
              {t("navbar.aboutUs")}
            </Link>
          </>
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
                {checkIsOperationsManager() &&
              <Link to={operationsPanelPath} className="navbar-link admin-link">
                    <span>{t('navbar.operationsManager')}</span>
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
                    <span>{t("navbar.sellerPanel")}</span>
                  </Link>
              }
                {user?.role === "warehouse_staff" &&
              <Link to="/warehouse-staff" className="navbar-link">
                    <span>{t("navbar.warehouseStaffPanel")}</span>
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
                  <span>{adminNavDashboardLabel}</span>
                </Link>
              }
              {isOperationsArea &&
              <Link to={operationsHomePath} className="navbar-link admin-link">
                  <span>{operationsNavDashboardLabel}</span>
                </Link>
              }
              {(isDriverArea || (user?.role === 'driver' && !isDriverArea)) &&
              <Link to={driverHomePath} className="navbar-link admin-link">
                  <span>{driverNavDashboardLabel}</span>
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
              {(isSellerArea || (user?.role === 'seller' && !isSellerArea)) &&
              <Link to={sellerHomePath} className="navbar-link admin-link">
                  <span>{t("navbar.sellerDashboard")}</span>
                </Link>
              }
              {(isWarehouseStaffArea || (user?.role === 'warehouse_staff' && !isWarehouseStaffArea)) &&
              <Link to="/warehouse-staff" className="navbar-link admin-link">
                  <span>{t("navbar.warehouseStaffDashboard")}</span>
                </Link>
              }
              {(isWarehouseManagerArea || (user?.role === 'warehouse_manager' && !isWarehouseManagerArea)) &&
              <Link to={warehouseManagerHomePath} className="navbar-link admin-link">
                  <span>{t("navbar.warehouseManager")}</span>
                </Link>
              }
              {(isCashierArea || (user?.role === 'cashier' && !isCashierArea)) &&
              <Link to={cashierHomePath} className="navbar-link admin-link">
                  <span>{cashierNavDashboardLabel}</span>
                </Link>
              }
              {isCashierArea && cashierPos &&
              <button
                type="button"
                className="navbar-pos-history-btn"
                onClick={cashierPos.openSalesHistory}
              >
                <FiClock aria-hidden />
                <span>{tUi('ui.pages.cashier.posTerminal.mySalesToday_69ede91d75')}</span>
              </button>
              }
              <div className="navbar-user" ref={profileDropdownRef}>
                <div
                  className="profile-image-wrapper"
                  onClick={toggleProfileDropdown}
                  aria-label={tUi("ui.layouts.navbar.profile_553de13c4b")}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleProfileDropdown(event);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={profileDropdownOpen}
                  aria-haspopup="true"
                >
                  <img
                  key={`${user?.id || 'no-user'}-${user?.profile_image || 'default'}`}
                  src={getProfileImageUrl()}
                  alt={tUi("ui.layouts.navbar.profile_553de13c4b")}
                  className="navbar-profile-image"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (e.target.src !== DEFAULT_PROFILE_IMAGE) {
                      e.target.src = DEFAULT_PROFILE_IMAGE;
                    }
                  }} />
                
                </div>
                <div
                  className={`profile-dropdown${profileDropdownOpen ? ' is-open' : ''}`}
                  aria-hidden={!profileDropdownOpen}
                >
                    <div className="dropdown-item email-item">
                      <span className="dropdown-label">{t("navbar.email")}:</span>
                      <span className="dropdown-value">{user?.email}</span>
                    </div>
                    <Link to={profilePath} className="dropdown-item"
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

          <LanguageSwitcher icon className="navbar-language-switcher" />

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
            <form className="mobile-search navbar-search-mobile" ref={mobileSearchRef} onSubmit={handleSearchSubmit}>
              <div className="navbar-search-field">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  placeholder={t("navbar.searchPlaceholder")}
                  aria-label={t("navbar.searchAria")}
                  aria-expanded={showSearchSuggestions}
                  aria-autocomplete="list"
                  autoComplete="off"
                />
                {renderSearchSuggestions('navbar-search-suggestions--mobile')}
              </div>
              <button type="submit">{t("navbar.searchButton")}</button>
            </form>
            <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
              {t("navbar.products")}
            </Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
              {t("navbar.aboutUs")}
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
                  {adminNavDashboardLabel}
                </Link>
              }
              {isOperationsArea &&
              <Link to={operationsHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {operationsNavDashboardLabel}
                </Link>
              }
              {isDriverArea &&
              <Link to={driverHomePath} onClick={() => setMobileMenuOpen(false)}>
                  {driverNavDashboardLabel}
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
              <Link to={profilePath} onClick={() => setMobileMenuOpen(false)}>
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
              {checkIsOperationsManager() &&
          <Link to={operationsPanelPath} onClick={() => setMobileMenuOpen(false)}>
                  {t('navbar.operationsManager')}
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
              {(user?.role === "cashier" || isCashierArea) &&
          <Link to="/cashier" onClick={() => setMobileMenuOpen(false)}>
                  {cashierNavDashboardLabel}
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
