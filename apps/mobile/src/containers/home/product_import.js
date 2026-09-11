import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import * as XLSX from 'xlsx';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { products as productsApi } from '../../services/api';

const ProductImport = ({ navigation }) => {
    const { colors } = useTheme();
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [selectedIndexes, setSelectedIndexes] = useState([]);

    const backPress = () => {
        navigation.goBack();
    };

    const toggleSelect = (index) => {
        setSelectedIndexes((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        );
    };

    const selectAll = () => {
        if (rows.length === 0) return;
        if (selectedIndexes.length === rows.length) {
            setSelectedIndexes([]);
        } else {
            setSelectedIndexes(rows.map((_, idx) => idx));
        }
    };

    const handlePickFile = async () => {
        try {
            const [res] = await pick({
                presentationStyle: 'fullScreen',
                copyTo: 'cachesDirectory',
            });
            const uri = res.fileCopyUri || res.uri;
            if (!uri) {
                Alert.alert('Error', 'Could not access selected file.');
                return;
            }
            const allowed = ['.xlsx', '.xls', '.csv'];
            const lowerName = (res.name || '').toLowerCase();
            if (!allowed.some((ext) => lowerName.endsWith(ext))) {
                Alert.alert('Unsupported file', 'Please select an Excel (.xlsx, .xls) or CSV file.');
                return;
            }
            setFileName(res.name || 'Selected file');
            setLoading(true);
            const path = uri.replace('file://', '');
            const b64 = await RNFS.readFile(path, 'base64');
            const workbook = XLSX.read(b64, { type: 'base64' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!Array.isArray(json) || json.length === 0) {
                Alert.alert('No data', 'No rows were found in the selected file.');
                setRows([]);
                setSelectedIndexes([]);
                return;
            }
            const mapped = json.map((row) => ({
                name: row.Name || row.name || '',
                sku: row.SKU || row.sku || '',
                barcode: row.Barcode || row.barcode || row['Bar Code'] || '',
                retail_price: row.RetailPrice || row.retail_price || row.Price || '',
                wholesale_price:
                    row.WholesalePrice || row.wholesale_price || row['Wholesale Price'] || '',
                unit: row.Unit || row.unit || 'pcs',
            }));
            setRows(mapped);
            setSelectedIndexes(mapped.map((_, idx) => idx)); // default select all
        } catch (err) {
            console.log(err);
            Alert.alert('File error', err?.message || 'Could not read selected file.');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (rows.length === 0 || selectedIndexes.length === 0) {
            Alert.alert('Nothing to import', 'Select at least one product to import.');
            return;
        }
        setLoading(true);
        try {
            const toImport = rows.filter((_, idx) => selectedIndexes.includes(idx));
            for (const row of toImport) {
                if (!row.name || !row.retail_price) {
                    continue;
                }
                const payload = {
                    name: String(row.name).trim(),
                    description: '',
                    retail_price: parseFloat(row.retail_price) || 0,
                    wholesale_price: row.wholesale_price
                        ? parseFloat(row.wholesale_price) || null
                        : null,
                    sku: String(row.sku || '').trim(),
                    bar_code: String(row.barcode || '').trim() || null,
                    batch_number: null,
                    expiry_date: null,
                    reorder_quantity: null,
                    tags: '',
                    initial_stock: 0,
                    unit: String(row.unit || 'pcs').trim(),
                    categories: [],
                    images: [],
                };
                await productsApi.create(payload);
            }
            Alert.alert('Imported', 'Selected products have been imported.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to import products from file.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item, index }) => {
        const isSelected = selectedIndexes.includes(index);
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleSelect(index)}
                style={[
                    styles.row,
                    {
                        borderColor: isSelected ? config.THEME_COLOR : colors.border,
                        backgroundColor: colors.surface,
                    },
                ]}>
                <View
                    style={[
                        styles.checkbox,
                        {
                            borderColor: isSelected ? config.THEME_COLOR : colors.border,
                            backgroundColor: isSelected ? config.THEME_COLOR : colors.surface,
                        },
                    ]}>
                    {isSelected && <Lucide name="check" size={14} color={colors.textInverse} />}
                </View>
                <View style={{ flex: 1 }}>
                    <AppText label={item.name || 'Unnamed product'} color={colors.text} />
                    <AppText
                        label={`SKU: ${item.sku || '-'} · Barcode: ${item.barcode || '-'}`}
                        color={colors.textTertiary}
                        fontSize={11}
                        style={{ marginTop: 2 }}
                    />
                    <AppText
                        label={`Retail: ${item.retail_price || '-'} · Unit: ${item.unit || 'pcs'}`}
                        color={colors.textTertiary}
                        fontSize={11}
                        style={{ marginTop: 2 }}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Import Products from Excel'}>
                <View />
            </ScreenHeader>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText
                        label={
                            fileName
                                ? `Selected file: ${fileName}`
                                : 'Upload an Excel (.xlsx, .xls) or CSV file with product data.'
                        }
                        color={colors.text}
                        fontSize={13}
                        style={{ marginBottom: 10 }}
                    />

                    <View style={[styles.templateTable, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <View
                            style={[
                                styles.templateHeaderRow,
                                {
                                    borderBottomColor: colors.border,
                                    backgroundColor: colors.surfaceSecondary || colors.inputBackground,
                                },
                            ]}>
                            <AppText label="Column" fontSize={12} color={colors.textSecondary} style={{ flex: 0.85 }} />
                            <AppText label="Required" fontSize={12} color={colors.textSecondary} style={{ flex: 0.5, textAlign: 'center' }} />
                            <AppText label="Example" fontSize={12} color={colors.textSecondary} style={{ flex: 1.2, marginLeft: 8 }} />
                        </View>
                        {[
                            { col: 'Name', required: 'Yes', example: 'Coca Cola 330ml' },
                            { col: 'SKU', required: 'No', example: 'CC-330-01' },
                            { col: 'Barcode', required: 'No', example: '8901234567890' },
                            { col: 'RetailPrice', required: 'Yes', example: '5.50' },
                            { col: 'WholesalePrice', required: 'No', example: '4.20' },
                            { col: 'Unit', required: 'No', example: 'pcs' },
                        ].map((row) => (
                            <View
                                key={row.col}
                                style={[
                                    styles.templateRow,
                                    {
                                        borderBottomColor: colors.border,
                                        backgroundColor: row.required === 'Yes'
                                            ? (colors.surfaceSecondary || '#fef9c3')
                                            : colors.surface,
                                    },
                                ]}>
                                <AppText label={row.col} fontSize={12} color={colors.text} style={{ flex: 0.85 }} />
                                <View style={{ flex: 0.5, alignItems: 'center' }}>
                                    <View
                                        style={[
                                            styles.requiredPill,
                                            row.required === 'Yes'
                                                ? { backgroundColor: '#fee2e2' }
                                                : { backgroundColor: '#e5f6ff' },
                                        ]}>
                                        <AppText
                                            label={row.required}
                                            fontSize={10}
                                            color={row.required === 'Yes' ? '#b91c1c' : '#0369a1'}
                                        />
                                    </View>
                                </View>
                                <AppText label={row.example} fontSize={12} color={colors.textSecondary} style={{ flex: 1.2, marginLeft: 8 }} />
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handlePickFile}
                        disabled={loading}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: config.THEME_COLOR },
                            loading && { opacity: 0.7 },
                        ]}>
                        {loading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <>
                                <Lucide name="cloud-upload" size={18} color={colors.textInverse} />
                                <AppText
                                    label={fileName ? 'Change file' : 'Choose file'}
                                    variant={1}
                                    fontSize={15}
                                    color={colors.textInverse}
                                    style={{ marginLeft: 8 }}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginTop: 10 }}>
                    {rows.length === 0 ? (
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                            <Lucide
                                name="file-search"
                                size={40}
                                color={colors.textTertiary}
                                style={{ marginBottom: 8 }}
                            />
                            <AppText
                                label={'No products loaded yet'}
                                color={colors.textSecondary}
                                fontSize={14}
                            />
                        </View>
                    ) : (
                        <>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 8,
                                    paddingHorizontal: 2,
                                }}>
                                <AppText
                                    label={`${selectedIndexes.length} of ${rows.length} selected`}
                                    fontSize={13}
                                    color={colors.textSecondary}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={selectAll}
                                    style={styles.selectAllBtn}>
                                    <AppText
                                        label={
                                            selectedIndexes.length === rows.length
                                                ? 'Deselect all'
                                                : 'Select all'
                                        }
                                        fontSize={13}
                                        color={config.THEME_COLOR}
                                    />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={rows}
                                keyExtractor={(_, index) => `row-${index}`}
                                renderItem={renderItem}
                                ItemSeparatorComponent={() => (
                                    <View style={{ height: 6 }} />
                                )}
                                contentContainerStyle={{ paddingBottom: 16 }}
                            />
                        </>
                    )}
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleImport}
                    disabled={loading || rows.length === 0 || selectedIndexes.length === 0}
                    style={[
                        styles.importBtn,
                        { backgroundColor: config.THEME_COLOR },
                        (loading || rows.length === 0 || selectedIndexes.length === 0) && {
                            opacity: 0.6,
                        },
                    ]}>
                    {loading ? (
                        <ActivityIndicator color={colors.textInverse} />
                    ) : (
                        <>
                            <AppText
                                label={'Import selected products'}
                                variant={1}
                                fontSize={15}
                                color={colors.textInverse}
                            />
                            <Lucide
                                name="arrow-right"
                                size={18}
                                color={colors.textInverse}
                                style={{ marginLeft: 8 }}
                            />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    card: {
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
    },
    templateTable: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 10,
        overflow: 'hidden',
    },
    templateHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
    },
    templateRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
    },
    requiredPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectAllBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    importBtn: {
        marginVertical: 8,
        marginHorizontal: 10,
        borderRadius: 10,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ProductImport;

