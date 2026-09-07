# iOS release prep (Cheqstock / Shopynn)

Checklist before **TestFlight**, **Ad Hoc**, or **App Store** release. Complements [PRODUCTION_TEST_CHECKLIST.md](./PRODUCTION_TEST_CHECKLIST.md) and [ANDROID_RELEASE_SECURITY.md](./ANDROID_RELEASE_SECURITY.md).

**Last verified:** Release `iphoneos` build succeeded locally (`xcodebuild` scheme **IMSCheckr**, `CODE_SIGNING_ALLOWED=NO`).

---

## Summary

| Area | Status |
|------|--------|
| Release compile (native) | OK — builds with scheme `IMSCheckr` → target `CheqStock` |
| API URL in release JS | OK — `__DEV__` false → `PRODUCTION_TEST_API` (HTTPS) in `src/config/index.js` |
| App Transport Security | OK — `NSAllowsArbitraryLoads` = false |
| Code signing / team | Team `BX92C3QV2U` set; you still need **Distribution** cert + provisioning for Archive |
| Firebase push (FCM) | **Fix required** — bundle ID mismatch (see §2) |
| Google / Facebook sign-in | **Fix required** — placeholder IDs (see §3) |
| App Store metadata | Review display name, privacy strings, tracking (see §4) |

**Verdict:** Fine for **signed Ad Hoc / internal production-test** after fixing Firebase bundle ID and social placeholders (if those features are in scope). **Not ready for public App Store** until §2–§5 are addressed.

---

## 1. Build commands

```bash
cd apps/mobile/ios
pod install
open CheqStock.xcworkspace
```

In Xcode:

- Scheme: **IMSCheckr** (builds **CheqStock** app — consider renaming scheme to `CheqStock` for clarity)
- Configuration: **Release**
- Destination: Any iOS device (not simulator for Archive)
- **Product → Archive** (requires Apple Distribution profile)

CLI (compile only, no signing):

```bash
xcodebuild -workspace CheqStock.xcworkspace \
  -scheme IMSCheckr -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

JS bundle for release is embedded via `Bundle.main` → `main.jsbundle` (`AppDelegate.swift` `#else` branch). Run Release on device or Archive — do not rely on Metro for production-test.

---

## 2. Firebase — bundle ID mismatch (high priority)

| Source | Bundle ID |
|--------|-----------|
| Xcode `PRODUCT_BUNDLE_IDENTIFIER` | `com.shopynn` |
| `ios/GoogleService-Info.plist` → `BUNDLE_ID` | `com.cheqstock` |

Push notifications (`@react-native-firebase/messaging`) and other Firebase iOS features expect these to match.

**Fix (pick one):**

1. Register **`com.shopynn`** in Firebase Console → download new `GoogleService-Info.plist`, replace `ios/GoogleService-Info.plist`, or  
2. Change Xcode bundle ID to **`com.cheqstock`** everywhere (App ID, profiles, store listing) and keep the plist.

Then reinstall pods and rebuild.

---

## 3. Social login placeholders (high if used)

| File | Issue |
|------|--------|
| `ios/CheqStock/Info.plist` | `YOUR_FACEBOOK_APP_ID`, `YOUR_GOOGLE_WEB_CLIENT_ID`, `fbYOUR_FACEBOOK_APP_ID` URL schemes |
| `src/config/socialAuth.js` | Same placeholders for Google / Facebook |

Apple / Google / Facebook sign-in will fail until real credentials are set and URL schemes match the Firebase / developer consoles.

**Apple Sign-In:** dependency present (`@invertase/react-native-apple-authentication`); enable capability in Xcode if you ship it.

---

## 4. App Store / privacy

| Item | Location | Action |
|------|----------|--------|
| Display name | `CFBundleDisplayName` = **Shopynn** | Align with store listing |
| Location permission | `NSLocationWhenInUseUsageDescription` is **empty** | Remove usage or add a real string — empty may cause rejection if any SDK requests location |
| App Tracking | `NSUserTrackingUsageDescription` + ATT in `AppDelegate` | Required for Facebook; show only if you use tracking |
| Privacy manifest | `CheqStock/PrivacyInfo.xcprivacy` | Present; review when adding SDKs |
| Background modes | `fetch`, `processing` | Justify for App Review if claimed |
| Export compliance | App Store Connect | Typically “No” for HTTPS-only apps unless custom crypto |

---

## 5. Security parity (vs Android doc)

| Area | iOS status |
|------|------------|
| Jailbreak | `jail-monkey` in `deviceSecurity.js` — active on iOS |
| Tokens | `react-native-keychain` |
| Offline sensitive data | `secureOfflineStorage.js` (AES) |
| HTTPS for API | Release uses `PRODUCTION_TEST_API` |
| ATS arbitrary loads | Disabled |
| Local HTTP | `NSAllowsLocalNetworking` = **true** — allows LAN HTTP (e.g. receipt printer `LOCAL_PRINT_URL`); API still HTTPS in release |
| SSL pinning | `pinnedFetch.js` not wired to axios (same as Android) |
| Simulator block | Not implemented (`react-native-device-info` unused) |
| Release log noise | Several `console.log` calls **not** gated with `__DEV__` (e.g. `interceptors.js` logs every request URL) |

---

## 6. Versioning

| Field | Current |
|-------|---------|
| `MARKETING_VERSION` (Xcode) | 1.0 |
| `CURRENT_PROJECT_VERSION` | 1 |
| `config/index.js` → `VERSION_NUMBER` | 1 |

Bump **both** Xcode build number and `VERSION_NUMBER` for each tester build.

---

## 7. Pre-flight checklist

- [ ] `pod install` clean; open **`.xcworkspace`** (not `.xcodeproj`)
- [ ] Firebase `GoogleService-Info.plist` matches bundle ID `com.shopynn` (or update bundle ID to match plist)
- [ ] Replace social auth placeholders if Google/Facebook login is in test scope
- [ ] Confirm `PRODUCTION_TEST_API` in `config/index.js` points to deployed API
- [ ] Archive with **Release** + valid distribution signing
- [ ] Install on physical device; login, notifications, subscription, warehouse flows
- [ ] Confirm no Metro — app works offline from bundled JS
- [ ] Gate or remove release `console.log` (especially `interceptors.js` request URL log)

---

## 8. Optional improvements

- Rename shared scheme `IMSCheckr` → `CheqStock`
- Add `__DEV__` guard around `console.log('config url', …)` in `interceptors.js`
- Add Push Notifications + Background Modes capabilities in entitlements if FCM required
- TestFlight internal group before external testers
- App Store Connect: screenshots, privacy nutrition labels, support URL

---

## Related paths

- `apps/mobile/ios/CheqStock.xcodeproj/project.pbxproj` — signing, bundle ID, versions  
- `apps/mobile/ios/CheqStock/Info.plist` — permissions, ATS, URL schemes  
- `apps/mobile/ios/CheqStock/AppDelegate.swift` — bundle URL, Facebook, release JS bundle  
- `apps/mobile/src/config/index.js` — API base URL  
