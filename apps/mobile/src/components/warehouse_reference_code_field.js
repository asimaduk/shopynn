import React from 'react';
import { View, TextInput, TouchableOpacity, Alert, Linking, Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import { storefrontStoreUrl, storefrontShareMessage } from '../utils/storefrontLinks';
import { buildWhatsAppUrl } from '../utils/invoice';

export const REFERENCE_CODE_MIN_LENGTH = 6;
export const REFERENCE_CODE_MAX_LENGTH = 80;

const REFERENCE_CODE_PATTERN = new RegExp(
    `^[a-z0-9](?:[a-z0-9_-]{${REFERENCE_CODE_MIN_LENGTH - 2},${REFERENCE_CODE_MAX_LENGTH - 2}}[a-z0-9])?$`
);

export function normalizeReferenceCodeInput(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
}

export function validateReferenceCode(value) {
    const code = normalizeReferenceCodeInput(value);
    if (!code) return '';
    if (code.length < REFERENCE_CODE_MIN_LENGTH) {
        return `Code must be at least ${REFERENCE_CODE_MIN_LENGTH} characters`;
    }
    if (code.length > REFERENCE_CODE_MAX_LENGTH) {
        return `Code must be ${REFERENCE_CODE_MAX_LENGTH} characters or less`;
    }
    if (!REFERENCE_CODE_PATTERN.test(code)) {
        return 'Use letters, numbers, hyphens, and underscores. Must start and end with a letter or number.';
    }
    return '';
}

export function suggestReferenceCode(warehouseName) {
    const base = String(warehouseName ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    let code = `${base || 'store'}-${Math.random().toString(36).slice(2, 6).toLowerCase()}`;
    while (code.length < REFERENCE_CODE_MIN_LENGTH) {
        code += Math.random().toString(36).slice(2, 3).toLowerCase();
    }
    return code.slice(0, REFERENCE_CODE_MAX_LENGTH);
}

export default function WarehouseReferenceCodeField({
    colors,
    value,
    onChange,
    error,
    warehouseName,
    onClearError,
}) {
    const handleGenerate = () => {
        const next = suggestReferenceCode(warehouseName);
        onChange(next);
        onClearError?.();
    };

    const storefrontUrl = () => {
        const code = normalizeReferenceCodeInput(value);
        if (!code) return null;
        return storefrontStoreUrl(code);
    };

    const handleCopy = () => {
        const code = normalizeReferenceCodeInput(value);
        if (!code) {
            Alert.alert('Nothing to copy', 'Enter or generate a customer signup code first.');
            return;
        }
        Clipboard.setString(code);
        Alert.alert('Copied', 'Signup code copied to clipboard.');
    };

    const handleCopyStoreLink = () => {
        const url = storefrontUrl();
        if (!url) {
            Alert.alert('No code yet', 'Enter or generate a customer signup code first.');
            return;
        }
        Clipboard.setString(url);
        Alert.alert('Copied', 'Order link copied. Paste it in WhatsApp or anywhere.');
    };

    const handleShareWhatsApp = async () => {
        const url = storefrontUrl();
        if (!url) {
            Alert.alert('No code yet', 'Enter or generate a customer signup code first.');
            return;
        }
        const message = storefrontShareMessage({
            storeName: warehouseName,
            url,
        });
        try {
            const wa = buildWhatsAppUrl(null, message);
            const canOpen = await Linking.canOpenURL(wa);
            if (canOpen) {
                await Linking.openURL(wa);
                return;
            }
        } catch (_) {
            /* fall through to Share */
        }
        try {
            await Share.share({ message, title: 'Share store order link' });
        } catch (e) {
            if (e?.message !== 'User did not share') {
                Alert.alert('Share failed', e?.message || 'Could not open share sheet.');
            }
        }
    };

    return (
        <View style={{ marginTop: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <AppText label="Customer signup code" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                <AppText label=" (optional)" color={colors.textTertiary} fontSize={12} />
            </View>
            <AppText
                label={`Customers use this code to link to your store (${REFERENCE_CODE_MIN_LENGTH}–${REFERENCE_CODE_MAX_LENGTH} characters). It also powers your WhatsApp order link. Leave blank to auto-generate on save.`}
                fontSize={12}
                color={colors.textTertiary}
                style={{ marginBottom: 10 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                    placeholder="e.g. main-store-a1b2"
                    placeholderTextColor={colors.placeholder}
                    value={value}
                    onChangeText={(text) => {
                        onChange(normalizeReferenceCodeInput(text));
                        onClearError?.();
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                        flex: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        fontFamily: 'FiraSans-Regular',
                        borderRadius: 8,
                        height: 50,
                        color: colors.text,
                        fontSize: 15,
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: error ? colors.error : colors.inputBorder,
                    }}
                    maxLength={REFERENCE_CODE_MAX_LENGTH}
                />
                <TouchableOpacity
                    onPress={handleGenerate}
                    activeOpacity={0.7}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: colors.surfaceSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                    <Lucide name="refresh-cw" size={18} color={config.THEME_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleCopy}
                    activeOpacity={0.7}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: colors.surfaceSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                    <Lucide name="copy" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
            {normalizeReferenceCodeInput(value) ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                    <AppText
                        label={storefrontUrl()}
                        fontSize={12}
                        color={colors.textSecondary}
                        numberOfLines={2}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={handleShareWhatsApp}
                            activeOpacity={0.75}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                height: 44,
                                borderRadius: 8,
                                backgroundColor: '#25D366',
                            }}
                        >
                            <Lucide name="message-circle" size={18} color="#fff" />
                            <AppText label="Share on WhatsApp" color="#fff" fontSize={13} variant={1} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleCopyStoreLink}
                            activeOpacity={0.75}
                            style={{
                                height: 44,
                                paddingHorizontal: 14,
                                borderRadius: 8,
                                backgroundColor: colors.surfaceSecondary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 6,
                            }}
                        >
                            <Lucide name="link" size={16} color={config.THEME_COLOR} />
                            <AppText label="Copy link" color={config.THEME_COLOR} fontSize={13} variant={1} />
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}
            {error ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Lucide name="alert-circle" color={colors.error} size={14} />
                    <AppText label={error} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                </View>
            ) : null}
        </View>
    );
}
