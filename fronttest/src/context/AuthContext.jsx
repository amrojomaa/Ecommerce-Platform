import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const fetchUserInfo = async () => {
    try {
      const response = await api.get('/users/me/information');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      return null;
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      
      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        
        // Refresh user info to get latest role if token exists
        if (storedToken) {
          try {
            const userInfo = await fetchUserInfo();
            if (userInfo) {
              const userData = {
                email: userInfo.email,
                name: userInfo.name,
                id: userInfo.id,
                role: userInfo.role,
              };
              localStorage.setItem('user', JSON.stringify(userData));
              setUser(userData);
            }
          } catch (error) {
            // If fetch fails, use stored user data
            console.error('Failed to refresh user info:', error);
          }
        }
      }
      setLoading(false);
    };
    
    loadUserData();
  }, []);

  const login = async (email, password) => {
    try {
      // FastAPI OAuth2PasswordRequestForm expects form data with username and password
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await api.post('/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const { access_token } = response.data;
      
      // Store token first
      localStorage.setItem('token', access_token);
      setToken(access_token);
      
      // Fetch full user information including role
      const userInfo = await fetchUserInfo();
      
      if (userInfo) {
        const userData = {
          email: userInfo.email,
          name: userInfo.name,
          id: userInfo.id,
          role: userInfo.role,
        };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      } else {
        // Fallback to minimal info if fetch fails
        const userData = { email };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      // FastAPI OAuth2PasswordRequestForm expects form data with username and password
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await api.post('/signup', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      // Signup doesn't return token, so we need to login after signup
      // Or we can just show success message and redirect to login
      // For now, let's auto-login after successful signup
      const loginResult = await login(email, password);
      
      if (loginResult.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Account created but login failed. Please try logging in.',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Registration failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    loading,
    refreshUserInfo: async () => {
      if (token) {
        const userInfo = await fetchUserInfo();
        if (userInfo) {
          const userData = {
            email: userInfo.email,
            name: userInfo.name,
            id: userInfo.id,
            role: userInfo.role,
          };
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        }
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
