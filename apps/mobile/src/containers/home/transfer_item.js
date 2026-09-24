import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const TransferItem = ({ item, onPress }) => {
    const { colors } = useTheme();
    const statusRaw = String(item.status ?? item.status_label ?? '').toLowerCase();
    const status =
        item.status_label ||
        (statusRaw === 'pending'
            ? 'Pending'
            : statusRaw === 'received' || statusRaw === 'completed'
              ? 'Received'
              : item.status || 'Pending');
    const statusColor =
        status === 'Received' || status === 'Completed'
            ? config.GREEN_COLOR || colors.success
            : status === 'Pending'
              ? colors.warning || '#f59e0b'
              : colors.textSecondary;
    const itemCount = Number(item.number_of_items || 0);
    const dateLabel = item.created_at
        ? new Date(item.created_at).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '—';

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.topRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                    <Lucide name="arrow-right-left" size={18} color={config.THEME_COLOR} />
                </View>
                <View style={styles.main}>
                    <View style={styles.routeRow}>
                        <AppText
                            label={item.source_warehouse_name || 'Source'}
                            variant={1}
                            fontSize={14}
                            color={colors.text}
                            numberOfLines={1}
                            style={{ flexShrink: 1 }}
                        />
                        <Lucide name="arrow-right" color={colors.textTertiary} size={14} style={{ marginHorizontal: 6 }} />
                        <AppText
                            label={item.destination_warehouse_name || 'Destination'}
                            variant={1}
                            fontSize={14}
                            color={colors.text}
                            numberOfLines={1}
                            style={{ flexShrink: 1 }}
                        />
                    </View>
                    <View style={styles.metaRow}>
                        <Lucide name="package" size={12} color={colors.textTertiary} />
                        <AppText
                            label={`${itemCount} item${itemCount === 1 ? '' : 's'}`}
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginLeft: 6 }}
                        />
                    </View>
                    <View style={styles.metaRow}>
                        <Lucide name="calendar" size={12} color={colors.textTertiary} />
                        <AppText label={dateLabel} fontSize={12} color={colors.textTertiary} style={{ marginLeft: 6 }} numberOfLines={1} />
                    </View>
                </View>
                <View style={styles.trailing}>
                    <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                        <AppText label={status} fontSize={11} color={statusColor} variant={1} />
                    </View>
                    <Lucide name="chevron-right" color={colors.border} size={18} style={{ marginTop: 8 }} />
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
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    trailing: { alignItems: 'flex-end' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
});

export default TransferItem;
