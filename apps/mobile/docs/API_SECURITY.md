# API Security – Shopynn

Implemented measures and usage for securing API calls.

---

## Implemented

### 1. Secure token storage (Keychain)
- **`src/utils/secureStorage.js`** – Access and refresh tokens are stored in the OS keychain/Keystore via `react-native-keychain`.
- One-time migration from AsyncStorage to Keychain on first run.
- Fallback to AsyncStorage if Keychain is unavailable.
- **Usage:** Interceptors use `getAccessToken()` / `getRefreshToken()`; after login/refresh use `setTokens(accessToken, refreshToken)`; on logout use `clearTokens()`.

### 2. Refresh token flow
- **`src/interceptors.js`** – On 401 (except login/refresh), the app calls `POST /auth/refresh` with the stored refresh token, saves the new access token (and optional new refresh token) via `setTokens`, retries the failed request, and processes a queue of concurrent 401s so only one refresh runs.
- If refresh fails or there is no refresh token, tokens are cleared and “Session expired” is shown.
- **Backend:** Implement `POST /auth/refresh` accepting `refresh_token` and returning `access_token` (and optionally `refresh_token`). After real login, store both with `setTokens(response.access_token, response.refresh_token)`.

### 3. Request timeout and GET retries
- Default **timeout 30s** for all requests.
- **GET only:** Automatic retry with backoff (up to 2 retries, 1s then 2s delay) on network errors (`error.response === undefined`) and on 5xx responses.
- POST/PUT/DELETE are not retried to avoid duplicate operations.

### 4. Redux persist secret
- **`src/store/index.js`** – In dev uses `__test__`; in production uses `process.env.REDUX_PERSIST_SECRET` or a long default. Set `REDUX_PERSIST_SECRET` (e.g. via react-native-config) in production and never commit it.

### 5. Input validation and sanitization
- **`src/utils/apiValidation.js`** – Helpers: `sanitizeString`, `sanitizeNumber`, `sanitizeBody`, `requireNonEmpty`, `requireOneOf`. Use before sending user input in request bodies.
- **Example:** `category_form.js` uses `sanitizeBody(categoryData)` before the API payload.

### 6. Safe logging (no tokens)
- **`src/utils/safeLog.js`** – `safeLogRequest`, `safeLogResponse`, `stripSensitive` for dev-only logs. Strips Authorization, token, password, etc. Use these if you add request/response logging.

### 7. Android network security
- **`android/app/src/main/res/xml/network_security_config.xml`** – Base config with `cleartextTrafficPermitted="false"`.
- **AndroidManifest** – `android:networkSecurityConfig="@xml/network_security_config"` and `android:usesCleartextTraffic="false"` so production uses HTTPS only.

### 8. Certificate pinning (optional)
- **`src/utils/pinnedFetch.js`** – Optional wrapper. Install `react-native-ssl-pinning`, add your cert names or SHA256 hashes to `PINNED_CERTS`, then use `secureFetch(url, options)` for sensitive calls. Without the lib or certs, falls back to global fetch.

### 9. Login and token storage
- When switching from mock to real API in **`src/containers/auth/login.js`**, after a successful login response call `setTokens(access_token, refresh_token)` from `../../utils/secureStorage`.
- On logout, call `clearTokens()` so the next request does not send a stale token.

---

## Backend alignment

- Prefer short-lived access tokens (e.g. 15–60 min) and longer-lived refresh tokens.
- Enforce HTTPS and secure cookies; set CORS appropriately.
- Rate-limit auth and sensitive endpoints (e.g. per token or IP on API Gateway).

---

## Summary

| Area                 | Status   | Notes                                              |
|----------------------|----------|----------------------------------------------------|
| HTTPS                | Done     | BASE_API is HTTPS; Android disallows cleartext     |
| Bearer token         | Done     | From Keychain via secureStorage                   |
| Token refresh        | Done     | Queue + retry; backend must expose /auth/refresh   |
| Timeout              | Done     | 30s default                                       |
| GET retries          | Done     | 2 retries, exponential backoff                   |
| Redux secret         | Done     | Env or long default in prod                       |
| Input validation     | Done     | apiValidation + example in category_form          |
| Safe logging         | Done     | safeLog for dev-only logs                          |
| Certificate pinning  | Optional | pinnedFetch when react-native-ssl-pinning installed |

All API calls should go through the same axios instance (so interceptors apply) and must not log tokens or full request/response bodies in production.
