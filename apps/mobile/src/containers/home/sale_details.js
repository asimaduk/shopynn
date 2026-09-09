import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, ActivityIndicator, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import InvoiceShareSheet from '../../components/invoice_share_sheet';
import { formatCurrency } from '../../utils/format';
import { sales as salesApi } from '../../services/api';
import { hasPermission } from '../../utils/permissions';
import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    readSecureList,
    writeSecureList,
} from '../../utils/secureOfflineStorage';

const safeString = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const getErrorCode = (err) => safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
const getErrorMessage = (err) =>
    safeString(
        err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Upload failed.'
    );

const SaleDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const appSettings = useSelector((s) => s.appSettings) || {};
    const { item: paramItem, saleId, mode } = route.params || {};
    const [item, setItem] = useState(paramItem);
    const isPendingUpload = mode === 'pending-upload' || !!paramItem?.payload;
    const [loading, setLoading] = useState(!isPendingUpload && !!(saleId || paramItem?.id));
    const [showInvoiceShare, setShowInvoiceShare] = useState(false);
    const [resendingInvoice, setResendingInvoice] = useState(false);
    const canResendInvoice = hasPermission(user, 'sales.share_receipt');

    useEffect(() => {
        const id = saleId || paramItem?.id;
        if (isPendingUpload) return;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        salesApi.get(id).then((data) => {
            // console.log('sale details data', data);
            if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [saleId, paramItem?.id]);

    const removePendingSaleById = async (pendingId) => {
        const list = await readSecureList(PENDING_SALES_KEY);
        const next = Array.isArray(list) ? list.filter((x) => String(x?.id) !== String(pendingId)) : [];
        await writeSecureList(PENDING_SALES_KEY, next);
        return next;
    };

    const updatePendingSale = async (pendingId, updater) => {
        const list = await readSecureList(PENDING_SALES_KEY);
        const next = (Array.isArray(list) ? list : []).map((x) => {
            if (String(x?.id) !== String(pendingId)) return x;
            return updater(x);
        });
        await writeSecureList(PENDING_SALES_KEY, next);
        return next;
    };

    const handleRetryPendingUpload = async () => {
        const pendingId = item?.id;
        if (!pendingId || !item?.payload) return;
        try {
            await salesApi.create(item.payload);
            await removePendingSaleById(pendingId);
            Alert.alert('Uploaded', 'Pending sale uploaded successfully.');
            navigation.goBack();
        } catch (err) {
            const nowIso = new Date().toISOString();
            const nextItem = {
                ...item,
                attempts: (Number(item?.attempts) || 0) + 1,
                last_attempt_at: nowIso,
                last_error_code: getErrorCode(err) || item?.last_error_code || null,
                last_error_message: getErrorMessage(err) || item?.last_error_message || null,
            };
            setItem(nextItem);
            await updatePendingSale(pendingId, () => nextItem);
            Alert.alert('Upload failed', nextItem.last_error_message || 'Could not upload this sale.');
        }
    };

    const handleEditPendingSale = () => {
        const pendingId = item?.id;
        Alert.alert(
            'Edit pending sale',
            'This will remove it from Pending Sales and open it in New Sale for editing.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Edit',
                    onPress: async () => {
                        if (pendingId) await removePendingSaleById(pendingId);
                        navigation.navigate('NewSale', { restorePendingSale: item });
                    },
                },
            ],
        );
    };

    const handleDeletePendingSale = () => {
        const pendingId = item?.id;
        Alert.alert('Delete pending sale?', 'This will remove it from Pending Sales.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    if (pendingId) await removePendingSaleById(pendingId);
                    navigation.goBack();
                },
            },
        ]);
    };

    const backPress = () => {
        navigation.goBack();
    };

    const handleResendInvoice = () => {
        const id = saleId || item?.id;
        if (!id || isPendingUpload) return;
        const emailHint = item?.customer_email ? ` to ${item.customer_email}` : '';
        Alert.alert(
            'Resend invoice',
            `Email invoice #${item?.invoice_number}${emailHint}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Resend',
                    onPress: async () => {
                        setResendingInvoice(true);
                        try {
                            const result = await salesApi.sendInvoice(
                                id,
                                item?.customer_email ? { email: item.customer_email } : {},
                            );
                            Alert.alert('Sent', `Invoice resent to ${result?.sent_to || item?.customer_email || 'customer'}.`);
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Could not resend invoice.';
                            Alert.alert('Resend failed', msg);
                        } finally {
                            setResendingInvoice(false);
                        }
                    },
                },
            ],
        );
    };

    const handleCallCustomer = async () => {
        const phone = String(item.customer_phone || '').trim();
        if (!phone) return;
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Call', 'This device cannot make phone calls.');
            }
        } catch (err) {
            const msg = err?.message || 'Failed to start the call.';
            Alert.alert('Error', msg);
        }
    };

    const DetailSection = ({ title, children }) => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <AppText label={title} fontSize={16} variant={1} style={[styles.sectionTitle, { color: colors.text }]} />
            {children}
        </View>
    );

    const DetailRow = ({ icon, label, value }) => (
        <View style={styles.detailRow}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name={icon} color={colors.textSecondary} size={18} />
            </View>
            <View style={{ flex: 1 }}>
                <AppText label={label} fontSize={12} color={colors.textTertiary} />
                <AppText label={value} fontSize={15} color={colors.text} />
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading sale..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Sale Details'}>
                <View style={{ flexDirection: 'row', paddingRight: 10, gap: 8 }}>
                    {!isPendingUpload && canResendInvoice ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={handleResendInvoice}
                            disabled={resendingInvoice}
                            style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                        >
                            {resendingInvoice ? (
                                <ActivityIndicator size="small" color={config.THEME_COLOR} />
                            ) : (
                                <Lucide name="mail" color={config.THEME_COLOR} size={20} />
                            )}
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setShowInvoiceShare(true)}
                        style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="file-text" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    {/* <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate("NewSale", {item: item})}
                        style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="redo-dot" color={colors.textSecondary} size={20} />
                    </TouchableOpacity> */}
                </View>
            </ScreenHeader>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                {isPendingUpload && (
                    <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.iconContainer, { backgroundColor: colors.warningLight }]}>
                                    <Lucide name="cloud-off" size={18} color={colors.warning} />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <AppText label="Pending upload" variant={1} fontSize={15} color={colors.text} />
                                    <AppText
                                        label={(item?.last_error_message || 'Will upload when internet is available.').trim()}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 2, maxWidth: 260 }}
                                    />
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <AppText label={`Attempts: ${Number(item?.attempts) || 0}`} fontSize={11} color={colors.textTertiary} />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleRetryPendingUpload}
                                style={{ flex: 1, backgroundColor: config.THEME_COLOR, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}>
                                <AppText label="Retry now" variant={1} fontSize={13} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleEditPendingSale}
                                style={{ flex: 1, backgroundColor: colors.surfaceSecondary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}>
                                <AppText label="Edit" variant={1} fontSize={13} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleDeletePendingSale}
                                style={{ backgroundColor: colors.errorLight, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' }}>
                                <Lucide name="trash-2" size={16} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Status Header */}
                <View style={[styles.statusHeader, { backgroundColor: item.status === 'Delivered' ? config.GREEN_COLOR : config.THEME_COLOR }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <AppText label={item.status} fontSize={20} variant={2} color={'#fff'} />
                            <AppText label={item.date} fontSize={13} color={'rgba(255,255,255,0.8)'} />
                        </View>
                        <Lucide name={item.status === 'Delivered' ? "circle-check" : "clock"} size={32} color="#fff" />
                    </View>
                    <View style={styles.divider} />
                    <AppText label={`Attendant: ${item.user}`} fontSize={13} color={'rgba(255,255,255,0.9)'} />
                </View>

                {/* Sale Summary */}
                <DetailSection title="Sale Summary">
                    <View style={styles.summaryBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, gap: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <AppText label="Transaction ID" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={`#${item.invoice_number}`}
                                    fontSize={18}
                                    variant={1}
                                    color={colors.text}
                                    numberOfLines={1}
                                />
                            </View>
                            <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                                <AppText label="Total Amount" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={formatCurrency(Number(String(item.amount ?? 0).replace(/,/g, '')) || 0)}
                                    fontSize={18}
                                    variant={1}
                                    color={config.THEME_COLOR}
                                    style={{ fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                        </View>
                        <View style={styles.tagRow}>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="package" size={14} color={colors.textSecondary} />
                                <AppText label={`${item.itemCount || 0} Items`} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                            </View>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="wallet" size={14} color={colors.textSecondary} />
                                <AppText label={item.payment_method === 'cash' ? "Cash Sale" : item.payment_method === 'mobile_money' ? "Mobile Money Sale" : item.payment_method === 'card' ? "Card Sale" : "Other Sale"} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                            </View>
                        </View>
                    </View>
                </DetailSection>

                {/* Customer info section */}
                <DetailSection title="Customer Information">
                    <DetailRow icon="user" label="Customer Name" value={item.customer ? item.customer : 'Walk-in'} />
                    <DetailRow icon="phone" label="Contact Number" value={item.customer_phone ? item.customer_phone : 'N/A'} />
                    <DetailRow icon="map-pin" label="Location" value={item.customer_address ? item.customer_address : 'N/A'} />
                    {item.customer_phone ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleCallCustomer}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    backgroundColor: config.THEME_COLOR + '15',
                                }}
                            >
                                <Lucide name="phone" size={16} color={config.THEME_COLOR} style={{ marginRight: 6 }} />
                                <AppText label="Call customer" fontSize={13} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </DetailSection>

                {/* Payment Info */}
                <DetailSection title="Payment & Reference">
                    <DetailRow icon="hash" label="Receipt Number" value={item.payment_refrence ?? 'N/A'} />
                    <DetailRow icon="credit-card" label="Payment Method" value= {item.payment_method === 'cash' ? "Cash" : item.payment_method === 'mobile_money' ? `Mobile Money (${item.payment_number})` : item.payment_method === 'card' ? "Card" : "Other"} />
                </DetailSection>

                <DetailSection title="Sold Items">
                    {item.products?.map((prod, i) => (
                        <View key={prod.sku || prod.id || i} style={[styles.itemRow, { borderBottomColor: colors.borderLight }]}>
                            <Image
                                source={
                                    prod.thumbnail
                                        ? { uri: `${config.BASE_API}/images?id=${prod.thumbnail}` }
                                        : require('../../assets/images/product-image-placeholder.png')
                                }
                                style={[styles.itemImage, { backgroundColor: colors.surfaceTertiary }]}
                                resizeMode="cover"
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label={prod.name} fontSize={14} variant={1} color={colors.text} />
                                {/* <AppText label="Category: Food" fontSize={12} color={colors.textTertiary} /> */}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <AppText label={`x ${prod.quantity}`} fontSize={14} variant={1} color={colors.text} />
                                <AppText
                                    label={formatCurrency(Number(prod.quantity || 0) * Number(prod.unit_price || 0))}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                        </View>
                    ))}
                </DetailSection>

                {!isPendingUpload && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setShowInvoiceShare(true)}
                        style={[styles.invoiceCta, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <Lucide name="send" size={18} color="#fff" />
                        <AppText label="Send invoice" variant={1} fontSize={15} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                )}
            </ScrollView>

            <InvoiceShareSheet
                visible={showInvoiceShare}
                sale={item}
                saleId={saleId || item?.id}
                appSettings={appSettings}
                onClose={() => setShowInvoiceShare(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerActionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusHeader: {
        padding: 20,
        borderRadius: 5,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 15,
    },
    section: {
        borderRadius: 5,
        padding: 15,
        marginBottom: 15,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    sectionTitle: {
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
    },
    invoiceCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        marginBottom: 24,
    },
});

export default SaleDetails;