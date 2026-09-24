import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    TextInput,
    Switch,
} from 'react-native';
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
    status: 'pending',
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
    const [receiving, setReceiving] = useState(false);
    const [allReceived, setAllReceived] = useState(true);
    const [qtyByKey, setQtyByKey] = useState({});

    const load = async () => {
        const id = transferId || initialItem?.id;
        if (!id) return;
        setLoading(true);
        try {
            const data = await transfersApi.get(id);
            if (data) {
                setItem((prev) => ({ ...prev, ...data }));
                const lines = Array.isArray(data.products)
                    ? data.products
                    : Array.isArray(data.items)
                      ? data.items
                      : [];
                const next = {};
                for (const line of lines) {
                    const key = String(line.detail_id || line.product_id || line.id);
                    next[key] = String(line.quantity_received ?? line.quantity ?? 0);
                }
                setQtyByKey(next);
                setAllReceived(true);
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to load transfer.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transferId, initialItem?.id]);

    const statusRaw = String(item.status || '').toLowerCase();
    const isPending = statusRaw === 'pending';
    const isReceived = statusRaw === 'received' || statusRaw === 'completed';
    const statusLabel = item.status_label || (isPending ? 'Pending' : isReceived ? 'Received' : item.status || '—');
    const statusColor = isReceived
        ? config.GREEN_COLOR || colors.success
        : isPending
          ? colors.warning || '#f59e0b'
          : colors.error;
    const statusIcon = isReceived ? 'circle-check' : isPending ? 'clock' : 'x-circle';
    const statusBg = isReceived ? colors.successLight : colors.warningLight;

    const sourceName = item.sourceStore || item.source_warehouse_name || item.source || '—';
    const destinationName =
        item.destinationStore || item.destination_warehouse_name || item.destination || '—';
    const itemsSummary =
        item.itemsSummary ||
        (typeof item.number_of_items === 'number'
            ? `${item.number_of_items} item${item.number_of_items === 1 ? '' : 's'}`
            : 'Transfer');
    const dateLabel =
        item.date || (item.created_at ? new Date(item.created_at).toLocaleString() : '');
    const reason = item.reason || item.notes || 'No reason provided.';
    const creatorName = [item.creator_first_name, item.creator_last_name].filter(Boolean).join(' ') || '—';
    const receiverName = [item.receiver_first_name, item.receiver_last_name].filter(Boolean).join(' ') || '—';

    const productLines = useMemo(() => {
        if (Array.isArray(item.items) && item.items.length) return item.items;
        if (Array.isArray(item.products) && item.products.length) return item.products;
        return [];
    }, [item.items, item.products]);

    const backPress = () => navigation.goBack();

    const handleReceive = async () => {
        const id = item.id || transferId;
        if (!id) return;
        setReceiving(true);
        try {
            const body = allReceived
                ? { all_received: true }
                : {
                      all_received: false,
                      lines: productLines.map((line) => {
                          const key = String(line.detail_id || line.product_id || line.id);
                          return {
                              detail_id: line.detail_id,
                              product_id: line.product_id,
                              quantity_received: Number(qtyByKey[key] || 0),
                          };
                      }),
                  };
            await transfersApi.receive(id, body);
            Alert.alert('Received', 'Transfer accepted. Destination stock updated.');
            await load();
        } catch (err) {
            Alert.alert(
                'Receive failed',
                err?.response?.data?.message || err?.message || 'Could not receive transfer.',
            );
        } finally {
            setReceiving(false);
        }
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

    if (loading) {
        return (
            <SafeAreaView
                edges={['bottom', 'left', 'right']}
                style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}
            >
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading transfer..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Transfer Details'} />
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <View
                    style={{
                        backgroundColor: colors.surface,
                        borderRadius: 10,
                        padding: 20,
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                    }}
                >
                    <View
                        style={{
                            alignItems: 'center',
                            marginBottom: 25,
                            paddingBottom: 20,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                        }}
                    >
                        <View
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 30,
                                backgroundColor: statusBg,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 10,
                            }}
                        >
                            <Lucide name={statusIcon} size={30} color={statusColor} />
                        </View>
                        <AppText
                            label={itemsSummary}
                            fontSize={18}
                            fontFamily="FiraSans-Bold"
                            color={colors.text}
                            style={{ textAlign: 'center', marginBottom: 5 }}
                        />
                        <AppText label={statusLabel} fontSize={14} color={statusColor} fontFamily="FiraSans-SemiBold" />
                    </View>

                    <DetailRow label="Source Store" value={sourceName} icon="log-out" />
                    <DetailRow label="Destination Store" value={destinationName} icon="log-in" />
                    <DetailRow label="Sent by" value={creatorName} icon="user" />
                    <DetailRow label="Received by" value={isPending ? '—' : receiverName} icon="user-check" />
                    <DetailRow label="Date & Time" value={dateLabel} icon="calendar" />

                    <View
                        style={{
                            marginTop: 10,
                            backgroundColor: colors.surfaceSecondary,
                            padding: 15,
                            borderRadius: 8,
                            borderLeftWidth: 3,
                            borderLeftColor: colors.border,
                        }}
                    >
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
                                    label="Products"
                                    fontSize={14}
                                    color={colors.textSecondary}
                                    fontFamily="FiraSans-SemiBold"
                                />
                            </View>
                            {productLines.map((line, idx) => {
                                const name = line.product_name || line.name || `Item ${idx + 1}`;
                                const sent = line.quantity ?? 0;
                                const got = line.quantity_received;
                                return (
                                    <View
                                        key={line.detail_id || line.product_id || `${idx}`}
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingVertical: 8,
                                            borderBottomWidth: idx === productLines.length - 1 ? 0 : 1,
                                            borderBottomColor: colors.border,
                                        }}
                                    >
                                        <AppText
                                            label={name}
                                            fontSize={14}
                                            color={colors.text}
                                            style={{ flex: 1, marginRight: 12 }}
                                        />
                                        <AppText
                                            label={
                                                got != null
                                                    ? `sent ${sent} · got ${got}`
                                                    : `sent ${sent}`
                                            }
                                            fontSize={13}
                                            color={colors.textSecondary}
                                            fontFamily="FiraSans-Medium"
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {isPending ? (
                        <View
                            style={{
                                marginTop: 8,
                                padding: 16,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#f59e0b66',
                                backgroundColor: '#f59e0b14',
                            }}
                        >
                            <AppText
                                label="Receive this transfer"
                                fontSize={15}
                                fontFamily="FiraSans-SemiBold"
                                color={colors.text}
                            />
                            <AppText
                                label="Confirm arrival. Use all received, or enter actual counts if short."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ marginTop: 6, marginBottom: 12 }}
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Switch value={allReceived} onValueChange={setAllReceived} />
                                <AppText
                                    label="All quantities received as sent"
                                    fontSize={14}
                                    color={colors.text}
                                    style={{ marginLeft: 10, flex: 1 }}
                                />
                            </View>
                            {!allReceived &&
                                productLines.map((line, idx) => {
                                    const key = String(line.detail_id || line.product_id || line.id);
                                    const name = line.product_name || line.name || `Item ${idx + 1}`;
                                    return (
                                        <View key={key} style={{ marginBottom: 10 }}>
                                            <AppText
                                                label={`${name} (sent ${line.quantity})`}
                                                fontSize={13}
                                                color={colors.textSecondary}
                                            />
                                            <TextInput
                                                value={qtyByKey[key] ?? ''}
                                                onChangeText={(t) =>
                                                    setQtyByKey((prev) => ({ ...prev, [key]: t }))
                                                }
                                                keyboardType="decimal-pad"
                                                placeholder="Received qty"
                                                placeholderTextColor={colors.textTertiary}
                                                style={{
                                                    marginTop: 6,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    borderRadius: 8,
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 10,
                                                    color: colors.text,
                                                    backgroundColor: colors.surface,
                                                }}
                                            />
                                        </View>
                                    );
                                })}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={receiving}
                                onPress={handleReceive}
                                style={{
                                    marginTop: 8,
                                    backgroundColor: config.THEME_COLOR,
                                    borderRadius: 10,
                                    paddingVertical: 14,
                                    alignItems: 'center',
                                    opacity: receiving ? 0.7 : 1,
                                }}
                            >
                                {receiving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <AppText label="Confirm receive" fontSize={15} color="#fff" fontFamily="FiraSans-SemiBold" />
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default TransferDetails;
