/**
 * Offline Whisper STT for POS voice add (Shopynn).
 * Model is downloaded once to DocumentDirectoryPath (see docs/VOICE_POS_OFFLINE.md).
 */
import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { initWhisper } from 'whisper.rn';
import {
    createSound,
    AVLinearPCMBitDepthKeyIOSType,
} from 'react-native-nitro-sound';
import config from '../config';
import { buildCatalogWhisperPrompt } from './voicePosCatalog';

/** English base model — much more accurate than ggml-tiny.en for product names */
export const VOICE_WHISPER_MODEL_FILENAME = 'ggml-base.en.bin';

export const LEGACY_WHISPER_MODEL_FILENAME = 'ggml-tiny.en.bin';

/** whisper.rn file transcribe expects 16-bit PCM WAV */
const VOICE_RECORD_SAMPLE_RATE = 16000;

/** ggml-base.en.bin is ~148MB */
const WHISPER_MODEL_MIN_BYTES = 120 * 1024 * 1024;

const LEGACY_WHISPER_MODEL_MIN_BYTES = 30 * 1024 * 1024;

export const DEFAULT_WHISPER_MODEL_URL =
    config.VOICE_WHISPER_MODEL_URL ||
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';

let whisperContext = null;
let initInFlight = null;
let downloadInFlight = null;
let activeDownloadJobId = null;

export function getWhisperModelPath() {
    return `${RNFS.DocumentDirectoryPath}/${VOICE_WHISPER_MODEL_FILENAME}`;
}

function getLegacyWhisperModelPath() {
    return `${RNFS.DocumentDirectoryPath}/${LEGACY_WHISPER_MODEL_FILENAME}`;
}

function voicePosWavPath() {
    return `${RNFS.CachesDirectoryPath}/voice-pos-${Date.now()}.wav`;
}

function iosWhisperWavAudioSets() {
    return {
        AVFormatIDKeyIOS: 'lpcm',
        AVEncodingOptionIOS: 'lpcm',
        AVSampleRateKeyIOS: VOICE_RECORD_SAMPLE_RATE,
        AVNumberOfChannelsKeyIOS: 1,
        AVLinearPCMBitDepthKeyIOS: AVLinearPCMBitDepthKeyIOSType.bit16,
        AVLinearPCMIsBigEndianKeyIOS: false,
        AVLinearPCMIsFloatKeyIOS: false,
        AVLinearPCMIsNonInterleavedIOS: false,
        AudioSamplingRate: VOICE_RECORD_SAMPLE_RATE,
        AudioChannels: 1,
    };
}

export async function hasLegacyWhisperModel() {
    try {
        const path = getLegacyWhisperModelPath();
        if (!(await RNFS.exists(path))) return false;
        const stat = await RNFS.stat(path);
        return Number(stat.size) >= LEGACY_WHISPER_MODEL_MIN_BYTES;
    } catch {
        return false;
    }
}

export async function removeLegacyWhisperModel() {
    try {
        const path = getLegacyWhisperModelPath();
        if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
        }
    } catch (_) {
        // ignore
    }
}

export async function whisperModelFileExists() {
    try {
        const path = getWhisperModelPath();
        if (!(await RNFS.exists(path))) return false;
        const stat = await RNFS.stat(path);
        return Number(stat.size) >= WHISPER_MODEL_MIN_BYTES;
    } catch {
        return false;
    }
}

export function cancelWhisperModelDownload() {
    if (activeDownloadJobId != null) {
        try {
            RNFS.stopDownload(activeDownloadJobId);
        } catch (_) {
            // ignore
        }
        activeDownloadJobId = null;
    }
    downloadInFlight = null;
}

/**
 * @param {{ url?: string, onProgress?: (p: { bytesWritten: number, contentLength: number, percent: number }) => void }} [opts]
 */
