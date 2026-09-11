import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { transfers as transfersApi } from '../../services/api';

const defaultItem = {
    id: '',
    status: 'Completed',
    source_warehouse_name: '',
    destination_warehouse_name: '',
    number_of_items: 0,
    created_at: new Date().toISOString(),
    reason: '',
    items: [],
};

const TransferDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: initialItem, transferId } = route.params || {};
    const [item, setItem] = useState(initialItem || defaultItem);
    const [loading, setLoading] = useState(!!(transferId || initialItem?.id));

    useEffect(() => {
        const id = transferId || initialItem?.id;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        transfersApi
            .get(id)
            .then((data) => {
                console.log('transfer details data', data);
                if (!mounted || !data) return;
                setItem((prev) => ({ ...prev, ...data }));
            })
            .catch((err) => {
                const msg = err?.response?.data?.message || err?.message || 'Failed to load transfer.';
                Alert.alert('Error', msg);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [transferId, initialItem?.id]);

    const status = item.status || 'Completed';
    const isCompleted = status === 'Completed';
    const isPending = status === 'Pending';
    const statusColor = isCompleted ? (config.GREEN_COLOR || colors.success) : isPending ? colors.warning : colors.error;
    const statusIcon = isCompleted ? 'circle-check' : isPending ? 'clock' : 'x-circle';
    const statusBg = isCompleted ? colors.successLight : colors.warningLight;

    const sourceName = item.sourceStore || item.source_warehouse_name || '—';
    const destinationName = item.destinationStore || item.destination_warehouse_name || '—';
    const itemsSummary =
        item.itemsSummary ||
        (typeof item.number_of_items === 'number'
            ? `${item.number_of_items} item${item.number_of_items === 1 ? '' : 's'}`
            : 'Transfer');
    const dateLabel =
        item.date ||
        (item.created_at ? new Date(item.created_at).toLocaleString() : '');
    const reason = item.reason || item.notes || 'No reason provided.';

    const productLines = Array.isArray(item.items)
        ? item.items
        : Array.isArray(item.products)
            ? item.products
            : [];

    const backPress = () => {
        navigation.goBack();
    };

    const DetailRow = ({ label, value, icon, color }) => (
        <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                {icon && <Lucide name={icon} size={16} color={colors.textSecondary} style={{ marginRight: 5 }} />}
                <AppText label={label} fontSize={14} color={colors.textSecondary} />
            </View>
            <AppText label={value} fontSize={16} color={color || colors.text} fontFamily="FiraSans-Medium" />
        </View>
    );

    const ProductRow = ({ line, index }) => {
        const name = line.product_name || line.name || line.product || `Item ${index + 1}`;
        const qty = line.quantity ?? line.qty ?? line.order_quantity ?? 0;
        return (
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: index === productLines.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                }}
            >
                <AppText label={name} fontSize={14} color={colors.text} style={{ flex: 1, marginRight: 12 }} />
                <AppText label={`x${qty}`} fontSize={14} color={colors.textSecondary} fontFamily="FiraSans-Medium" />
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading transfer..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Transfer Details'} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>

                    <View style={{ alignItems: 'center', marginBottom: 25, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: statusBg, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                            <Lucide name={statusIcon} size={30} color={statusColor} />
                        </View>
                        <AppText label={itemsSummary} fontSize={18} fontFamily="FiraSans-Bold" color={colors.text} style={{ textAlign: 'center', marginBottom: 5 }} />
                        <AppText label={status} fontSize={14} color={statusColor} fontFamily="FiraSans-SemiBold" />
                    </View>

                    <DetailRow label="Source Store" value={sourceName} icon="log-out" />
                    <DetailRow label="Destination Store" value={destinationName} icon="log-in" />
                    <DetailRow label="Date & Time" value={dateLabel} icon="calendar" />

                    <View style={{ marginTop: 10, backgroundColor: colors.surfaceSecondary, padding: 15, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.border }}>
                        <AppText label="Reason for Transfer" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 5 }} />
                        <AppText label={reason} fontSize={16} color={colors.text} style={{ lineHeight: 22 }} />
                    </View>

                    {productLines.length > 0 && (
                        <View
                            style={{
                                marginTop: 20,
                                backgroundColor: colors.surfaceSecondary,
                                padding: 15,
                                borderRadius: 8,
                                marginBottom: 10,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <Lucide name="boxes" size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
                                <AppText
                                    label="Products Transferred"
                                    fontSize={14}
                                    color={colors.textSecondary}
                                    fontFamily="FiraSans-SemiBold"
                                />
                            </View>
                            {productLines.map((line, idx) => (
                                <ProductRow key={line.id || line.product_id || `${idx}`} line={line} index={idx} />
                            ))}
                        </View>
                    )}

                    
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default TransferDetails;
