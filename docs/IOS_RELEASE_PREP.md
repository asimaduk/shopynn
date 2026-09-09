# iOS release prep (Shopynn)

Checklist before **TestFlight**, **Ad Hoc**, or **App Store** release. Complements [PRODUCTION_TEST_CHECKLIST.md](./PRODUCTION_TEST_CHECKLIST.md) and [ANDROID_RELEASE_SECURITY.md](./ANDROID_RELEASE_SECURITY.md).

**Last verified:** Native project renamed to **Shopynn** (scheme / target / workspace). Re-run a Release `iphoneos` build after `pod install` before shipping.

---

## Summary

| Area | Status |
|------|--------|
| Release compile (native) | Scheme `Shopynn` → target `Shopynn` → `Shopynn.app` |
| API URL in release JS | OK — `__DEV__` false → Railway / production HTTPS in `src/config/index.js` |
| App Transport Security | OK — `NSAllowsArbitraryLoads` = false |
| Code signing / team | Team `BX92C3QV2U` set; you still need **Distribution** cert + provisioning for Archive |
| Firebase push (FCM) | **Fix required** — replace configs for `com.shopynn` (see §2) |
| Google / Facebook sign-in | **Fix required** — placeholder IDs (see §3) |
| App Store metadata | Review display name, privacy strings, tracking (see §4) |

**Verdict:** Fine for **signed Ad Hoc / internal production-test** after fixing Firebase configs and social placeholders (if those features are in scope). **Not ready for public App Store** until §2–§5 are addressed.

---

## 1. Build commands

```bash
cd apps/mobile/ios
pod install
open Shopynn.xcworkspace
```

In Xcode:

- Scheme: **Shopynn**
- Configuration: **Release**
- Destination: Any iOS device (not simulator for Archive)
- **Product → Archive** (requires Apple Distribution profile)

CLI (compile only, no signing):

```bash
xcodebuild -workspace Shopynn.xcworkspace \
  -scheme Shopynn -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

JS bundle for release is embedded via `Bundle.main` → `main.jsbundle` (`AppDelegate.swift` `#else` branch). Run Release on device or Archive — do not rely on Metro for production-test.

---

## 2. Firebase — register `com.shopynn` (high priority)

| Source | Bundle / package ID |
|--------|---------------------|
| Xcode `PRODUCT_BUNDLE_IDENTIFIER` | `com.shopynn` |
| Android `applicationId` | `com.shopynn` |
| Current `GoogleService-Info.plist` / `google-services.json` | still legacy `com.cheqstock` until replaced |

Push notifications (`@react-native-firebase/messaging`) and other Firebase features expect Console apps to match.

**Fix:**

1. Firebase Console → add **iOS** and **Android** apps for **`com.shopynn`**
2. Download and replace:
   - `apps/mobile/ios/GoogleService-Info.plist`
   - `apps/mobile/android/app/google-services.json`
3. Rebuild (do not only rewrite `BUNDLE_ID` / `package_name` in the old files)

---

## 3. Social login placeholders (high if used)

| File | Issue |
|------|--------|
| `ios/Shopynn/Info.plist` | `YOUR_FACEBOOK_APP_ID`, `YOUR_GOOGLE_WEB_CLIENT_ID`, `fbYOUR_FACEBOOK_APP_ID` URL schemes |
| `src/config/socialAuth.js` | Same placeholders for Google / Facebook |

Apple / Google / Facebook sign-in will fail until real credentials are set and URL schemes match the Firebase / developer consoles.

**Apple Sign-In:** dependency present (`@invertase/react-native-apple-authentication`); enable capability in Xcode if you ship it.

---

## 4. App Store / privacy metadata

| Item | Path | Notes |
|------|------|--------|
| Display name | `INFOPLIST_KEY_CFBundleDisplayName` / Info.plist | Shopynn |
| Privacy manifest | `Shopynn/PrivacyInfo.xcprivacy` | Present; review when adding SDKs |
| Usage descriptions | Info.plist | Camera, mic, photo library, Face ID, etc. |

---

## 5. Versioning

Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode (or `agvtool`) for each TestFlight / store build. Keep `src/config/index.js` `VERSION_NUMBER` in sync with the force-update API.

---

## Key paths

- `apps/mobile/ios/Shopynn.xcodeproj/project.pbxproj` — signing, bundle ID, versions
- `apps/mobile/ios/Shopynn/Info.plist` — permissions, ATS, URL schemes
- `apps/mobile/ios/Shopynn/AppDelegate.swift` — bundle URL, Facebook, release JS bundle
- `apps/mobile/src/config/index.js` — API base URL for release builds
