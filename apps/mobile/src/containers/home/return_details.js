import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { returnsApi } from '../../services/api';

const ReturnDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: paramItem, returnId, type: paramType } = route.params || {};
    const [item, setItem] = useState(paramItem || {});
    const [loading, setLoading] = useState(!!(returnId || paramItem?.id));
    const type = paramType || item.type || 'sales';
    const isSales = type === 'sales';

    const status = item.status || 'Pending';
    const isApproved = status === 'Approved';
    const isPending = status === 'Pending';
    const isRejected = status === 'Rejected';

    const statusColor = isApproved ? (config.GREEN_COLOR || colors.success) : isPending ? (config.THEME_COLOR || colors.text) : colors.error;
    const statusIcon = isApproved ? 'check-circle' : isPending ? 'clock' : 'x-circle';
    const statusBg = isApproved ? colors.successLight : isPending ? colors.primaryShade : colors.errorLight;
    const heroBg = isApproved ? colors.successLight : isPending ? colors.primaryShade : colors.errorLight;

    useEffect(() => {
        const id = returnId || paramItem?.id;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        returnsApi.get(id).then((data) => {
            if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [returnId, paramItem?.id]);

    const backPress = () => {
        navigation.goBack();
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading return..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const DetailRow = ({ label, value, icon, valueColor, isLast, onPress }) => {
        const RowContent = (
            <View style={[styles.detailRow, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}>
                <View style={[styles.detailIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name={icon} size={18} color={config.THEME_COLOR} />
                </View>
                <View style={styles.detailContent}>
                    <AppText label={label} fontSize={13} color={colors.textTertiary} style={{ marginBottom: 2 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <AppText label={value || '—'} fontSize={16} color={valueColor || colors.text} fontFamily="FiraSans-Medium" />
                        {onPress && <Lucide name="chevron-right" size={18} color={colors.textTertiary} />}
                    </View>
                </View>
            </View>
        );

        if (onPress) {
            return (
                <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
                    {RowContent}
                </TouchableOpacity>
            );
        }

        return RowContent;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={isSales ? 'Sales Return' : 'Purchase Return'} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {/* Hero: amount + ID + status */}
                <View style={[styles.hero, { backgroundColor: heroBg }]}>
                    <View style={[styles.heroIconWrap, { backgroundColor: statusColor + '25' }]}>
                        <Lucide name={isSales ? 'rotate-ccw' : 'package-x'} size={36} color={statusColor} />
                    </View>
                    <AppText label={`GHS ${item.amount || '0.00'}`} fontSize={28} fontFamily="FiraSans-Bold" color={colors.text} style={{ marginTop: 12 }} />
                    <AppText label="Return amount" fontSize={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                    <View style={styles.heroMeta}>
                        <View style={[styles.typePill, { backgroundColor: colors.surface }]}>
                            <AppText label={item.id || 'N/A'} fontSize={12} fontFamily="FiraSans-SemiBold" color={colors.text} />
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: statusColor + '25', borderColor: statusColor }]}>
                            <Lucide name={statusIcon} size={14} color={statusColor} />
                            <AppText label={status} fontSize={12} fontFamily="FiraSans-SemiBold" color={statusColor} style={{ marginLeft: 6 }} />
                        </View>
                    </View>
                </View>

                {/* Details card */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                        <Lucide name="list" size={18} color={config.THEME_COLOR} />
                        <AppText label="Details" fontSize={16} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginLeft: 8 }} />
                    </View>
                    <View style={styles.cardBody}>
                        <DetailRow label="Reference" value={item.ref || 'N/A'} icon="hash" />
                        <DetailRow
                            label={isSales ? 'Customer' : 'Supplier'}
                            value={isSales ? (item.customer || 'N/A') : (item.supplier || 'N/A')}
                            icon={isSales ? 'user' : 'truck'}
                        />
                        <DetailRow label="Date & time" value={item.date || 'N/A'} icon="calendar" />
                        <DetailRow
                            label="Items"
                            value={`${item.items ?? 0} item${(item.items ?? 0) !== 1 ? 's' : ''}`}
                            icon="package"
                            isLast
                            onPress={() => {
                                if ((item.items ?? 0) > 0) {
                                    navigation.navigate('ReturnItems', { item, type });
                                }
                            }}
                        />
                    </View>
                </View>

                {/* Reason card */}
                <View style={[styles.reasonCard, { backgroundColor: colors.surface, borderLeftColor: config.THEME_COLOR }]}>
                    <View style={styles.reasonHeader}>
                        <View style={[styles.reasonIconWrap, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="message-square" size={20} color={config.THEME_COLOR} />
                        </View>
                        <AppText label="Reason for return" fontSize={15} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginLeft: 12 }} />
                    </View>
                    <AppText
                        label={item.reason || 'No reason provided.'}
                        fontSize={15}
                        color={colors.textSecondary}
                        style={[styles.reasonText, { color: colors.textSecondary }]}
                    />
                </View>

                {/* Actions – only when pending */}
                {isPending && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.actionBtn, styles.approveBtn, { backgroundColor: config.GREEN_COLOR || colors.success }]}
                            onPress={() => {}}>
                            <Lucide name="check" size={20} color={colors.textInverse} />
                            <AppText label="Approve" fontSize={15} variant={1} color={colors.textInverse} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.actionBtn, styles.rejectBtn, { backgroundColor: colors.error }]}
                            onPress={() => {}}>
                            <Lucide name="x" size={20} color={colors.textInverse} />
                            <AppText label="Reject" fontSize={15} variant={1} color={colors.textInverse} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Info banner */}
                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name="info" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                    <AppText
                        label={
                            isApproved
                                ? `This ${isSales ? 'sales' : 'purchase'} return has been approved and processed.`
                                : isPending
                                ? 'This return is pending approval.'
                                : 'This return has been rejected.'
                        }
                        fontSize={13}
                        color={colors.textTertiary}
                        style={{ flex: 1, lineHeight: 20 }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    hero: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    heroIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 10,
    },
    typePill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    card: {
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    cardBody: {
        padding: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    detailIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    detailContent: {
        flex: 1,
    },
    reasonCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    reasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    reasonIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reasonText: {
        lineHeight: 22,
        paddingLeft: 0,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    approveBtn: {},
    rejectBtn: {},
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 10,
    },
});

export default ReturnDetails;
