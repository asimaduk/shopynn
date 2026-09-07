# Offline voice add (Cheqstock New Sale)

This feature adds **Voice add** on the New Sale screen: record speech (or type a phrase), parse line items with simple rules, fuzzy-match against the **cached product list**, then add confirmed lines to the cart. Matching and optional on-device STT work **without ims-web** for the voice→SKU path.

## Product cache (matching)

Fuzzy search reads the same AsyncStorage list as Search (`CHEQSTOCK_PRODUCTS_CACHE_V1`). Refresh happens when `products.list`, `products.byCategory`, or `products.get` succeeds online. Until then, use Search once while connected so the cache is populated.

## Whisper model (local STT)

The app uses **whisper.rn** with **ggml-base.en** (English) named:

`ggml-base.en.bin`

This is more accurate than the older `ggml-tiny.en` model for product names. Devices that still have only `ggml-tiny.en.bin` are prompted to download the base model (~150 MB).

### One-time download (cashier-initiated)

The first time hold-to-talk is needed, the modal explains that a **voice model** must be downloaded (~150 MB, English). The cashier taps **Download voice model**, confirms in a dialog, then sees **“Downloading voice model…”** with progress. The app does **not** download automatically. Later opens use the cached file unless it is removed.

- Default URL: `config.VOICE_WHISPER_MODEL_URL` in `src/config/index.js` (Hugging Face `whisper.cpp` `ggml-base.en.bin`). Point this at **your CDN** in production if you prefer not to depend on Hugging Face.
- Transcription uses a **catalog-aware prompt** (cached product names) and **temperature 0** for steadier decoding.
- Typed **Find products** works without the model; only speech-to-text requires the download.

### Manual install (optional, for QA)

Developers can still copy `ggml-base.en.bin` into the app container’s Documents folder via Xcode / Device File Explorer to skip the download during testing.

## Dev: test Fuse without voice

In **development** builds, the Voice add modal includes a **“Dev: test fuzzy match”** box to query the cache.

## Phase 2 (deferred)

**ims-web** New Sale with server-assisted STT/LLM, tenant-scoped catalog subsets, and audit logging is **out of scope** for this module; only the Cheqstock RN path is implemented here.

## Offline checkout

Voice add only stages **cart lines** using the same stock checks as manual adds. If completing a sale still requires network in your build, treat **full offline checkout** (pending sales queue, sync) as a separate product track unless you already ship it elsewhere.

## Recording format

**whisper.rn** file transcription only accepts **16-bit PCM WAV** (16 kHz mono). Hold-to-talk records that format on both platforms (iOS via `react-native-nitro-sound` linear PCM; Android via `VoicePosWavRecorder`). Do not point Whisper at `.m4a` / `.mp4` paths from the default recorder settings.

## Native notes

- Re-run **`pod install`** after adding `whisper.rn`.
- **iOS:** `react-native-nitro-sound` must pass linear-PCM keys when `AVFormatIDKeyIOS` is `lpcm` (patched in `node_modules` for voice POS). Re-apply after `npm install` if you wipe `node_modules`.
- **iOS:** If Xcode reports *Multiple commands produce … whisper.h*, the `ios/Podfile` `post_install` hook deduplicates duplicate `whisper-rn` xcframework headers automatically on each `pod install`.
- **iOS New Architecture:** `whisper.rn` must be listed in `react-native.config.js` `dependencies` so React Native codegen emits `RNWhisperSpec` (the package `exports` field hides `package.json` from the default dependency scan). After changing that file, run `cd ios && pod install` and clean-build in Xcode.
- Android release builds with ProGuard: keep rules for `com.rnwhisper.**` are in `android/app/proguard-rules.pro`.
- Metro includes **`bin`** in `assetExts` if you later bundle models via Metro (optional).
