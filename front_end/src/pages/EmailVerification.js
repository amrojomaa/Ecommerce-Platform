import { tUi } from "../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Auth.css';

const EmailVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail } = useAuth();

  // Get email and verification code from location state (passed from signup)
  const email = location.state?.email || '';
  const providedCode = location.state?.verification_code || null;

  const [verificationCode, setVerificationCode] = useState(
    providedCode ? providedCode.split('') : ['', '', '', '', '', '']
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    // Redirect if no email provided
    if (!email) {
      navigate('/signup');
      return;
    }

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    if (/^\d{6}$/.test(pastedData)) {
      const codeArray = pastedData.split('');
      setVerificationCode(codeArray);
      setError('');
      // Focus last input
      document.getElementById('code-5')?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const code = verificationCode.join('');

    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    const result = await verifyEmail(email, code);

    if (result.success) {
      toast.success(result.message || 'Email verified successfully!');
      navigate('/login');
    } else {
      setError(result.error || 'Verification failed. Please try again.');
      // Clear code on error
      setVerificationCode(['', '', '', '', '', '']);
      document.getElementById('code-0')?.focus();
    }

    setLoading(false);
  };

  if (!email) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="auth-page">
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}>
        
        <h1>{tUi("ui.pages.emailVerification.verifyYourEmail_372dab72dc")}</h1>
        {providedCode ?
        <>
            <p style={{ color: '#e67e22', marginBottom: '10px', fontWeight: 'bold' }}>{tUi("ui.pages.emailVerification.emailServiceNotConfigured_f1229624dd")}

          </p>
            <p>{tUi("ui.pages.emailVerification.useTheVerificationCodeBelow_367d5fb1fd")}</p>
            <p style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#3498db',
            marginBottom: '20px',
            letterSpacing: '0.5rem'
          }}>
              {providedCode}
            </p>
          </> :

        <>
            <p>{tUi("ui.pages.emailVerification.weVeSentA6_128266b80a")}</p>
            <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>{email}</p>
          </>
        }

        {timeLeft > 0 ?
        <p style={{ color: '#666', marginBottom: '30px' }}>{tUi("ui.pages.emailVerification.codeExpiresIn_8601755255")}
          <strong>{formatTime(timeLeft)}</strong>
          </p> :

        <p style={{ color: '#e74c3c', marginBottom: '30px' }}>{tUi("ui.pages.emailVerification.codeHasExpiredPleaseSign_5c4639499c")}

        </p>
        }

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="verification-code-container">
            {verificationCode.map((digit, index) =>
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              inputMode="numeric"
              maxLength="1"
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={`verification-input ${error ? 'error' : ''}`}
              disabled={loading || timeLeft === 0}
              autoFocus={index === 0} />

            )}
          </div>

          {error && <div className="error-message" style={{ marginTop: '15px' }}>{error}</div>}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="submit"
              className="auth-button"
              disabled={loading || timeLeft === 0 || verificationCode.join('').length !== 6}
              style={{ marginTop: '30px' }}>
              
              {loading ?
              <>
                  <LoadingSpinner size="small" />{tUi("ui.pages.emailVerification.verifying_3319180426")}

              </> : tUi("ui.pages.emailVerification.verifyEmail_f44f5e1195")


              }
            </button>
          </motion.div>
        </form>

        <p className="auth-link" style={{ marginTop: '20px' }}>{tUi("ui.pages.emailVerification.didnTReceiveTheCode_acb1a79a21")}
          {' '}
          <Link to="/signup" style={{ color: '#3498db' }}>{tUi("ui.pages.emailVerification.signUpAgain_63456b734d")}

          </Link>
        </p>
      </motion.div>
    </div>);

};

export default EmailVerification;
