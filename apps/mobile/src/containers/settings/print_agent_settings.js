import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useDispatch, useSelector } from 'react-redux';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { setPrintAgent } from '../../store/actions/appSettings';
import {
    DEFAULT_PRINT_AGENT_HOST,
    DEFAULT_PRINT_AGENT_PORT,
    getPrintAgentHealthUrl,
    getPrintAgentPairUrl,
    normalizePrintAgentHost,
    normalizePrintAgentKey,
    normalizePrintAgentPort,
    printAgentHeaders,
    readPrintAgentResponse,
} from '../../utils/printAgent';
import AppAlert from '../../utils/appAlert';

const PrintAgentSettings = ({ navigation }) => {
    const dispatch = useDispatch();
    const { colors } = useTheme();
    const appSettings = useSelector((s) => s.appSettings) || {};
    const [host, setHost] = useState(appSettings.printAgentHost || DEFAULT_PRINT_AGENT_HOST);
    const [port, setPort] = useState(String(appSettings.printAgentPort ?? DEFAULT_PRINT_AGENT_PORT));
    const [key, setKey] = useState(appSettings.printAgentKey || '');
    const [testing, setTesting] = useState(false);
    const [pairing, setPairing] = useState(false);

    useEffect(() => {
        setHost(appSettings.printAgentHost || DEFAULT_PRINT_AGENT_HOST);
        setPort(String(appSettings.printAgentPort ?? DEFAULT_PRINT_AGENT_PORT));
        setKey(appSettings.printAgentKey || '');
    }, [appSettings.printAgentHost, appSettings.printAgentPort, appSettings.printAgentKey]);

    const buildDraft = () => ({
        printAgentHost: normalizePrintAgentHost(host),
        printAgentPort: normalizePrintAgentPort(port),
        printAgentKey: normalizePrintAgentKey(key),
    });

    const save = () => {
        const normalizedHost = normalizePrintAgentHost(host);
        if (!normalizedHost) {
            AppAlert.alert('Host required', 'Enter the LAN IP of the computer running Shopynn Print.');
            return;
        }
        dispatch(
            setPrintAgent({
                host: normalizedHost,
                port: normalizePrintAgentPort(port),
                key,
            }),
        );
        AppAlert.alert('Saved', 'Print agent settings updated.');
    };

    const testConnection = async () => {
        const draft = buildDraft();
        if (!draft.printAgentHost) {
            AppAlert.alert('Host required', 'Enter the LAN IP of the computer running Shopynn Print.');
            return;
        }
        const url = getPrintAgentHealthUrl(draft);
        setTesting(true);
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = setTimeout(() => controller?.abort?.(), 5000);
            const res = await fetch(url, { method: 'GET', headers: printAgentHeaders(draft), signal: controller?.signal });
            clearTimeout(timer);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                AppAlert.alert('Not reachable', data.message || `HTTP ${res.status}`);
                return;
            }
            const printer = data.printer_connected ? 'Printer detected' : 'Agent OK — no USB printer detected yet';
            if (data.pairing_required && data.key_valid !== true) {
                AppAlert.alert(
                    'Pairing code needed',
                    data.key_valid === false
                        ? `${printer}, but the pairing code is wrong. Tap “Print pairing code” and enter the code from the receipt.`
                        : `${printer}. Tap “Print pairing code” and enter the code from the receipt.`,
                );
                return;
            }
            AppAlert.alert('Connected', `${printer}\n${url.replace('/health', '')}`);
        } catch (err) {
            AppAlert.alert(
                'Not reachable',
                err?.name === 'AbortError'
                    ? 'Timed out. Check Wi‑Fi, firewall, and that Shopynn Print is running.'
                    : err?.message || 'Could not reach the print agent.',
            );
        } finally {
            setTesting(false);
        }
    };

    const printPairingCode = async () => {
        const draft = buildDraft();
        if (!draft.printAgentHost) {
            AppAlert.alert('Host required', 'Enter the LAN IP of the computer running Shopynn Print.');
            return;
        }
        setPairing(true);
        try {
            const res = await fetch(getPrintAgentPairUrl(draft), { method: 'POST' });
            const { ok, data } = await readPrintAgentResponse(res);
            AppAlert.alert(ok ? 'Check the printer' : 'Could not print code', data?.message || '');
        } catch (err) {
            AppAlert.alert('Not reachable', err?.message || 'Could not reach the print agent.');
        } finally {
            setPairing(false);
        }
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Print agent" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText
                        label="Computer running Shopynn Print"
                        variant={1}
                        fontSize={14}
                        color={colors.text}
                        style={styles.label}
                    />
                    <AppText
                        label="Enter that PC’s LAN IP (USB printer is plugged into it). Not a network printer address."
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginBottom: 10 }}
                    />
                    <AppText label="Host / IP" fontSize={12} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                    <TextInput
                        placeholder="192.168.1.20"
                        placeholderTextColor={colors.textTertiary}
                        value={host}
                        onChangeText={setHost}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="default"
                        style={[
                            styles.input,
                            { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                        ]}
                    />
                    <AppText label="Port" fontSize={12} color={colors.textSecondary} style={{ marginTop: 12, marginBottom: 6 }} />
                    <TextInput
                        placeholder="3001"
                        placeholderTextColor={colors.textTertiary}
                        value={port}
                        onChangeText={(t) => setPort(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        style={[
                            styles.input,
                            { borderColor: colors.border, color: colors.text, backgroundColor: colors.background, width: 120 },
                        ]}
                    />
                    <AppText label="Pairing code" fontSize={12} color={colors.textSecondary} style={{ marginTop: 12, marginBottom: 6 }} />
                    <TextInput
                        placeholder="ABCDE-FGH23"
                        placeholderTextColor={colors.textTertiary}
                        value={key}
                        onChangeText={setKey}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        secureTextEntry
                        style={[
                            styles.input,
                            { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                        ]}
                    />
                    <AppText
                        label="Tap “Print pairing code” to print it on the receipt printer, then type it here."
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginTop: 6 }}
                    />
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={printPairingCode}
                    disabled={pairing}
                    style={[styles.secondaryBtn, { borderColor: config.THEME_COLOR }]}
                >
                    {pairing ? (
                        <ActivityIndicator color={config.THEME_COLOR} />
                    ) : (
                        <Lucide name="printer" color={config.THEME_COLOR} size={18} />
                    )}
                    <AppText
                        label={pairing ? 'Printing…' : 'Print pairing code'}
                        variant={1}
                        color={config.THEME_COLOR}
                        fontSize={15}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={testConnection}
                    disabled={testing}
                    style={[styles.secondaryBtn, { borderColor: config.THEME_COLOR }]}
                >
                    {testing ? (
                        <ActivityIndicator color={config.THEME_COLOR} />
                    ) : (
                        <Lucide name="wifi" color={config.THEME_COLOR} size={18} />
                    )}
                    <AppText
                        label={testing ? 'Testing…' : 'Test connection'}
                        variant={1}
                        color={config.THEME_COLOR}
                        fontSize={15}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.8} onPress={save} style={[styles.saveBtn, { backgroundColor: config.THEME_COLOR }]}>
                    <Lucide name="check" color="#fff" size={20} />
                    <AppText label="Save" variant={1} color="#fff" fontSize={16} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { padding: 16, borderRadius: 10, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
    label: { marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderRadius: 999,
        height: 48,
        marginBottom: 10,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        height: 50,
    },
});

export default PrintAgentSettings;
