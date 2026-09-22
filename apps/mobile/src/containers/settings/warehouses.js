import React, { useState, useCallback, useMemo } from 'react';
import { TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import WarehouseItem from './warehouse_item';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { warehouses as warehousesApi, normalizeList } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const Warehouses = ({ navigation }) => {
    const { colors } = useTheme();
    const [searchText, setSearchText] = useState('');
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadWarehouses = useCallback(async () => {
        try {
            const raw = await warehousesApi.list();
            const items = normalizeList(raw);
            setList(Array.isArray(items) ? items : []);
        } catch (_) {
            setList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadWarehouses();
        }, [loadWarehouses]),
    );

    const data = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (item) =>
                item.name?.toLowerCase().includes(q) ||
                item.location?.toLowerCase().includes(q) ||
                item.manager?.toLowerCase().includes(q) ||
                item.reference_code?.toLowerCase().includes(q),
        );
    }, [list, searchText]);

    const filtering = searchText.trim().length > 0;

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Warehouses / Stores">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('CreateWarehouse')}
                    style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                >
                    <Lucide name="plus" color={config.THEME_COLOR} size={18} />
                </TouchableOpacity>
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="store" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${data.length} store${data.length === 1 ? '' : 's'}`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
            </View>

            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search name, location, or manager"
                    placeholderTextColor={colors.placeholder}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {searchText.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading warehouses..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <View style={styles.listWrap}>
                    <FlashList
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        data={data}
                        estimatedItemSize={100}
                        showsVerticalScrollIndicator={false}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => <WarehouseItem item={item} navigation={navigation} />}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyWrap}>
                                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="store" color={colors.textTertiary} size={28} />
                                </View>
                                <AppText
                                    label={filtering ? 'No warehouses match' : 'No warehouses yet'}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.text}
                                    style={{ marginTop: 12 }}
                                />
                                <AppText
                                    label={filtering ? 'Try another search' : 'Add a store or warehouse to get started'}
                                    fontSize={13}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                                {!filtering ? (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => navigation.navigate('CreateWarehouse')}
                                        style={[styles.emptyCta, { backgroundColor: config.THEME_COLOR }]}
                                    >
                                        <Lucide name="plus" size={16} color="#fff" />
                                        <AppText label="Add warehouse" color="#fff" variant={1} fontSize={14} style={{ marginLeft: 6 }} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        )}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

export default Warehouses;

const styles = StyleSheet.create({
    safe: { flex: 1 },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 10,
    },
    summaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 46,
    },
    searchInput: { flex: 1, marginLeft: 8, fontFamily: 'FiraSans-Regular', fontSize: 14 },
    listWrap: { flex: 1, minHeight: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 28 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { paddingTop: 48, paddingHorizontal: 24, alignItems: 'center' },
    emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
});
