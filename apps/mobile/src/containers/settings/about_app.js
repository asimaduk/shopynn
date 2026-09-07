import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../../hooks/useTheme';

const AboutApp = ({ navigation }) => {
    const { colors } = useTheme();
    const backPress = () => {
        navigation.goBack();
    };

    const openLink = (url) => {
        Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
    };

    const FeatureRow = ({ icon, title, description }) => (
        <View style={styles.featureRow}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.primaryShade || (config.THEME_COLOR + '12') }]}>
                <Lucide name={icon} size={22} color={config.THEME_COLOR} />
            </View>
            <View style={styles.featureTextContainer}>
                <AppText label={title} variant={1} fontSize={16} color={colors.text} />
                <AppText label={description} fontSize={13} color={colors.textSecondary} style={{ marginTop: 2 }} />
            </View>
        </View>
    );

    const StatCard = ({ icon, label, value }) => (
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.primaryShade || (config.THEME_COLOR + '12') }]}>
                <Lucide name={icon} size={18} color={config.THEME_COLOR} />
            </View>
            <AppText label={value} variant={1} fontSize={18} color={colors.text} style={{ marginTop: 8 }} />
            <AppText label={label} fontSize={12} color={colors.textSecondary} style={{ marginTop: 2, textAlign: 'center' }} />
        </View>
    );

    const LinkItem = ({ icon, label, onPress }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.linkItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Lucide name={icon} size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <AppText label={label} fontSize={15} color={colors.text} />
            </View>
            <Lucide name="chevron-right" size={18} color={colors.border} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'About App'} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.heroSection}>
                        <View style={styles.logoContainer}>
                            <Lucide name="package-check" size={56} color={colors.textInverse} />
                        </View>
                        <AppText label="Shopynn" fontSize={30} variant={1} color={colors.text} style={{ marginTop: 14 }} />
                        <AppText label="Inventory + Customer Ordering Platform" fontSize={13} color={colors.textSecondary} style={{ marginTop: 4 }} />
                        <View style={[styles.versionPill, { backgroundColor: colors.primaryShade || (config.THEME_COLOR + '12') }]}>
                            <Lucide name="badge-check" size={14} color={config.THEME_COLOR} />
                            <AppText label={`Version ${config.VERSION_NUMBER || '1.0.0'}`} fontSize={12} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                        </View>
                    </View>
                    <AppText
                        label="Shopynn helps businesses and customers work together in one app. Customers can discover products, place orders, and track updates, while store teams manage stock, process orders, and fulfill faster."
                        fontSize={14}
                        color={colors.textSecondary}
                        style={styles.heroDescription}
                    />
                </View>

                <View style={styles.statsRow}>
                    <StatCard icon="shopping-cart" label="Ordering" value="Live" />
                    <StatCard icon="shield-check" label="Security" value="RBAC" />
                    <StatCard icon="refresh-cw" label="Updates" value="Realtime" />
                </View>

                <View style={styles.section}>
                    <AppText label="ORDERING JOURNEY" variant={1} fontSize={12} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <FeatureRow
                            icon="search"
                            title="Browse & Discover"
                            description="Customers explore available products from linked stores and review product details before ordering."
                        />
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <FeatureRow
                            icon="shopping-cart"
                            title="Place Orders Fast"
                            description="Add items to cart, select delivery options, include notes, and place orders in a few taps."
                        />
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <FeatureRow
                            icon="list-checks"
                            title="Track Every Status"
                            description="Follow each order from pending to completion with clear timeline updates and history."
                        />
                    </View>
                </View>

                {/* <View style={styles.dualSectionRow}>
                    <View style={styles.halfSection}>
                        <AppText label="FOR CUSTOMERS" variant={1} fontSize={12} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <FeatureRow
                                icon="store"
                                title="Store-Linked Shopping"
                                description="Shop from your connected store(s) with better accuracy."
                            />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <FeatureRow
                                icon="truck"
                                title="Delivery-Ready Orders"
                                description="Share delivery notes so teams fulfill correctly."
                            />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <FeatureRow
                                icon="phone-call"
                                title="Call Vendor"
                                description="Contact the store directly from order screens."
                            />
                        </View>
                    </View>

                    <View style={styles.halfSection}>
                        <AppText label="FOR STORE TEAMS" variant={1} fontSize={12} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <FeatureRow
                                icon="clipboard-check"
                                title="Order Queue"
                                description="Process incoming orders and update statuses."
                            />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <FeatureRow
                                icon="boxes"
                                title="Stock Control"
                                description="Track inventory by warehouse and store."
                            />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <FeatureRow
                                icon="chart-column"
                                title="Insights"
                                description="Use reports to monitor performance."
                            />
                        </View>
                    </View>
                </View> */}

                <View style={styles.section}>
                    <AppText label="CONNECT & LEGAL" variant={1} fontSize={12} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <LinkItem icon="globe" label="Official Website" onPress={() => openLink('https://cheqstock.com')} />
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <LinkItem icon="shield-check" label="Privacy Policy" onPress={() => openLink('https://cheqstock.com/privacy-policy')} />
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <LinkItem icon="file-text" label="Terms of Service" onPress={() => openLink('https://cheqstock.com/terms-of-service')} />
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <LinkItem icon="mail" label="Contact Support" onPress={() => openLink('mailto:mail.asimadu@gmail.com')} />
                    </View>
                </View>

                <View style={styles.footer}>
                    <AppText label="© 2026 Shopynn Technologies Ltd." fontSize={12} color={colors.textTertiary} />
                    <AppText label="All Rights Reserved" fontSize={11} color={colors.placeholder} style={{ marginTop: 2 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 28,
    },
    heroCard: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 12,
    },
    logoContainer: {
        width: 92,
        height: 92,
        borderRadius: 24,
        backgroundColor: config.THEME_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    versionPill: {
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroDescription: {
        textAlign: 'center',
        lineHeight: 22,
        marginTop: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    statCard: {
        width: '32%',
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    section: {
        marginBottom: 14,
    },
    dualSectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    halfSection: {
        width: '48.8%',
    },
    sectionTitle: {
        marginBottom: 10,
        marginLeft: 2,
        letterSpacing: 0.8,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 9,
    },
    featureIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: config.THEME_COLOR + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureTextContainer: {
        flex: 1,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f3f5',
    },
    footer: {
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 16,
    }
});

export default AboutApp;