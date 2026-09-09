import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, StatusBar, TouchableOpacity, View, Dimensions, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';

const { width } = Dimensions.get('window');

const ACCOUNT_TYPES = [
    {
        id: 'customer',
        title: 'Customer',
        subtitle: 'Shop from stores you are linked to. Pay over time where offered.',
        icon: 'shopping-bag',
        screen: 'CustomerSignup',
        accent: '#7C3AED',
    },
    {
        id: 'shop_owner',
        title: 'Shop owner',
        subtitle: 'Run inventory, sales, and customer orders for your business.',
        icon: 'store',
        screen: 'ShopOwnerSignup',
        accent: config.THEME_COLOR,
    },
];

const ChooseAccountType = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
            StatusBar.setBarStyle('light-content');
            return undefined;
        }, [])
    );

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            {isFocused ? (
                <StatusBar barStyle="light-content" backgroundColor={config.THEME_COLOR} />
            ) : null}
            {insets.top > 0 && (
                <View style={[styles.statusBarFill, { height: insets.top, backgroundColor: config.THEME_COLOR }]} />
            )}
            <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.brandStrip, { backgroundColor: config.THEME_COLOR }]}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Lucide name="arrow-left" size={22} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.brandStripInner}>
                            <View style={styles.brandIconWrap}>
                                <Lucide name="user-plus" color="#fff" size={32} />
                            </View>
                            <AppText label="Create account" variant={1} fontSize={26} color="#fff" style={styles.brandTitle} />
                            <AppText label="Choose the type of account you need" fontSize={13} color="rgba(255,255,255,0.85)" />
                        </View>
                    </View>

                    <View style={styles.cardsWrap}>
                        {ACCOUNT_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                activeOpacity={0.88}
                                onPress={() => navigation.navigate(type.screen)}
                                style={[styles.typeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={[styles.typeIconWrap, { backgroundColor: `${type.accent}18` }]}>
                                    <Lucide name={type.icon} size={28} color={type.accent} />
                                </View>
                                <View style={styles.typeTextWrap}>
                                    <AppText label={type.title} variant={1} fontSize={18} color={colors.text} />
                                    <AppText label={type.subtitle} fontSize={13} color={colors.textSecondary} style={{ marginTop: 6 }} />
                                </View>
                                <Lucide name="chevron-right" size={22} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={[styles.footerHint, { borderTopColor: colors.border }]}>
                        <Lucide name="badge-info" size={14} color={colors.textTertiary} />
                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginLeft: 8 }}>
                            <AppText label="Already have an account? Sign in" fontSize={13} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    safeArea: { flex: 1 },
    statusBarFill: { width: '100%' },
    content: { paddingBottom: 28 },
    brandStrip: {
        width,
        paddingTop: 8,
        paddingBottom: 28,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backBtn: {
        position: 'absolute',
        left: 16,
        top: 12,
        zIndex: 2,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandStripInner: { alignItems: 'center', marginTop: 8 },
    brandIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    brandTitle: { marginBottom: 4 },
    cardsWrap: { paddingHorizontal: 20, paddingTop: 24, gap: 14 },
    typeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    typeIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeTextWrap: { flex: 1 },
    footerHint: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        marginTop: 20,
    },
});

export default ChooseAccountType;
