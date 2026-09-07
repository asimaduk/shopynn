import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AdjustmentItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    const refLabel = item.reference_number || (item.id ? `#${String(item.id).slice(0, 8)}` : `#${index + 1}`);
    const warehouse = item.warehouse_name || item.warehouse_id || '—';
    const dateStr = formatDate(item.created_at);
    const count = item.number_of_items ?? (Array.isArray(item.products) ? item.products.length : 0);
    const notesSnippet = item.notes ? (item.notes.length > 40 ? `${item.notes.slice(0, 40)}…` : item.notes) : null;
    const hasAddition = Array.isArray(item.products) && item.products.some((p) => (p.adjustment_type || p.type) === 'addition');
    const hasSubtraction = Array.isArray(item.products) && item.products.some((p) => (p.adjustment_type || p.type) === 'subtraction');
    const typeColor = hasSubtraction && !hasAddition ? colors.error : config.GREEN_COLOR || colors.success;

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.itemContainer, { backgroundColor: colors.surface }]}
            onPress={onPress}
        >
            <AppText label={`${index + 1}.`} style={[styles.itemIndex, { color: colors.textSecondary }]} fontSize={14} />
            <View style={styles.itemContent}>
                <AppText label={refLabel} style={styles.itemName} color={colors.text} numberOfLines={1} />

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2 }}>
                    <Lucide name="map-pin" color={colors.textSecondary} size={12} style={{ marginRight: 4 }} />
                    <AppText label={warehouse} style={[styles.itemDetail, { marginRight: 10, color: colors.textSecondary }]} numberOfLines={1} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Lucide name="calendar" color={colors.textSecondary} size={12} style={{ marginRight: 4 }} />
                    <AppText label={dateStr} style={[styles.itemDetail, { color: colors.textSecondary }]} />
                </View>

                {notesSnippet ? (
                    <AppText label={notesSnippet} style={[styles.itemDetail, { fontSize: 11, color: colors.textTertiary }]} numberOfLines={1} />
                ) : null}
            </View>

            <View style={[styles.itemPriceContainer, { alignItems: 'flex-end' }]}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: typeColor || config.THEME_COLOR,
                    borderWidth: 0,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                }}>
                    <Lucide 
                        name={hasSubtraction && !hasAddition ? 'minus' : 'plus'}
                        size={12}
                        color={colors.textInverse || '#fff'}
                        style={{ marginRight: 2 }}
                    />
                    <AppText
                        label={String(count)}
                        style={{
                            color: colors.textInverse || '#fff',
                            fontWeight: 'bold',
                            fontSize: 14,
                        }}
                    />
                </View>
                <AppText label={`${count} item(s)`} style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }} />
            </View>
        </TouchableOpacity>
    );
};

export default AdjustmentItem;
