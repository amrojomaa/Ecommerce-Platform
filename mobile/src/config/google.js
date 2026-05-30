/** Web OAuth client — used for Expo Go + auth.expo.io redirect flow */
export const GOOGLE_CLIENT_ID =
  '108100700042-4goa14cqd204qbs7lfphabs2pk8bfskl.apps.googleusercontent.com';

/** Native Android client — for EAS/dev builds only, not Expo Go browser OAuth */
export const GOOGLE_ANDROID_CLIENT_ID =
  '108100700042-vsat96sb064hvhav7i93n2jdhbi9bmku.apps.googleusercontent.com';

export const EXPO_OWNER = 'amrojomsa';
export const EXPO_SLUG = 'mobile';

/** Must match Authorized redirect URI on the Web OAuth client in Google Cloud */
export const GOOGLE_REDIRECT_URI = `https://auth.expo.io/@${EXPO_OWNER}/${EXPO_SLUG}`;
