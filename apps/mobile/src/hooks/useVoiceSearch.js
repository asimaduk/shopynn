import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';

const LOG_TAG = '[useVoiceSearch]';

function logVoiceError(context, source) {
    const err = source?.error ?? source;
    const code = err?.code != null ? String(err.code) : '';
    const message = err?.message != null ? String(err.message) : '';
    const details = {
        context,
        platform: Platform.OS,
        code: code || '(none)',
        message: message || '(none)',
        error: err,
        event: source,
    };
    console.warn(LOG_TAG, details);
    if (source && source !== err) {
        console.warn(LOG_TAG, 'raw payload:', JSON.stringify(source, null, 2));
    }
    return details;
}

function messageFromVoiceError(source) {
    const { code, message } = logVoiceError('speech', source);
    const codeStr = code.toLowerCase();
    const msgStr = message.toLowerCase();

    if (codeStr === '7' || msgStr.includes('no match') || msgStr.includes('no speech')) {
        return 'No speech detected. Try again.';
    }
    if (
        codeStr === '9' ||
        codeStr === 'permission' ||
        msgStr.includes('permission') ||
        msgStr.includes('denied') ||
        msgStr.includes('not authorized')
    ) {
        return 'Microphone permission denied.';
    }
    if (codeStr === '6' || msgStr.includes('timeout') || msgStr.includes('timed out')) {
        return 'Listening timed out. Try again.';
    }
    if (codeStr === '8' || msgStr.includes('busy') || msgStr.includes('recognizer')) {
        return 'Speech recognition is busy. Wait a moment and try again.';
    }
    if (codeStr === '5' || msgStr.includes('client') || msgStr.includes('cancel')) {
        return 'Voice search was cancelled.';
    }
    if (message && message !== '(none)') {
        return `Voice input failed: ${message}`;
    }
    if (code && code !== '(none)') {
        return `Voice input failed (code ${code}). Try again.`;
    }
    return 'Voice input failed. Try again.';
}

async function ensureMicrophonePermission() {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone',
        message: 'Allow microphone access to search products by voice.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useVoiceSearch({ onResult, onError, locale = 'en-US' }) {
    const [listening, setListening] = useState(false);
    const [supported, setSupported] = useState(true);
    const onResultRef = useRef(onResult);
    const onErrorRef = useRef(onError);
    const userStoppedRef = useRef(false);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        let mounted = true;
        Voice.isAvailable()
            .then((available) => {
                if (mounted) setSupported(!!available);
            })
            .catch((e) => {
                logVoiceError('isAvailable', e);
                if (mounted) setSupported(false);
            });

        Voice.onSpeechResults = (event) => {
            const text = (event?.value && event.value[0]) || '';
            if (text.trim()) onResultRef.current(text.trim());
        };
        Voice.onSpeechError = (event) => {
            setListening(false);
            if (userStoppedRef.current) {
                logVoiceError('speech (ignored — stopped by user)', event);
                return;
            }
            const userMessage = messageFromVoiceError(event);
            onErrorRef.current?.(userMessage);
        };
        Voice.onSpeechEnd = () => setListening(false);

        return () => {
            mounted = false;
            Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
        };
    }, []);

    const stop = useCallback(async () => {
        userStoppedRef.current = true;
        try {
            await Voice.stop();
        } catch (e) {
            logVoiceError('stop', e);
            try {
                await Voice.cancel();
            } catch (cancelErr) {
                logVoiceError('cancel', cancelErr);
            }
        }
        setListening(false);
        setTimeout(() => {
            userStoppedRef.current = false;
        }, 400);
    }, []);

    const toggle = useCallback(async () => {
        if (!supported) {
            onErrorRef.current?.('Voice search is not available on this device.');
            return;
        }
        if (listening) {
            await stop();
            return;
        }
        const allowed = await ensureMicrophonePermission();
        if (!allowed) {
            console.warn(LOG_TAG, { context: 'permission', platform: Platform.OS, granted: false });
            onErrorRef.current?.('Microphone permission denied.');
            return;
        }
        try {
            setListening(true);
            await Voice.start(locale);
        } catch (e) {
            setListening(false);
            logVoiceError('start', e);
            const msg = e?.message ? `Could not start voice search: ${e.message}` : 'Could not start voice search.';
            onErrorRef.current?.(msg);
        }
    }, [listening, locale, stop, supported]);

    return { listening, supported, toggle, stop };
}
