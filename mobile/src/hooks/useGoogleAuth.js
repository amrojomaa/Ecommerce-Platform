import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_CLIENT_ID,
} from '../config/google';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({
  scheme: 'mobile',
  path: 'oauth',
});

/**
 * Google sign-in for Expo Go / native using expo-auth-session (no auth.expo.io proxy).
 */
export function useGoogleAuth({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (__DEV__) {
      console.log('[Google Auth] Native redirect URI:', redirectUri);
    }
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') {
        onError?.(response.error?.message || 'Google sign-in failed');
        setLoading(false);
      } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
        setLoading(false);
      }
      return;
    }

    const accessToken =
      response.authentication?.accessToken || response.params?.access_token;

    if (!accessToken) {
      onError?.('Google sign-in failed: no access token returned');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    (async () => {
      try {
        const result = await onSuccess?.(accessToken);
        if (active && result && result.success === false) {
          onError?.(result.error || 'Google sign-in failed');
        }
      } catch (err) {
        if (active) {
          onError?.(err.message || 'Google sign-in failed');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [response, onSuccess, onError]);

  const signInWithGoogle = useCallback(async () => {
    if (!request) {
      onError?.('Google sign-in is not ready yet. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type !== 'success') {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      onError?.(error.message || 'Google sign-in failed');
    }
  }, [request, promptAsync, onError]);

  return {
    signInWithGoogle,
    googleLoading: loading,
    googleReady: !!request,
  };
}
