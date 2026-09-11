import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import config from '../../config';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../../hooks/useTheme';

const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AdjustmentDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item } = route.params || {};
    const refLabel = item.reference_number || (item.id ? `#${String(item.id).slice(0, 8)}` : 'Adjustment');
    const dateStr = formatDate(item.created_at);
    const warehouse = item.warehouse_name || item.warehouse_id || '—';
    const products = Array.isArray(item.products) ? item.products : [];
    const hasAddition = products.some((p) => (p.adjustment_type || p.type) === 'addition');
    const hasSubtraction = products.some((p) => (p.adjustment_type || p.type) === 'subtraction');
    const icon = hasSubtraction && !hasAddition ? 'minus' : 'plus';
    const color = hasSubtraction && !hasAddition ? colors.error : config.GREEN_COLOR || colors.success;
    const iconBg = hasSubtraction && !hasAddition ? colors.errorLight : colors.successLight;

    const backPress = () => {
        navigation.goBack();
    };

    const DetailRow = ({ label, value, icon: rowIcon, color: rowColor }) => (
        <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                {rowIcon && <Lucide name={rowIcon} size={16} color={colors.textSecondary} style={{ marginRight: 5 }} />}
                <AppText label={label} fontSize={14} color={colors.textSecondary} />
            </View>
            <AppText label={value} fontSize={16} color={rowColor || colors.text} fontFamily="FiraSans-Medium" />
        </View>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Adjustment Details" />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>

                    <View style={{ alignItems: 'center', marginBottom: 25, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: iconBg, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                            <Lucide name={icon} size={30} color={color} />
                        </View>
                        <AppText label={refLabel} fontSize={20} fontFamily="FiraSans-Bold" color={colors.text} style={{ textAlign: 'center', marginBottom: 5 }} />
                        <AppText label={`${item.number_of_items ?? products.length} item(s)`} fontSize={14} color={colors.textSecondary} />
                    </View>

                    <DetailRow label="Reference" value={refLabel} icon="hash" />
                    <DetailRow label="Date & Time" value={dateStr} icon="calendar" />
                    <DetailRow label="Warehouse" value={warehouse} icon="map-pin" />

                    {products.length > 0 && (
                        <View style={{ marginTop: 8, marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Lucide name="package" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                                <AppText label="Products" fontSize={14} color={colors.textSecondary} fontFamily="FiraSans-SemiBold" />
                            </View>
                            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 12 }}>
                                {products.map((p, idx) => {
                                    const isAdd = (p.adjustment_type || p.type) === 'addition';
                                    const typeColor = isAdd ? config.GREEN_COLOR || colors.success : colors.error;
                                    return (
                                        <View
                                            key={p.product_id || idx}
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                paddingVertical: 10,
                                                borderBottomWidth: idx === products.length - 1 ? 0 : 1,
                                                borderBottomColor: colors.border,
                                            }}
                                        >
                                            <AppText label={p.product_name || 'Product'} fontSize={14} color={colors.text} style={{ flex: 1 }} numberOfLines={2} />
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                                                <Lucide name={isAdd ? 'plus' : 'minus'} size={14} color={typeColor} style={{ marginRight: 4 }} />
                                                <AppText label={`${p.quantity ?? 0}`} fontSize={14} fontFamily="FiraSans-SemiBold" color={typeColor} />
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    <View style={{ marginTop: 10, backgroundColor: colors.surfaceSecondary, padding: 15, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.border }}>
                        <AppText label="Notes" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 5 }} />
                        <AppText label={item.notes || 'No notes provided.'} fontSize={16} color={colors.text} style={{ lineHeight: 22 }} />
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AdjustmentDetails;
