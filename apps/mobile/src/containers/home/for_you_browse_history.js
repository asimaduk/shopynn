import React, { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { clearBrowseHistory, loadBrowseHistory } from '../../utils/forYouBrowseHistory';

const resolveImageUrl = (raw) => {
    if (!raw) return '';
    if (/^(https?:|data:|file:)/i.test(String(raw))) return String(raw);
    return `${config.BASE_API}/images?id=${encodeURIComponent(raw)}`;
};

const formatMoney = (n) => `GHS ${Number(n || 0).toFixed(2)}`;

const ForYouBrowseHistory = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { warehouseId } = route?.params || {};
    const [history, setHistory] = useState([]);

    const refresh = useCallback(async () => {
        const list = await loadBrowseHistory(warehouseId);
        setHistory(Array.isArray(list) ? list : []);
    }, [warehouseId]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh]),
    );

    const onClear = () => {
        if (!history.length) return;
        Alert.alert('Clear browsing history?', 'Remove all products from your browsing history.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                    await clearBrowseHistory(warehouseId);
                    setHistory([]);
                },
            },
        ]);
    };

    const openProduct = (item) => {
        const product = item?.product || item;
        if (!product?.id) return;
        navigation.navigate('ForYouProductDetails', { product, warehouseId });
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Browsing history">
                {history.length > 0 ? (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onClear}
                        style={[styles.clearBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                ) : null}
            </ScreenHeader>

            {history.length === 0 ? (
                <View style={styles.empty}>
                    <Lucide name="history" size={36} color={colors.border} />
                    <AppText
                        label="No browsing history yet"
                        variant={1}
                        color={colors.text}
                        style={{ marginTop: 12 }}
                    />
                    <AppText
                        label="Products you open will show up here."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}
                    />
                </View>
            ) : (
                <FlashList
                    data={history}
                    estimatedItemSize={88}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    renderItem={({ item }) => {
                        const uri = resolveImageUrl(item.thumbnail);
                        const name = item.name || item.product?.name || 'Product';
                        return (
                            <TouchableOpacity
                                activeOpacity={0.88}
                                onPress={() => openProduct(item)}
                                style={[
                                    styles.row,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.thumb,
                                        { backgroundColor: colors.surfaceSecondary },
                                    ]}
                                >
                                    {uri ? (
                                        <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
                                    ) : (
                                        <Lucide
                                            name="package"
                                            size={20}
                                            color={colors.textTertiary || colors.textSecondary}
                                        />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginHorizontal: 12 }}>
                                    <AppText
                                        label={name}
                                        variant={1}
                                        fontSize={15}
                                        color={colors.text}
                                        numberOfLines={1}
                                    />
                                    <AppText
                                        label={formatMoney(item.unit_price)}
                                        fontSize={13}
                                        color={config.THEME_COLOR}
                                        variant={1}
                                        style={{ marginTop: 4 }}
                                    />
                                </View>
                                <Lucide
                                    name="chevron-right"
                                    size={18}
                                    color={colors.textTertiary || colors.textSecondary}
                                />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    clearBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 60,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
    },
    thumb: {
        width: 64,
        height: 64,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbImg: { width: '100%', height: '100%' },
});

export default ForYouBrowseHistory;
