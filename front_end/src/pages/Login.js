import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      console.log("LOGIN RESULT:", result);
  
      if (result?.success) {
        alert('Login successful');
        navigate('/');
      } else {
        alert(result?.error || 'Login failed');
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      alert("Something went wrong");
    }
  
    setLoading(false);
  };

  // try { 
  //   const result = await login(formData.email, formData.password); 
  //   console.log("LOGIN RESULT:", result); 
  //   if (result?.success) { 
  //     toast.success('Login successful'); 
  //     navigate('/'); } 
  //     else { 
  //       toast.error(result?.error || 'Login failed'); } } 
  //       catch (err) { 
  //         console.error("LOGIN ERROR:", err); 
  //         toast.error("Something went wrong"); } 
  //         setLoading(false); 
  //       };
  

  return (
    <div className="auth-page">
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>Login</h1>
        <p>Welcome back! Please login to your account.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
            />
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </motion.div>
        </form>

        <p className="auth-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
