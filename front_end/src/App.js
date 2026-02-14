import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';

// Layouts
import MainLayout from './layouts/MainLayout';
// import AdminLayout from './layouts/AdminLayout';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Pages - User
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Orders from './pages/Orders';
import Profile from './pages/Profile';

// Pages - Admin
// import AdminDashboard from './pages/admin/AdminDashboard';
// import AdminProducts from './pages/admin/AdminProducts';
// import AdminCategories from './pages/admin/AdminCategories';
// import AdminOrders from './pages/admin/AdminOrders';

// Styles
import './styles/App.css';

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
    <Router>
      <Routes>

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:name" element={<ProductDetails />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="profile" element={<Profile />} />
          <Route path="cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        </Route>
        

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
    </CartProvider>
    </AuthProvider>
    </ThemeProvider>
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

