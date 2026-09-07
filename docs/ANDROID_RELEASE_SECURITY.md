# Android release security (Cheqstock / Shopynn)

Reference for hardening the built APK: blocking emulator abuse, reducing API interception risk, and hardening the binary. Revisit before wide production-test or Play Store release.

**Related:** [PRODUCTION_TEST_CHECKLIST.md](./PRODUCTION_TEST_CHECKLIST.md) · [React Native signed APK](https://reactnative.dev/docs/signed-apk-android)

---

## What is already in the app

| Area | Location | Notes |
|------|----------|--------|
| Root / tamper hints | `jail-monkey` — `src/navigators/index.js`, `src/utils/deviceSecurity.js` | Can set `isBlocked` when jailbroken |
| Auth tokens | `src/utils/secureStorage.js` | Keychain / Keystore for access + refresh tokens |
| Offline cache encryption | `src/utils/secureOfflineStorage.js` | AES for persisted sensitive offline data |
| HTTPS default | `android/app/src/main/res/xml/network_security_config.xml` | Cleartext disabled in base config |
| Safe dev logging | `src/utils/safeLog.js`, `__DEV__` in `src/interceptors.js` | Avoid logging tokens in dev |
| SSL pinning stub | `src/utils/pinnedFetch.js` | Not wired to axios; `PINNED_CERTS` empty |
| Backup disabled | `AndroidManifest.xml` | `android:allowBackup="false"` |
| Hermes | `android/gradle.properties` | `hermesEnabled=true` |

### Known gaps (as of this doc)

- No explicit **emulator** check (`react-native-device-info` is installed but unused).
- **User-installed CAs** are trusted in `network_security_config` — allows Charles / mitmproxy on many devices.
- API calls use **axios** (`interceptors.js`), not `pinnedFetch`.
- **ProGuard/R8** off: `enableProguardInReleaseBuilds = false` in `android/app/build.gradle`.
- Release signing still uses **debug keystore** in `build.gradle` (OK for internal test only).
- Dev LAN / API hosts appear in `network_security_config` — should not ship in a strict release config.

### Realistic expectation

On a device or APK the attacker controls, you **cannot fully hide** API traffic or guarantee the app only runs on “safe” hardware. Use **layers**: client checks + TLS + pinning + server auth + (optionally) Play Integrity.

---

## 1. Block or limit emulator use

### Client-side (discourages casual abuse; bypassable with a patched APK)

1. **`react-native-device-info`** — on app launch (release only):

   ```javascript
   import DeviceInfo from 'react-native-device-info';

   const isEmulator = await DeviceInfo.isEmulator();
   if (isEmulator && !__DEV__) {
     // Block UI or show "Physical device required"
   }
   ```

2. **Extend `src/utils/deviceSecurity.js`** — combine emulator + existing jail-monkey checks; drive `isBlocked` in `src/navigators/index.js`.

3. **`JailMonkey.isDebuggedMode()`** — consider for **release** builds only (comment in `index.js` warns it is always true in dev).

4. **Play Integrity API** (strongest) — app obtains integrity token → **backend verifies** on login / sensitive actions. Use for production, not only JS checks.

### Policy suggestion

| Build | Emulator |
|-------|----------|
| Dev (`__DEV__`) | Allow |
| Internal QA | Optional flavor flag |
| Production-test / Play | Block or require Integrity |

---

## 2. Protect API calls from inspection (MitM / proxy)

### Transport

1. **HTTPS only** — `PRODUCTION_TEST_API` in `src/config/index.js` must use `https://` for release.

2. **Release network config — do not trust user CAs**

   In release, use system CAs only:

   ```xml
   <base-config cleartextTrafficPermitted="false">
       <trust-anchors>
           <certificates src="system" />
       </trust-anchors>
   </base-config>
   ```

   Keep user CAs + cleartext only in a **debug** overlay (Metro, LAN dev API).

3. **Remove dev domains from release** — e.g. `192.168.*`, `10.0.2.2` except in debug config.

4. **Certificate pinning**

   - Enable `src/utils/pinnedFetch.js` (`react-native-ssl-pinning`) with public key hashes for the API host (e.g. API Gateway / CloudFront).
   - Wire pinning into axios or OkHttp in `MainApplication` for release.
   - See comments in `pinnedFetch.js` for setup steps.

### App & secrets

5. **No API secrets in the APK** — public endpoints only; auth via short-lived JWT + refresh in Keychain.
6. **No request/response body logging in release** — keep `safeLog` behind `__DEV__`.
7. **Optional:** HMAC request signing (timestamp + nonce) for critical endpoints, verified server-side.

### Server-side (most important)

8. Rate limits, refresh rotation, permission/feature checks on every route (already partially in place).
9. **Play Integrity** attestation on login and high-risk actions.
10. Audit logs for admin / tenant-directory / payments.

---

## 3. Harden the APK binary

| Measure | Purpose | Where |
|---------|---------|--------|
| R8 / ProGuard | Obfuscate Java/Kotlin, shrink size | `android/app/build.gradle` → `minifyEnabled true` + keep rules for RN/Firebase |
| Release keystore | Real signing, Play requirement | Replace `debug.keystore` in `signingConfigs.release` |
| `debuggable false` | No attach debugger | Default for `release`; verify merged manifest |
| Hermes | Harder than plain JSC bundle | Already enabled |
| No public source maps | Less JS recovery | Do not distribute maps with tester APKs |
| `FLAG_SECURE` | Block screenshots on sensitive screens | Payment, PII screens (optional) |
| Startup security gate | Block rooted / emulator / debugged | `deviceSecurity.js` + `navigators/index.js` |

---

## Suggested implementation phases

### Phase A — Quick (1–2 days)

- [ ] Emulator block in release: `DeviceInfo.isEmulator()` + existing jail-monkey `isBlocked`.
- [ ] Split `network_security_config`: **release** = system CAs only; **debug** = user CAs + cleartext for Metro/LAN.
- [ ] Remove LAN / dev API domains from **release** network config.
- [ ] Enable **R8** for release; run full smoke test (sales, login, camera, notifications).
- [ ] Production release keystore (not debug).

### Phase B — Before wide production-test / Play

- [ ] SSL pinning for API host; integrate with axios or OkHttp.
- [ ] Play Integrity token on login; verify in `apps/api` (`@shopynn/api`).
- [ ] `isDebuggedMode()` in release only (with dev bypass).

### Phase C — Ongoing

- [ ] Server attestation for sensitive admin routes.
- [ ] `FLAG_SECURE` on payment / customer PII screens.
- [ ] Review `SUPER_ADMIN` and token scopes periodically.

---

## Quick reference: goal → tool

| Goal | Tools |
|------|--------|
| Discourage emulator | `DeviceInfo.isEmulator()` + jail-monkey + block in `index.js` |
| Strong fake-app / emulator resistance | **Play Integrity** + server verify |
| Stop casual HTTPS sniffing | Remove user CA trust + **certificate pinning** |
| Limit stolen token damage | Keychain + short JWT TTL + server permissions |
| Harder APK tampering | R8 + Integrity + server-side checks |

---

## Files to touch when implementing

| File | Change |
|------|--------|
| `src/utils/deviceSecurity.js` | Add emulator + debug checks |
| `src/navigators/index.js` | Block app when compromised |
| `android/app/src/main/res/xml/network_security_config.xml` | Release vs debug trust anchors |
| `android/app/src/debug/res/xml/` (new) | Debug-only cleartext / user CAs |
| `src/utils/pinnedFetch.js` | Set `PINNED_CERTS`, use from API layer |
| `src/interceptors.js` or native OkHttp | Pin HTTPS client |
| `android/app/build.gradle` | R8, release signing |
| `apps/api` (`@shopynn/api`) | Play Integrity verification endpoint |

---

## Emulator vs dev workflow

`jail-monkey` README notes emulators often appear rooted — you may need to **bypass** root/emulator checks only when `__DEV__` is true so daily development is not blocked.

---

*Last updated for Cheqstock production-test planning. Implement Phase A before distributing APKs outside the team.*
