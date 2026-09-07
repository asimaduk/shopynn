import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import AppModal from '../../components/app_modal';
import { catalog, customerProfiles, orders } from '../../services/api';

const CreateOrder = ({ navigation }) => {
    const { colors } = useTheme();
    const [stores, setStores] = useState([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [unitPrice, setUnitPrice] = useState('');
    const [fulfillmentType, setFulfillmentType] = useState('pickup');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [referenceCode, setReferenceCode] = useState('');

    useEffect(() => {
        const loadStores = async () => {
            try {
                const data = await customerProfiles.stores();
                const list = Array.isArray(data) ? data : [];
                setStores(list);
                if (list.length && !warehouseId) setWarehouseId(list[0].warehouse_id);
            } catch (_) {
                setStores([]);
            }
        };
        loadStores();
    }, []);

    useEffect(() => {
        const loadCatalog = async () => {
            if (!warehouseId) {
                setProducts([]);
                return;
            }
            try {
                const data = await catalog.list(warehouseId);
                setProducts(Array.isArray(data) ? data : []);
            } catch (_) {
                setProducts([]);
            }
        };
        loadCatalog();
    }, [warehouseId]);

    useEffect(() => {
        if (selectedProduct) {
            setUnitPrice(String(selectedProduct.unit_price || 0));
        }
    }, [selectedProduct]);

    const lineTotal = useMemo(() => {
        const q = Number(quantity || 0);
        const p = Number(unitPrice || 0);
        if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
        return q * p;
    }, [quantity, unitPrice]);

    const submit = async () => {
        if (!warehouseId || !selectedProduct?.id) {
            Alert.alert('Required', 'Warehouse and product are required.');
            return;
        }
        const q = Number(quantity);
        const p = Number(unitPrice);
        if (!Number.isFinite(q) || q <= 0) {
            Alert.alert('Invalid quantity', 'Enter a valid quantity.');
            return;
        }
        if (!Number.isFinite(p) || p < 0) {
            Alert.alert('Invalid price', 'Enter a valid unit price.');
            return;
        }

        setSubmitting(true);
        try {
            await orders.create({
                warehouse_id: warehouseId,
                fulfillment_type: fulfillmentType,
                notes,
                items: [
                    {
                        product_id: selectedProduct.id,
                        quantity: q,
                        unit_price: p,
                    },
                ],
            });
            Alert.alert('Success', 'Order created.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to create order.';
            Alert.alert('Order error', message);
        } finally {
            setSubmitting(false);
        }
    };

    const linkStoreByReference = async () => {
        const code = referenceCode.trim();
        if (!code) {
            Alert.alert('Reference required', 'Enter a valid store reference code.');
            return;
        }
        try {
            if (stores.length === 0) {
                await customerProfiles.signup(code);
            } else {
                await customerProfiles.linkStore(code);
            }
            const data = await customerProfiles.stores();
            const list = Array.isArray(data) ? data : [];
            setStores(list);
            if (list.length && !warehouseId) setWarehouseId(list[0].warehouse_id);
            setReferenceCode('');
            Alert.alert('Success', 'Store linked successfully.');
        } catch (error) {
            Alert.alert('Link failed', error?.response?.data?.message || 'Invalid reference code.');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Create order" />
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {stores.length === 0 && (
                        <>
                            <AppText label="Link store with reference code" fontSize={13} color={colors.textTertiary} style={styles.label} />
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <TextInput
                                        value={referenceCode}
                                        onChangeText={setReferenceCode}
                                        placeholder="Enter reference code"
                                        placeholderTextColor={colors.placeholder}
                                        style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }]}
                                    />
                                </View>
                                <TouchableOpacity onPress={linkStoreByReference} style={[styles.refBtn, { backgroundColor: config.THEME_COLOR }]}>
                                    <AppText label="Link" color="#fff" variant={1} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                    <AppText label="Warehouse ID" fontSize={13} color={colors.textTertiary} style={styles.label} />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowStoreModal(true)}
                        style={[styles.input, styles.selectInput, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
                    >
                        <AppText
                            label={stores.find((s) => s.warehouse_id === warehouseId)?.name || warehouseId || 'Select store'}
                            color={colors.text}
                        />
                    </TouchableOpacity>

                    <AppText label="Product" fontSize={13} color={colors.textTertiary} style={styles.label} />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowProductModal(true)}
                        style={[styles.input, styles.selectInput, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
                    >
                        <AppText
                            label={selectedProduct ? `${selectedProduct.name} (${selectedProduct.measurement_unit || 'unit'})` : 'Select product'}
                            color={colors.text}
                        />
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <View style={styles.col}>
                            <AppText label="Quantity" fontSize={13} color={colors.textTertiary} style={styles.label} />
                            <TextInput
                                value={quantity}
                                onChangeText={(text) => setQuantity(text.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }]}
                            />
                        </View>
                        <View style={styles.col}>
                            <AppText label="Unit price" fontSize={13} color={colors.textTertiary} style={styles.label} />
                            <TextInput
                                value={unitPrice}
                                onChangeText={(text) => setUnitPrice(text.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }]}
                            />
                        </View>
                    </View>

                    <AppText label="Fulfillment (pickup/delivery)" fontSize={13} color={colors.textTertiary} style={styles.label} />
                    <TextInput
                        value={fulfillmentType}
                        onChangeText={setFulfillmentType}
                        style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }]}
                    />

                    <AppText label="Notes" fontSize={13} color={colors.textTertiary} style={styles.label} />
                    <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        style={[styles.input, styles.textArea, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }]}
                    />

                    <View style={styles.rowTotal}>
                        <AppText label="Estimated total" fontSize={14} color={colors.text} />
                        <AppText label={`GHS ${lineTotal.toFixed(2)}`} variant={1} fontSize={16} color={config.THEME_COLOR} />
                    </View>

                    <TouchableOpacity
                        disabled={submitting}
                        onPress={submit}
                        activeOpacity={0.8}
                        style={[styles.submitBtn, { backgroundColor: config.THEME_COLOR, opacity: submitting ? 0.7 : 1 }]}
                    >
                        <AppText label={submitting ? 'Submitting...' : 'Create order'} color="#fff" variant={1} fontSize={15} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <AppModal visible={showStoreModal} onClose={() => setShowStoreModal(false)} title="Select store">
                {stores.map((store) => (
                    <TouchableOpacity
                        key={store.warehouse_id}
                        style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}
                        onPress={() => {
                            setWarehouseId(store.warehouse_id);
                            setSelectedProduct(null);
                            setShowStoreModal(false);
                        }}
                    >
                        <AppText label={store.name || store.warehouse_id} color={colors.text} />
                    </TouchableOpacity>
                ))}
            </AppModal>

            <AppModal visible={showProductModal} onClose={() => setShowProductModal(false)} title="Select product">
                {products.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}
                        onPress={() => {
                            setSelectedProduct(item);
                            setShowProductModal(false);
                        }}
                    >
                        <AppText label={item.name} color={colors.text} />
                        <AppText
                            label={`${item.measurement_unit || 'unit'} | In stock: ${Number(item.quantity_available || 0)}`}
                            color={colors.textTertiary}
                            fontSize={12}
                        />
                    </TouchableOpacity>
                ))}
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 10, padding: 12 },
    label: { marginTop: 8, marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
    selectInput: { justifyContent: 'center' },
    row: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    textArea: { minHeight: 78, textAlignVertical: 'top' },
    rowTotal: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    submitBtn: { marginTop: 14, borderRadius: 9, paddingVertical: 12, alignItems: 'center' },
    modalRow: { paddingVertical: 12, borderBottomWidth: 1 },
    refBtn: { marginLeft: 8, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
});

export default CreateOrder;
