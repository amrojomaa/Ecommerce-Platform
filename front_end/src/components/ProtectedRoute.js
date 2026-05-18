import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({
  children,
  requireAdmin = false,
  requireSupportAgent = false,
  requireDriver = false,
  requireCashier = false,
  requireSupportManager = false,
  requireWarehouseManager = false,
}) => {
  const {
    isAuthenticated,
    loading,
    isAdmin,
    isSupportAgent,
    isDriver,
    isCashier,
    isSupportManager,
    isWarehouseManager,
  } = useAuth();

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

  if (requireAdmin && isAdmin && typeof isAdmin === 'function' && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  if (requireSupportAgent && isSupportAgent && typeof isSupportAgent === 'function' && !isSupportAgent()) {
    return <Navigate to="/" replace />;
  }

  if (requireDriver && isDriver && typeof isDriver === 'function' && !isDriver()) {
    return <Navigate to="/" replace />;
  }

  if (requireCashier && isCashier && typeof isCashier === 'function' && !isCashier()) {
    return <Navigate to="/" replace />;
  }

  if (requireSupportManager && isSupportManager && typeof isSupportManager === 'function' && !isSupportManager()) {
    return <Navigate to="/" replace />;
  }

  if (requireWarehouseManager && isWarehouseManager && typeof isWarehouseManager === 'function' && !isWarehouseManager()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;

