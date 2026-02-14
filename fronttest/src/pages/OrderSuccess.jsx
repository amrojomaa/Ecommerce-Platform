import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const OrderSuccess = () => {
  const { orderId } = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Placed Successfully!</h1>
          <p className="text-gray-600 mb-2">
            Thank you for your purchase. Your order has been confirmed.
          </p>
          {orderId && orderId !== 'success' && (
            <p className="text-sm text-gray-500 mb-6">
              Order ID: <span className="font-mono">{orderId}</span>
            </p>
          )}
          <div className="space-y-3">
            <Link
              to="/products"
              className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Continue Shopping
            </Link>
            <Link
              to="/"
              className="block w-full px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
