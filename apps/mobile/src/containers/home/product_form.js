import React, { useState, useEffect, useCallback } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { FlashList } from '@shopify/flash-list';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import useTheme from '../../hooks/useTheme';
import { products as productsApi, warehouses as warehousesApi, categories as categoriesApi, normalizeList } from '../../services/api';

// const images = [];

const { width, height } = Dimensions.get('screen');

const resolveProductImageUri = (ref) => {
    if (ref == null || ref === '') return null;
    const s = String(ref).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return `${config.BASE_API}/images?id=${encodeURIComponent(s)}`;
};

/** Existing product photos from API (ids → display uris for Image). */
const buildServerProductImages = (product) => {
    if (!product) return [];
    const refs = [
        product.thumbnail,
        product.picture1,
        product.picture2,
        product.picture3,
        product.picture4,
    ].filter(Boolean);
    const seen = new Set();
    const uniqueRefs = refs.filter((r) => {
        const k = String(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    return uniqueRefs
        .map((ref) => {
            const uri = resolveProductImageUri(ref);
            if (!uri) return null;
            return { uri, isLocal: false, serverRef: String(ref) };
        })
        .filter(Boolean);
};

const ProductForm = ({ navigation, route }) => {
    const { colors } = useTheme();
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        unit_price: '',
        alt_price: '',
        actual_cost: '',
        sku: '',
        barcode: '',
        batchNumber: '',
        expiryDate: '',
        reorderLevel: '',
        tags: '',
        unit: 'units',
        productType: 'standard',
        allowsFractionalQty: false,
        minOrderQty: '1',
        qtyStep: '1',
    });

    const [editMode, setEditMode] = useState(false);
    
    // UI state
    const [showCategories, setShowCategories] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState({});
    const [showFullImage, setShowFullImage] = useState(false);
    const [selectedImage, setSelectedImage] = useState({});
    const [images, setImages] = useState([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [warehouses, setWarehouses] = useState([]);
    const [warehouseQuantities, setWarehouseQuantities] = useState({});
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showProductTypePicker, setShowProductTypePicker] = useState(false);
    const [categories, setCategories] = useState([]);
    const [imageDeleteLoading, setImageDeleteLoading] = useState(false);

    const UNIT_OPTIONS = ['units', 'piece', 'yard', 'meter', 'kg', 'g', 'ltr', 'ml', 'box', 'pack'];
    const PRODUCT_TYPE_OPTIONS = ['standard', 'fabric', 'service'];
    
    // Filtered categories based on search
    const filteredCategories = (categories || []).filter((cat) =>
        (cat.name || '').toLowerCase().includes(categorySearch.toLowerCase())
    );
    
    // Initialize form data if editing existing product
    useEffect(() => {
        if (route.params?.product) {
            const product = route.params.product;
            console.log('edit mode product', product);
            setEditMode(true);
            setFormData({
                name: product.name || '',
                description: product.description || '',
                unit_price: product.unit_price?.toString() || '',
                alt_price: product.alt_price?.toString() || '',
                actual_cost: product.actual_cost != null ? String(product.actual_cost) : '',
                sku: product.sku || '',
                barcode: product.bar_code || product.barcode || '',
                batchNumber: product.batch_number || '',
                expiryDate: product.expiry_date || '',
                reorderLevel: product.reorder_quantity?.toString() || '',
                tags: product.tags?.join(',') || '',
                unit: product.measurement_unit || product.unit || 'units',
                productType: product.product_type || 'standard',
                allowsFractionalQty: Boolean(product.allows_fractional_qty),
                minOrderQty: product.min_order_qty?.toString() || '1',
                qtyStep: product.qty_step?.toString() || '1',
            });
            const fromApi = buildServerProductImages(product);
            if (fromApi.length > 0) {
                setImages(fromApi);
            } else if (Array.isArray(product.images) && product.images.length > 0) {
                setImages(product.images);
            } else {
                setImages([]);
            }
            // if (product.categories) {
            //     const cats = {};
            //     product.categories.forEach((cat) => {
            //         if (!cat) return;
            //         const key = cat.id;
            //         console.log('cat', cat);
            //         if (key) cats[key] = cat;
            //     });
            //     setSelectedCategories(cats);
            // }
        } else {
            setEditMode(false);
            setImages([]);
        }

        if (route.params?.scannedBarcode) {
            updateFormData('barcode', route.params.initialBarcode);
        }
    }, [route.params?.product, route.params?.scannedBarcode]);

    // Load warehouses on mount for per-warehouse quantities
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await warehousesApi.list();
                const list = normalizeList(raw) || [];
                if (mounted) setWarehouses(list);
            } catch (_) {
                if (mounted) setWarehouses([]);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Load categories on focus (so they refresh after adding/editing)
    useEffect(() => {
        let active = true;
        const loadCategories = async () => {
            try {
                const product = route.params?.product || {};
                const raw = await categoriesApi.list();
                const list = normalizeList(raw) || [];
                if (active) setCategories(Array.isArray(list) ? list : []);
                if (list.length > 0) { 
                    if (product.categories) {
                        const cats = {};
                        product.categories.forEach((catId) => {
                            if (!catId) return;
                            const cat = list.find(c => c.id === catId);
                            if (cat) {
                                cats[cat.id] = cat;
                            }
                        });
                        setSelectedCategories(cats);
                        console.log('selected categories', cats);
                    }
                }
                console.log('api categories', list);
            } catch (_) {
                console.log('error loading categories', _);
                if (active) setCategories([]);
            }
        };
        const unsubscribe = navigation.addListener('focus', loadCategories);
        loadCategories();
        return () => {
            active = false;
            unsubscribe && unsubscribe();
        };
    }, [navigation]);

    // useFocusEffect(
    //     useCallback(() => {
    //         loadCategories();
    //     }, [loadCategories])
    // );

    const backPress = () => {
        navigation.goBack();
    }

    const handleClose = () => {
        setShowCategories(false);
        setCategorySearch('');
    }

    const buildImageSlotsPayload = (remainingServerRefs) => ({
        thumbnail: remainingServerRefs[0] ?? null,
        picture1: remainingServerRefs[1] ?? null,
        picture2: remainingServerRefs[2] ?? null,
        picture3: remainingServerRefs[3] ?? null,
        picture4: remainingServerRefs[4] ?? null,
    });

    const handleRemoveImage = () => {
        if (selectedImage.isLocal) {
            setShowFullImage(false);
            const tmp = images.filter((img) => img.uri !== selectedImage.uri);
            setImages(tmp);
            return;
        }
        Alert.alert('', 'Are you sure you want to delete this image?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const productId = route.params?.product?.id;
                    const refToRemove = selectedImage.serverRef;
                    const removeFromState = () => {
                        setShowFullImage(false);
                        const tmp = images.filter((img) => {
                            if (img.isLocal) return true;
                            return String(img.serverRef) !== String(refToRemove);
                        });
                        setImages(tmp);
                    };

                    if (!productId || !refToRemove) {
                        removeFromState();
                        return;
                    }

                    const serverRefsInOrder = images
                        .filter((i) => i.serverRef)
                        .map((i) => String(i.serverRef));
                    const remaining = serverRefsInOrder.filter((r) => r !== String(refToRemove));

                    setImageDeleteLoading(true);
                    try {
                        await productsApi.updateImages({
                            id: productId,
                            ...buildImageSlotsPayload(remaining),
                        });
                        removeFromState();
                    } catch (err) {
                        const msg =
                            err?.response?.data?.message ||
                            err?.message ||
                            'Could not remove image from server.';
                        Alert.alert('Error', msg);
                    } finally {
                        setImageDeleteLoading(false);
                    }
                },
            },
        ]);
    }

    const onRequestClose = () => {
        setShowCategories(false);
        setCategorySearch('');
    }

    const handleOpenGallery = async() => {
        if(images.length >= 5) {
            Alert.alert('','Maximum 5 images allowed');
            return;
        }
        const result = await launchImageLibrary({
            mediaType:'photo',
            maxHeight:800,
            maxWidth:800,
            quality:0.8,
            selectionLimit: 5 - images.length
        });
        if(result.assets && result.assets.length>0){
            const newImages = result.assets.map(asset => ({isLocal:true, ...asset}));
            setImages([...newImages, ...images].slice(0, 5));
        }
    }

    const handleOpenCamera = async() => {
        if(images.length >= 5) {
            Alert.alert('','Maximum 5 images allowed');
            return;
        }
        const result = await launchCamera({
            mediaType:'photo',
            maxHeight:800,
            maxWidth:800,
            quality:0.8,
            cameraType:'back'
        });
        if(result.assets && result.assets.length>0){
            const tmp = {isLocal:true, ...result.assets[0]};
            setImages([tmp, ...images].slice(0, 5));
        }
    }

    const handleAddImage = async () => {
        if(images.length >= 5) {
            Alert.alert('','Maximum 5 images allowed');
            return;
        }
        Alert.alert('Add Image','Select an option',[
            {text:'Cancel', style: 'cancel'},
            {text:'Gallery', onPress: handleOpenGallery},
            {text:'Camera', onPress: handleOpenCamera}
        ])
    }

    const updateFormData = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
        // Clear error when user starts typing
        if(errors[field]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        }
    }

    const handleWarehouseQtyChange = (id, value) => {
        const numeric = value.replace(/[^0-9]/g, '');
        setWarehouseQuantities((prev) => ({ ...prev, [id]: numeric }));
    };

    const validateForm = () => {
        const newErrors = {};
        
        if(!formData.name.trim()) {
            newErrors.name = 'Product name is required';
        }
       
        if (!editMode) {
            if(!formData.unit_price.trim()) {
                newErrors.unit_price = 'Retail price is required';
            } else if(isNaN(parseFloat(formData.unit_price)) || parseFloat(formData.unit_price) <= 0) {
                newErrors.unit_price = 'Please enter a valid price';
            }

            if(formData.alt_price.trim() && (isNaN(parseFloat(formData.alt_price)) || parseFloat(formData.alt_price) <= 0)) {
                newErrors.alt_price = 'Please enter a valid price';
            }
        }

        if (formData.actual_cost.trim() && (isNaN(parseFloat(formData.actual_cost)) || parseFloat(formData.actual_cost) < 0)) {
            newErrors.actual_cost = 'Please enter a valid cost';
        }
        
        if(formData.reorderLevel.trim() && (isNaN(parseInt(formData.reorderLevel)) || parseInt(formData.reorderLevel) < 0)) {
            newErrors.reorderLevel = 'Please enter a valid number';
        }
        if(formData.minOrderQty.trim() && (isNaN(Number(formData.minOrderQty)) || Number(formData.minOrderQty) < 1)) {
            newErrors.minOrderQty = 'Minimum order quantity cannot be less than 1';
        }
        if(formData.qtyStep.trim() && (isNaN(Number(formData.qtyStep)) || Number(formData.qtyStep) < 1)) {
            newErrors.qtyStep = 'Quantity step cannot be less than 1';
        }
        if(!formData.allowsFractionalQty && Number(formData.qtyStep || 1) % 1 !== 0) {
            newErrors.qtyStep = 'Quantity step must be whole number when fractional qty is disabled';
        }
        if(formData.expiryDate.trim()) {
            const d = new Date(formData.expiryDate);
            if (isNaN(d.getTime())) newErrors.expiryDate = 'Please enter a valid date (e.g. YYYY-MM-DD)';
        }
        if(Object.values(selectedCategories).length === 0) {
            newErrors.categories = 'Please select at least one category';
        }

        if (!editMode) {
            // Require at least one warehouse quantity when warehouses exist
            const warehouseQuantitiesPayload = Object.entries(warehouseQuantities || {})
                .map(([warehouseId, qtyStr]) => ({
                    warehouse_id: warehouseId,
                    quantity: parseInt(qtyStr || '0', 10) || 0,
                }))
                .filter((entry) => entry.quantity > 0);
            if (warehouses.length > 0 && warehouseQuantitiesPayload.length === 0) {
                newErrors.warehouseQuantities = 'Enter quantity for at least one warehouse';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSave = async () => {
        if(!validateForm()) {
            Alert.alert('Validation Error', 'Please fix the errors before saving');
            return;
        }
        
        setIsLoading(true);
        try {
            // Prepare product data
            const productData = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                actual_cost: formData.actual_cost.trim() ? parseFloat(formData.actual_cost) : null,
                sku: formData.sku.trim(),
                bar_code: formData.barcode.trim() || null,
                // batch_number: formData.batchNumber.trim() || null,
                // expiry_date: formData.expiryDate.trim() || null,
                reorder_quantity: formData.reorderLevel.trim() ? parseInt(formData.reorderLevel) : null,
                tags: formData.tags.replace(/,\s*$/, '').trim().split(',').map(tag => tag.trim()),
                unit: formData.unit,
                product_type: formData.productType || 'standard',
                measurement_unit: formData.unit || 'units',
                allows_fractional_qty: Boolean(formData.allowsFractionalQty),
                min_order_qty: formData.minOrderQty.trim() ? Number(formData.minOrderQty) : 1,
                qty_step: formData.qtyStep.trim() ? Number(formData.qtyStep) : 1,
                categories: Object.values(selectedCategories).map(cat => cat.id || cat.name),
                images: images
            };

            if (!editMode) {
                productData.unit_price = parseFloat(formData.unit_price);
                productData.alt_price = formData.alt_price.trim() ? parseFloat(formData.alt_price) : null;
            }

            // Optional per-warehouse initial quantities
            const warehouseQuantitiesPayload = Object.entries(warehouseQuantities || {})
                .map(([warehouseId, qtyStr]) => ({
                    warehouse_id: warehouseId,
                    quantity: parseInt(qtyStr || '0', 10) || 0,
                }))
                .filter((entry) => entry.quantity > 0);

            if (warehouseQuantitiesPayload.length > 0) {
                productData.warehouse_quantities = warehouseQuantitiesPayload;
            }

            const isEdit = !!route.params?.product?.id;
            console.log('productData', productData);

            if (isEdit) {
                await productsApi.update(route.params.product.id, productData);
            } else {
                await productsApi.create(productData);
            }
            
            Alert.alert('Success', 'Product saved successfully', [
                {text: 'OK', onPress: () => navigation.goBack()}
            ]);
        } catch (err) {
            console.log('err', err);
            const msg = err?.response?.data?.message || err?.message || 'Failed to save product.';
            Alert.alert('Error', msg);
        } finally {
            setIsLoading(false);
        }
    }

    const handleBarcodeScanned = (barcode) => {
        updateFormData('barcode', barcode);
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex:1}}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label={'Product form'}>
                    <View style={{flexDirection:'row',marginVertical:5}}>
                        {/* <TouchableOpacity
                            activeOpacity={.6}
                            style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:'#eee'}}>
                            <Lucide name="redo-dot" color="#4c4c4c" size={20} />
                        </TouchableOpacity> */}
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={() => navigation.navigate('ProductImport')}
                            style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:'#eee',marginHorizontal:10}}>
                            <Lucide name="book-up-2" color="#4c4c4c" size={20} />
                        </TouchableOpacity>
                    </View>
                </ScreenHeader>
                <View style={{flex:1}}>
                    <ScrollView showsVerticalScrollIndicator={false} style={{flex:1,padding:10}} contentContainerStyle={{paddingBottom:20}}>
                        {/* Images Section */}
                        <View style={[styles.viewContainer, { paddingBottom: 15, backgroundColor: colors.surface }]}>
                            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                                <View>
                                    <AppText label={'Product Images'} variant={1} style={{ marginBottom: 2 }} color={colors.text} />
                                    <AppText label={`${images.length}/5 images`} color={colors.textTertiary} fontSize={12} />
                                </View>
                                {images.length < 5 && (
                                    <TouchableOpacity
                                        activeOpacity={.6}
                                        onPress={handleAddImage}
                                        style={styles.addImageButton}>
                                        <Lucide name='plus' size={18} color={config.THEME_COLOR}/>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {images.length > 0 ? 
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:5}}>
                                    {images.map((img, i)=> (
                                        <View key={img.serverRef ? `${img.serverRef}-${i}` : `${img.uri}-${i}`} style={{position:'relative',marginRight:10}}>
                                            <TouchableOpacity
                                                activeOpacity={.6}
                                                onPress={()=> {
                                                    setSelectedImage(img);
                                                    setShowFullImage(true);
                                                }}
                                                style={[styles.imageThumbnail, { backgroundColor: colors.surfaceSecondary }]}>
                                                <Image source={{ uri: img.uri }} style={{ flex: 1, borderRadius: 8 }} resizeMode="cover" />
                                            </TouchableOpacity>
                                            {img.isLocal ? (
                                                <TouchableOpacity
                                                    activeOpacity={.6}
                                                    onPress={() => {
                                                        const tmp = images.filter((_, idx) => idx !== i);
                                                        setImages(tmp);
                                                    }}
                                                    style={[styles.removeImageButton, { backgroundColor: colors.error }]}>
                                                    <Lucide name='x' size={14} color={colors.textInverse}/>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    ))}
                                    {images.length < 5 && (
                                        <TouchableOpacity
                                            activeOpacity={.6}
                                            onPress={handleAddImage}
                                            style={[styles.imageThumbnail, styles.addImagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Lucide name='plus' size={24} color={colors.textTertiary}/>
                                        </TouchableOpacity>
                                    )}
                                </ScrollView>
                                :
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={handleAddImage}
                                    style={[styles.emptyImageContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <Lucide name='camera' size={32} color={colors.textTertiary} />
                                    <AppText label={'Tap to add images'} color={colors.textTertiary} fontSize={13} style={{ marginTop: 8 }} />
                                </TouchableOpacity>
                            }
                        </View>

                        {/* Basic Information Section */}
                        <View style={styles.sectionHeader}>
                            <AppText label={'Basic Information'} variant={1} fontSize={16} color={colors.text} />
                        </View>

                        <View style={[styles.viewContainer, { marginTop: 5, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                <AppText label={'Product Name'} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label={' *'} color={colors.error} />
                            </View>
                            <TextInput
                                placeholder='e.g., Bottle Water 500ml'
                                placeholderTextColor={colors.placeholder}
                                value={formData.name}
                                onChangeText={(text) => updateFormData('name', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.name && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                            />
                            {errors.name && <AppText label={errors.name} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                        </View>

                        <View style={[styles.viewContainer, { marginTop: 10, backgroundColor: colors.surface }]}>
                            <AppText label={'Description'} style={{ marginBottom: 5 }} color={colors.text} />
                            <TextInput
                                placeholder='Enter product description...'
                                placeholderTextColor={colors.placeholder}
                                value={formData.description}
                                onChangeText={(text) => updateFormData('description', text)}
                                multiline
                                numberOfLines={4}
                                style={[styles.textInput, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Pricing Section */}
                        {!editMode && (
                            <View style={styles.sectionHeader}>
                                <AppText label={'Pricing'} variant={1} fontSize={16} color={colors.text} />
                            </View>
                        )}

                        {!editMode && (
                            <View style={{ flexDirection: 'row', marginTop: 5 }}>
                                <View style={[styles.viewContainer, { flex: .5, marginRight: 5, backgroundColor: colors.surface }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                        <AppText label={'Retail Price'} style={{ marginBottom: 0 }} color={colors.text} />
                                        <AppText label={' *'} color={colors.error} />
                                    </View>
                                    <View style={styles.priceInputContainer}>
                                        <AppText label={'GHS'} color={colors.textTertiary} fontSize={14} style={{ marginRight: 5 }} />
                                        <TextInput
                                            placeholder='0.00'
                                            placeholderTextColor={colors.placeholder}
                                            value={formData.unit_price}
                                            onChangeText={(text) => updateFormData('unit_price', text.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            style={[styles.textInput, styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.unit_price && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                        />
                                    </View>
                                    {errors.unit_price && <AppText label={errors.unit_price} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                                </View>
                                <View style={[styles.viewContainer, { flex: .5, marginLeft: 5, backgroundColor: colors.surface }]}>
                                    <AppText label={'Wholesale Price'} style={{ marginBottom: 5 }} color={colors.text} />
                                    <View style={styles.priceInputContainer}>
                                        <AppText label={'GHS'} color={colors.textTertiary} fontSize={14} style={{ marginRight: 5 }} />
                                        <TextInput
                                            placeholder='0.00'
                                            placeholderTextColor={colors.placeholder}
                                            value={formData.alt_price}
                                            onChangeText={(text) => updateFormData('alt_price', text.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            style={[styles.textInput, styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.alt_price && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                        />
                                    </View>
                                    {errors.alt_price && <AppText label={errors.alt_price} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                                </View>
                            </View>
                        )}

                        <View style={[styles.viewContainer, { marginTop: 10, backgroundColor: colors.surface }]}>
                                <AppText label={'Actual cost (per unit)'} style={{ marginBottom: 5 }} color={colors.text} />
                                <AppText label={'Used for profit & COGS when purchase history is missing'} fontSize={11} color={colors.textTertiary} style={{ marginBottom: 8 }} />
                                <View style={styles.priceInputContainer}>
                                    <AppText label={'GHS'} color={colors.textTertiary} fontSize={14} style={{ marginRight: 5 }} />
                                    <TextInput
                                        placeholder="0.00"
                                        placeholderTextColor={colors.placeholder}
                                        value={formData.actual_cost}
                                        onChangeText={(text) => updateFormData('actual_cost', text.replace(/[^0-9.]/g, ''))}
                                        keyboardType="decimal-pad"
                                        style={[styles.textInput, styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.actual_cost && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                    />
                                </View>
                                {errors.actual_cost && <AppText label={errors.actual_cost} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                        </View>

                        {/* Inventory Section */}
                        <View style={styles.sectionHeader}>
                            <AppText label={'Inventory'} variant={1} fontSize={16} color={colors.text} />
                        </View>

                        <View style={{ flexDirection: 'row', marginTop: 5 }}>
                            <View style={[styles.viewContainer, { flex: .5, marginRight: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'SKU / Code'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TextInput
                                    placeholder='e.g., R8-01'
                                    placeholderTextColor={colors.placeholder}
                                    value={formData.sku}
                                    onChangeText={(text) => updateFormData('sku', text.toUpperCase())}
                                    style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                                    autoCapitalize="characters"
                                />
                            </View>
                            <View style={[styles.viewContainer, { flex: .5, marginLeft: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Measurement unit'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setShowUnitPicker(true)}
                                    style={[
                                        styles.unitSelector,
                                        {
                                            backgroundColor: colors.inputBackground,
                                            borderColor: colors.inputBorder,
                                        },
                                    ]}>
                                    <AppText
                                        label={formData.unit || 'units'}
                                        color={colors.text}
                                        style={styles.unitSelectorText}
                                    />
                                    <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <View style={[styles.viewContainer, { flex: .5, marginRight: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Product type'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setShowProductTypePicker(true)}
                                    style={[
                                        styles.unitSelector,
                                        {
                                            backgroundColor: colors.inputBackground,
                                            borderColor: colors.inputBorder,
                                        },
                                    ]}>
                                    <AppText
                                        label={formData.productType || 'standard'}
                                        color={colors.text}
                                        style={styles.unitSelectorText}
                                    />
                                    <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.viewContainer, { flex: .5, marginLeft: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Allow fractional qty'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => updateFormData('allowsFractionalQty', !formData.allowsFractionalQty)}
                                    style={[
                                        styles.unitSelector,
                                        {
                                            backgroundColor: colors.inputBackground,
                                            borderColor: formData.allowsFractionalQty ? config.THEME_COLOR : colors.inputBorder,
                                        },
                                    ]}>
                                    <AppText
                                        label={formData.allowsFractionalQty ? 'Enabled' : 'Disabled'}
                                        color={formData.allowsFractionalQty ? config.THEME_COLOR : colors.text}
                                        style={styles.unitSelectorText}
                                    />
                                    <Lucide name={formData.allowsFractionalQty ? 'circle-check' : 'circle'} size={18} color={formData.allowsFractionalQty ? config.THEME_COLOR : colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <View style={[styles.viewContainer, { flex: 1, marginRight: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Barcode'} style={{ marginBottom: 5 }} color={colors.text} />
                                <View style={[styles.barcodeRow, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
                                    <TextInput
                                        placeholder='Barcode'
                                        placeholderTextColor={colors.placeholder}
                                        value={formData.barcode}
                                        onChangeText={(text) => updateFormData('barcode', text)}
                                        style={[styles.textInput, styles.barcodeInput, { color: colors.text }]}
                                    />
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => navigation.navigate('BarcodeScanner', {
                                            returnScreen: 'ProductForm',
                                            initialBarcode: formData.barcode,
                                            onBarcodeScanned: (barcode) => handleBarcodeScanned(barcode)
                                        })}
                                        style={styles.barcodeScanButton}>
                                        <Lucide name="scan-line" size={20} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={[styles.viewContainer, { flex: 1, marginLeft: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Re-order Level'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TextInput
                                    placeholder='0'
                                    placeholderTextColor={colors.placeholder}
                                    value={formData.reorderLevel}
                                    onChangeText={(text) => updateFormData('reorderLevel', text.replace(/[^0-9]/g, ''))}
                                    keyboardType="numeric"
                                    style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.reorderLevel && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                />
                                {errors.reorderLevel && <AppText label={errors.reorderLevel} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <View style={[styles.viewContainer, { flex: 1, marginRight: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Minimum order qty'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TextInput
                                    placeholder='1'
                                    placeholderTextColor={colors.placeholder}
                                    value={formData.minOrderQty}
                                    onChangeText={(text) => updateFormData('minOrderQty', text.replace(/[^0-9.]/g, ''))}
                                    keyboardType='decimal-pad'
                                    style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.minOrderQty && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                />
                                {errors.minOrderQty && <AppText label={errors.minOrderQty} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                            </View>
                            <View style={[styles.viewContainer, { flex: 1, marginLeft: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Quantity step'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TextInput
                                    placeholder='1'
                                    placeholderTextColor={colors.placeholder}
                                    value={formData.qtyStep}
                                    onChangeText={(text) => updateFormData('qtyStep', text.replace(/[^0-9.]/g, ''))}
                                    keyboardType='decimal-pad'
                                    style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.qtyStep && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                />
                                {errors.qtyStep && <AppText label={errors.qtyStep} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                            </View>
                        </View>

                        {/* <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <View style={[styles.viewContainer, { flex: 1, marginRight: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Batch Number'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TextInput
                                    placeholder='e.g., BATCH-2024-01'
                                    placeholderTextColor={colors.placeholder}
                                    value={formData.batchNumber}
                                    onChangeText={(text) => updateFormData('batchNumber', text)}
                                    style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                                />
                            </View>
                            <View style={[styles.viewContainer, { flex: 1, marginLeft: 5, backgroundColor: colors.surface }]}>
                                <AppText label={'Expiry Date'} style={{ marginBottom: 5 }} color={colors.text} />
                                <TextInput
                                    placeholder='YYYY-MM-DD'
                                    placeholderTextColor={colors.placeholder}
                                    value={formData.expiryDate}
                                    onChangeText={(text) => updateFormData('expiryDate', text)}
                                    style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.expiryDate && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                />
                                {errors.expiryDate && <AppText label={errors.expiryDate} color={colors.error} fontSize={12} style={{ marginTop: 4 }} />}
                            </View>
                        </View> */}

                        {warehouses.length > 0 && !editMode && (
                            <View
                                style={[
                                    styles.viewContainer,
                                    {
                                        marginTop: 10,
                                        backgroundColor: colors.surface,
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                    },
                                ]}>
                                <AppText
                                    label={'Distribute initial stock by warehouse'}
                                    style={{ marginBottom: 8 }}
                                    color={colors.text}
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <AppText
                                        label={'Warehouse'}
                                        fontSize={12}
                                        color={colors.textTertiary}
                                    />
                                    <AppText
                                        label={`Qty (${formData.unit || 'pcs'})`}
                                        fontSize={12}
                                        color={colors.textTertiary}
                                    />
                                </View>
                                {warehouses.map((wh, index) => (
                                    <View
                                        key={wh.id || wh.code || wh.name || index}
                                        style={[
                                            styles.warehouseRow,
                                            {
                                                backgroundColor: colors.inputBackground,
                                                borderColor: colors.border,
                                                borderTopRightRadius: index === 0 ? 5 : 0,
                                                borderBottomRightRadius: index === warehouses.length - 1 ? 5 : 0,
                                                borderTopLeftRadius: index === 0 ? 5 : 0,
                                                borderBottomLeftRadius: index === warehouses.length - 1 ? 5 : 0,    
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1, marginRight: 10 }}>
                                            <AppText
                                                label={wh.name || wh.code || 'Warehouse'}
                                                color={colors.text}
                                                numberOfLines={1}
                                            />
                                            {wh.location ? (
                                                <AppText
                                                    label={wh.location}
                                                    color={colors.textTertiary}
                                                    fontSize={11}
                                                    numberOfLines={1}
                                                />
                                            ) : null}
                                        </View>
                                        <View style={{ width: 96 }}>
                                            <TextInput
                                                placeholder='0'
                                                placeholderTextColor={colors.placeholder}
                                                value={warehouseQuantities[wh.id] || ''}
                                                onChangeText={(text) => handleWarehouseQtyChange(wh.id, text)}
                                                keyboardType='numeric'
                                                style={[
                                                    styles.warehouseQtyInput,
                                                    {
                                                        backgroundColor: colors.surface,
                                                        borderColor: colors.inputBorder,
                                                        color: colors.text,
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>
                                ))}
                                {errors.warehouseQuantities && (
                                    <AppText
                                        label={errors.warehouseQuantities}
                                        color={colors.error}
                                        fontSize={12}
                                        style={{ marginTop: 8 }}
                                    />
                                )}
                            </View>
                        )}

                        {/* Categories Section */}
                        <View style={styles.sectionHeader}>
                            <AppText label={'Categories'} variant={1} fontSize={16} color={colors.text} />
                        </View>

                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={() => setShowCategories(true)}
                            style={[styles.viewContainer, { marginTop: 5, paddingBottom: 12, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: errors.categories ? 1 : 0, borderColor: errors.categories ? colors.error : 'transparent' }]}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                    <AppText label={'Select Categories'} style={{ marginBottom: 0 }} color={colors.text} />
                                    <AppText label={' *'} color={colors.error} />
                                </View>
                                <AppText
                                    label={Object.values(selectedCategories).length > 0
                                        ? Object.values(selectedCategories).map((cat, i) => i < Object.values(selectedCategories).length - 1 ? `${cat.name}, ` : cat.name).join('')
                                        : 'Tap to select categories'}
                                    color={Object.values(selectedCategories).length > 0 ? colors.text : colors.textTertiary}
                                    fontSize={14}
                                    numberOfLines={2}
                                />
                            </View>
                            <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
                        </TouchableOpacity>
                        {errors.categories && <AppText label={errors.categories} color={colors.error} fontSize={12} style={{ marginTop: 4, marginLeft: 10 }} />}

                        {/* Tags Section */}
                        <View style={styles.sectionHeader}>
                            <AppText label={'Tags'} variant={1} fontSize={16} color={colors.text} />
                        </View>

                        <View style={[styles.viewContainer, { marginTop: 5, backgroundColor: colors.surface }]}>
                            <AppText label={'Tags (comma separated)'} style={{ marginBottom: 5 }} color={colors.text} />
                            <TextInput
                                placeholder='e.g., bundle, swift, premium'
                                placeholderTextColor={colors.placeholder}
                                value={formData.tags}
                                onChangeText={(text) => updateFormData('tags', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                            />
                        </View>
                    </ScrollView>
                    
                    {/* Save Button */}
                    <TouchableOpacity
                        activeOpacity={.8}
                        onPress={handleSave}
                        disabled={isLoading}
                        style={[styles.saveButton, { backgroundColor: config.THEME_COLOR }, isLoading && styles.saveButtonDisabled]}>
                        {isLoading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <>
                                <AppText label={'Save Product'} variant={1} color={colors.textInverse} fontSize={16} />
                                <Lucide name="check" color={colors.textInverse} size={18} style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <AppModal title={`Select Categories (${Object.values(selectedCategories).length} selected)`} handleClose={handleClose} onRequestClose={onRequestClose} visible={showCategories}>
                    <View style={{ padding: 10, paddingBottom: 0 }}>
                        <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Lucide name="search" color={colors.textTertiary} size={18} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder='Search categories...'
                                placeholderTextColor={colors.placeholder}
                                value={categorySearch}
                                onChangeText={setCategorySearch}
                                style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                            />
                            {categorySearch.length > 0 && (
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={() => setCategorySearch('')}
                                    style={{ padding: 5 }}>
                                    <Lucide name="x" color={colors.textTertiary} size={16} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, marginBottom: 4 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setShowCategories(false);
                                    navigation.navigate('CategoryForm');
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
                                <Lucide name="circle-plus" size={18} color={config.THEME_COLOR} />
                                <AppText label="Add category" fontSize={13} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        </View>

                        {filteredCategories.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Lucide name="search-x" color={colors.border} size={40} />
                                <AppText label={'No categories found'} color={colors.textTertiary} style={{ marginTop: 10 }} />
                            </View>
                        ) : (
                            <View style={{ padding: 5, height: Math.min(filteredCategories.length * 75, height / 2.5) }}>
                                    <FlashList
                                    showsVerticalScrollIndicator={false}
                                    data={filteredCategories}
                                        keyExtractor={(item, index) => `cat-${item.id || index}`}
                                    estimatedItemSize={55}
                                    renderItem={({ item, index }) => {
                                        const key = item.id || item.name;
                                        const isSelected = !!selectedCategories[key];
                                        return (
                                            <TouchableOpacity
                                                activeOpacity={.6}
                                                onPress={() => {
                                                    if (isSelected) {
                                                        const newSelectedCategories = { ...selectedCategories };
                                                        delete newSelectedCategories[key];
                                                        setSelectedCategories(newSelectedCategories);
                                                    } else {
                                                        if (Object.keys(selectedCategories).length >= 3) {
                                                            Alert.alert('Not Allowed','You can only select up to 3 categories');
                                                            return;
                                                        } else {
                                                            const newSelectedCategories = { ...selectedCategories };
                                                            newSelectedCategories[key] = item;
                                                            setSelectedCategories(newSelectedCategories);
                                                        }
                                                    }
                                                }}
                                                style={[styles.categoryItem, { backgroundColor: colors.surface, borderColor: colors.border }, isSelected && [styles.categoryItemSelected, { backgroundColor: colors.primaryShade, borderColor: config.THEME_COLOR }]]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                    <View style={[styles.categoryCheckbox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, isSelected && [styles.categoryCheckboxSelected, { backgroundColor: config.THEME_COLOR, borderColor: config.THEME_COLOR }]]}>
                                                        {isSelected && <Lucide name="check" color={colors.textInverse} size={14} />}
                                                    </View>
                                                    <AppText label={item.name} style={{ flex: 1, marginLeft: 12 }} variant={isSelected ? 1 : 2} color={colors.text} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            </View>
                        )}

                        {Object.values(selectedCategories).length > 0 && (
                            <View style={styles.selectedCategoriesFooter}>
                                <AppText
                                    label={`${Object.values(selectedCategories).length} category${Object.values(selectedCategories).length > 1 ? 'ies' : ''} selected`}
                                    color={config.THEME_COLOR}
                                    fontSize={13}
                                />
                            </View>
                        )}
                    </View>
                </AppModal>

                <AppModal
                    title={'Select unit'}
                    visible={showUnitPicker}
                    handleClose={() => setShowUnitPicker(false)}
                    onRequestClose={() => setShowUnitPicker(false)}>
                    <View style={{ padding: 10 }}>
                        {UNIT_OPTIONS.map((u) => {
                            const isSelected = (formData.unit || 'pcs') === u;
                            return (
                                <TouchableOpacity
                                    key={u}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        updateFormData('unit', u);
                                        setShowUnitPicker(false);
                                    }}
                                    style={[
                                        styles.unitOptionRow,
                                        isSelected && { borderColor: config.THEME_COLOR, backgroundColor: '#f0f7ff' },
                                    ]}>
                                    <AppText label={u} color={colors.text} />
                                    {isSelected && <Lucide name="check" size={16} color={config.THEME_COLOR} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppModal>

                <AppModal
                    title={'Select product type'}
                    visible={showProductTypePicker}
                    handleClose={() => setShowProductTypePicker(false)}
                    onRequestClose={() => setShowProductTypePicker(false)}>
                    <View style={{ padding: 10 }}>
                        {PRODUCT_TYPE_OPTIONS.map((type) => {
                            const isSelected = (formData.productType || 'standard') === type;
                            return (
                                <TouchableOpacity
                                    key={type}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        updateFormData('productType', type);
                                        if (type === 'fabric') {
                                            updateFormData('unit', 'yard');
                                            updateFormData('allowsFractionalQty', true);
                                            if (!String(formData.minOrderQty || '').trim() || Number(formData.minOrderQty) < 1) {
                                                updateFormData('minOrderQty', '1');
                                            }
                                            if (!String(formData.qtyStep || '').trim() || Number(formData.qtyStep) < 1) {
                                                updateFormData('qtyStep', '1');
                                            }
                                        }
                                        setShowProductTypePicker(false);
                                    }}
                                    style={[
                                        styles.unitOptionRow,
                                        isSelected && { borderColor: config.THEME_COLOR, backgroundColor: '#f0f7ff' },
                                    ]}>
                                    <AppText label={type} color={colors.text} />
                                    {isSelected && <Lucide name="check" size={16} color={config.THEME_COLOR} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppModal>

                <AppModal title={'Product Image'} handleClose={() => setShowFullImage(false)} onRequestClose={() => setShowFullImage(false)} visible={showFullImage}>
                    <View style={{ padding: 10, alignItems: 'center' }}>
                        <Image
                            source={{ uri: selectedImage.uri }}
                            style={{ width: width - 60, height: width - 60, borderRadius: 10, marginTop: 10 }}
                            resizeMode='contain'
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 20 }}>
                            <TouchableOpacity
                                activeOpacity={.6}
                                onPress={handleRemoveImage}
                                disabled={imageDeleteLoading}
                                style={[
                                    styles.deleteImageButton,
                                    { backgroundColor: colors.error, opacity: imageDeleteLoading ? 0.65 : 1 },
                                ]}>
                                {imageDeleteLoading ? (
                                    <ActivityIndicator color={colors.textInverse} size="small" />
                                ) : (
                                    <>
                                        <Lucide name="trash-2" size={18} color={colors.textInverse} />
                                        <AppText label="Remove" color={colors.textInverse} fontSize={14} style={{ marginLeft: 6 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </AppModal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    )
}

export default ProductForm;

const styles = StyleSheet.create({
    viewContainer: {
        backgroundColor:'#fff',
        padding:12,
        paddingTop:10,
        borderRadius:8,
        paddingBottom: 10
    },
    textInput: {
        paddingHorizontal:12,
        paddingVertical:12,
        fontFamily:'FiraSans-Regular',
        borderRadius:6,
        height:50,
        color:'#4d4d4d',
        fontSize:15,
        backgroundColor:'#f8f8f8',
        borderWidth:1,
        borderColor:'#eee'
    },
    textArea: {
        height:100,
        paddingTop:12
    },
    inputError: {
        borderColor:'#f00',
        backgroundColor:'#fff5f5'
    },
    sectionHeader: {
        marginTop:15,
        marginBottom:5,
        paddingHorizontal:5
    },
    unitSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 12,
        height: 50,
    },
    unitSelectorText: {
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
    },
    barcodeRow: {
        flexDirection:'row',
        alignItems:'center',
        borderRadius:6,
        borderWidth:1,
        paddingHorizontal:8,
        paddingVertical:2,
    },
    barcodeInput: {
        flex:1,
        backgroundColor:'transparent',
        borderWidth:0,
        paddingHorizontal:8,
    },
    barcodeScanButton: {
        width:40,
        height:40,
        borderRadius:20,
        justifyContent:'center',
        alignItems:'center',
    },
    // Image styles
    addImageButton: {
        width:36,
        height:36,
        borderRadius:18,
        backgroundColor:'#f0f7ff',
        justifyContent:'center',
        alignItems:'center',
        borderWidth:1,
        borderColor:config.THEME_COLOR
    },
    emptyImageContainer: {
        width:'100%',
        height:120,
        justifyContent:'center',
        alignItems:'center',
        borderRadius:8,
        backgroundColor:'#f8f8f8',
        borderWidth:2,
        borderStyle:'dashed',
        borderColor:'#ddd'
    },
    imageThumbnail: {
        width:100,
        height:100,
        borderRadius:8,
        overflow:'hidden',
        backgroundColor:'#eee',
        borderWidth:1,
        borderColor:'#ddd'
    },
    addImagePlaceholder: {
        backgroundColor:'#f8f8f8',
        borderWidth:2,
        borderStyle:'dashed',
        borderColor:'#ddd',
        justifyContent:'center',
        alignItems:'center'
    },
    removeImageButton: {
        position:'absolute',
        top:4,
        right:4,
        width:24,
        height:24,
        borderRadius:12,
        backgroundColor:'rgba(0,0,0,0.6)',
        justifyContent:'center',
        alignItems:'center'
    },
    deleteImageButton: {
        flexDirection:'row',
        alignItems:'center',
        paddingHorizontal:20,
        paddingVertical:12,
        borderRadius:25,
        backgroundColor:'#f00'
    },
    // Price input styles
    priceInputContainer: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#f8f8f8',
        borderRadius:6,
        borderWidth:1,
        borderColor:'#eee',
        paddingLeft:12
    },
    priceInput: {
        flex:1,
        backgroundColor:'transparent',
        borderWidth:0,
        paddingLeft:5
    },
    // Category styles
    searchContainer: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#f8f8f8',
        borderRadius:99,
        paddingHorizontal:12,
        paddingVertical:10,
        marginBottom:10,
        borderWidth:1,
        borderColor:'#eee'
    },
    searchInput: {
        flex:1,
        fontFamily:'FiraSans-Regular',
        fontSize:15,
        color:'#4d4d4d',
        padding:0
    },
    categoryItem: {
        backgroundColor:'#fff',
        height:55,
        flexDirection:'row',
        justifyContent:'space-between',
        alignItems:'center',
        paddingHorizontal:12,
        borderRadius:8,
        marginBottom:8,
        borderWidth:1,
        borderColor:'#eee'
    },
    categoryItemSelected: {
        backgroundColor:'#f0f7ff',
        borderColor:config.THEME_COLOR
    },
    categoryCheckbox: {
        width:22,
        height:22,
        borderRadius:6,
        borderWidth:2,
        borderColor:'#ddd',
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'#fff'
    },
    categoryCheckboxSelected: {
        backgroundColor:config.THEME_COLOR,
        borderColor:config.THEME_COLOR
    },
    selectedCategoriesFooter: {
        paddingVertical:12,
        paddingHorizontal:12,
        borderTopWidth:1,
        borderTopColor:'#eee',
        marginTop:10
    },
    // Save button styles
    saveButton: {
        flexDirection:'row',
        justifyContent:'center',
        alignItems:'center',
        height:55,
        backgroundColor:config.THEME_COLOR,
        margin:10,
        marginTop:5,
        borderRadius:10,
        shadowColor:'#000',
        shadowOffset:{width:0,height:2},
        shadowOpacity:0.1,
        shadowRadius:4,
        elevation:3
    },
    saveButtonDisabled: {
        opacity:0.6
    },
    warehouseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        borderBottomWidth: 1,
    },
    warehouseQtyInput: {
        height: 42,
        padding: 8,
        fontSize: 14,
        borderRadius: 5
    },
    unitOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 8,
    }
});