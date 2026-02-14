import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loader />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
