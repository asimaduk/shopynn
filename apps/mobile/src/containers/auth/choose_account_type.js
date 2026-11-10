import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, StatusBar, TouchableOpacity, View, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';

const ACCOUNT_TYPES = [
    {
        id: 'customer',
        title: 'Customer',
        tag: 'For shoppers',
        subtitle: 'Shop from a store you already buy from.',
        features: ['Link your store with its code', 'Order and pay from your phone', 'Track every order as it moves'],
        cta: 'Continue as customer',
        icon: 'shopping-bag',
        screen: 'CustomerSignup',
        accent: '#7C3AED',
    },
    {
        id: 'shop_owner',
        title: 'Shop owner',
        tag: 'For businesses',
        subtitle: 'Run your shop and every branch from one app.',
        features: ['Sales, MoMo and receipts', 'Inventory across your stores', 'Staff roles and reports'],
        cta: 'Continue as shop owner',
        icon: 'store',
        screen: 'ShopOwnerSignup',
        accent: config.THEME_COLOR,
    },
];

const ChooseAccountType = ({ navigation }) => {
    const { colors } = useTheme();
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
                    <View style={[styles.header, { backgroundColor: config.THEME_COLOR }]}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Lucide name="arrow-left" size={22} color="#fff" />
                        </TouchableOpacity>
                        <AppText label="Create account" variant={1} fontSize={28} color="#fff" style={styles.headerTitle} />
                        <AppText
                            label="How will you use Shopynn?"
                            fontSize={15}
                            color="rgba(255,255,255,0.88)"
                        />
                    </View>

                    <View style={styles.cardsWrap}>
                        {ACCOUNT_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                activeOpacity={0.88}
                                onPress={() => navigation.navigate(type.screen)}
                                style={[styles.typeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={[styles.accentBar, { backgroundColor: type.accent }]} />
                                <View style={styles.cardBody}>
                                    <View style={styles.cardTop}>
                                        <View style={[styles.typeIconWrap, { backgroundColor: `${type.accent}18` }]}>
                                            <Lucide name={type.icon} size={28} color={type.accent} />
                                        </View>
                                        <View style={styles.typeTextWrap}>
                                            <View style={[styles.tag, { backgroundColor: `${type.accent}14` }]}>
                                                <AppText label={type.tag} fontSize={11} color={type.accent} variant={1} />
                                            </View>
                                            <AppText label={type.title} variant={1} fontSize={20} color={colors.text} />
                                        </View>
                                    </View>
                                    <AppText
                                        label={type.subtitle}
                                        fontSize={14}
                                        color={colors.textSecondary}
                                        style={styles.subtitle}
                                    />
                                    <View style={styles.features}>
                                        {type.features.map((f) => (
                                            <View key={f} style={styles.featureRow}>
                                                <Lucide name="circle-check" size={16} color={type.accent} />
                                                <AppText label={f} fontSize={13} color={colors.text} style={styles.featureText} />
                                            </View>
                                        ))}
                                    </View>
                                    <View style={[styles.ctaRow, { borderTopColor: colors.border }]}>
                                        <AppText label={type.cta} variant={1} fontSize={14} color={type.accent} />
                                        <Lucide name="arrow-right" size={18} color={type.accent} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.spacer} />

                    <View style={styles.footer}>
                        <AppText label="Already have an account?" fontSize={13} color={colors.textSecondary} />
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Login')}
                            activeOpacity={0.85}
                            style={[styles.signInBtn, { borderColor: config.THEME_COLOR }]}
                        >
                            <Lucide name="log-in" size={18} color={config.THEME_COLOR} />
                            <AppText label="Sign in" variant={1} fontSize={15} color={config.THEME_COLOR} />
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
    content: { flexGrow: 1, paddingBottom: 20 },
    header: {
        paddingTop: 8,
        paddingBottom: 28,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backBtn: {
        width: 40,
        height: 40,
        marginLeft: -8,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { marginBottom: 6 },
    cardsWrap: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
    typeCard: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    accentBar: { width: 5 },
    cardBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    typeIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeTextWrap: { flex: 1, alignItems: 'flex-start' },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4 },
    subtitle: { marginTop: 12 },
    features: { marginTop: 12, gap: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    featureText: { flex: 1 },
    ctaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        marginTop: 14,
        paddingVertical: 12,
    },
    spacer: { flex: 1, minHeight: 24 },
    footer: { alignItems: 'center', paddingHorizontal: 20, gap: 10 },
    signInBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: 'stretch',
        height: 50,
        borderRadius: 12,
        borderWidth: 1.5,
    },
});

export default ChooseAccountType;
