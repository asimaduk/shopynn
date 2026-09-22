import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import { formatDateAndTime, formatCurrency } from '../../utils/format';

const ExpenditureItem = ({ item, onPress }) => {
    const { colors } = useTheme();
    const creator = `${item.creator_first_name || ''} ${item.creator_last_name || ''}`.trim();
    const category = item.category || 'Uncategorized';
    const initials = String(category)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || 'E';

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.topRow}>
                <View style={[styles.avatar, { backgroundColor: `${colors.error || '#ef4444'}18` }]}>
                    <AppText label={initials} variant={1} fontSize={13} color={colors.error || '#ef4444'} />
                </View>
                <View style={styles.main}>
                    <AppText
                        label={item.description || 'Expense'}
                        variant={1}
                        fontSize={15}
                        color={colors.text}
                        numberOfLines={1}
                    />
                    <View style={styles.metaRow}>
                        <Lucide name="tag" size={12} color={colors.textTertiary} />
                        <AppText label={category} fontSize={12} color={colors.textSecondary} numberOfLines={1} style={styles.metaText} />
                    </View>
                    <View style={styles.metaRow}>
                        <Lucide name="calendar" size={12} color={colors.textTertiary} />
                        <AppText
                            label={[formatDateAndTime(item.created_at || item.expense_date), creator].filter(Boolean).join(' · ')}
                            fontSize={12}
                            color={colors.textTertiary}
                            numberOfLines={1}
                            style={styles.metaText}
                        />
                    </View>
                </View>
                <View style={styles.trailing}>
                    <AppText
                        label={formatCurrency(item.amount)}
                        variant={1}
                        fontSize={15}
                        color={colors.error || '#ef4444'}
                        style={{ fontVariant: ['tabular-nums'] }}
                    />
                    <Lucide name="chevron-right" color={colors.border} size={18} style={{ marginTop: 6 }} />
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
    avatar: {
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
});

export default ExpenditureItem;
