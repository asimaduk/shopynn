import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const AdjustmentItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    const refLabel = item.reference_number || (item.id ? `#${String(item.id).slice(0, 8)}` : `#${index + 1}`);
    const warehouse = item.warehouse_name || item.warehouse_id || '—';
    const count = item.number_of_items ?? (Array.isArray(item.products) ? item.products.length : 0);
    const notesSnippet = item.notes
        ? item.notes.length > 40
            ? `${item.notes.slice(0, 40)}…`
            : item.notes
        : null;
    const hasAddition =
        Array.isArray(item.products) && item.products.some((p) => (p.adjustment_type || p.type) === 'addition');
    const hasSubtraction =
        Array.isArray(item.products) && item.products.some((p) => (p.adjustment_type || p.type) === 'subtraction');
    const typeColor = hasSubtraction && !hasAddition ? colors.error || '#ef4444' : config.GREEN_COLOR || colors.success;

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.topRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${typeColor}18` }]}>
                    <Lucide
                        name={hasSubtraction && !hasAddition ? 'minus' : 'plus'}
                        size={18}
                        color={typeColor}
                    />
                </View>
                <View style={styles.main}>
                    <AppText label={refLabel} variant={1} fontSize={15} color={colors.text} numberOfLines={1} />
                    <View style={styles.metaRow}>
                        <Lucide name="map-pin" size={12} color={colors.textTertiary} />
                        <AppText label={warehouse} fontSize={12} color={colors.textSecondary} numberOfLines={1} style={styles.metaText} />
                    </View>
                    <View style={styles.metaRow}>
                        <Lucide name="calendar" size={12} color={colors.textTertiary} />
                        <AppText label={formatDate(item.created_at)} fontSize={12} color={colors.textTertiary} style={styles.metaText} />
                    </View>
                    {notesSnippet ? (
                        <AppText label={notesSnippet} fontSize={12} color={colors.textTertiary} numberOfLines={1} style={{ marginTop: 3 }} />
                    ) : null}
                </View>
                <View style={styles.trailing}>
                    <View style={[styles.countPill, { backgroundColor: typeColor }]}>
                        <Lucide
                            name={hasSubtraction && !hasAddition ? 'minus' : 'plus'}
                            size={12}
                            color="#fff"
                            style={{ marginRight: 2 }}
                        />
                        <AppText label={String(count)} fontSize={13} color="#fff" variant={1} />
                    </View>
                    <AppText
                        label={`${count} item${count === 1 ? '' : 's'}`}
                        fontSize={11}
                        color={colors.textTertiary}
                        style={{ marginTop: 6 }}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start' },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    main: { flex: 1, minWidth: 0, marginRight: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    metaText: { marginLeft: 6, flex: 1 },
    trailing: { alignItems: 'flex-end' },
    countPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

export default AdjustmentItem;
