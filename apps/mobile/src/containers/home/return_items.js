import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FlashList } from '@shopify/flash-list';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';

// Generate sample items based on return ID
const generateReturnItems = (returnId, itemCount) => {
    const items = [];
    const sampleProducts = [
        { name: 'Coca Cola 500ml', sku: 'CC-500', category: 'Beverages', unitPrice: 3.50 },
        { name: 'Rice 50kg Bag', sku: 'RICE-50', category: 'Grains', unitPrice: 180.00 },
        { name: 'Cooking Oil 5L', sku: 'OIL-5L', category: 'Cooking', unitPrice: 45.00 },
        { name: 'Sugar 1kg', sku: 'SUGAR-1KG', category: 'Baking', unitPrice: 8.50 },
        { name: 'Milk Powder 400g', sku: 'MILK-400', category: 'Dairy', unitPrice: 12.00 },
        { name: 'Bread Loaf', sku: 'BREAD-LF', category: 'Bakery', unitPrice: 5.00 },
        { name: 'Tomato Paste 400g', sku: 'TOMATO-400', category: 'Condiments', unitPrice: 6.50 },
        { name: 'Spaghetti 500g', sku: 'SPAG-500', category: 'Pasta', unitPrice: 4.50 },
    ];

    for (let i = 0; i < itemCount; i++) {
        const product = sampleProducts[i % sampleProducts.length];
        const quantity = Math.floor(Math.random() * 5) + 1;
        items.push({
            id: `${returnId}-ITEM-${i + 1}`,
            name: product.name,
            sku: product.sku,
            category: product.category,
            quantity: quantity,
            unitPrice: product.unitPrice,
            totalPrice: (product.unitPrice * quantity).toFixed(2),
            reason: i === 0 ? 'Defective' : i === 1 ? 'Damaged packaging' : 'Wrong item',
        });
    }

    return items;
};

const ReturnItems = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item, type } = route.params || {};
    const isSales = type === 'sales' || item?.type === 'sales';

    // Generate items based on return
    const items = React.useMemo(() => {
        const itemCount = item?.items || 0;
        if (itemCount === 0) return [];
        return generateReturnItems(item?.id || 'RET-001', itemCount);
    }, [item]);

    const totalAmount = React.useMemo(() => {
        return items.reduce((sum, item) => sum + parseFloat(item.totalPrice || 0), 0).toFixed(2);
    }, [items]);

    const backPress = () => {
        navigation.goBack();
    };

    const ItemRow = ({ item: itemData, index }) => (
        <View style={[styles.itemRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={[styles.itemIconCircle, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name="package" size={18} color={config.THEME_COLOR} />
            </View>
            <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                    <AppText label={itemData.name} fontSize={15} variant={1} color={colors.text} numberOfLines={1} />
                    <AppText label={`×${itemData.quantity}`} fontSize={15} variant={1} color={config.THEME_COLOR} />
                </View>
                <View style={styles.itemMeta}>
                    <View style={styles.itemMetaItem}>
                        <Lucide name="hash" size={12} color={colors.textTertiary} />
                        <AppText label={itemData.sku} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                    </View>
                    <View style={styles.itemMetaItem}>
                        <Lucide name="tag" size={12} color={colors.textTertiary} />
                        <AppText label={itemData.category} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                    </View>
                </View>
                <View style={[styles.itemFooter, { borderTopColor: colors.border }]}>
                    <View>
                        <AppText label="Unit Price" fontSize={11} color={colors.textTertiary} />
                        <AppText label={`GHS ${itemData.unitPrice.toFixed(2)}`} fontSize={13} color={colors.textSecondary} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <AppText label="Total" fontSize={11} color={colors.textTertiary} />
                        <AppText label={`GHS ${itemData.totalPrice}`} fontSize={15} variant={1} color={colors.text} />
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Return Items" />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                
                {/* Summary Card */}
                <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.summaryRow}>
                        <View>
                            <AppText label="Total Items" fontSize={13} color={colors.textTertiary} />
                            <AppText label={`${items.length} item${items.length !== 1 ? 's' : ''}`} fontSize={20} variant={1} color={colors.text} style={{ marginTop: 4 }} />
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <AppText label="Total Amount" fontSize={13} color={colors.textTertiary} />
                            <AppText label={`GHS ${totalAmount}`} fontSize={20} variant={1} color={config.THEME_COLOR} style={{ marginTop: 4 }} />
                        </View>
                    </View>
                </View>

                {/* Items List */}
                {items.length > 0 ? (
                    <View style={styles.listSection}>
                        <View style={[styles.listHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                            <Lucide name="list" size={18} color={config.THEME_COLOR} />
                            <AppText label="Items" fontSize={16} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginLeft: 8 }} />
                            <View style={[styles.countBadge, { backgroundColor: config.THEME_COLOR }]}>
                                <AppText label={items.length} fontSize={11} color={colors.textInverse} variant={1} />
                            </View>
                        </View>
                        <FlashList
                            data={items}
                            estimatedItemSize={120}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item, index }) => <ItemRow item={item} index={index} />}
                            scrollEnabled={false}
                        />
                    </View>
                ) : (
                    <View style={styles.empty}>
                        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="package-x" size={32} color={colors.textTertiary} />
                        </View>
                        <AppText label="No items found" variant={1} fontSize={16} color={colors.textTertiary} style={{ marginTop: 16 }} />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    summaryCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    listSection: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    countBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    itemRow: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
    },
    itemIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 10,
    },
    itemMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: 8,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ReturnItems;
