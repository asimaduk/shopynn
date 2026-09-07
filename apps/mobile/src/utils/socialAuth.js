/**
 * Social sign-in helpers (Google, Apple, Facebook).
 * Configure credentials in src/config/socialAuth.js and native projects.
 */
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import { LoginManager, AccessToken, Profile } from 'react-native-fbsdk-next';
import { GOOGLE_WEB_CLIENT_ID } from '../config/socialAuth';

const isGoogleConfigured = () =>
  GOOGLE_WEB_CLIENT_ID &&
  !GOOGLE_WEB_CLIENT_ID.startsWith('YOUR_');

let googleConfigured = false;

/**
 * Call once at app startup (e.g. in App.js or before first sign-in).
 */
export function configureSocialAuth() {
  if (isGoogleConfigured()) {
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
      googleConfigured = true;
    } catch (e) {
      // no-op if native module not linked
    }
  }
}

/**
 * Sign in with Google.
 * @returns {{ name: string, email: string, idToken?: string }} or throws
 */
export async function signInWithGoogle() {
  if (!isGoogleConfigured()) {
    throw new Error('Google Sign-In is not configured. Set GOOGLE_WEB_CLIENT_ID in src/config/socialAuth.js');
  }
  if (!googleConfigured) {
    configureSocialAuth();
  }

  const res = await GoogleSignin.signIn();
  if (res?.type !== 'success' || !res?.data?.user) {
    throw new Error(res?.data?.user ? 'Google sign-in was cancelled.' : 'Google sign-in failed.');
  }
  const user = res.data.user;
  const name = user.name || user.givenName && user.familyName
    ? [user.givenName, user.familyName].filter(Boolean).join(' ')
    : 'User';
  const email = user.email || `${user.id || 'user'}@google.social`;
  let idToken = null;
  try {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens?.idToken;
  } catch (_) {}
  return { name, email, idToken };
}

/**
 * Sign in with Apple (iOS only).
 * @returns {{ name: string, email: string }} or throws
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only available on iOS.');
  }
  if (!appleAuth.isSupported) {
    throw new Error('Sign in with Apple is not supported on this device.');
  }

  const { user, email, fullName } = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  const givenName = fullName?.givenName || '';
  const familyName = fullName?.familyName || '';
  const name = [givenName, familyName].filter(Boolean).join(' ') || 'Apple User';
  const emailOrPlaceholder = email || `${user || 'user'}@privaterelay.appleid.com`;
  return { name, email: emailOrPlaceholder };
}

/**
 * Sign in with Facebook.
 * @returns {{ name: string, email: string }} or throws
 */
export async function signInWithFacebook() {
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) {
    throw new Error('Facebook sign-in was cancelled.');
  }
  if (result.declinedPermissions?.includes?.('public_profile')) {
    throw new Error('Public profile permission is required.');
  }

  const token = await AccessToken.getCurrentAccessToken();
  if (!token) {
    throw new Error('Facebook sign-in failed.');
  }

  const profile = await Profile.getCurrentProfile();
  const name = profile?.name || 'Facebook User';
  const email = profile?.email || `${profile?.userID || 'user'}@facebook.social`;
  return { name, email };
}

/**
 * Whether Apple Sign In is available (iOS 13+).
 */
export function isAppleSignInAvailable() {
  return Platform.OS === 'ios' && appleAuth.isSupported;
}
