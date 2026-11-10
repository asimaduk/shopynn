import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import axios from 'axios';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import useTheme from '../hooks/useTheme';
import { subscribeStepUp } from '../utils/stepUp';

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/** Code prompt for withdrawals and payout changes. Mount at the app root and inside every AppModal. */
const StepUpHost = () => {
    const { colors } = useTheme();
    const [request, setRequest] = useState(null);
    const [destination, setDestination] = useState('');
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => subscribeStepUp(setRequest), []);

    const sendCode = useCallback(async () => {
        setSending(true);
        setError('');
        try {
            const res = await axios.post('/users/me/step-up/send-otp', {}, { skipErrorAlert: true });
            const data = res?.data?.data || {};
            setDestination(data.destination || '');
        } catch (err) {
            setError(errorMessage(err, 'Could not send the code. Try again.'));
        } finally {
            setSending(false);
        }
    }, []);

    useEffect(() => {
        if (!request) return;
        setCode('');
        setDestination('');
        setError('');
        sendCode();
    }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!request) return null;

    const confirm = async () => {
        if (!/^\d{6}$/.test(code) || verifying) return;
        setVerifying(true);
        setError('');
        try {
            const res = await axios.post('/users/me/step-up/verify', { otp: code }, { skipErrorAlert: true });
            request.finish(res?.data?.data || null);
        } catch (err) {
            setError(errorMessage(err, 'Could not confirm the code.'));
        } finally {
            setVerifying(false);
        }
    };

    const sentTo = destination ? `We sent a 6-digit code to ${destination}.` : 'Sending a 6-digit code…';

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.root}
        >
            <View style={styles.backdrop} />
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primaryShade || 'rgba(10,116,218,0.12)' }]}>
                    <Lucide name="shield-check" size={26} color={colors.primary || '#0A74DA'} />
                </View>
                <AppText label="Confirm it's you" variant={1} fontSize={18} color={colors.text} style={styles.center} />
                <AppText
                    label={`${sentTo} Enter it to continue with this payout action.`}
                    fontSize={14}
                    color={colors.textSecondary}
                    style={[styles.center, { marginTop: 6, lineHeight: 20 }]}
                />
                <TextInput
                    value={code}
                    onChangeText={(t) => setCode(String(t || '').replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    autoFocus
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.text, borderColor: error ? (colors.error || '#dc2626') : colors.border }]}
                />
                {error ? <AppText label={error} fontSize={13} color={colors.error || '#dc2626'} style={styles.center} /> : null}
                <TouchableOpacity disabled={sending} onPress={sendCode} style={styles.resend}>
                    {sending ? (
                        <ActivityIndicator size="small" color={colors.primary || '#0A74DA'} />
                    ) : (
                        <AppText label="Send a new code" fontSize={14} color={colors.primary || '#0A74DA'} />
                    )}
                </TouchableOpacity>
                <View style={styles.actions}>
                    <TouchableOpacity
                        onPress={() => request.finish(null)}
                        style={[styles.btn, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
                    >
                        <AppText label="Cancel" variant={1} fontSize={15} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={code.length !== 6 || verifying}
                        onPress={confirm}
                        style={[styles.btn, { backgroundColor: colors.primary || '#0A74DA', opacity: code.length === 6 ? 1 : 0.5 }]}
                    >
                        {verifying ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <AppText label="Confirm" variant={1} fontSize={15} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1100,
        elevation: 1100,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 22,
        paddingTop: 24,
        paddingBottom: 18,
        alignItems: 'center',
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    center: {
        textAlign: 'center',
    },
    input: {
        width: '100%',
        marginTop: 18,
        marginBottom: 8,
        height: 52,
        borderWidth: 1,
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 24,
        letterSpacing: 8,
    },
    resend: {
        paddingVertical: 10,
    },
    actions: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
        marginTop: 6,
    },
    btn: {
        flex: 1,
        height: 46,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default StepUpHost;
