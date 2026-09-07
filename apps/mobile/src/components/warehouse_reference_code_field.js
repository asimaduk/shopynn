import React from 'react';
import { View, TextInput, TouchableOpacity, Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import config from '../config';

export const REFERENCE_CODE_MIN_LENGTH = 6;
export const REFERENCE_CODE_MAX_LENGTH = 80;

const REFERENCE_CODE_PATTERN = new RegExp(
    `^[A-Z0-9](?:[A-Z0-9_-]{${REFERENCE_CODE_MIN_LENGTH - 2},${REFERENCE_CODE_MAX_LENGTH - 2}}[A-Z0-9])?$`
);

export function normalizeReferenceCodeInput(value) {
    return String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
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
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    let code = `${base || 'STORE'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    while (code.length < REFERENCE_CODE_MIN_LENGTH) {
        code += Math.random().toString(36).slice(2, 3).toUpperCase();
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

    const handleCopy = () => {
        const code = normalizeReferenceCodeInput(value);
        if (!code) {
            Alert.alert('Nothing to copy', 'Enter or generate a customer signup code first.');
            return;
        }
        Clipboard.setString(code);
        Alert.alert('Copied', 'Signup code copied to clipboard.');
    };

    return (
        <View style={{ marginTop: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <AppText label="Customer signup code" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                <AppText label=" (optional)" color={colors.textTertiary} fontSize={12} />
            </View>
            <AppText
                label={`Customers enter this when creating a Customer account to link to this store (${REFERENCE_CODE_MIN_LENGTH}–${REFERENCE_CODE_MAX_LENGTH} characters). Leave blank to auto-generate on save.`}
                fontSize={12}
                color={colors.textTertiary}
                style={{ marginBottom: 10 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                    placeholder="e.g. MAIN-STORE-A1B2"
                    placeholderTextColor={colors.placeholder}
                    value={value}
                    onChangeText={(text) => {
                        onChange(normalizeReferenceCodeInput(text));
                        onClearError?.();
                    }}
                    autoCapitalize="characters"
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
            {error ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Lucide name="alert-circle" color={colors.error} size={14} />
                    <AppText label={error} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                </View>
            ) : null}
        </View>
    );
}
