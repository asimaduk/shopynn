import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppModal from './app_modal';
import AppText from './text';
import useTheme from '../hooks/useTheme';
import config from '../config';
import { buildInvoiceFromSale, shareInvoice } from '../utils/invoice';

const PDF_OPTIONS = [
    {
        id: 'share',
        label: 'Share PDF',
        subtitle: 'Official PDF — open system share sheet',
        icon: 'share-2',
        needsSaleId: true,
    },
    {
        id: 'pdf',
        label: 'Save PDF',
        subtitle: 'Official PDF file to this device',
        icon: 'download',
        needsSaleId: true,
    },
    {
        id: 'server-email',
        label: 'Email PDF',
        subtitle: 'Send official PDF from Shopynn',
        icon: 'mail',
        needsSaleId: true,
    },
];

const MESSAGE_OPTIONS = [
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        subtitle: 'Send invoice summary as text',
        icon: 'message-circle',
        needsSaleId: false,
    },
    {
        id: 'email',
        label: 'Email text',
        subtitle: 'Open mail app with invoice summary',
        icon: 'mail',
        needsSaleId: false,
    },
];

const InvoiceShareSheet = ({ visible, sale, saleId, appSettings, onClose }) => {
    const { colors } = useTheme();
    const [busy, setBusy] = useState(null);

    const resolvedSaleId = saleId || sale?.id;

    const invoice = useMemo(() => {
        if (!sale) return null;
        return buildInvoiceFromSale(sale, appSettings || {});
    }, [sale, appSettings]);

    const handleSelect = async (method) => {
        if (!invoice || busy) return;

        const opt = [...PDF_OPTIONS, ...MESSAGE_OPTIONS].find((o) => o.id === method);
        if (opt?.needsSaleId && !resolvedSaleId) {
            Alert.alert(
                'Invoice',
                'This sale is not synced yet. Upload it first to send or save the official PDF, or use WhatsApp / Email text.',
            );
            return;
        }

        setBusy(method);
        try {
            if (method === 'server-email' && !invoice.customer_email) {
                Alert.alert('Email required', 'Add a customer email, or use Email text instead.');
                return;
            }
            const savedPath = await shareInvoice(invoice, method, { saleId: resolvedSaleId });
            if (method === 'server-email') {
                Alert.alert('Sent', `PDF invoice emailed to ${invoice.customer_email}.`);
            } else if (method === 'pdf' && savedPath) {
                Alert.alert('PDF saved', `Invoice PDF saved${savedPath ? `\n${savedPath}` : ''}.`);
            }
            onClose?.();
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || '';
            if (msg && !/cancel|dismiss/i.test(msg)) {
                Alert.alert('Invoice', msg || 'Could not share the invoice. Please try again.');
            }
        } finally {
            setBusy(null);
        }
    };

    const emailHint = invoice?.customer_email || 'No email on file';
    const whatsappHint = invoice?.customer_phone || 'Opens WhatsApp';

    const hintFor = (id, fallback) => {
        if (id === 'email') return emailHint;
        if (id === 'whatsapp') return whatsappHint;
        if (id === 'server-email') {
            return invoice?.customer_email || 'Requires customer email on file';
        }
        return fallback;
    };

    const renderOption = (opt, isLast) => {
        const loading = busy === opt.id;
        const disabled = opt.needsSaleId && !resolvedSaleId;
        return (
            <TouchableOpacity
                key={opt.id}
                activeOpacity={0.7}
                disabled={!!busy || disabled}
                onPress={() => handleSelect(opt.id)}
                style={[
                    styles.optionRow,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    { opacity: busy && !loading ? 0.5 : disabled ? 0.4 : 1 },
                ]}
            >
                <View style={[styles.iconWrap, { backgroundColor: config.THEME_COLOR + '14' }]}>
                    {loading ? (
                        <ActivityIndicator size="small" color={config.THEME_COLOR} />
                    ) : (
                        <Lucide name={opt.icon} size={18} color={config.THEME_COLOR} />
                    )}
                </View>
                <View style={styles.optionText}>
                    <AppText label={opt.label} variant={1} fontSize={15} color={colors.text} />
                    <AppText
                        label={hintFor(opt.id, opt.subtitle)}
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginTop: 2 }}
                        numberOfLines={2}
                    />
                </View>
                {!loading ? <Lucide name="chevron-right" size={16} color={colors.textTertiary} /> : null}
            </TouchableOpacity>
        );
    };

    return (
        <AppModal
            visible={visible}
            title={`Invoice ${invoice?.invoice_number || ''}`.trim()}
            handleClose={onClose}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <AppText
                    label="Send the official PDF invoice, or share a text summary."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginBottom: 4, lineHeight: 18 }}
                />

                {!resolvedSaleId ? (
                    <View style={[styles.notice, { backgroundColor: colors.warningLight || '#FFF7ED', borderColor: colors.warning || '#F59E0B' }]}>
                        <Lucide name="info" size={14} color={colors.warning || '#F59E0B'} />
                        <AppText
                            label="PDF actions need a synced sale. WhatsApp and Email text still work."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ flex: 1, marginLeft: 8, lineHeight: 17 }}
                        />
                    </View>
                ) : null}

                <AppText
                    label="PDF"
                    fontSize={11}
                    variant={1}
                    color={colors.textTertiary}
                    style={styles.sectionLabel}
                />
                <View style={[styles.group, { backgroundColor: colors.surfaceSecondary || colors.background, borderColor: colors.border }]}>
                    {PDF_OPTIONS.map((opt, i) => renderOption(opt, i === PDF_OPTIONS.length - 1))}
                </View>

                <AppText
                    label="Message"
                    fontSize={11}
                    variant={1}
                    color={colors.textTertiary}
                    style={styles.sectionLabel}
                />
                <View style={[styles.group, { backgroundColor: colors.surfaceSecondary || colors.background, borderColor: colors.border }]}>
                    {MESSAGE_OPTIONS.map((opt, i) => renderOption(opt, i === MESSAGE_OPTIONS.length - 1))}
                </View>
            </View>
        </AppModal>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 12,
        marginBottom: 4,
        padding: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    sectionLabel: {
        marginTop: 18,
        marginBottom: 8,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    group: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionText: {
        flex: 1,
        paddingRight: 4,
    },
});

export default InvoiceShareSheet;
