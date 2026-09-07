import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    View,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import config from '../../config';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import useTheme from '../../hooks/useTheme';
import { warehouses as warehousesApi, locations as locationsApi, normalizeList } from '../../services/api';
import WarehouseReferenceCodeField, { validateReferenceCode } from '../../components/warehouse_reference_code_field';
import CustomerSignupCodesUpgradeCard from '../../components/customer_signup_codes_upgrade_card';
import { canManageCustomerSignupCodes } from '../../utils/permissions';

const EditWarehouse = ({ navigation, route }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user?.data);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canCustomerSignupCodes = canManageCustomerSignupCodes(currentUser, subscriptionFeatures);
    const warehouse = route.params?.warehouse || {};
    const [formData, setFormData] = useState({
        name: warehouse.name || '',
        location: warehouse.location || '',
        location_id: warehouse.location_id ?? null,
        manager: warehouse.manager || '',
        reference_code: warehouse.reference_code || '',
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [loadingWarehouse, setLoadingWarehouse] = useState(Boolean(warehouse?.id));
    const [hasChanges, setHasChanges] = useState(false);
    const [initialSnapshot, setInitialSnapshot] = useState(null);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [locationOptions, setLocationOptions] = useState([]);

    const fetchLocations = useCallback(async () => {
        try {
            const raw = await locationsApi.list();
            const list = normalizeList(raw) || [];
            const options = list
                .map((item) => ({ id: item.id, name: item.name ?? item.label ?? String(item.id ?? '') }))
                .filter((o) => o.name);
            setLocationOptions(options);
        } catch (_) {
            setLocationOptions([]);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchLocations();
        }, [fetchLocations])
    );

    useEffect(() => {
        let cancelled = false;
        if (!warehouse?.id) return undefined;
        setLoadingWarehouse(true);
        warehousesApi
            .get(warehouse.id)
            .then((data) => {
                if (cancelled || !data) return;
                const next = {
                    name: data.name || '',
                    location: data.location || '',
                    location_id: data.location_id ?? null,
                    manager: data.manager || '',
                    reference_code: data.reference_code || '',
                };
                setFormData(next);
                setInitialSnapshot(next);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoadingWarehouse(false);
            });
        return () => {
            cancelled = true;
        };
    }, [warehouse?.id]);

    useEffect(() => {
        if (!initialSnapshot) return;
        const hasChanged = JSON.stringify(initialSnapshot) !== JSON.stringify(formData);
        setHasChanges(hasChanged);
    }, [formData, initialSnapshot]);

    const backPress = () => {
        if (hasChanges) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to go back?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
                ]
            );
        } else {
            navigation.goBack();
        }
    };

    const updateFormData = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Warehouse name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Warehouse name must be at least 2 characters';
        } else if (formData.name.trim().length > 50) {
            newErrors.name = 'Warehouse name must be less than 50 characters';
        }
        if (formData.location_id == null && !formData.location?.trim()) {
            newErrors.location = 'Please select a location';
        }
        if (canCustomerSignupCodes) {
            const refErr = validateReferenceCode(formData.reference_code);
            if (refErr) newErrors.reference_code = refErr;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            Alert.alert('Validation Error', 'Please fix the errors before saving');
            return;
        }
        setIsLoading(true);
        try {
            const payload = {
                name: formData.name.trim(),
                manager: formData.manager?.trim() || undefined,
            };
            if (formData.location_id != null) {
                payload.location_id = formData.location_id;
            } else {
                payload.location = formData.location?.trim() || undefined;
            }
            if (canCustomerSignupCodes) {
                payload.reference_code = formData.reference_code?.trim() || '';
            }
            await warehousesApi.update(warehouse.id, payload);
            Alert.alert('Success', 'Warehouse updated successfully', [
                { text: 'OK', onPress: () => { setHasChanges(false); navigation.goBack(); } },
            ]);
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Failed to update warehouse. Please try again.';
            Alert.alert('Error', msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label="Edit Warehouse" />
                <View style={{ flex: 1 }}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ flex: 1, padding: 10 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled">
                        {/* Info Banner */}
                        <View style={[styles.infoBanner, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="pencil-line" color={config.THEME_COLOR} size={18} />
                            <AppText
                                label="Update the warehouse details below. Changes will be saved when you tap 'Update Warehouse'."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ flex: 1, marginLeft: 10 }}
                            />
                        </View>

                        {/* Warehouse Name */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Warehouse Name" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" *" color={colors.error} />
                            </View>
                            <TextInput
                                placeholder="e.g., Main Store, Accra Depot"
                                placeholderTextColor={colors.placeholder}
                                value={formData.name}
                                onChangeText={(text) => updateFormData('name', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.name && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                maxLength={50}
                                autoCapitalize="words"
                            />
                            {errors.name && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.name} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                            <AppText
                                label={`${formData.name.length}/50 characters`}
                                fontSize={11}
                                color={colors.textTertiary}
                                style={{ marginTop: 4, textAlign: 'right' }}
                            />
                        </View>

                        {/* Location (dropdown) */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Location" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" *" color={colors.error} />
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setShowLocationPicker(true)}
                                style={[styles.textInput, styles.dropdownTouchable, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, errors.location && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}>
                                <AppText
                                    label={formData.location || 'Select location'}
                                    fontSize={15}
                                    color={formData.location ? colors.text : colors.placeholder}
                                    style={{ flex: 1 }}
                                    numberOfLines={1}
                                />
                                <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                            {errors.location && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.location} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                        </View>

                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            {canCustomerSignupCodes ? (
                                <WarehouseReferenceCodeField
                                    colors={colors}
                                    value={formData.reference_code}
                                    warehouseName={formData.name}
                                    error={errors.reference_code}
                                    onChange={(text) => updateFormData('reference_code', text)}
                                    onClearError={() =>
                                        setErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.reference_code;
                                            return next;
                                        })
                                    }
                                />
                            ) : (
                                <CustomerSignupCodesUpgradeCard
                                    navigation={navigation}
                                    user={currentUser}
                                    colors={colors}
                                    subscriptionFeatures={subscriptionFeatures}
                                />
                            )}
                        </View>

                        {/* Manager (optional) */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Manager" style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" (optional)" color={colors.textTertiary} fontSize={12} />
                            </View>
                            <TextInput
                                placeholder="Manager or contact name"
                                placeholderTextColor={colors.placeholder}
                                value={formData.manager}
                                onChangeText={(text) => updateFormData('manager', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Preview */}
                        {formData.name.trim() && (
                            <View style={[styles.previewContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <Lucide name="eye" color={config.THEME_COLOR} size={16} />
                                    <AppText label="Preview" variant={1} fontSize={14} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                                </View>
                                <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
                                    <View style={[styles.previewIconContainer, { backgroundColor: colors.primaryShade }]}>
                                        <Lucide name="store" color={config.THEME_COLOR} size={22} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <AppText label={formData.name.trim()} fontSize={15} variant={1} numberOfLines={1} color={colors.text} />
                                        {formData.location ? (
                                            <AppText label={formData.location} fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                        ) : (
                                            <AppText label="No location selected" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4, fontStyle: 'italic' }} />
                                        )}
                                        {formData.manager.trim() ? (
                                            <AppText label={`Manager: ${formData.manager.trim()}`} fontSize={12} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Save Button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={
                            isLoading ||
                            loadingWarehouse ||
                            !formData.name.trim() ||
                            (formData.location_id == null && !formData.location?.trim()) ||
                            !hasChanges
                        }
                        style={[
                            styles.saveButton,
                            (isLoading ||
                                loadingWarehouse ||
                                !formData.name.trim() ||
                                (formData.location_id == null && !formData.location?.trim()) ||
                                !hasChanges) &&
                                styles.saveButtonDisabled,
                        ]}>
                        {isLoading || loadingWarehouse ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <>
                                <Lucide name="save" color={colors.textInverse} size={18} style={{ marginRight: 8 }} />
                                <AppText label="Update Warehouse" variant={1} color={colors.textInverse} fontSize={16} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <AppModal
                    title="Select location"
                    visible={showLocationPicker}
                    handleClose={() => setShowLocationPicker(false)}
                    onRequestClose={() => setShowLocationPicker(false)}>
                    <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                        {locationOptions.map((opt) => (
                            <TouchableOpacity
                                key={opt.id ?? opt.name}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setFormData((prev) => ({ ...prev, location: opt.name, location_id: opt.id ?? null }));
                                    setErrors((prev) => ({ ...prev, location: undefined }));
                                    setShowLocationPicker(false);
                                }}
                                style={[styles.modalRow, { backgroundColor: colors.surface }]}>
                                <Lucide name="map-pin" size={18} color={config.THEME_COLOR} />
                                <AppText label={opt.name} fontSize={16} style={{ flex: 1, marginLeft: 12 }} color={colors.text} />
                                {formData.location === opt.name && <Lucide name="check" size={20} color={config.THEME_COLOR} />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                setShowLocationPicker(false);
                                navigation.navigate('CreateLocation');
                            }}
                            style={[styles.modalRow, styles.addLocationRow, { backgroundColor: colors.primaryShade, borderColor: colors.border }]}>
                            <Lucide name="circle-plus" size={20} color={config.THEME_COLOR} />
                            <AppText label="Add location" fontSize={16} variant={1} style={{ marginLeft: 12 }} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    </ScrollView>
                </AppModal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default EditWarehouse;

const styles = StyleSheet.create({
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f7ff',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: config.THEME_COLOR,
    },
    viewContainer: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    textInput: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontFamily: 'FiraSans-Regular',
        borderRadius: 8,
        height: 50,
        color: '#4d4d4d',
        fontSize: 15,
        backgroundColor: '#f8f8f8',
        borderWidth: 1,
        borderColor: '#eee',
    },
    dropdownTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputError: {
        borderColor: '#f00',
        backgroundColor: '#fff5f5',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    previewContainer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    previewIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f0f7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 55,
        backgroundColor: config.THEME_COLOR,
        margin: 10,
        marginTop: 5,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    modalList: {
        maxHeight: 320,
    },
    modalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    addLocationRow: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
    },
});
