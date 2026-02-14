import { Link } from 'react-router-dom';

const ProductCard = ({ product }) => {
  return (
    <Link
      to={`/products/${product.id}`}
      className="group bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 animate-fade-in"
    >
      <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200">
        <img
          src={product.image || 'https://via.placeholder.com/300x300?text=No+Image'}
          alt={product.name}
          className="h-64 w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">
            ${product.price?.toFixed(2)}
          </span>
          {product.inStock !== false && (
            <span className="text-xs text-green-600 font-medium">In Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
