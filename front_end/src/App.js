import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ThemeProvider } from './context/ThemeContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ConfirmProvider } from './context/ConfirmContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import SupportAgentLayout from './layouts/SupportAgentLayout';
import DriverLayout from './layouts/DriverLayout';
import CashierLayout from './layouts/CashierLayout';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Styles
import './styles/App.css';
import { isRtlLanguage, normalizeLanguageCode } from './i18n/constants';

const PageFallback = () => (
  <div className="page-loading">
    <LoadingSpinner size="large" />
  </div>
);

const lazyPage = (loader) => lazy(loader);

// Pages - User
const Home = lazyPage(() => import('./pages/Home'));
const Products = lazyPage(() => import('./pages/Products'));
const ProductDetails = lazyPage(() => import('./pages/ProductDetails'));
const Cart = lazyPage(() => import('./pages/Cart'));
const Checkout = lazyPage(() => import('./pages/Checkout'));
const Payment = lazyPage(() => import('./pages/Payment'));
const Login = lazyPage(() => import('./pages/Login'));
const Signup = lazyPage(() => import('./pages/Signup'));
const EmailVerification = lazyPage(() => import('./pages/EmailVerification'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const VerifyResetCode = lazyPage(() => import('./pages/VerifyResetCode'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const Orders = lazyPage(() => import('./pages/Orders'));
const Profile = lazyPage(() => import('./pages/Profile'));
const Wishlist = lazyPage(() => import('./pages/Wishlist'));
const Recommendations = lazyPage(() => import('./pages/Recommendations'));
const AboutUs = lazyPage(() => import('./pages/AboutUs'));
const Tickets = lazyPage(() => import('./pages/Tickets'));
const Installments = lazyPage(() => import('./pages/Installments'));

// Pages - Admin
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
const OperationsManagerDashboard = lazyPage(() => import('./pages/admin/OperationsManagerDashboard'));
const AdminProducts = lazyPage(() => import('./pages/admin/AdminProducts'));
const AdminCategories = lazyPage(() => import('./pages/admin/AdminCategories'));
const AdminOrders = lazyPage(() => import('./pages/admin/AdminOrders'));
const AdminUsers = lazyPage(() => import('./pages/admin/AdminUsers'));
const AdminUserDetails = lazyPage(() => import('./pages/admin/AdminUserDetails'));
const AdminTickets = lazyPage(() => import('./pages/admin/AdminTickets'));
const AdminComments = lazyPage(() => import('./pages/admin/AdminComments'));
const AdminFeedback = lazyPage(() => import('./pages/admin/AdminFeedback'));
const AdminDeliveries = lazyPage(() => import('./pages/admin/AdminDeliveries'));
const AdminDiscounts = lazyPage(() => import('./pages/admin/AdminDiscounts'));
const AdminPromotions = lazyPage(() => import('./pages/admin/AdminPromotions'));
const AdminInstallments = lazyPage(() => import('./pages/admin/AdminInstallments'));
const AdminPosAnalytics = lazyPage(() => import('./pages/admin/AdminPosAnalytics'));

// Pages - Support Manager
const SupportManagerDashboard = lazyPage(() => import('./pages/support-manager/SupportManagerDashboard'));
const SupportManagerComments = lazyPage(() => import('./pages/support-manager/SupportManagerComments'));

// Pages - Support Agent
const SupportAgentDashboard = lazyPage(() => import('./pages/support-agent/SupportAgentDashboard'));
const SupportAgentTickets = lazyPage(() => import('./pages/support-agent/SupportAgentTickets'));
const SupportAgentChats = lazyPage(() => import('./pages/support-agent/SupportAgentChats'));

// Pages - Driver
const DriverDashboard = lazyPage(() => import('./pages/driver/DriverDashboard'));
const DriverMap = lazyPage(() => import('./pages/driver/DriverMap'));
const DriverActiveJob = lazyPage(() => import('./pages/driver/DriverActiveJob'));
const DriverJobHistory = lazyPage(() => import('./pages/driver/DriverJobHistory'));

// Cashier / POS
const PosTerminal = lazyPage(() => import('./pages/cashier/PosTerminal'));

// Seller
const SellerDashboard = lazyPage(() => import('./pages/seller/SellerDashboard'));
const SellerProducts = lazyPage(() => import('./pages/seller/SellerProducts'));
const SellerOrders = lazyPage(() => import('./pages/seller/SellerOrders'));

// Warehouse Staff
const WarehouseStaffDashboard = lazyPage(() => import('./pages/warehouse-staff/WarehouseStaffDashboard'));
const WarehouseStaffOrders = lazyPage(() => import('./pages/warehouse-staff/WarehouseStaffOrders'));
const WarehouseStaffProducts = lazyPage(() => import('./pages/warehouse-staff/WarehouseStaffProducts'));

// Warehouse Manager
const WarehouseManagerDashboard = lazyPage(() => import('./pages/warehouse-manager/WarehouseManagerDashboard'));
const WarehouseInventory = lazyPage(() => import('./pages/warehouse-manager/WarehouseInventory'));
const WarehouseApprovals = lazyPage(() => import('./pages/warehouse-manager/WarehouseApprovals'));
const WarehouseIssues = lazyPage(() => import('./pages/warehouse-manager/WarehouseIssues'));

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function App() {
  const { i18n } = useTranslation();
  const activeLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isRtl = isRtlLanguage(activeLanguage);

  useEffect(() => {
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.body.classList.toggle('app-rtl', isRtl);
    document.body.classList.toggle('app-ltr', !isRtl);
  }, [activeLanguage, isRtl]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <ThemeProvider>
    <CurrencyProvider>
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
      <ConfirmProvider>
    <Router>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
      <Routes>

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:name" element={<ProductDetails />} />
          <Route path="about" element={<AboutUs />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="verify-email" element={<EmailVerification />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="verify-reset-code" element={<VerifyResetCode />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="profile" element={<Profile />} />
          <Route path="cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="installments" element={<ProtectedRoute><Installments /></ProtectedRoute>} />
          <Route path="tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
        </Route>
        <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="discounts" element={<AdminDiscounts />} />
                    <Route path="discounts/create" element={<AdminDiscounts />} />
                    <Route path="promotions" element={<AdminPromotions />} />
                    <Route path="promotions/create" element={<AdminPromotions />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="installments" element={<AdminInstallments />} />
                    <Route path="deliveries" element={<AdminDeliveries />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="users/:id" element={<AdminUserDetails />} />
                    <Route path="tickets" element={<AdminTickets />} />
                    <Route path="comments" element={<AdminComments />} />
                    <Route path="comments/product/:productId" element={<AdminComments />} />
                    <Route path="feedback" element={<AdminFeedback />} />
                    <Route path="pos-analytics" element={<AdminPosAnalytics />} />
                    <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/operations" element={<ProtectedRoute requireOperationsManager={true}><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<OperationsManagerDashboard />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="installments" element={<AdminInstallments />} />
                    <Route path="deliveries" element={<AdminDeliveries />} />
                    <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/support" element={<ProtectedRoute requireSupportManager={true}><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<SupportManagerDashboard />} />
                    <Route path="tickets" element={<AdminTickets />} />
                    <Route path="comments" element={<SupportManagerComments />} />
                    <Route path="feedback" element={<AdminFeedback />} />
                    <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/warehouse" element={<ProtectedRoute requireWarehouseManager={true}><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<WarehouseManagerDashboard />} />
                    <Route path="inventory" element={<WarehouseInventory />} />
                    <Route path="approvals" element={<WarehouseApprovals />} />
                    <Route path="issues" element={<WarehouseIssues />} />
                    <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/support-agent" element={<ProtectedRoute requireSupportAgent={true}><SupportAgentLayout /></ProtectedRoute>}>
                    <Route index element={<SupportAgentDashboard />} />
                    <Route path="tickets" element={<SupportAgentTickets />} />
                    <Route path="chats" element={<SupportAgentChats />} />
                    <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/driver" element={<ProtectedRoute requireDriver={true}><DriverLayout /></ProtectedRoute>}>
                    <Route index element={<DriverDashboard />} />
                    <Route path="map" element={<DriverMap />} />
                    <Route path="active" element={<DriverActiveJob />} />
                    <Route path="history" element={<DriverJobHistory />} />
                    <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/cashier" element={<ProtectedRoute requireCashier={true}><CashierLayout /></ProtectedRoute>}>
          <Route index element={<PosTerminal />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/seller" element={<ProtectedRoute requireSeller={true}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<SellerDashboard />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/warehouse-staff" element={<ProtectedRoute requireWarehouseStaff={true}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<WarehouseStaffDashboard />} />
          <Route path="products" element={<WarehouseStaffProducts />} />
          <Route path="orders" element={<WarehouseStaffOrders />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
      </Suspense>
      <ToastContainer
        position={isRtl ? 'top-left' : 'top-right'}
        autoClose={3000}
        rtl={isRtl}
      />
    </Router>
    </ConfirmProvider>
    </WishlistProvider>
    </CartProvider>
    </AuthProvider>
    </CurrencyProvider>
    </ThemeProvider>
    </GoogleOAuthProvider>);

}

export default App;
