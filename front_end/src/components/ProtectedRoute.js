import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, requireAdmin = false, requireEmployee = false, requireDriver = false }) => {
  const { isAuthenticated, loading, isAdmin, isEmployee, isDriver } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && typeof isAdmin === 'function' && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  if (requireEmployee && typeof isEmployee === 'function' && !isEmployee()) {
    return <Navigate to="/" replace />;
  }

  if (requireDriver && isDriver && typeof isDriver === 'function' && !isDriver()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;

