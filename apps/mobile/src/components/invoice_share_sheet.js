import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppModal from './app_modal';
import AppText from './text';
import useTheme from '../hooks/useTheme';
import config from '../config';
import { buildInvoiceFromSale, shareInvoice } from '../utils/invoice';

const OPTIONS = [
    {
        id: 'share',
        label: 'Share PDF',
        subtitle: 'Download PDF from server and share',
        icon: 'share-2',
        needsSaleId: true,
    },
    {
        id: 'pdf',
        label: 'Download PDF',
        subtitle: 'Official PDF invoice file',
        icon: 'download',
        needsSaleId: true,
    },
    {
        id: 'server-email',
        label: 'Email with PDF',
        subtitle: 'Send invoice PDF from server to customer',
        icon: 'mail',
        needsSaleId: true,
    },
    {
        id: 'email',
        label: 'Email (device)',
        subtitle: 'Open mail app with invoice text',
        icon: 'mail',
    },
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        subtitle: 'Send invoice text on WhatsApp',
        icon: 'message-circle',
    },
    {
        id: 'html',
        label: 'Share HTML',
        subtitle: 'HTML file — Print → Save as PDF in browser',
        icon: 'file-text',
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

        const opt = OPTIONS.find((o) => o.id === method);
        if (opt?.needsSaleId && !resolvedSaleId) {
            Alert.alert(
                'Invoice',
                'This sale is not on the server yet. Upload it first, or use Email / WhatsApp / HTML options.',
            );
            return;
        }

        setBusy(method);
        try {
            if (method === 'server-email' && !invoice.customer_email) {
                Alert.alert('Email required', 'Add a customer email or use Email (device).');
                return;
            }
            await shareInvoice(invoice, method, { saleId: resolvedSaleId });
            if (method === 'server-email') {
                Alert.alert('Sent', `Invoice emailed to ${invoice.customer_email}.`);
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

    const emailHint = invoice?.customer_email || 'Device mail app';
    const whatsappHint = invoice?.customer_phone || 'Opens WhatsApp';

    const subtitles = {
        email: emailHint,
        whatsapp: whatsappHint,
        'server-email': invoice?.customer_email || 'Requires customer email on file',
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
                    label="Generate and send this sale invoice to your customer."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginBottom: 16 }}
                />
                {!resolvedSaleId ? (
                    <AppText
                        label="Server PDF and email require a synced sale. Pending sales can still use device email, WhatsApp, or HTML."
                        fontSize={12}
                        color={colors.warning}
                        style={{ marginBottom: 12 }}
                    />
                ) : null}
                {OPTIONS.map((opt) => {
                    const loading = busy === opt.id;
                    const disabled = opt.needsSaleId && !resolvedSaleId;
                    return (
                        <TouchableOpacity
                            key={opt.id}
                            activeOpacity={0.75}
                            disabled={!!busy || disabled}
                            onPress={() => handleSelect(opt.id)}
                            style={[
                                styles.option,
                                {
                                    backgroundColor: colors.surfaceSecondary,
                                    borderColor: colors.border,
                                    opacity: busy && !loading ? 0.55 : disabled ? 0.45 : 1,
                                },
                            ]}
                        >
                            <View style={[styles.iconWrap, { backgroundColor: config.THEME_COLOR + '18' }]}>
                                {loading ? (
                                    <ActivityIndicator size="small" color={config.THEME_COLOR} />
                                ) : (
                                    <Lucide name={opt.icon} size={22} color={config.THEME_COLOR} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppText label={opt.label} variant={1} fontSize={15} color={colors.text} />
                                <AppText
                                    label={subtitles[opt.id] || opt.subtitle}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                    numberOfLines={2}
                                />
                            </View>
                            <Lucide name="chevron-right" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </AppModal>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 28,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
        gap: 12,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default InvoiceShareSheet;
