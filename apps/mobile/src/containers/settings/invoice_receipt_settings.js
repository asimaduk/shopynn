import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useDispatch, useSelector } from 'react-redux';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import {
    setInvoicePrefix,
    setInvoiceNext,
    setInvoiceRegisterCode,
    setReceiptCompanyName,
    setPrintAgent,
} from '../../store/actions/appSettings';
import { buildInvoiceNumberFromSettings, normalizeInvoiceRegisterCode } from '../../utils/invoiceNumbering';
import {
    DEFAULT_PRINT_AGENT_HOST,
    DEFAULT_PRINT_AGENT_PORT,
    getPrintAgentHealthUrl,
    getPrintAgentPrintUrl,
    normalizePrintAgentHost,
    normalizePrintAgentPort,
} from '../../utils/printAgent';
import { users as usersApi } from '../../services/api';

const SectionCard = ({ colors, icon, title, subtitle, action, children }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.cardHeader, { borderBottomColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                    <Lucide name={icon} size={18} color={config.THEME_COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                    <AppText label={title} variant={1} fontSize={15} color={colors.text} />
                    {subtitle ? (
                        <AppText
                            label={subtitle}
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginTop: 2 }}
                        />
                    ) : null}
                </View>
            </View>
            {action}
        </View>
        <View style={styles.cardBody}>{children}</View>
    </View>
);

