import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ThemeProvider } from './context/ThemeContext';

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
import Tickets from './pages/Tickets';

//Pages - Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetails from './pages/admin/AdminUserDetails';
import AdminTickets from './pages/admin/AdminTickets';
import AdminComments from './pages/admin/AdminComments';

//Pages - Employee
import EmployeeLayout from './layouts/EmployeeLayout';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeTickets from './pages/employee/EmployeeTickets';

// Styles
import './styles/App.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
    <Router>
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
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
        </Route>
        <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="users/:id" element={<AdminUserDetails />} />
                    <Route path="tickets" element={<AdminTickets />} />
                    <Route path="comments" element={<AdminComments />} />
                    <Route path="comments/product/:productId" element={<AdminComments />} />
        </Route>
        <Route path="/employee" element={<ProtectedRoute requireEmployee={true}><EmployeeLayout /></ProtectedRoute>}>
                    <Route index element={<EmployeeDashboard />} />
                    <Route path="tickets" element={<EmployeeTickets />} />
        </Route>

        {/* <Route path="*" element={<Navigate to="/" />} /> */}

      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
    </WishlistProvider>
    </CartProvider>
    </AuthProvider>
    </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
// function App() {
//   return (
//     <ThemeProvider>
//       <AuthProvider>
//         <CartProvider>
//           <Router>
//             <div className="app">
//               <Routes>
//                   {/* Main Layout Routes */}
//                   <Route path="/" element={<MainLayout />}>
//                     <Route index element={<Home />} />
//                     <Route path="products" element={<Products />} />
//                     <Route path="products/:name" element={<ProductDetails />} />
//                     <Route
//                       path="cart"
//                       element={
//                         <ProtectedRoute>
//                           <Cart />
//                         </ProtectedRoute>
//                       }
//                     />
//                     <Route
//                       path="checkout"
//                       element={
//                         <ProtectedRoute>
//                           <Checkout />
//                         </ProtectedRoute>
//                       }
//                     />
//                     <Route path="login" element={<Login />} />
//                     <Route path="signup" element={<Signup />} />
//                     <Route
//                       path="orders"
//                       element={
//                         <ProtectedRoute>
//                           <Orders />
//                         </ProtectedRoute>
//                       }
//                     />
//                     <Route
//                       path="profile"
//                       element={
//                         <ProtectedRoute>
//                           <Profile />
//                         </ProtectedRoute>
//                       }
//                     />
//                   </Route>

//                   {/* Admin Layout Routes */}
//                   <Route
//                     path="/admin"
//                     element={
//                       <ProtectedRoute requireAdmin={true}>
//                         <AdminLayout />
//                       </ProtectedRoute>
//                     }
//                   >
//                     <Route index element={<AdminDashboard />} />
//                     <Route path="products" element={<AdminProducts />} />
//                     <Route path="categories" element={<AdminCategories />} />
//                     <Route path="orders" element={<AdminOrders />} />
//                   </Route>

//                   {/* 404 */}
//                   <Route path="*" element={<Navigate to="/" replace />} />
//                 </Routes>

//               <ToastContainer
//                 position="top-right"
//                 autoClose={3000}
//                 hideProgressBar={false}
//                 newestOnTop={false}
//                 closeOnClick
//                 rtl={false}
//                 pauseOnFocusLoss
//                 draggable
//                 pauseOnHover
//                 theme="dark"
//               />
//             </div>
//           </Router>
//         </CartProvider>
//       </AuthProvider>
//     </ThemeProvider>
//   );
// }

// export default App;

