import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    PermissionsAndroid,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AppModal from '../../components/app_modal';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import {
    findVoiceProductCandidates,
    getVoiceCatalogProducts,
    resolveVoiceLineItem,
} from '../../services/voicePosCatalog';
import {
    cancelWhisperModelDownload,
    createVoicePosRecorder,
    downloadWhisperVoiceModel,
    hasLegacyWhisperModel,
    transcribeWithWhisper,
    whisperModelFileExists,
} from '../../services/whisperVoicePos';
import { parseVoiceOrderTranscript } from '../../utils/voiceOrderParse';

const MAX_RECORD_MS = 20000;

async function ensureAndroidMicPermission() {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone',
        message: 'Allow microphone access to add sale items by voice (offline).',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * @typedef {{ id: string; rawItem: string; qty: number; candidates: { item: any; score: number }[]; selectedIdx: number | null }} VoiceLineRow
 */

export default function VoiceAddToSaleModal({ visible, onClose, onApply }) {
    const { colors } = useTheme();
    const [modelPhase, setModelPhase] = useState('checking');
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [downloadError, setDownloadError] = useState('');
    const [cacheCount, setCacheCount] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [lines, setLines] = useState(/** @type {VoiceLineRow[]} */ ([]));
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [devQuery, setDevQuery] = useState('');
    const [devHits, setDevHits] = useState(/** @type {any[]} */ ([]));
    const [legacyModelOnly, setLegacyModelOnly] = useState(false);

    const recorderRef = useRef(null);
    const isRecordingRef = useRef(false);
    const stopInFlightRef = useRef(false);
    const recordCapTimerRef = useRef(null);
    const recordStartedAtRef = useRef(0);
    const visibleRef = useRef(visible);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    const resetTranscriptState = useCallback(() => {
        setTranscript('');
        setLines([]);
        setRecording(false);
        isRecordingRef.current = false;
        setTranscribing(false);
        setParsing(false);
        setDevQuery('');
        setDevHits([]);
    }, []);

    const startModelDownload = useCallback(async () => {
        setDownloadError('');
        setDownloadPercent(0);
        setModelPhase('downloading');

        try {
            await downloadWhisperVoiceModel({
                onProgress: ({ percent }) => {
                    if (visibleRef.current) {
                        setDownloadPercent(percent);
                    }
                },
            });
            if (!visibleRef.current) return;
            setModelPhase('ready');
            setDownloadPercent(100);
        } catch (e) {
            if (!visibleRef.current) return;
            setDownloadError(String(e?.message || e || 'Download failed'));
            const net = await NetInfo.fetch();
            const online = net.isConnected === true && net.isInternetReachable !== false;
            setModelPhase(online ? 'error' : 'offline');
        }
    }, []);

    /** Check only — never starts a download without cashier action */
    const checkVoiceModel = useCallback(async () => {
        setModelPhase('checking');
        setDownloadError('');
        setDownloadPercent(0);

        if (await whisperModelFileExists()) {
            setLegacyModelOnly(false);
            setModelPhase('ready');
            return;
        }

        setLegacyModelOnly(await hasLegacyWhisperModel());

        const net = await NetInfo.fetch();
        const online = net.isConnected === true && net.isInternetReachable !== false;
        setModelPhase(online ? 'needs_download' : 'offline');
    }, []);

    const onCashierDownloadPress = useCallback(async () => {
        const net = await NetInfo.fetch();
        const online = net.isConnected === true && net.isInternetReachable !== false;
        if (!online) {
            Alert.alert(
                'No connection',
                'Connect to the internet to download the voice model (~150 MB, one time). You can still type your order below.',
            );
            setModelPhase('offline');
            return;
        }

        Alert.alert(
            'Download voice model?',
            'Hold-to-talk needs a one-time download (~150 MB, English). Wi‑Fi is recommended. After this, speech works offline.\n\nDownload now?',
            [
                { text: 'Not now', style: 'cancel' },
                { text: 'Download', onPress: () => startModelDownload() },
            ],
        );
    }, [startModelDownload]);

    useEffect(() => {
        if (!visible) {
            cancelWhisperModelDownload();
            return;
        }
        resetTranscriptState();
        checkVoiceModel();
        getVoiceCatalogProducts().then((list) => setCacheCount(Array.isArray(list) ? list.length : 0));

        return () => {
            cancelWhisperModelDownload();
        };
    }, [visible, resetTranscriptState, checkVoiceModel]);

    useEffect(() => {
        return () => {
            if (recordCapTimerRef.current) clearTimeout(recordCapTimerRef.current);
        };
    }, []);

    const stopRecordingSafe = useCallback(async () => {
        if (stopInFlightRef.current) return null;
        stopInFlightRef.current = true;
        isRecordingRef.current = false;
        if (recordCapTimerRef.current) {
            clearTimeout(recordCapTimerRef.current);
            recordCapTimerRef.current = null;
        }
        const rec = recorderRef.current;
        recorderRef.current = null;
        if (!rec) {
            stopInFlightRef.current = false;
            return null;
        }
        try {
            return await rec.stop();
        } catch (_) {
            return null;
        } finally {
            stopInFlightRef.current = false;
        }
    }, []);

    const applyTranscriptToLines = useCallback(async (text) => {
        const t = String(text || '').trim();
        if (!t) return;
        setParsing(true);
        try {
            const catalog = await getVoiceCatalogProducts();
            const parsed = parseVoiceOrderTranscript(t);
            if (!parsed.length) {
                setLines([]);
                return;
            }
            const next = [];
            for (let i = 0; i < parsed.length; i++) {
                const p = parsed[i];
                const candidates = await resolveVoiceLineItem(p.item, {
                    catalog,
                    fullTranscript: t,
                    limit: 5,
                });
                next.push({
                    id: `vl-${i}-${Date.now()}`,
                    rawItem: p.item,
                    qty: p.qty,
                    candidates,
                    selectedIdx: candidates.length > 0 ? 0 : -1,
                });
            }
            setLines(next);
        } finally {
            setParsing(false);
        }
    }, []);

    const runTranscribe = useCallback(async (uri) => {
        if (!uri) return;
        setTranscribing(true);
        try {
            const catalog = await getVoiceCatalogProducts();
            const text = await transcribeWithWhisper(uri, { catalog });
            setTranscript(text);
            if (text) {
                await applyTranscriptToLines(text);
            } else {
                setLines([]);
            }
        } catch (e) {
            const code = e?.code || e?.message;
            if (code === 'WHISPER_NO_MODEL' || String(e?.message || '').includes('WHISPER_NO_MODEL')) {
                checkVoiceModel();
                Alert.alert(
                    'Voice model',
                    'Download the voice model to use hold-to-talk, or type your order below.',
                );
            } else {
                Alert.alert('Transcription failed', String(e?.message || e || 'Unknown error'));
            }
        } finally {
            setTranscribing(false);
        }
    }, [applyTranscriptToLines, checkVoiceModel]);

    const voiceReady = modelPhase === 'ready';
    // Do not disable the button while recording — that blocks onPressOut and leaves native audio running.
    const holdStartDisabled = !voiceReady || transcribing || parsing;
    const onPressInRecord = useCallback(async () => {
        if (holdStartDisabled || isRecordingRef.current || recorderRef.current) return;
        const ok = await ensureAndroidMicPermission();
        if (!ok) {
            Alert.alert('Microphone', 'Microphone permission is required to record.');
            return;
        }
        const recorder = createVoicePosRecorder();
        if (!recorder) {
            Alert.alert('Recording', 'Could not start the audio recorder.');
            return;
        }
        recorderRef.current = recorder;
        recordStartedAtRef.current = Date.now();
        try {
            await recorderRef.current.start();
            isRecordingRef.current = true;
            setRecording(true);
            recordCapTimerRef.current = setTimeout(async () => {
                setRecording(false);
                const uri = await stopRecordingSafe();
                if (uri) await runTranscribe(uri);
            }, MAX_RECORD_MS);
        } catch (e) {
            Alert.alert('Recording failed', String(e?.message || e));
            isRecordingRef.current = false;
            setRecording(false);
            recorderRef.current = null;
        }
    }, [holdStartDisabled, runTranscribe, stopRecordingSafe]);

    const onPressOutRecord = useCallback(async () => {
        if (!isRecordingRef.current && !recorderRef.current) return;
        setRecording(false);
        const elapsed = Date.now() - recordStartedAtRef.current;
        const uri = await stopRecordingSafe();
        if (elapsed < 400) {
            return;
        }
        if (uri) await runTranscribe(uri);
    }, [runTranscribe, stopRecordingSafe]);

    useEffect(() => {
        if (!visible) {
            setRecording(false);
            stopRecordingSafe();
        }
    }, [visible, stopRecordingSafe]);

    const refreshLinesFromTranscript = useCallback(async () => {
        const t = String(transcript || '').trim();
        if (!t) {
            Alert.alert('Transcript', 'Enter or record what the customer asked for.');
            return;
        }
        const parsed = parseVoiceOrderTranscript(t);
        if (!parsed.length) {
            Alert.alert('Parse', 'Could not parse any line items. Try phrases like "3 water and bread".');
            setLines([]);
            return;
        }
        await applyTranscriptToLines(t);
    }, [applyTranscriptToLines, transcript]);

    const setLineSelection = useCallback((lineId, idx) => {
        setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, selectedIdx: idx } : l)));
    }, []);

    const handleApply = useCallback(() => {
        const unresolved = lines.filter((l) => l.selectedIdx === null);
        if (unresolved.length) {
            Alert.alert('Confirm matches', 'Pick a product or None for each line.');
            return;
        }
        const payload = [];
        for (const l of lines) {
            if (l.selectedIdx === -1) continue;
            const pick = l.candidates[l.selectedIdx];
            if (!pick?.item) continue;
            payload.push({ record: pick.item, qty: l.qty });
        }
        if (!payload.length) {
            Alert.alert('Nothing to add', 'All lines were skipped or had no matches.');
            return;
        }
        const ok = onApply(payload);
        if (ok) onClose();
    }, [lines, onApply, onClose]);

    const runDevMatch = useCallback(async () => {
        const q = devQuery.trim();
        if (!q) return;
        const hits = await findVoiceProductCandidates(q, 8);
        setDevHits(hits);
    }, [devQuery]);

    const renderModelBanner = () => {
        if (modelPhase === 'checking') {
            return (
                <View style={[styles.modelBanner, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <ActivityIndicator color={config.THEME_COLOR} />
                    <AppText label="Checking voice model…" fontSize={13} color={colors.textSecondary} style={styles.modelBannerText} />
                </View>
            );
        }

        if (modelPhase === 'downloading') {
            return (
                <View style={[styles.modelBanner, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <ActivityIndicator color={config.THEME_COLOR} />
                    <AppText
                        label={
                            downloadPercent > 0
                                ? `Downloading voice model… ${downloadPercent}%`
                                : 'Downloading voice model…'
                        }
                        fontSize={13}
                        color={colors.text}
                        style={styles.modelBannerText}
                    />
                    <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: config.THEME_COLOR,
                                    width: `${Math.max(downloadPercent, 4)}%`,
                                },
                            ]}
                        />
                    </View>
                    <AppText
                        label="One-time download (~150 MB). Stay on Wi‑Fi if possible."
                        fontSize={11}
                        color={colors.textTertiary}
                        style={{ marginTop: 8 }}
                    />
                </View>
            );
        }

        if (modelPhase === 'needs_download') {
            return (
                <View style={[styles.modelBanner, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <AppText
                        label={
                            legacyModelOnly
                                ? 'An improved voice model is available (~150 MB). Download for better product name recognition. Typing and Find products still work.'
                                : 'To use hold-to-talk, download the voice recognition model once (~150 MB, English). Typing your order and Find products works without it.'
                        }
                        fontSize={13}
                        color={colors.textSecondary}
                    />
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={onCashierDownloadPress}
                        style={[styles.downloadBtn, { backgroundColor: config.THEME_COLOR }]}>
                        <AppText label="Download voice model" variant={1} fontSize={14} color={colors.textInverse} />
                    </TouchableOpacity>
                </View>
            );
        }

        if (modelPhase === 'offline' || modelPhase === 'error') {
            return (
                <View style={[styles.modelBanner, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <AppText
                        label={
                            modelPhase === 'offline'
                                ? 'Hold-to-talk needs a one-time model download (~150 MB) when you are online. You can still type orders below.'
                                : downloadError || 'Could not download the voice model. You can still type orders below.'
                        }
                        fontSize={13}
                        color={colors.textSecondary}
                    />
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={onCashierDownloadPress}
                        style={[styles.downloadBtn, { backgroundColor: config.THEME_COLOR }]}>
                        <AppText
                            label={modelPhase === 'error' ? 'Try download again' : 'Download voice model'}
                            variant={1}
                            fontSize={14}
                            color={colors.textInverse}
                        />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <AppText label="Voice model ready" fontSize={12} color={colors.textSecondary} style={{ marginBottom: 10 }} />
        );
    };

    return (
        <AppModal visible={visible} title="Voice add" handleClose={onClose} onRequestClose={onClose}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
                {cacheCount < 1 ? (
                    <AppText
                        label="No cached products yet. Open product search while online once so the catalog is saved for offline matching."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 12 }}
                    />
                ) : (
                    <AppText label={`${cacheCount} products in offline cache`} fontSize={12} color={colors.textTertiary} style={{ marginBottom: 8 }} />
                )}

                {renderModelBanner()}

                <Pressable
                    onPressIn={onPressInRecord}
                    onPressOut={onPressOutRecord}
                    disabled={holdStartDisabled}
                    style={[
                        styles.holdBtn,
                        {
                            backgroundColor: recording ? config.THEME_COLOR : colors.surface,
                            borderColor: config.THEME_COLOR,
                            opacity: holdStartDisabled && !recording ? 0.5 : 1,
                        },
                    ]}>
                    {transcribing ? (
                        <ActivityIndicator color={recording ? colors.textInverse : config.THEME_COLOR} />
                    ) : (
                        <AppText
                            label={
                                !voiceReady
                                    ? 'Hold to talk (download model first)'
                                    : recording
                                      ? 'Recording… release to stop'
                                      : 'Hold to talk (max 20s)'
                            }
                            variant={1}
                            fontSize={15}
                            color={recording ? colors.textInverse : colors.text}
                            style={{ textAlign: 'center' }}
                        />
                    )}
                </Pressable>

                <AppText label="Transcript" fontSize={11} color={colors.textTertiary} style={{ marginTop: 14 }} />
                <TextInput
                    value={transcript}
                    onChangeText={setTranscript}
                    placeholder="e.g. 3 water and 2 bread"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    style={[
                        styles.transcript,
                        { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                    ]}
                />

                <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={parsing}
                    onPress={refreshLinesFromTranscript}
                    style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR, opacity: parsing ? 0.7 : 1 }]}>
                    {parsing ? <ActivityIndicator color="#fff" /> : <AppText label="Find products" variant={1} color={colors.textInverse} />}
                </TouchableOpacity>

                {lines.map((line) => (
                    <View key={line.id} style={[styles.lineCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <AppText label={`${line.qty} × ${line.rawItem}`} variant={1} fontSize={14} color={colors.text} />
                        {line.candidates.length === 0 ? (
                            <AppText label="No close matches — skipped" fontSize={12} color={colors.textTertiary} style={{ marginTop: 6 }} />
                        ) : (
                            <View style={{ marginTop: 8 }}>
                                {line.candidates.map((c, idx) => {
                                    const active = line.selectedIdx === idx;
                                    return (
                                        <TouchableOpacity
                                            key={`${line.id}-c-${c.item?.id ?? idx}`}
                                            activeOpacity={0.75}
                                            onPress={() => setLineSelection(line.id, idx)}
                                            style={[
                                                styles.candRow,
                                                { borderColor: active ? config.THEME_COLOR : colors.borderLight },
                                            ]}>
                                            <AppText label={c.item?.name || '—'} fontSize={13} color={colors.text} numberOfLines={2} />
                                            <AppText
                                                label={`SKU ${c.item?.sku || '—'} · ${(c.score ?? 0).toFixed(2)}`}
                                                fontSize={11}
                                                color={colors.textTertiary}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                                <TouchableOpacity
                                    activeOpacity={0.75}
                                    onPress={() => setLineSelection(line.id, -1)}
                                    style={[
                                        styles.candRow,
                                        { borderColor: line.selectedIdx === -1 ? config.THEME_COLOR : colors.borderLight },
                                    ]}>
                                    <AppText label="None (skip this line)" fontSize={13} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))}

                {lines.length > 0 ? (
                    <TouchableOpacity activeOpacity={0.85} onPress={handleApply} style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}>
                        <AppText label="Add to cart" variant={1} color={colors.textInverse} />
                    </TouchableOpacity>
                ) : null}

                {__DEV__ ? (
                    <View style={[styles.devBox, { borderColor: colors.border }]}>
                        <AppText label="Dev: test fuzzy match" fontSize={12} color={colors.textTertiary} />
                        <TextInput
                            value={devQuery}
                            onChangeText={setDevQuery}
                            placeholder="Product name query"
                            placeholderTextColor={colors.textTertiary}
                            style={[
                                styles.devInput,
                                { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                            ]}
                        />
                        <TouchableOpacity onPress={runDevMatch} style={[styles.secondaryBtn, { borderColor: config.THEME_COLOR }]}>
                            <AppText label="Search cache" fontSize={14} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                        {devHits.map((h, i) => (
                            <AppText
                                key={i}
                                label={`${h.item?.name} (score ${(h.score ?? 0).toFixed(3)})`}
                                fontSize={12}
                                color={colors.textSecondary}
                                style={{ marginTop: 4 }}
                            />
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </AppModal>
    );
}

const styles = StyleSheet.create({
    scroll: { maxHeight: 520 },
    scrollInner: { padding: 14, paddingBottom: 28 },
    modelBanner: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    modelBannerText: { marginTop: 8, textAlign: 'center' },
    progressTrack: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        marginTop: 10,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    downloadBtn: {
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    holdBtn: {
        borderWidth: 2,
        borderRadius: 12,
        paddingVertical: 18,
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    transcript: {
        minHeight: 88,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginTop: 6,
        fontSize: 15,
        textAlignVertical: 'top',
    },
    primaryBtn: {
        height: 48,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    lineCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginTop: 12,
    },
    candRow: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
    devBox: {
        marginTop: 20,
        padding: 10,
        borderWidth: 1,
        borderRadius: 10,
        borderStyle: 'dashed',
    },
    devInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        marginTop: 8,
        fontSize: 14,
    },
    secondaryBtn: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
});
