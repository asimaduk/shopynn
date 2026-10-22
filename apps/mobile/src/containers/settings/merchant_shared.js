import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import AppText from '../../components/text';
import AppModal from '../../components/app_modal';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

export function fmtMoney(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '—';
}

export function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function userDisplayName(row) {
    const name = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
    return name || row?.email || row?.phone || 'User';
}

export function managerDisplayName(row) {
    return [row?.manager_first_name, row?.manager_last_name].filter(Boolean).join(' ').trim();
}

export function agentTypeLabel(type) {
    return type === 'manager' ? 'Agent manager' : 'Field agent';
}

export function apiErrorMessage(e, fallback) {
    return e?.response?.data?.message || e?.message || fallback;
}

export function commissionKindLabel(c) {
    if (c?.commission_kind === 'override') {
        const who = [c.source_agent_first_name, c.source_agent_last_name].filter(Boolean).join(' ');
        return who ? `Team override · ${who}` : 'Team override';
    }
    return c?.commission_kind === 'residual' ? 'Renewal' : 'Onboarding';
}

const TONE_BG = {
    success: 'rgba(34,197,94,0.2)',
    warning: 'rgba(245,158,11,0.2)',
    info: 'rgba(59,130,246,0.2)',
    error: 'rgba(239,68,68,0.2)',
    neutral: 'rgba(148,163,184,0.25)',
};

export const AGENT_STATUS = {
    pending_approval: { label: 'Awaiting approval', tone: 'warning' },
    active: { label: 'Active', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'error' },
    deactivated: { label: 'Deactivated', tone: 'neutral' },
};

export const COMMISSION_LIFECYCLE = {
    held: { label: 'On hold', tone: 'neutral' },
    payable: { label: 'Payable', tone: 'info' },
    in_payout: { label: 'In payout', tone: 'warning' },
    paid: { label: 'Paid', tone: 'success' },
    cancelled: { label: 'Cancelled', tone: 'error' },
};

export const PAYOUT_STATUS = {
    pending_approval: { label: 'Awaiting approval', tone: 'warning' },
    processing: { label: 'Processing', tone: 'info' },
    paid: { label: 'Paid', tone: 'success' },
    failed: { label: 'Failed', tone: 'error' },
    rejected: { label: 'Rejected', tone: 'neutral' },
};

export const MOMO_NETWORKS = [
    { value: 'mtn', label: 'MTN' },
    { value: 'vodafone', label: 'Telecel (Vodafone)' },
    { value: 'airteltigo', label: 'AirtelTigo' },
];

export function momoNetworkLabel(value) {
    return MOMO_NETWORKS.find((n) => n.value === value)?.label ?? value ?? '';
}

/** Small coloured status label; `meta` is an entry from AGENT_STATUS / COMMISSION_LIFECYCLE / PAYOUT_STATUS. */
export function StatusPill({ meta, fallback = '—', fontSize = 10 }) {
    const { colors } = useTheme();
    return (
        <View
            style={{
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 6,
                alignSelf: 'flex-start',
                backgroundColor: TONE_BG[meta?.tone] ?? TONE_BG.neutral,
            }}
        >
            <AppText label={meta?.label ?? fallback} variant={1} fontSize={fontSize} color={colors.text} />
        </View>
    );
}

export function CommissionPill({ commission }) {
    const lifecycle = commission?.lifecycle ?? (commission?.status === 'paid' ? 'paid' : 'held');
    const meta = COMMISSION_LIFECYCLE[lifecycle];
    const { colors } = useTheme();
    return (
        <View>
            <StatusPill meta={meta} fallback={commission?.status} />
            {lifecycle === 'held' && commission?.payable_after ? (
                <AppText
                    label={`From ${fmtDate(commission.payable_after)}`}
                    fontSize={9}
                    color={colors.textTertiary}
                    style={{ marginTop: 3 }}
                />
            ) : null}
        </View>
    );
}

/** Bottom-sheet asking for an optional (or required) reason before a destructive action. */
export function ReasonModal({ visible, title, message, confirmLabel = 'Confirm', destructive, required, busy, onCancel, onConfirm }) {
    const { colors } = useTheme();
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (visible) setReason('');
    }, [visible]);

    const disabled = busy || (required && !reason.trim());
    return (
        <AppModal visible={visible} title={title} handleClose={busy ? undefined : onCancel} onRequestClose={busy ? undefined : onCancel}>
            <View style={{ padding: 16 }}>
                {message ? <AppText label={message} fontSize={13} color={colors.textSecondary} /> : null}
                <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder={required ? 'Reason' : 'Reason (optional)'}
                    placeholderTextColor={colors.placeholder}
                    multiline
                    style={{
                        marginTop: 12,
                        minHeight: 72,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        padding: 12,
                        color: colors.text,
                        backgroundColor: colors.background,
                        textAlignVertical: 'top',
                    }}
                />
                <TouchableOpacity
                    onPress={() => onConfirm(reason.trim())}
                    disabled={disabled}
                    style={{
                        marginTop: 14,
                        backgroundColor: destructive ? '#dc2626' : config.THEME_COLOR,
                        padding: 14,
                        borderRadius: 999,
                        alignItems: 'center',
                        opacity: disabled ? 0.6 : 1,
                    }}
                >
                    {busy ? <ActivityIndicator color="#fff" /> : <AppText label={confirmLabel} color="#fff" variant={1} />}
                </TouchableOpacity>
            </View>
        </AppModal>
    );
}

/** Bottom-sheet single-choice list. */
export function PickerModal({ visible, title, message, options, selected, onSelect, onClose }) {
    const { colors } = useTheme();
    return (
        <AppModal visible={visible} title={title} handleClose={onClose} onRequestClose={onClose}>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                {message ? (
                    <AppText label={message} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 10 }} />
                ) : null}
                {options.length === 0 ? (
                    <AppText label="Nothing to choose from." fontSize={13} color={colors.textTertiary} />
                ) : (
                    options.map((o) => {
                        const active = o.value === selected;
                        return (
                            <TouchableOpacity
                                key={String(o.value)}
                                onPress={() => onSelect(o.value)}
                                style={{
                                    padding: 14,
                                    borderRadius: 10,
                                    marginBottom: 8,
                                    borderWidth: 1,
                                    borderColor: active ? config.THEME_COLOR : colors.border,
                                    backgroundColor: active ? config.THEME_COLOR + '22' : colors.surface,
                                }}
                            >
                                <AppText label={o.label} fontSize={14} color={colors.text} />
                                {o.hint ? (
                                    <AppText label={o.hint} fontSize={11} color={colors.textTertiary} style={{ marginTop: 3 }} />
                                ) : null}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </AppModal>
    );
}
