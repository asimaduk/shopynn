import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { purchases as purchasesApi } from '../../services/api';

const defaultItem = { id: 'N/A', vendor: 'Unknown', amount: '0.00', date: 'N/A', status: 'N/A', poStatus: 'draft', user: 'Unknown', itemCount: 0 };

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const formatCurrency = (value) => formatter.format(Number(value)).replace('GH₵', '').trim();

const PurchaseDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: routeItem, purchaseId } = route.params || {};
    const [item, setItem] = useState(routeItem || defaultItem);
    const [loading, setLoading] = useState(!!(purchaseId || routeItem?.id));
    const poStatus = item.poStatus || 'received';

    useEffect(() => {
        const id = purchaseId || routeItem?.id;
        if (!id || id === 'N/A') return;
        let mounted = true;
        setLoading(true);
        purchasesApi.get(id).then((data) => {
            // console.log('purchase details data', data);
            if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [purchaseId, routeItem?.id]);

    const backPress = () => navigation.goBack();
    const markAsSent = () => { setItem((prev) => ({ ...prev, poStatus: 'sent' })); Alert.alert('Updated', 'Purchase order marked as Sent.'); };
    const markAsReceived = () => { setItem((prev) => ({ ...prev, poStatus: 'received', status: 'Completed' })); Alert.alert('Updated', 'Purchase order marked as Received.'); };

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
                <AppText label="Loading purchase..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const formatDateAndTime = (date) => {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Purchase Details'}>
                {/* <TouchableOpacity
                    activeOpacity={0.6}
                    style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                >
                    <Lucide name="printer" color={colors.textSecondary} size={20} />
                </TouchableOpacity> */}
            </ScreenHeader>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                {/* Status Header */}
                <View style={[styles.statusHeader, { backgroundColor: item.current_status === 1 ? config.GREEN_COLOR : '#ff9800' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <AppText label={item.current_status == 1 ? 'Received' : 'Pending'} fontSize={20} variant={2} color={'#fff'} />
                            {/* <AppText label={`PO: ${poStatus}`} fontSize={12} color={'rgba(255,255,255,0.9)'} style={{ marginTop: 2 }} /> */}
                            <AppText label={formatDateAndTime(item.created_at)} fontSize={13} color={'rgba(255,255,255,0.8)'} />
                        </View>
                        <Lucide name={item.current_status === 1 ? "circle-check" : "clock"} size={32} color="#fff" />
                    </View>
                    <View style={styles.divider} />
                    <AppText label={`Recorded by ${item.receiver_name}`} fontSize={13} color={'rgba(255,255,255,0.9)'} />
                    {(poStatus === 'draft' || poStatus === 'sent') && (
                        <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
                            {poStatus === 'draft' && (
                                <TouchableOpacity activeOpacity={0.8} onPress={markAsSent} style={[styles.poActionBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Lucide name="send" size={16} color="#fff" />
                                    <AppText label="Mark as Sent" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            )}
                            {poStatus === 'sent' && (
                                <TouchableOpacity activeOpacity={0.8} onPress={markAsReceived} style={[styles.poActionBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Lucide name="package-check" size={16} color="#fff" />
                                    <AppText label="Mark as Received" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Purchase Summary */}
                <DetailSection title="Order Summary">
                    <View style={styles.summaryBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                            <View>
                                <AppText label="Purchase ID" fontSize={12} color={colors.textTertiary} />
                                <AppText label={`#${item.invoice_number}`} fontSize={18} variant={1} color={colors.text} />
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <AppText label="Total Amount" fontSize={12} color={colors.textTertiary} />
                                <AppText label={formatCurrency(item.total_amount)} fontSize={18} variant={1} color={config.THEME_COLOR} />
                            </View>
                        </View>
                        <View style={styles.tagRow}>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="package" size={14} color={colors.textSecondary} />
                                <AppText label={`${item.number_of_items} Items`} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                            </View>
                            {/* <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="wallet" size={14} color={colors.textSecondary} />
                                <AppText label="Credit Purchase" fontSize={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                            </View> */}
                        </View>
                    </View>
                </DetailSection>

                {/* Basic info section */}
                <DetailSection title="Supplier Information">
                    <DetailRow icon="store" label="Name" value={item.supplier} />
                    <DetailRow icon="user" label="Contact Person" value={item.supplier_manager ?? 'N/A'} />
                    <DetailRow icon="map-pin" label="Business Location" value={item.supplier_address ?? 'N/A'} />
                </DetailSection>

                {/* Payment Info */}
                <DetailSection title="Payment & Reference">
                    <DetailRow icon="hash" label="Reference ID" value={item.invoice_number ?? 'N/A'} />
                    <DetailRow icon="calendar-days" label="Settlement Due" value={formatDateAndTime(item.created_at)} />
                </DetailSection>

                {/* Items List Placeholder */}
                <DetailSection title="Purchased Items">
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
                                {/* <AppText label="Category: General" fontSize={12} color={colors.textTertiary} /> */}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <AppText label={`x ${prod.quantity}`} fontSize={14} variant={1} color={colors.text} />
                                <AppText label={formatCurrency(prod.quantity * prod.unit_price)} fontSize={12} color={colors.textTertiary} />
                            </View>
                        </View>
                    ))}
                </DetailSection>
            </ScrollView>
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
    poActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
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
});

export default PurchaseDetails;