const InvoiceReceiptSettings = ({ navigation }) => {
    const dispatch = useDispatch();
    const { colors } = useTheme();
    const appSettings = useSelector((s) => s.appSettings) || {};

    const [invoicePrefix, setLocalPrefix] = useState(appSettings.invoicePrefix || 'INV');
    const [invoiceRegister, setLocalRegister] = useState(appSettings.invoiceRegisterCode || 'M');
    const [invoiceNext, setLocalNext] = useState(String(appSettings.invoiceNextNumber ?? 1001));
    const [companyName, setLocalCompanyName] = useState(appSettings.receiptCompanyName || '');
    const [printHost, setPrintHost] = useState(appSettings.printAgentHost || DEFAULT_PRINT_AGENT_HOST);
    const [printPort, setPrintPort] = useState(String(appSettings.printAgentPort ?? DEFAULT_PRINT_AGENT_PORT));
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [agentStatus, setAgentStatus] = useState('idle'); // idle | testing | ok | ok-no-printer | error
    const [statusMessage, setStatusMessage] = useState('');
    const [loadingPrefs, setLoadingPrefs] = useState(true);

    useEffect(() => {
        setLocalPrefix(appSettings.invoicePrefix || 'INV');
        setLocalRegister(appSettings.invoiceRegisterCode || 'M');
        setLocalNext(String(appSettings.invoiceNextNumber ?? 1001));
        setPrintHost(appSettings.printAgentHost || DEFAULT_PRINT_AGENT_HOST);
        setPrintPort(String(appSettings.printAgentPort ?? DEFAULT_PRINT_AGENT_PORT));
    }, [
        appSettings.invoicePrefix,
        appSettings.invoiceRegisterCode,
        appSettings.invoiceNextNumber,
        appSettings.printAgentHost,
        appSettings.printAgentPort,
    ]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const prefs = await usersApi.mePreferences();
                if (cancelled) return;
                const fromApi =
                    prefs?.receiptCompanyName != null
                        ? String(prefs.receiptCompanyName)
                        : appSettings.receiptCompanyName || '';
                setLocalCompanyName(fromApi);
                if (prefs?.receiptCompanyName != null) {
                    dispatch(setReceiptCompanyName(String(prefs.receiptCompanyName)));
                }
            } catch {
                if (!cancelled) {
                    setLocalCompanyName(appSettings.receiptCompanyName || '');
                }
            } finally {
                if (!cancelled) setLoadingPrefs(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Load once on mount; local edits shouldn't re-fetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const previewNumber = buildInvoiceNumberFromSettings({
        invoicePrefix,
        invoiceRegisterCode: invoiceRegister,
        invoiceNextNumber: invoiceNext,
    });

    const endpointPreview = getPrintAgentPrintUrl({
        printAgentHost: normalizePrintAgentHost(printHost) || DEFAULT_PRINT_AGENT_HOST,
        printAgentPort: normalizePrintAgentPort(printPort),
    });

    const statusChip = (() => {
        if (agentStatus === 'ok') {
            return (
                <View style={[styles.chip, { backgroundColor: '#dcfce7' }]}>
                    <AppText label="Printer ready" fontSize={11} color="#166534" variant={1} />
                </View>
            );
        }
        if (agentStatus === 'ok-no-printer') {
            return (
                <View style={[styles.chip, { backgroundColor: '#fef3c7' }]}>
                    <AppText label="Agent OK" fontSize={11} color="#92400e" variant={1} />
                </View>
            );
        }
        if (agentStatus === 'error') {
            return (
                <View style={[styles.chip, { backgroundColor: '#fee2e2' }]}>
                    <AppText label="Not reachable" fontSize={11} color="#991b1b" variant={1} />
                </View>
            );
        }
        if (agentStatus === 'testing') {
            return (
                <View style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                    <AppText label="Testing…" fontSize={11} color={colors.textSecondary} variant={1} />
                </View>
            );
        }
        return (
            <View style={[styles.chip, { borderWidth: 1, borderColor: colors.border }]}>
                <AppText label="Not tested" fontSize={11} color={colors.textTertiary} />
            </View>
        );
    })();

    const save = async () => {
        const host = normalizePrintAgentHost(printHost);
        if (!host) {
            Alert.alert('Host required', 'Enter the LAN IP of the computer running Shopynn Print.');
            return;
        }
        const register = normalizeInvoiceRegisterCode(invoiceRegister);
        if (!register) {
            Alert.alert(
                'Register code required',
                'Register code is required (1–4 letters or digits, e.g. A, T1, W).',
            );
            return;
        }

        setSaving(true);
        try {
            const trimmedCompany = companyName.trim();
            try {
                await usersApi.updateMePreferences({ receiptCompanyName: trimmedCompany });
            } catch {
                // Prefer local save even if prefs API fails (offline / older API).
            }

            dispatch(setInvoicePrefix((invoicePrefix || 'INV').trim().toUpperCase() || 'INV'));
            dispatch(setInvoiceRegisterCode(register));
            const num = parseInt(invoiceNext, 10);
            if (!Number.isNaN(num) && num >= 0) dispatch(setInvoiceNext(num));
            dispatch(setReceiptCompanyName(trimmedCompany));
            dispatch(
                setPrintAgent({
                    host,
                    port: normalizePrintAgentPort(printPort),
                }),
            );
            setPrintHost(host);
            setPrintPort(String(normalizePrintAgentPort(printPort)));
            Alert.alert('Saved', 'Invoice & receipt settings saved.');
        } catch (err) {
            Alert.alert('Error', err?.message || 'Could not save settings.');
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        const draft = {
            printAgentHost: normalizePrintAgentHost(printHost),
            printAgentPort: normalizePrintAgentPort(printPort),
        };
        if (!draft.printAgentHost) {
            setAgentStatus('error');
            setStatusMessage('Enter a host / IP before testing.');
            return;
        }
        const url = getPrintAgentHealthUrl(draft);
        setTesting(true);
        setAgentStatus('testing');
        setStatusMessage('');
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = setTimeout(() => controller?.abort?.(), 5000);
            const res = await fetch(url, { method: 'GET', signal: controller?.signal });
            clearTimeout(timer);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setAgentStatus('error');
                setStatusMessage(data.message || `Agent returned HTTP ${res.status}.`);
                return;
            }
            if (data.printer_connected) {
                setAgentStatus('ok');
                setStatusMessage('Connected — USB printer detected.');
            } else {
                setAgentStatus('ok-no-printer');
                setStatusMessage('Connected — agent is reachable, but no USB printer was detected yet.');
            }
        } catch (err) {
            setAgentStatus('error');
            setStatusMessage(
                err?.name === 'AbortError'
                    ? 'Timed out. Check Wi‑Fi, firewall, and that Shopynn Print is running on this host.'
                    : err?.message || 'Could not reach the print agent.',
            );
        } finally {
            setTesting(false);
        }
    };

    const inputStyle = [
        styles.input,
        {
            borderColor: colors.border,
            color: colors.text,
            backgroundColor: colors.inputBackground || colors.background,
        },
    ];

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Invoice & Receipt" />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <AppText
                    label="Configure how invoices and thermal receipts appear, and connect the on‑prem print agent."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginBottom: 14 }}
                />

                <SectionCard
                    colors={colors}
                    icon="hash"
                    title="Invoice numbering"
                    subtitle="Stored on this device so offline sales stay unique. Use a different register code on each till."
                >
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <AppText label="Prefix" fontSize={12} color={colors.textSecondary} style={styles.fieldLabel} />
                            <TextInput
                                placeholder="INV"
                                placeholderTextColor={colors.placeholder || colors.textTertiary}
                                value={invoicePrefix}
                                onChangeText={(t) => setLocalPrefix(t.toUpperCase())}
                                autoCapitalize="characters"
                                maxLength={8}
                                style={inputStyle}
                            />
                        </View>
                        <View style={{ width: 88, marginRight: 8 }}>
                            <AppText label="Register" fontSize={12} color={colors.textSecondary} style={styles.fieldLabel} />
                            <TextInput
                                placeholder="W"
                                placeholderTextColor={colors.placeholder || colors.textTertiary}
                                value={invoiceRegister}
                                onChangeText={(t) => setLocalRegister(normalizeInvoiceRegisterCode(t))}
                                autoCapitalize="characters"
                                maxLength={4}
                                style={inputStyle}
                            />
                        </View>
                        <View style={{ width: 96 }}>
                            <AppText label="Next #" fontSize={12} color={colors.textSecondary} style={styles.fieldLabel} />
                            <TextInput
                                placeholder="1001"
                                placeholderTextColor={colors.placeholder || colors.textTertiary}
                                value={invoiceNext}
                                onChangeText={(t) => setLocalNext(t.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                style={inputStyle}
                            />
                        </View>
                    </View>
                    <AppText
                        label={`Next invoice: ${previewNumber}`}
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginTop: 10 }}
                    />
                    <AppText
                        label="Register: 1–4 letters/digits (e.g. A, T1)"
                        fontSize={11}
                        color={colors.textTertiary}
                        style={{ marginTop: 4 }}
                    />
                </SectionCard>

                <SectionCard
                    colors={colors}
                    icon="file-text"
                    title="Receipt branding"
                    subtitle="Shown on printed invoices and thermal receipts."
                >
                    <AppText label="Company name on receipt" fontSize={12} color={colors.textSecondary} style={styles.fieldLabel} />
                    <TextInput
                        placeholder="e.g. Shopynn Demo Store"
                        placeholderTextColor={colors.placeholder || colors.textTertiary}
                        value={companyName}
                        onChangeText={setLocalCompanyName}
                        editable={!loadingPrefs && !saving}
                        style={inputStyle}
                    />
                    <AppText
                        label="Leave blank to use your store name from account settings."
                        fontSize={11}
                        color={colors.textTertiary}
                        style={{ marginTop: 6 }}
                    />
                </SectionCard>

                <SectionCard
                    colors={colors}
                    icon="printer"
                    title="Thermal print agent"
                    subtitle="Shopynn Print runs on the checkout PC with the USB printer."
                    action={statusChip}
                >
                    <View
                        style={[
                            styles.tipBox,
                            {
                                backgroundColor: `${config.THEME_COLOR}12`,
                                borderColor: `${config.THEME_COLOR}33`,
                            },
                        ]}
                    >
                        <AppText label="Quick setup" variant={1} fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                        <AppText
                            label="1. Install and start Shopynn Print on the PC with the USB thermal printer."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginBottom: 4 }}
                        />
                        <AppText
                            label="2. Enter that PC’s LAN IP below (same Wi‑Fi/LAN as this phone)."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginBottom: 4 }}
                        />
                        <AppText
                            label="3. Test connection, then save. Use 127.0.0.1 only when the agent runs on this device."
                            fontSize={12}
                            color={colors.textSecondary}
                        />
                    </View>

                    <AppText label="Host / IP" fontSize={12} color={colors.textSecondary} style={styles.fieldLabel} />
                    <TextInput
                        placeholder="192.168.1.50"
                        placeholderTextColor={colors.placeholder || colors.textTertiary}
                        value={printHost}
                        onChangeText={(t) => {
                            setPrintHost(t);
                            setAgentStatus('idle');
                            setStatusMessage('');
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!saving && !testing}
                        style={inputStyle}
                    />
                    <AppText
                        label="Port"
                        fontSize={12}
                        color={colors.textSecondary}
                        style={[styles.fieldLabel, { marginTop: 12 }]}
                    />
                    <TextInput
                        placeholder="3001"
                        placeholderTextColor={colors.placeholder || colors.textTertiary}
                        value={printPort}
                        onChangeText={(t) => {
                            setPrintPort(t.replace(/[^0-9]/g, ''));
                            setAgentStatus('idle');
                            setStatusMessage('');
                        }}
                        keyboardType="number-pad"
                        editable={!saving && !testing}
                        style={[inputStyle, { width: 120 }]}
                    />

                    {endpointPreview ? (
                        <AppText
                            label={`Endpoint: ${endpointPreview}`}
                            fontSize={11}
                            color={colors.textTertiary}
                            style={{ marginTop: 10 }}
                        />
                    ) : null}

                    {statusMessage ? (
                        <View
                            style={[
                                styles.statusBox,
                                {
                                    backgroundColor:
                                        agentStatus === 'ok'
                                            ? '#dcfce7'
                                            : agentStatus === 'ok-no-printer'
                                              ? '#fef3c7'
                                              : agentStatus === 'error'
                                                ? '#fee2e2'
                                                : colors.surfaceSecondary,
                                },
                            ]}
                        >
                            <AppText
                                label={statusMessage}
                                fontSize={12}
                                color={
                                    agentStatus === 'ok'
                                        ? '#166534'
                                        : agentStatus === 'ok-no-printer'
                                          ? '#92400e'
                                          : agentStatus === 'error'
                                            ? '#991b1b'
                                            : colors.textSecondary
                                }
                            />
                        </View>
                    ) : null}

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={testConnection}
                        disabled={testing || saving}
                        style={[styles.secondaryBtn, { borderColor: config.THEME_COLOR, opacity: testing || saving ? 0.6 : 1 }]}
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
                </SectionCard>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={save}
                    disabled={saving}
                    style={[styles.saveBtn, { backgroundColor: config.THEME_COLOR, opacity: saving ? 0.7 : 1 }]}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Lucide name="check" color="#fff" size={20} />
                    )}
                    <AppText
                        label={saving ? 'Saving…' : 'Save settings'}
                        variant={1}
                        color="#fff"
                        fontSize={16}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
        borderRadius: 12,
        marginBottom: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        flex: 1,
    },
    cardIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    cardBody: { padding: 14 },
    fieldLabel: { marginBottom: 6 },
    row: { flexDirection: 'row' },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
    },
    tipBox: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 14,
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    statusBox: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderRadius: 10,
        height: 46,
        marginTop: 14,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: 10,
        marginTop: 4,
    },
});

export default InvoiceReceiptSettings;
