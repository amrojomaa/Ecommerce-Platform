import { useCallback, useState, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from '../config/google';

// Complete the auth session if redirected back to the app
WebBrowser.maybeCompleteAuthSession();

const getOAuthParam = (url, key) => {
  const search = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const queryValue = new URLSearchParams(search || '').get(key);
  const hashValue = new URLSearchParams(hash || '').get(key);
  return queryValue || hashValue;
};

/**
 * Hook for Google Authentication in Expo Go.
 * Uses WebBrowser to perform OAuth implicit flow and redirects back
 * to the app via custom scheme / deep link.
 */
export function useGoogleAuth({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const deepLinkUrl = Linking.useURL();
  const handledAccessTokenRef = useRef(null);

  const handleRedirectUrl = useCallback(
    async (url) => {
      if (!url) return;

      console.log('[Google Auth] Redirect URL received:', url);

      const accessToken = getOAuthParam(url, 'access_token');
      const error = getOAuthParam(url, 'error');

      if (error) {
        console.error('[Google Auth] Error from redirect:', error);
        onError?.(decodeURIComponent(error));
        setLoading(false);
        return;
      }

      if (accessToken) {
        if (handledAccessTokenRef.current === accessToken) {
          console.log('[Google Auth] Duplicate redirect ignored');
          return;
        }
        handledAccessTokenRef.current = accessToken;

        console.log('[Google Auth] Access token extracted successfully');
        setLoading(true);
        try {
          const result = await onSuccess?.(accessToken);
          if (result && result.success === false) {
            onError?.(result.error || 'Google sign-in failed');
          }
        } catch (err) {
          console.error('[Google Auth] Success callback error:', err);
          onError?.(err.message || 'Google sign-in failed');
        } finally {
          setLoading(false);
        }
      }
    },
    [onSuccess, onError]
  );

  // Monitor incoming deep links
  useEffect(() => {
    if (deepLinkUrl) {
      handleRedirectUrl(deepLinkUrl);
    }
  }, [deepLinkUrl, handleRedirectUrl]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    handledAccessTokenRef.current = null;
    try {
      // 1. Get the current Expo deep link (e.g. exp://192.168.1.8:8081/--/oauth)
      const expoRedirectUri = Linking.createURL('oauth');
      console.log('[Google Auth] Expo Redirect URI:', expoRedirectUri);

      console.log('[Google Auth] Google Redirect URI:', GOOGLE_REDIRECT_URI);

      // 2. Construct the Google OAuth authorization URL
      const scope = 'profile email';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${encodeURIComponent(expoRedirectUri)}`;

      const proxyStartUrl =
        `${GOOGLE_REDIRECT_URI}/start?` +
        `authUrl=${encodeURIComponent(authUrl)}` +
        `&returnUrl=${encodeURIComponent(expoRedirectUri)}`;

      console.log('[Google Auth] Opening auth browser session...');
      
      // 3. Open the Expo auth proxy. It will send the Google result back to expoRedirectUri.
      const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, expoRedirectUri);
      
      console.log('[Google Auth] Browser session ended:', result.type);

      if (result.type === 'success' && result.url) {
        await handleRedirectUrl(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // Small delay to allow the deepLinkUrl to capture before resetting loading
        setTimeout(() => {
          setLoading(false);
        }, 1200);
      }
    } catch (error) {
      console.error('[Google Auth] Error starting sign-in:', error);
      onError?.(error.message || 'Google sign-in failed');
      setLoading(false);
    }
  }, [handleRedirectUrl, onError]);

  return {
    signInWithGoogle,
    googleLoading: loading,
    googleReady: true,
  };
}
