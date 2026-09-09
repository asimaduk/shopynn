import React, { useState, useCallback } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { users as usersApi } from '../../services/api';

const { width } = Dimensions.get('window');

const ForgotPassword = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
            StatusBar.setBarStyle('light-content');
            return undefined;
        }, [])
    );

    const handleSubmit = async () => {
        const v = email.trim().toLowerCase();
        if (!v) {
            Alert.alert('Required', 'Please enter your email.');
            return;
        }
        setLoading(true);
        try {
            await usersApi.forgotPassword(v);
            Alert.alert(
                'Reset password sent',
                'If an account exists with that email, you will receive password reset instructions.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.keyboard, { backgroundColor: colors.background }]}>
            {isFocused ? (
                <StatusBar barStyle="light-content" backgroundColor={config.THEME_COLOR} />
            ) : null}
            {insets.top > 0 && (
                <View style={[styles.statusBarFill, { height: insets.top, backgroundColor: config.THEME_COLOR }]} />
            )}
            <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {/* Back button — below status bar */}
                    {/* <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.goBack()}
                        style={[styles.backBtn, { top: insets.top + 8, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Lucide name="arrow-left" color="#fff" size={22} />
                    </TouchableOpacity> */}

                    {/* Top brand strip — same as login */}
                    <View style={[styles.brandStrip, { backgroundColor: config.THEME_COLOR }]}>
                        <View style={styles.brandStripInner}>
                            <View style={styles.brandIconWrap}>
                                <Image
                                    source={require('../../assets/images/logo/ims-logo.png')}
                                    style={styles.brandLogoImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <AppText label="Shopynn" variant={1} fontSize={26} color="#fff" style={styles.brandTitle} />
                            <AppText label="Inventory · Sales · Reports" fontSize={13} color="rgba(255,255,255,0.85)" />
                        </View>
                    </View>

                    {/* Form area */}
                    <View style={[styles.formSection, { backgroundColor: colors.background }]}>
                        <AppText label="Forgot password?" variant={1} fontSize={20} color={colors.text} style={styles.formTitle} />
                        <AppText label="Enter your email and we'll send you reset instructions." fontSize={14} color={colors.textSecondary} style={styles.formSubtitle} />

                        <View style={styles.fieldGroup}>
                            <AppText label="Email" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                <Lucide name="mail" size={18} color={colors.placeholder} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="you@example.com"
                                    placeholderTextColor={colors.placeholder}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    editable={!loading}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleSubmit}
                            disabled={loading || !email.trim()}
                            style={[
                                styles.primaryBtn,
                                { backgroundColor: config.THEME_COLOR },
                                (loading || !email.trim()) && styles.primaryBtnDisabled,
                            ]}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <AppText label="Submit request" variant={1} fontSize={16} color="#fff" />
                                    <Lucide name="send" color="#fff" size={18} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backToSignIn}>
                            <AppText label="Back to sign in" fontSize={15} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    keyboard: { flex: 1 },
    safeArea: { flex: 1 },
    statusBarFill: { width: '100%' },
    scrollContent: { paddingBottom: 24 },
    backBtn: {
        position: 'absolute',
        left: 24,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandStrip: {
        width,
        paddingTop: 5,
        paddingBottom: 28,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    brandStripInner: { alignItems: 'center' },
    brandIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    brandLogoImage: {
        width: 44,
        height: 44,
    },
    brandTitle: { marginBottom: 4 },
    formSection: {
        paddingHorizontal: 24,
        paddingTop: 28,
    },
    formTitle: { marginBottom: 4 },
    formSubtitle: { marginBottom: 24 },
    fieldGroup: { marginBottom: 20 },
    fieldLabel: { marginLeft: 2 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1.5,
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        height: 44,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 0,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 12,
        marginBottom: 16,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    backToSignIn: { alignItems: 'center', paddingVertical: 8 },
});

export default ForgotPassword;