export async function downloadWhisperVoiceModel(opts = {}) {
    if (await whisperModelFileExists()) {
        return { path: getWhisperModelPath(), alreadyExisted: true };
    }

    if (downloadInFlight) {
        return downloadInFlight;
    }

    const dest = getWhisperModelPath();
    const tmp = `${dest}.download`;
    const fromUrl = opts.url || DEFAULT_WHISPER_MODEL_URL;

    downloadInFlight = (async () => {
        try {
            if (await RNFS.exists(tmp)) {
                await RNFS.unlink(tmp);
            }

            const { jobId, promise } = RNFS.downloadFile({
                fromUrl,
                toFile: tmp,
                progressInterval: 300,
                progress: (res) => {
                    const contentLength = res.contentLength || 0;
                    const percent =
                        contentLength > 0
                            ? Math.min(100, Math.round((res.bytesWritten / contentLength) * 100))
                            : 0;
                    opts.onProgress?.({
                        bytesWritten: res.bytesWritten,
                        contentLength,
                        percent,
                    });
                },
            });
            activeDownloadJobId = jobId;

            const result = await promise;
            activeDownloadJobId = null;

            if (result.statusCode < 200 || result.statusCode >= 300) {
                throw new Error(`Download failed (HTTP ${result.statusCode})`);
            }

            const stat = await RNFS.stat(tmp);
            if (Number(stat.size) < WHISPER_MODEL_MIN_BYTES) {
                await RNFS.unlink(tmp).catch(() => {});
                throw new Error('Download incomplete. Connect to Wi‑Fi and try again.');
            }

            if (await RNFS.exists(dest)) {
                await RNFS.unlink(dest);
            }
            await RNFS.moveFile(tmp, dest);
            await removeLegacyWhisperModel();
            await releaseWhisperContext();

            return { path: dest, alreadyExisted: false };
        } catch (e) {
            await RNFS.unlink(tmp).catch(() => {});
            const err = e instanceof Error ? e : new Error(String(e?.message || e));
            err.code = err.code || 'WHISPER_DOWNLOAD_FAILED';
            throw err;
        } finally {
            downloadInFlight = null;
            activeDownloadJobId = null;
        }
    })();

    return downloadInFlight;
}

export async function getWhisperContext() {
    if (whisperContext) return whisperContext;
    if (initInFlight) return initInFlight;
    const path = getWhisperModelPath();
    if (!(await whisperModelFileExists())) {
        return null;
    }
    initInFlight = (async () => {
        try {
            const filePath = path.startsWith('file://') ? path : `file://${path}`;
            // CPU-only: Metal fails when transcription runs while app is backgrounded (e.g. alert/modal).
            whisperContext = await initWhisper({ filePath, useGpu: false });
            return whisperContext;
        } finally {
            initInFlight = null;
        }
    })();
    return initInFlight;
}

export async function releaseWhisperContext() {
    try {
        if (whisperContext) {
            await whisperContext.release();
        }
    } catch (_) {
        // ignore
    }
    whisperContext = null;
}

/**
 * @param {string} fileUri absolute file path from recorder
 * @param {{ catalog?: any[], prompt?: string }} [opts]
 * @returns {Promise<string>} transcript
 */
export async function transcribeWithWhisper(fileUri, opts = {}) {
    const ctx = await getWhisperContext();
    if (!ctx) {
        const err = new Error('WHISPER_NO_MODEL');
        err.code = 'WHISPER_NO_MODEL';
        throw err;
    }
    const path = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;
    const prompt =
        opts.prompt ||
        (Array.isArray(opts.catalog) && opts.catalog.length
            ? buildCatalogWhisperPrompt(opts.catalog)
            : undefined);

    const { promise } = ctx.transcribe(path, {
        language: 'en',
        maxThreads: 4,
        temperature: 0,
        ...(prompt ? { prompt } : {}),
    });
    const res = await promise;
    return String(res?.result || '').trim();
}

let iosVoiceSound = null;

function getIosVoiceSound() {
    if (!iosVoiceSound) {
        iosVoiceSound = createSound();
    }
    return iosVoiceSound;
}

function createIosVoicePosRecorder() {
    const ar = getIosVoiceSound();
    let recordPath = null;
    return {
        async start() {
            recordPath = voicePosWavPath();
            return ar.startRecorder(recordPath, iosWhisperWavAudioSets(), false);
        },
        async stop() {
            try {
                await ar.stopRecorder();
            } catch (_) {
                // still return path if file exists
            }
            if (recordPath && (await RNFS.exists(recordPath))) {
                return recordPath.startsWith('file://') ? recordPath : `file://${recordPath}`;
            }
            return null;
        },
    };
}

function createAndroidVoicePosRecorder() {
    const { VoicePosWavRecorder } = NativeModules;
    if (!VoicePosWavRecorder?.startRecording) {
        throw new Error('VoicePosWavRecorder native module is not available');
    }
    let recordPath = null;
    return {
        async start() {
            recordPath = voicePosWavPath();
            await VoicePosWavRecorder.startRecording(recordPath);
            return recordPath;
        },
        async stop() {
            const uri = await VoicePosWavRecorder.stopRecording();
            if (uri) return uri;
            if (recordPath) {
                return recordPath.startsWith('file://') ? recordPath : `file://${recordPath}`;
            }
            return null;
        },
    };
}

export function createVoicePosRecorder() {
    if (Platform.OS === 'android') {
        return createAndroidVoicePosRecorder();
    }
    return createIosVoicePosRecorder();
}
