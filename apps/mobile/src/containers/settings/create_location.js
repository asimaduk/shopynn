import React, { useState } from 'react';
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
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { locations as locationsApi } from '../../services/api';

const CreateLocation = ({ navigation }) => {
    const { colors } = useTheme();
    const [formData, setFormData] = useState({ name: '' });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const backPress = () => navigation.goBack();

    const updateFormData = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Location name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Location name must be at least 2 characters';
        } else if (formData.name.trim().length > 100) {
            newErrors.name = 'Location name must be less than 100 characters';
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
            await locationsApi.create({ name: formData.name.trim() });
            Alert.alert('Success', 'Location added successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (_) {
            Alert.alert('Error', 'Failed to add location. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label="Add Location" />
                <View style={{ flex: 1 }}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ flex: 1, padding: 10 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled">
                        <View style={[styles.infoBanner, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="map-pin" color={config.THEME_COLOR} size={18} />
                            <AppText
                                label="Add a new location (e.g. city or area) that you can assign to warehouses."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ flex: 1, marginLeft: 10 }}
                            />
                        </View>

                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Location Name" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" *" color={colors.error} />
                            </View>
                            <TextInput
                                placeholder="e.g. Accra, Kumasi, Tema"
                                placeholderTextColor={colors.placeholder}
                                value={formData.name}
                                onChangeText={(text) => updateFormData('name', text)}
                                style={[
                                    styles.textInput,
                                    {
                                        backgroundColor: colors.inputBackground,
                                        borderColor: colors.inputBorder,
                                        color: colors.text,
                                    },
                                    errors.name && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }],
                                ]}
                                maxLength={100}
                                autoCapitalize="words"
                            />
                            {errors.name && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.name} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                            <AppText
                                label={`${formData.name.length}/100 characters`}
                                fontSize={11}
                                color={colors.textTertiary}
                                style={{ marginTop: 4, textAlign: 'right' }}
                            />
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={isLoading || !formData.name.trim()}
                        style={[
                            styles.saveButton,
                            (isLoading || !formData.name.trim()) && styles.saveButtonDisabled,
                        ]}>
                        {isLoading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <>
                                <Lucide name="plus" color={colors.textInverse} size={18} style={{ marginRight: 8 }} />
                                <AppText label="Add Location" variant={1} color={colors.textInverse} fontSize={16} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default CreateLocation;

const styles = StyleSheet.create({
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: config.THEME_COLOR,
    },
    viewContainer: {
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
        fontSize: 15,
        borderWidth: 1,
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
});
