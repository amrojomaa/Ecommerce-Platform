import React, { useEffect } from 'react';
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

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Pages - User
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import Login from './pages/Login';
import Signup from './pages/Signup';
import EmailVerification from './pages/EmailVerification';
import ForgotPassword from './pages/ForgotPassword';
import VerifyResetCode from './pages/VerifyResetCode';
import ResetPassword from './pages/ResetPassword';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Wishlist from './pages/Wishlist';
import Recommendations from './pages/Recommendations';
import Tickets from './pages/Tickets';
import Installments from './pages/Installments';

//Pages - Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetails from './pages/admin/AdminUserDetails';
import AdminTickets from './pages/admin/AdminTickets';
import AdminComments from './pages/admin/AdminComments';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminDeliveries from './pages/admin/AdminDeliveries';
import AdminDiscounts from './pages/admin/AdminDiscounts';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminInstallments from './pages/admin/AdminInstallments';
import AdminPosAnalytics from './pages/admin/AdminPosAnalytics';

//Pages - Support Manager
import SupportManagerDashboard from './pages/support-manager/SupportManagerDashboard';
import SupportManagerTickets from './pages/support-manager/SupportManagerTickets';
import SupportManagerComments from './pages/support-manager/SupportManagerComments';
import SupportManagerFeedback from './pages/support-manager/SupportManagerFeedback';

//Pages - Support Agent
import SupportAgentLayout from './layouts/SupportAgentLayout';
import SupportAgentDashboard from './pages/support-agent/SupportAgentDashboard';
import SupportAgentTickets from './pages/support-agent/SupportAgentTickets';
import SupportAgentChats from './pages/support-agent/SupportAgentChats';

//Pages - Driver
import DriverLayout from './layouts/DriverLayout';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverMap from './pages/driver/DriverMap';
import DriverActiveJob from './pages/driver/DriverActiveJob';
import DriverJobHistory from './pages/driver/DriverJobHistory';
import DriverEarnings from './pages/driver/DriverEarnings';

// Cashier / POS
import CashierLayout from './layouts/CashierLayout';
import PosTerminal from './pages/cashier/PosTerminal';

// Seller
import SellerLayout from './layouts/SellerLayout';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';

// Warehouse Staff
import WarehouseStaffLayout from './layouts/WarehouseStaffLayout';
import WarehouseStaffDashboard from './pages/warehouse-staff/WarehouseStaffDashboard';
import WarehouseStaffOrders from './pages/warehouse-staff/WarehouseStaffOrders';

// Warehouse Manager
import WarehouseManagerDashboard from './pages/warehouse-manager/WarehouseManagerDashboard';
import WarehouseInventory from './pages/warehouse-manager/WarehouseInventory';
import WarehouseApprovals from './pages/warehouse-manager/WarehouseApprovals';
import WarehouseIssues from './pages/warehouse-manager/WarehouseIssues';

// Styles
import './styles/App.css';
import { isRtlLanguage, normalizeLanguageCode } from './i18n/constants';

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
      <Routes>

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:name" element={<ProductDetails />} />
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
        <Route path="/support" element={<ProtectedRoute requireSupportManager={true}><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<SupportManagerDashboard />} />
                    <Route path="tickets" element={<SupportManagerTickets />} />
                    <Route path="comments" element={<SupportManagerComments />} />
                    <Route path="feedback" element={<SupportManagerFeedback />} />
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
                    <Route path="earnings" element={<DriverEarnings />} />
                    <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/cashier" element={<ProtectedRoute requireCashier={true}><CashierLayout /></ProtectedRoute>}>
          <Route index element={<PosTerminal />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/seller" element={<ProtectedRoute requireSeller={true}><SellerLayout /></ProtectedRoute>}>
          <Route index element={<SellerDashboard />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="promotions" element={<AdminPromotions />} />
          <Route path="promotions/create" element={<AdminPromotions />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/warehouse-staff" element={<ProtectedRoute requireWarehouseStaff={true}><WarehouseStaffLayout /></ProtectedRoute>}>
          <Route index element={<WarehouseStaffDashboard />} />
          <Route path="orders" element={<WarehouseStaffOrders />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
      <ToastContainer
                      position={isRtl ? "top-left" : "top-right"}
                      autoClose={3000}
                      rtl={isRtl}
                      style={{ top: '85px' }} />
                    
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
