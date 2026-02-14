# E-Commerce Frontend

A production-ready E-commerce frontend built with React, featuring a modern UI and complete shopping cart functionality.

## Features

- 🛍️ **Product Browsing** - Browse products with filtering and search
- 🛒 **Shopping Cart** - Add, remove, and update cart items
- 🔐 **Authentication** - JWT-based login and registration
- 💳 **Checkout** - Complete checkout flow with shipping information
- 📱 **Responsive Design** - Fully responsive for desktop and mobile
- 🎨 **Modern UI** - Built with Tailwind CSS

## Tech Stack

- React 18
- React Router v6
- Axios
- Context API (Auth & Cart)
- Tailwind CSS
- Vite

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
 ├─ api/
 │   └─ axios.js          # Axios instance with interceptors
 ├─ components/
 │   ├─ Navbar.jsx        # Navigation bar
 │   ├─ ProductCard.jsx   # Product card component
 │   ├─ Loader.jsx        # Loading spinner
 │   └─ Footer.jsx        # Footer component
 ├─ context/
 │   ├─ AuthContext.jsx   # Authentication context
 │   └─ CartContext.jsx   # Shopping cart context
 ├─ pages/
 │   ├─ Home.jsx          # Home page
 │   ├─ Products.jsx      # Products listing page
 │   ├─ ProductDetails.jsx # Product details page
 │   ├─ Cart.jsx          # Shopping cart page
 │   ├─ Checkout.jsx      # Checkout page
 │   ├─ Login.jsx         # Login page
 │   └─ Register.jsx      # Registration page
 ├─ routes/
 │   └─ PrivateRoute.jsx  # Protected route component
 ├─ App.jsx               # Main app component
 └─ main.jsx              # Entry point
```

## API Integration

The app expects a REST API with the following endpoints:

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register

### Products
- `GET /api/products` - Get all products (supports query params: `category`, `search`, `min_price`, `max_price`, `featured`, `limit`)
- `GET /api/products/:id` - Get product by ID

### Categories
- `GET /api/categories` - Get all categories

### Orders
- `POST /api/orders` - Create new order

## Environment Variables

- `VITE_API_BASE_URL` - Base URL for the API (default: `http://localhost:8000/api`)

## Features in Detail

### Authentication
- JWT token stored in localStorage
- Automatic token attachment to API requests
- Protected routes for authenticated users
- Auto-logout on 401 responses

### Shopping Cart
- Persistent cart using localStorage
- Add/remove/update items
- Quantity management
- Cart total calculation

### Product Features
- Product listing with filters
- Category filtering
- Price range filtering
- Search functionality
- Product details with image gallery

## License

MIT
