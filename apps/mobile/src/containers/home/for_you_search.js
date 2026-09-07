import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { catalog } from '../../services/api';
import Toast from 'react-native-toast-message';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';

const getProductImageUri = (item) =>
    item?.thumbnail || item?.picture1 || item?.picture2 || item?.image || item?.image_url || item?.photo || null;

const ForYouSearch = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { warehouseId } = route?.params || {};
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState([]);

    const voiceSearch = useVoiceSearch({
        onResult: setQuery,
        onError: (message) => {
            if (Toast?.show) Toast.show({ type: 'error', text1: message });
        },
    });

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!warehouseId) return;
            setLoading(true);
            try {
                const res = await catalog.list(warehouseId);
                if (mounted) setProducts(Array.isArray(res) ? res : []);
            } catch (_) {
                if (mounted) setProducts([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [warehouseId]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) => {
            const name = String(p?.name || '').toLowerCase();
            const sku = String(p?.sku || '').toLowerCase();
            const barCode = String(p?.bar_code || '').toLowerCase();
            const description = String(p?.description || '').toLowerCase();
            return name.includes(q) || sku.includes(q) || barCode.includes(q) || description.includes(q);
        });
    }, [products, query]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                    <Lucide name="chevron-left" size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={[styles.searchWrap, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name="search" size={16} color={colors.textTertiary || colors.textSecondary} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search name, SKU, or code..."
                        placeholderTextColor={colors.placeholder}
                        style={[styles.searchInput, { color: colors.text }]}
                        autoFocus
                    />
                    <TouchableOpacity
                        onPress={voiceSearch.toggle}
                        disabled={!voiceSearch.supported}
                        style={{ padding: 6, opacity: voiceSearch.supported ? 1 : 0.4 }}
                        accessibilityLabel={voiceSearch.listening ? 'Stop voice search' : 'Voice search'}
                    >
                        <Lucide
                            name={voiceSearch.listening ? 'square' : 'mic'}
                            size={18}
                            color={voiceSearch.listening ? '#DC2626' : config.THEME_COLOR}
                        />
                    </TouchableOpacity>
                    {!!query && (
                        <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
                            <Lucide name="x" size={16} color={colors.textTertiary || colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={config.THEME_COLOR} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {filtered.length === 0 ? (
                        <View style={styles.emptyWrap}>
                            <Lucide name="search-x" size={30} color={colors.border} />
                            <AppText label="No products found" color={colors.textSecondary} style={{ marginTop: 8 }} />
                        </View>
                    ) : (
                        filtered.map((item) => (
                            <TouchableOpacity
                                key={String(item.id)}
                                activeOpacity={0.85}
                                style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                onPress={() =>
                                    navigation.navigate('ForYouProductDetails', {
                                        product: item,
                                        warehouseId,
                                    })
                                }
                            >
                                {getProductImageUri(item) ? (
                                    <Image
                                        source={{ uri: `${config.BASE_API}/images?id=${getProductImageUri(item)}` }}
                                        style={styles.image}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={[styles.image, styles.imageFallback, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="image" size={16} color={colors.textTertiary || colors.textSecondary} />
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <AppText label={item?.name || 'Product'} variant={1} color={colors.text} numberOfLines={2} />
                                    <AppText
                                        label={Number(item?.quantity_available || 0) > 0 ? 'In stock' : 'Out of stock'}
                                        color={Number(item?.quantity_available || 0) > 0 ? '#16A34A' : '#DC2626'}
                                        fontSize={12}
                                        style={{ marginTop: 4 }}
                                    />
                                    <AppText
                                        label={`GHS ${Number(item?.base_price_per_unit || item?.unit_price || 0).toFixed(2)}`}
                                        color={config.THEME_COLOR}
                                        fontSize={13}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                                <Lucide name="chevron-right" size={17} color={colors.textTertiary || colors.textSecondary} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    topBar: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    searchWrap: {
        flex: 1,
        height: 42,
        borderRadius: 99,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        marginHorizontal: 8,
        fontSize: 14,
        fontFamily: 'FiraSans-Regular',
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 12, paddingBottom: 28 },
    emptyWrap: { marginTop: 80, alignItems: 'center' },
    rowCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    image: { width: 56, height: 56, borderRadius: 10 },
    imageFallback: { alignItems: 'center', justifyContent: 'center' },
});

export default ForYouSearch;
