import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { sanitizeBody } from '../../utils/apiValidation';
import { categories as categoriesApi } from '../../services/api';

const CategoryForm = ({ navigation, route }) => {
    const { colors } = useTheme();
    const isEditMode = !!route.params?.category;
    const existingCategory = route.params?.category || {};
    
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize form data if editing
    useEffect(() => {
        if (isEditMode && existingCategory) {
            setFormData({
                name: existingCategory.name || '',
                description: existingCategory.description || ''
            });
        }
    }, [isEditMode, existingCategory]);

    const backPress = () => {
        if (hasChanges) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to go back?',
                [
                    {text: 'Cancel', style: 'cancel'},
                    {text: 'Discard', style: 'destructive', onPress: () => navigation.goBack()}
                ]
            );
        } else {
            navigation.goBack();
        }
    }

    const updateFormData = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
        setHasChanges(true);
        // Clear error when user starts typing
        if(errors[field]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        }
    }

    const validateForm = () => {
        const newErrors = {};
        
        if(!formData.name.trim()) {
            newErrors.name = 'Category name is required';
        } else if(formData.name.trim().length < 2) {
            newErrors.name = 'Category name must be at least 2 characters';
        } else if(formData.name.trim().length > 50) {
            newErrors.name = 'Category name must be less than 50 characters';
        }
        
        if(formData.description.trim() && formData.description.trim().length > 200) {
            newErrors.description = 'Description must be less than 200 characters';
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
            const categoryData = sanitizeBody({
                name: formData.name.trim(),
                description: formData.description.trim() || null
            }, null, 500);
            
            if (isEditMode) {
                await categoriesApi.update(existingCategory.id, categoryData);
            } else {
                await categoriesApi.create(categoryData);
            }
            
            Alert.alert(
                'Success', 
                `Category ${isEditMode ? 'updated' : 'created'} successfully`,
                [
                    {text: 'OK', onPress: () => {
                        setHasChanges(false);
                        navigation.goBack();
                    }}
                ]
            );
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || `Failed to ${isEditMode ? 'update' : 'create'} category.`;
            Alert.alert('Error', msg);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex:1}}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label={isEditMode ? 'Edit Category' : 'Add Category'} />
                <View style={{ flex: 1 }}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ flex: 1, padding: 10 }}
                        contentContainerStyle={{ paddingBottom: 20 }}>
                        {/* Info Banner */}
                        <View style={[styles.infoBanner, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="info" color={config.THEME_COLOR} size={18} />
                            <AppText
                                label={isEditMode
                                    ? 'Update the category information below'
                                    : 'Fill in the details to create a new category'}
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ flex: 1, marginLeft: 10 }}
                            />
                        </View>

                        {/* Name Field */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label={'Category Name'} variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label={' *'} color={colors.error} />
                            </View>
                            <TextInput
                                placeholder='e.g., Beverages, Electronics'
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

                        {/* Description Field */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label={'Description'} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label={' (optional)'} color={colors.textTertiary} fontSize={12} />
                            </View>
                            <TextInput
                                placeholder='Brief description of this category...'
                                placeholderTextColor={colors.placeholder}
                                value={formData.description}
                                onChangeText={(text) => updateFormData('description', text)}
                                style={[styles.textInput, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.description && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                maxLength={200}
                            />
                            {errors.description && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.description} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                            <AppText
                                label={`${formData.description.length}/200 characters`}
                                fontSize={11}
                                color={colors.textTertiary}
                                style={{ marginTop: 4, textAlign: 'right' }}
                            />
                        </View>

                        {/* Preview Section */}
                        {formData.name.trim() && (
                            <View style={[styles.previewContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <Lucide name="eye" color={config.THEME_COLOR} size={16} />
                                    <AppText label={'Preview'} variant={1} fontSize={14} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                                </View>
                                <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
                                    <View style={[styles.previewIconContainer, { backgroundColor: colors.primaryShade }]}>
                                        <Lucide name="folder" color={config.THEME_COLOR} size={20} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <AppText label={formData.name.trim()} fontSize={15} variant={1} numberOfLines={1} color={colors.text} />
                                        {formData.description.trim() ? (
                                            <AppText label={formData.description.trim()} fontSize={12} color={colors.textSecondary} numberOfLines={2} style={{ marginTop: 4 }} />
                                        ) : (
                                            <AppText label={'No description'} fontSize={12} color={colors.textTertiary} style={{ marginTop: 4, fontStyle: 'italic' }} />
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Save Button */}
                    <TouchableOpacity
                        activeOpacity={.8}
                        onPress={handleSave}
                        disabled={isLoading || !formData.name.trim()}
                        style={[
                            styles.saveButton,
                            (isLoading || !formData.name.trim()) && styles.saveButtonDisabled
                        ]}>
                        {isLoading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <>
                                <Lucide
                                    name={isEditMode ? "check" : "plus"}
                                    color={colors.textInverse}
                                    size={18}
                                    style={{ marginRight: 8 }}
                                />
                                <AppText
                                    label={isEditMode ? 'Update Category' : 'Create Category'}
                                    variant={1}
                                    color={colors.textInverse}
                                    fontSize={16}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    )
}

export default CategoryForm;

const styles = StyleSheet.create({
    // Info banner
    infoBanner: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#f0f7ff',
        padding:12,
        borderRadius:8,
        borderLeftWidth:3,
        borderLeftColor:config.THEME_COLOR
    },
    // Form container
    viewContainer: {
        backgroundColor:'#fff',
        padding:15,
        borderRadius:10,
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.05,
        shadowRadius:2,
        elevation:2
    },
    // Input styles
    textInput: {
        paddingHorizontal:12,
        paddingVertical:12,
        fontFamily:'FiraSans-Regular',
        borderRadius:8,
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
    // Error container
    errorContainer: {
        flexDirection:'row',
        alignItems:'center',
        marginTop:6
    },
    // Preview section
    previewContainer: {
        marginTop:20,
        padding:15,
        backgroundColor:'#f8f8f8',
        borderRadius:10,
        borderWidth:1,
        borderColor:'#eee'
    },
    previewCard: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#fff',
        padding:15,
        borderRadius:8,
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.03,
        shadowRadius:2,
        elevation:1
    },
    previewIconContainer: {
        width:48,
        height:48,
        borderRadius:24,
        backgroundColor:'#f0f7ff',
        justifyContent:'center',
        alignItems:'center'
    },
    // Save button
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
        opacity:0.5
    }
})