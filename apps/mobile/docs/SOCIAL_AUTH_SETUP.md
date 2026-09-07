# Social Login Setup (Google, Apple, Facebook)

The app includes Google Sign-In, Sign in with Apple (iOS), and Facebook Login. To use them in development or production, add your own credentials as below.

## 1. Config (all platforms)

Edit **`src/config/socialAuth.js`** and replace placeholders:

- **GOOGLE_WEB_CLIENT_ID** – From [Google Cloud Console](https://console.cloud.google.com/) or Firebase → Project settings → Your apps → Web client (OAuth 2.0 Client ID), e.g. `123456789-xxx.apps.googleusercontent.com`
- **FACEBOOK_APP_ID** – From [Facebook for Developers](https://developers.facebook.com/) → Your app → Settings → Basic → App ID
- **FACEBOOK_CLIENT_TOKEN** – Same place → Settings → Basic → App Secret (or Client token if you use one)

## 2. Android

### Google

- Add **`google-services.json`** to `android/app/` (from Firebase Console → Project settings → Your Android app).
- The existing `com.google.gms.google-services` plugin in `android/app/build.gradle` will use it.

### Facebook

- In **`android/app/src/main/res/values/strings.xml`** replace:
  - `YOUR_FACEBOOK_APP_ID` with your numeric Facebook App ID
  - `YOUR_FACEBOOK_CLIENT_TOKEN` with your Facebook Client Token
- Add your **Android key hashes** in Facebook Developer Console → Your app → Settings → Basic → Key Hashes (use the same keystore as your build).

## 3. iOS

### Google

- Add **GoogleService-Info.plist** to the Xcode project (from Firebase Console).
- In **Info.plist**, under `CFBundleURLTypes`, replace the Google URL scheme with your **reversed client ID** from GoogleService-Info.plist (e.g. `com.googleusercontent.apps.123456789-xxxx`).

### Apple

- In Xcode, select the app target → **Signing & Capabilities** → **+ Capability** → **Sign in with Apple**.
- The **CheqStock.entitlements** file already includes the Sign in with Apple entitlement.

### Facebook

- In **Info.plist** set:
  - **FacebookAppID** – your numeric Facebook App ID
  - **FacebookClientToken** – your Facebook Client Token
- In **Info.plist** → **CFBundleURLTypes**, replace `fbYOUR_FACEBOOK_APP_ID` with `fb` + your App ID (e.g. `fb123456789`).
- **AppDelegate.swift** is already configured to initialize the Facebook SDK and handle the openURL callback.

## 4. Backend (optional)

For production, validate tokens on your backend:

- **Google**: verify the `idToken` from `signInWithGoogle()` (e.g. using Google’s token verification or your auth provider).
- **Apple**: verify the identity token from the Apple credential.
- **Facebook**: verify the access token with the Graph API or your auth provider.

Then issue your own session tokens and call `setTokens(accessToken, refreshToken)` from `src/utils/secureStorage` after successful validation.
