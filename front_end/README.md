# E-Commerce Frontend

A premium, production-grade React e-commerce frontend connected to a FastAPI backend.

## Features

- 🛍️ **Full E-Commerce Functionality**
  - Product browsing with search, filters, and sorting
  - Product details with image gallery
  - Shopping cart with quantity management
  - Checkout process
  - Order history

- 👤 **User Management**
  - User authentication (Login/Signup)
  - User profile management
  - Protected routes
  - Role-based access control

- 🎨 **Admin Dashboard**
  - Product CRUD operations
  - Category management
  - Image upload support
  - Order management
  - Admin-only routes

- 🎭 **UI/UX Features**
  - Dark mode toggle
  - Toast notifications
  - Skeleton loading states
  - Smooth animations with Framer Motion
  - Responsive design (mobile/tablet/desktop)
  - Micro-interactions and transitions

## Tech Stack

- **React** 19.2.4 (JavaScript, no TypeScript)
- **React Router** 6.20.0 - Routing
- **Axios** 1.6.0 - HTTP client
- **Framer Motion** 10.16.4 - Animations
- **React Toastify** 9.1.3 - Notifications
- **Custom CSS** - No Tailwind or UI libraries

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── LoadingSpinner.js
│   ├── ProtectedRoute.js
│   └── Skeleton.js
├── config/             # Configuration files
│   └── api.js          # API endpoints configuration
├── context/            # React Context providers
│   ├── AuthContext.js
│   ├── CartContext.js
│   └── ThemeContext.js
├── hooks/              # Custom hooks
│   ├── useAuth.js
│   ├── useCart.js
│   └── useTheme.js
├── layouts/            # Layout components
│   ├── Navbar.js
│   ├── Footer.js
│   ├── Sidebar.js
│   ├── MainLayout.js
│   └── AdminLayout.js
├── pages/              # Page components
│   ├── Home.js
│   ├── Products.js
│   ├── ProductDetails.js
│   ├── Cart.js
│   ├── Checkout.js
│   ├── Login.js
│   ├── Signup.js
│   ├── Orders.js
│   ├── Profile.js
│   └── admin/
│       ├── AdminDashboard.js
│       ├── AdminProducts.js
│       ├── AdminCategories.js
│       └── AdminOrders.js
├── services/           # API services
│   └── http.js        # Axios instance with auth
├── styles/            # CSS files
│   ├── App.css
│   ├── components/
│   ├── layouts/
│   └── pages/
└── utils/             # Utility functions
    └── helpers.js
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd front_end
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `front_end` directory:

```bash
cp .env.example .env
```

Update `.env` with your FastAPI backend URL:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

### 3. Configure API Endpoints

All API endpoints are centralized in `src/config/api.js`. Update the endpoints to match your FastAPI backend routes if needed.

**Current API Endpoints:**
- Authentication: `/login`, `/signup`
- Products: `/products/all`, `/products/filter/user`, `/products/create`, etc.
- Cart: `/addtocart`, `/showmecart`, `/updatecart/{item_id}`, etc.
- Orders: `/checkout`
- Categories: `/Categories/all`, `/Categories/create`, etc.
- Users: `/users/me/information`, `/users/me`, etc.
- Images: `/image`

### 4. Start Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

## API Endpoint Configuration

### Where to Edit Endpoints

All API endpoints are defined in `src/config/api.js`. This file contains:

- `AUTH_ENDPOINTS` - Authentication routes
- `PRODUCT_ENDPOINTS` - Product CRUD operations
- `CART_ENDPOINTS` - Shopping cart operations
- `ORDER_ENDPOINTS` - Order management
- `CATEGORY_ENDPOINTS` - Category management
- `USER_ENDPOINTS` - User operations
- `IMAGE_ENDPOINTS` - Image upload

**Example:** To change the products endpoint:

```javascript
// src/config/api.js
export const PRODUCT_ENDPOINTS = {
  ALL: '/api/v1/products',  // Changed from '/products/all'
  // ... other endpoints
};
```

### HTTP Service Configuration

The Axios instance is configured in `src/services/http.js`:

- Automatically attaches JWT token from localStorage
- Handles 401 errors (redirects to login)
- Unified error handling

## Authentication Flow

1. User logs in via `/login` endpoint
2. JWT token is stored in `localStorage`
3. Token is automatically attached to all API requests
4. On 401 error, token is cleared and user is redirected to login

## Features in Detail

### Products Page
- Search functionality
- Category filter
- Price range filter
- Sorting (name, price low-to-high, price high-to-low)
- Pagination (not infinite scroll)
- Skeleton loading states

### Product Details
- Image gallery (supports multiple images)
- Add to cart with quantity selection
- Stock availability display
- Smooth animations

### Shopping Cart
- View cart items
- Update quantities
- Remove items
- View totals
- Persisted to backend (via API)

### Checkout
- Shipping information form
- Order summary
- Creates order via `/checkout` endpoint

### Admin Dashboard
- Product CRUD (Create, Read, Update, Delete)
- Category management
- Image upload (multiple images per product)
- Admin-only routes protected by role check

### Dark Mode
- Toggle in navbar
- Persists preference in localStorage
- Respects system preference on first visit

## Protected Routes

- `/cart` - Requires authentication
- `/checkout` - Requires authentication
- `/orders` - Requires authentication
- `/profile` - Requires authentication
- `/admin/*` - Requires admin role

## Notes

### Orders Endpoint
The orders listing endpoint (`/orders/my`) may need to be implemented in your FastAPI backend. Currently, the frontend shows a placeholder message.

### Image Handling
- Product images are served from `/images` endpoint
- Image upload uses `/image` endpoint
- Placeholder images are used when product images are not available

### Cart Persistence
- Cart is stored on the backend (not localStorage for authenticated users)
- Cart syncs with backend on login

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Troubleshooting

### CORS Issues
Ensure your FastAPI backend has CORS configured to allow requests from `http://localhost:3000`.

### Authentication Issues
- Check that JWT tokens are being stored in localStorage
- Verify token format matches backend expectations
- Check browser console for 401 errors

### API Connection Issues
- Verify `REACT_APP_API_BASE_URL` in `.env` matches your backend URL
- Check that FastAPI server is running
- Verify endpoints in `src/config/api.js` match your backend routes

## Customization

### Styling
All styles are in the `src/styles/` directory. The app uses CSS custom properties (variables) for theming, making it easy to customize colors.

### Animations
Animations use Framer Motion. Modify animation properties in component files.

### API Integration
To add new API endpoints:
1. Add endpoint to `src/config/api.js`
2. Create service function if needed
3. Use in components via `http` service

## License

This project is part of a FastAPI e-commerce application.
