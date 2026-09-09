import React, { useState, useEffect, useMemo } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View, Alert, Share, Linking, Switch, Platform, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { SET_USER, SET_LOGGED_IN } from '../../store/actions/user';
import { setThemeMode } from '../../store/actions/appSettings';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { isBiometricSupported, isBiometricLoginEnabled, getBiometricType, disableBiometricLogin } from '../../utils/biometricAuth';
import { useFocusEffect } from '@react-navigation/native';
import {
    canAccessScreen,
    getScreenPlanAccess,
    hasFeature,
    hasPermission,
    navigateToScreenOrUpgrade,
} from '../../utils/permissions';
import { getTierBadgeLetterForPlanName } from '../../utils/subscriptionFeatureTiers';
import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    readSecureList,
    clearSensitiveOfflineData,
} from '../../utils/secureOfflineStorage';
import { clearTokens } from '../../utils/secureStorage';

const TAB_BAR_HEIGHT = 60;

const resolveProfileImageUri = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
    return `${config.BASE_API}/images?id=${encodeURIComponent(value)}`;
};

const SETTINGS_ITEMS = [
    { section: 'Account', title: 'Profile', subtitle: 'Manage your personal information', screen: 'Profile', icon: 'user', iconColor: config.THEME_COLOR },
    { section: 'Operations', title: 'Online Orders', subtitle: 'Process incoming customer orders', screen: 'Orders', icon: 'shopping-basket', iconColor: '#8b5cf6' },
    { section: 'Operations', title: 'Order Payments', subtitle: 'Admin view for order payment records', screen: 'OrderPayments', icon: 'banknote', iconColor: '#16a34a' },
    { section: 'Operations', title: 'Order Settlements', subtitle: 'Digital order revenue and payout balance', screen: 'OrderSettlements', icon: 'landmark', iconColor: '#2563eb' },
    { section: 'Operations', title: 'Pending Sales', subtitle: 'Review and approve sales', screen: 'PendingSales', icon: 'clipboard-list', iconColor: '#f00' },
    { section: 'Operations', title: 'Warehouses / Stores', subtitle: 'Manage storage locations', screen: 'Warehouses', icon: 'store', iconColor: '#10b981' },
    { section: 'Operations', title: 'Product Transfers', subtitle: 'Transfer products between locations', screen: 'ProductTransfers', icon: 'arrow-right-left', iconColor: config.THEME_COLOR },
    { section: 'Operations', title: 'Adjust Quantities', subtitle: 'Update stock quantities', screen: 'AdjustedQuantities', icon: 'arrow-down-1-0', iconColor: '#f59e0b' },
    { section: 'Operations', title: 'Stock count / Audit', subtitle: 'Count actual stock and create adjustments', screen: 'StockCountHistory', icon: 'clipboard-check', iconColor: '#0284c7' },
    // { section: 'Operations', title: 'Returns', subtitle: 'Sales & purchase returns', screen: 'Returns', icon: 'rotate-ccw', iconColor: '#ef4444' },
    { section: 'Administration', title: 'System users', subtitle: 'Create, edit, disable users and assign roles', screen: 'Users', icon: 'user-cog', iconColor: '#6366f1' },
    { section: 'Administration', title: 'Roles & Permissions', subtitle: 'Create and manage role permission sets', screen: 'Roles', icon: 'shield', iconColor: '#0ea5e9' },
    { section: 'Data Management', title: 'Customers', subtitle: 'Manage customer database', screen: 'Customers', icon: 'users', iconColor: config.THEME_COLOR },
    { section: 'Data Management', title: 'Suppliers', subtitle: 'Manage supplier information', screen: 'Suppliers', icon: 'truck', iconColor: '#f59e0b' },
    { section: 'Data Management', title: 'Product Categories', subtitle: 'Organize products by category', screen: 'ProductCategories', icon: 'grid-3x3', iconColor: '#10b981' },
    { section: 'Data Management', title: 'Expenditures', subtitle: 'Track business expenses', screen: 'Expenditures', icon: 'wallet', iconColor: '#ef4444' },
    { section: 'Reports & Analytics', title: 'Reports', subtitle: 'View business reports and analytics', screen: 'Reports', icon: 'activity', iconColor: config.THEME_COLOR },
    { section: 'Reports & Analytics', title: 'Transactions', subtitle: 'View all product transactions', screen: 'ProductTransactions', icon: 'database', iconColor: '#6b7280' },
    { section: 'App Settings', title: 'Invoice & Receipt', subtitle: 'Invoice number, receipt template, currency and valuation', screen: 'InvoiceReceiptSettings', icon: 'file-text', iconColor: config.THEME_COLOR },
    { section: 'App Settings', title: 'Notifications', subtitle: 'Configure notification preferences', screen: 'NotificationsSetup', icon: 'bell', iconColor: '#f59e0b' },
    { section: 'App Settings', title: 'Clients', subtitle: 'Partner merchants, onboarding & commissions', screen: 'MerchantPortal', icon: 'handshake', iconColor: '#6366f1' },
    { section: 'App Settings', title: 'Tenant directory', subtitle: 'All businesses, subscriptions, and payments (admin)', screen: 'TenantsDirectory', icon: 'building-2', iconColor: '#0ea5e9' },
    { section: 'App Settings', title: 'Billing catalog', subtitle: 'Plans, onboarding fees, and add-on prices (admin)', screen: 'BillingCatalog', icon: 'circle-dollar-sign', iconColor: '#059669' },
    { section: 'App Settings', title: 'About this app', subtitle: 'App version and information', screen: 'AboutApp', icon: 'info', iconColor: config.THEME_COLOR },
    { section: 'App Settings', title: 'Share app', subtitle: 'Share Shopynn with others', action: 'share', icon: 'share-2', iconColor: '#10b981' },
    { section: 'Account', title: 'Sign Out', subtitle: 'Sign out of your account', action: 'signout', icon: 'log-out', iconColor: '#f00' },
];

const Settings = ({ navigation, route }) => {
    const dispatch = useDispatch();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const { colors, themeMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchInput, setShowSearchInput] = useState(false);
    const [biometricSupported, setBiometricSupported] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [biometricLabel, setBiometricLabel] = useState('Biometrics');
    const [pendingSalesCount, setPendingSalesCount] = useState(0);
    const profileImageUri = resolveProfileImageUri(
        user?.profile_image ?? user?.profileImage ?? user?.avatar ?? user?.settings?.profile?.image_url,
    );

    const settingsItemsForSearch = useMemo(() => [...SETTINGS_ITEMS], []);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.trim().toLowerCase();
        return settingsItemsForSearch.filter((item) => {
            const matchesQuery =
                item.title.toLowerCase().includes(q) ||
                item.subtitle.toLowerCase().includes(q) ||
                item.section.toLowerCase().includes(q);

            if (!matchesQuery) return false;
            // Always allow non-navigation actions.
            if (item.action === 'share' || item.action === 'signout') return true;
            if (!item.screen) return true;
            return getScreenPlanAccess(user, item.screen, subscriptionFeatures).show;
        });
    }, [searchQuery, user, settingsItemsForSearch, subscriptionFeatures]);

    const handleSearchResultPress = (item) => {
        setSearchQuery('');
        setShowSearchInput(false);
        if (item.action === 'share') handleShareApp();
        else if (item.action === 'signout') handleSignOut();
        else if (item.screen) navigateToScreenOrUpgrade(navigation, user, item.screen, subscriptionFeatures);
    };

    const handleCloseSearch = () => {
        setSearchQuery('');
        setShowSearchInput(false);
    };

    const isAdmin =
        typeof user?.roles === 'string' &&
        user.roles
            .split(',')
            .map(role => role.trim().toLowerCase())
            .includes('admin') || user?.settings?.roles?.some(role => role.name.toLowerCase() === 'admin');
    const isCustomer = Boolean(
        (typeof user?.roles === 'string' &&
            user.roles
                .split(',')
                .map((role) => role.trim().toLowerCase())
                .includes('customer')) ||
        user?.settings?.roles?.some((role) => String(role?.name || '').trim().toLowerCase() === 'customer')
    );

    const canPendingSales = canAccessScreen(user, 'PendingSales', subscriptionFeatures);
    const warehousesAccess = getScreenPlanAccess(user, 'Warehouses', subscriptionFeatures);
    const transfersAccess = getScreenPlanAccess(user, 'ProductTransfers', subscriptionFeatures);
    const ordersAccess = getScreenPlanAccess(user, 'Orders', subscriptionFeatures);
    const adjustmentsAccess = getScreenPlanAccess(user, 'AdjustedQuantities', subscriptionFeatures);
    const stockCountAccess = getScreenPlanAccess(user, 'StockCountHistory', subscriptionFeatures);
    const usersAccess = getScreenPlanAccess(user, 'Users', subscriptionFeatures);
    const rolesAccess = getScreenPlanAccess(user, 'Roles', subscriptionFeatures);
    const canCustomers = canAccessScreen(user, 'Customers', subscriptionFeatures);
    const canSuppliers = canAccessScreen(user, 'Suppliers', subscriptionFeatures);
    const canCategories = canAccessScreen(user, 'ProductCategories', subscriptionFeatures);
    const canExpenditures = canAccessScreen(user, 'Expenditures', subscriptionFeatures);
    const reportsAccess = getScreenPlanAccess(user, 'Reports', subscriptionFeatures);
    const canTransactions = canAccessScreen(user, 'ProductTransactions', subscriptionFeatures);
    const notificationsSetupAccess = getScreenPlanAccess(user, 'NotificationsSetup', subscriptionFeatures);
    /** Customer ordering: list + control order-related push without staff notification settings. */
    const canCustomerOrderNotifications =
        hasPermission(user, 'orders.create') &&
        hasFeature(user, 'orders.create', subscriptionFeatures) &&
        hasPermission(user, 'notifications.view') &&
        hasFeature(user, 'notifications.view', subscriptionFeatures);
    const orderPaymentsAccess = getScreenPlanAccess(user, 'OrderPayments', subscriptionFeatures);
    const orderSettlementsAccess = getScreenPlanAccess(user, 'OrderSettlements', subscriptionFeatures);
    const canAbout = canAccessScreen(user, 'AboutApp', subscriptionFeatures);
    const tenantsDirectoryAccess = getScreenPlanAccess(user, 'TenantsDirectory', subscriptionFeatures);
    const billingCatalogAccess = getScreenPlanAccess(user, 'BillingCatalog', subscriptionFeatures);
    const canMerchantPortalFromSettings =
        canAccessScreen(user, 'MerchantPortal', subscriptionFeatures) && hasPermission(user, ['merchants.view']);
    const canWarehouses = warehousesAccess.show;
    const canTransfers = transfersAccess.show;
    const canOrders = ordersAccess.show;
    const canAdjustments = adjustmentsAccess.show;
    const canStockCount = stockCountAccess.show;
    const canUsers = usersAccess.show;
    const canRoles = rolesAccess.show;
    const canReports = reportsAccess.show;
    const canNotificationsSetup = notificationsSetupAccess.show;
    const canOrderPayments = orderPaymentsAccess.show;
    const canOrderSettlements = orderSettlementsAccess.show;
    const canTenantsDirectory = tenantsDirectoryAccess.show;
    const canBillingCatalog = billingCatalogAccess.show;
    const showAppSettingsSection =
        notificationsSetupAccess.show ||
        canCustomerOrderNotifications ||
        canAbout ||
        tenantsDirectoryAccess.show ||
        billingCatalogAccess.show ||
        canMerchantPortalFromSettings;

    const renderPlanGateTrailing = (access) => {
        if (!access?.locked) {
            return <Lucide name="chevron-right" color={colors.border} size={18} />;
        }
        return (
            <View style={styles.planGateTrailing}>
                <View style={styles.planBadge}>
                    <AppText
                        label={getTierBadgeLetterForPlanName(access.requiredPlanName)}
                        fontSize={11}
                        variant={1}
                        color="#4338CA"
                    />
                </View>
                <Lucide name="lock" color={colors.textTertiary} size={16} />
            </View>
        );
    };

    useFocusEffect(
        React.useCallback(() => {
            let mounted = true;
            readSecureList(PENDING_SALES_KEY)
                .then((list) => {
                    if (!mounted) return;
                    setPendingSalesCount(Array.isArray(list) ? list.length : 0);
                })
                .catch(() => {
                    if (mounted) setPendingSalesCount(0);
                });
            return () => {
                mounted = false;
            };
        }, []),
    );

    useEffect(() => {
        let mounted = true;
        (async () => {
            const supported = await isBiometricSupported();            
            const enabled = await isBiometricLoginEnabled();
            const label = await getBiometricType();
            if (mounted) {
                setBiometricSupported(supported);
                setBiometricEnabled(enabled);
                setBiometricLabel(label);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleBiometricToggle = async (value) => {
        if (!value) {
            await disableBiometricLogin();
            setBiometricEnabled(false);
        } else {
            Alert.alert(
                'Enable on sign in',
                'Sign in with your password on the login screen, then choose "Yes" when asked to use ' + biometricLabel + ' for next time.'
            );
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    await clearTokens();
                    await clearSensitiveOfflineData();
                    dispatch({ type: SET_USER, payload: {} });
                    dispatch({ type: SET_LOGGED_IN, payload: false });
                },
            }
        ]);
    }

    const handleShareApp = async () => {
        try {
            const result = await Share.share({
                message: 'Check out Shopynn - Inventory Management System',
                title: 'Shopynn'
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Search - icon button or expanded input */}
            {!isCustomer && !showSearchInput ? (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowSearchInput(true)}
                    style={[styles.searchIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
            ) : !isCustomer ? (
                <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search..."
                        placeholderTextColor={colors.placeholder || colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={[styles.searchInput, { color: colors.text }]}
                        returnKeyType="search"
                        autoFocus
                    />
                    <TouchableOpacity
                        onPress={handleCloseSearch}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.searchClear}>
                        <Lucide name="x" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            ) : null}

            {!isCustomer && showSearchInput && searchQuery.trim().length > 0 ? (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}>
                    {filteredItems.length === 0 ? (
                        <View style={[styles.searchEmpty, { backgroundColor: colors.surface }]}>
                            <Lucide name="search-x" size={40} color={colors.border} />
                            <AppText label="No settings match your search" variant={1} fontSize={16} color={colors.textSecondary} style={{ marginTop: 12 }} />
                            <AppText label="Try a different term" fontSize={14} color={colors.textTertiary} style={{ marginTop: 4 }} />
                        </View>
                    ) : (
                        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}>
                            {filteredItems.map((item, index) => {
                                const itemAccess = item.screen
                                    ? getScreenPlanAccess(user, item.screen, subscriptionFeatures)
                                    : null;
                                return (
                                    <TouchableOpacity
                                        key={`${item.section}-${item.title}-${index}`}
                                        activeOpacity={0.6}
                                        onPress={() => handleSearchResultPress(item)}
                                        style={[styles.menuItem, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                                        <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Lucide name={item.icon} color={item.iconColor} size={20} />
                                        </View>
                                        <View style={styles.menuContent}>
                                            <AppText label={item.title} variant={2} color={item.action === 'signout' ? '#f00' : colors.text} fontSize={15} />
                                            <AppText label={item.subtitle} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                        </View>
                                        {itemAccess ? renderPlanGateTrailing(itemAccess) : (
                                            <Lucide name="chevron-right" color={colors.border} size={18} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            ) : (
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 10, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}>

                {/* Profile Section */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("Profile")}
                    style={styles.profileCard}>
                    <View style={styles.profileContent}>
                        <View style={[styles.profileImageContainer, { backgroundColor: colors.primaryShade }]}>
                            {profileImageUri ? (
                                <Image
                                    source={{ uri: profileImageUri }}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.primaryShade }]}>
                                    <Lucide name="user" color={config.THEME_COLOR} size={32} />
                                </View>
                            )}
                        </View>
                        <AppText
                            label={user?.name || 'Kingsford Asimadu'}
                            color={colors.text}
                            variant={1}
                            fontSize={18}
                            style={styles.profileName}
                        />
                        {user?.email ? (
                            <AppText
                                label={user.email}
                                variant={2}
                                color={colors.textSecondary}
                                fontSize={14}
                                style={styles.profileEmail}
                            />
                        ) : null}
                    </View>
                </TouchableOpacity>

                {/* Account Section */}
                <View style={styles.section}>
                    <AppText label={'Account'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={() => navigation.navigate("Profile")}
                            style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="user" color={config.THEME_COLOR} size={20} />
                            </View>
                            <View style={styles.menuContent}>
                                <AppText label={'Profile'} variant={2} color={colors.text} fontSize={15} />
                                <AppText label={'Manage your personal information and company profile'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Security Section */}
                {biometricSupported && (
                    <View style={styles.section}>
                        <AppText label={'Security'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.menuItem}>
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="scan-face" color={config.THEME_COLOR} size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'Sign in with ' + biometricLabel} variant={2} color={colors.text} fontSize={15} />
                                    <AppText label={biometricEnabled ? 'Enabled – use ' + biometricLabel + ' on login screen' : 'Use Face ID or fingerprint to sign in quickly'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                </View>
                                <Switch
                                    value={biometricEnabled}
                                    onValueChange={handleBiometricToggle}
                                    trackColor={{ false: colors.border, true: colors.primaryShade }}
                                    thumbColor={biometricEnabled ? config.THEME_COLOR : colors.textTertiary}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* Appearance Section */}
                <View style={styles.section}>
                    <AppText label={'Appearance'} variant={1} fontSize={14} color={colors.textSecondary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="palette" color={colors.primary} size={20} />
                            </View>
                            <View style={styles.menuContent}>
                                <AppText label={'Theme'} variant={2} color={colors.text} fontSize={15} />
                                <AppText label={themeMode === 'system' ? 'Follow system' : themeMode === 'dark' ? 'Dark mode' : 'Light mode'} variant={2} color={colors.textSecondary} fontSize={12} style={{ marginTop: 2 }} />
                            </View>
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => dispatch(setThemeMode('light'))}
                            style={[styles.themeOption, themeMode === 'light' && { backgroundColor: colors.primaryShade }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Lucide name="sun" size={18} color={themeMode === 'light' ? colors.primary : colors.textSecondary} />
                                <AppText label={'Light'} variant={themeMode === 'light' ? 1 : 2} fontSize={15} color={themeMode === 'light' ? colors.primary : colors.text} style={{ marginLeft: 12 }} />
                            </View>
                            {themeMode === 'light' && <Lucide name="check" size={18} color={colors.primary} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => dispatch(setThemeMode('dark'))}
                            style={[styles.themeOption, themeMode === 'dark' && { backgroundColor: colors.primaryShade }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Lucide name="moon" size={18} color={themeMode === 'dark' ? colors.primary : colors.textSecondary} />
                                <AppText label={'Dark'} variant={themeMode === 'dark' ? 1 : 2} fontSize={15} color={themeMode === 'dark' ? colors.primary : colors.text} style={{ marginLeft: 12 }} />
                            </View>
                            {themeMode === 'dark' && <Lucide name="check" size={18} color={colors.primary} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => dispatch(setThemeMode('system'))}
                            style={[styles.themeOption, themeMode === 'system' && { backgroundColor: colors.primaryShade }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Lucide name="monitor" size={18} color={themeMode === 'system' ? colors.primary : colors.textSecondary} />
                                <AppText label={'System'} variant={themeMode === 'system' ? 1 : 2} fontSize={15} color={themeMode === 'system' ? colors.primary : colors.text} style={{ marginLeft: 12 }} />
                            </View>
                            {themeMode === 'system' && <Lucide name="check" size={18} color={colors.primary} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Operations Section */}
                {(canPendingSales || canWarehouses || canTransfers || canOrders || canOrderPayments || canOrderSettlements || canAdjustments || canStockCount) && (
                    <View style={styles.section}>
                        <AppText label={'Operations'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {canOrders && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={() => navigateToScreenOrUpgrade(navigation, user, 'Orders', subscriptionFeatures)}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="shopping-basket" color="#8b5cf6" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Online Orders'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Process incoming customer orders'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(ordersAccess)}
                                </TouchableOpacity>
                                {(canOrderPayments || canOrderSettlements || canPendingSales || canWarehouses || canTransfers || canAdjustments || canStockCount) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canOrderPayments && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={() => navigateToScreenOrUpgrade(navigation, user, 'OrderPayments', subscriptionFeatures)}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="banknote" color="#16a34a" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Order Payments'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText
                                            label={'Admin view for customer order payments'}
                                            variant={2}
                                            color={colors.textTertiary}
                                            fontSize={12}
                                            style={{ marginTop: 2 }}
                                        />
                                    </View>
                                    {renderPlanGateTrailing(orderPaymentsAccess)}
                                </TouchableOpacity>
                                {(canOrderSettlements || canPendingSales || canWarehouses || canTransfers || canAdjustments || canStockCount) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canOrderSettlements && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={() => navigateToScreenOrUpgrade(navigation, user, 'OrderSettlements', subscriptionFeatures)}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="landmark" color="#2563eb" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Order Settlements'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText
                                            label={'Digital order revenue and payout balance'}
                                            variant={2}
                                            color={colors.textTertiary}
                                            fontSize={12}
                                            style={{ marginTop: 2 }}
                                        />
                                    </View>
                                    {renderPlanGateTrailing(orderSettlementsAccess)}
                                </TouchableOpacity>
                                {(canPendingSales || canWarehouses || canTransfers || canAdjustments || canStockCount) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canPendingSales && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={() => navigation.navigate("PendingSales")}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="clipboard-list" color="#f00" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <AppText label={'Pending Sales'} variant={2} color={colors.text} fontSize={15} />
                                            {pendingSalesCount > 0 && (
                                                <View style={styles.badge}>
                                                    <AppText
                                                        label={String(pendingSalesCount)}
                                                        color={colors.textInverse}
                                                        fontSize={10}
                                                        variant={1}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                        <AppText label={'Review and approve sales'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" color={colors.border} size={18} />
                                </TouchableOpacity>
                                {(canWarehouses || canTransfers || canAdjustments || canStockCount) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canWarehouses && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={() => navigateToScreenOrUpgrade(navigation, user, 'Warehouses', subscriptionFeatures)}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="store" color="#10b981" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Warehouses / Stores / Branches'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Manage storage locations'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(warehousesAccess)}
                                </TouchableOpacity>
                                {(canTransfers || canOrders || canAdjustments || canStockCount) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canTransfers && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={() => navigateToScreenOrUpgrade(navigation, user, 'ProductTransfers', subscriptionFeatures)}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="arrow-right-left" color={config.THEME_COLOR} size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Item Transfers'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Transfer items between locations'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(transfersAccess)}
                                </TouchableOpacity>
                                {(canOrders || canAdjustments || canStockCount) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canAdjustments && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={.6}
                                    onPress={() => navigateToScreenOrUpgrade(navigation, user, 'AdjustedQuantities', subscriptionFeatures)}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="arrow-down-1-0" color="#f59e0b" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Adjust Quantities'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Update stock quantities'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(adjustmentsAccess)}
                                </TouchableOpacity>
                                {canStockCount && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                            </>
                        )}

                        {canStockCount && (
                            <TouchableOpacity
                                activeOpacity={.6}
                                onPress={() => navigateToScreenOrUpgrade(navigation, user, 'StockCountHistory', subscriptionFeatures)}
                                style={styles.menuItem}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="clipboard-check" color="#0284c7" size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'Stock count / Audit'} variant={2} color={colors.text} fontSize={15} />
                                    <AppText label={'Count actual stock and create adjustments'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                </View>
                                {renderPlanGateTrailing(stockCountAccess)}
                            </TouchableOpacity>
                        )}
                        {/* <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("Returns")} style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="rotate-ccw" color="#ef4444" size={20} />
                            </View>
                            <View style={styles.menuContent}>
                                <AppText label={'Returns'} variant={2} color={colors.text} fontSize={15} />
                                <AppText label={'Sales & purchase returns'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity> */}
                    </View>
                    </View>
                )}

                {/* Administration Section */}
                {(isAdmin || canUsers || canRoles) && (
                    <View style={styles.section}>
                        <AppText label={'Administration'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {canUsers && (
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigateToScreenOrUpgrade(navigation, user, 'Users', subscriptionFeatures)} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="user-cog" color="#6366f1" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'System users'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Create, edit, disable users and assign roles'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(usersAccess)}
                                </TouchableOpacity>
                            )}
                            {canUsers && canRoles && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                            {canRoles && (
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigateToScreenOrUpgrade(navigation, user, 'Roles', subscriptionFeatures)} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="shield" color="#0ea5e9" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Roles & Permissions'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Create and manage role permission sets'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(rolesAccess)}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Invoice & Data */}
                {/* <View style={styles.section}>
                    <AppText label={'Invoice & Data'} variant={1} fontSize={14} color={colors.textSecondary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("InvoiceReceiptSettings")} style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}><Lucide name="receipt" color={config.THEME_COLOR} size={20} /></View>
                            <View style={styles.menuContent}>
                                <AppText label={'Invoice & Receipt'} variant={2} color={colors.text} fontSize={15} />
                                <AppText label={'Invoice number, receipt template, currency'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <TouchableOpacity activeOpacity={.6} onPress={() => (user?.role === 'Admin' || user?.role === 'Manager') ? navigation.navigate("DataExportBackup") : null} style={[styles.menuItem, user?.role === 'Staff' && { opacity: 0.6 }]}>
                            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}><Lucide name="database" color="#10b981" size={20} /></View>
                            <View style={styles.menuContent}>
                                <AppText label={'Export & Backup'} variant={2} color={colors.text} fontSize={15} />
                                <AppText label={user?.role === 'Staff' ? 'Admin or Manager only' : 'Export CSV, backup and restore data'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    </View>
                </View> */}

                {/* Data Management Section */}
                {(canCustomers || canSuppliers || canCategories || canExpenditures) && (
                    <View style={styles.section}>
                        <AppText label={'Data Management'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {canCustomers && (
                            <>
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("Customers")} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="users" color={config.THEME_COLOR} size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Customers'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Manage customer database'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" color={colors.border} size={18} />
                                </TouchableOpacity>
                                {(canSuppliers || canCategories || canExpenditures) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canSuppliers && (
                            <>
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("Suppliers")} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="truck" color="#f59e0b" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Suppliers'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Manage supplier information'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" color={colors.border} size={18} />
                                </TouchableOpacity>
                                {(canCategories || canExpenditures) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canCategories && (
                            <>
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("ProductCategories")} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="grid-3x3" color="#10b981" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Product Categories'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Organize products by category'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" color={colors.border} size={18} />
                                </TouchableOpacity>
                                {canExpenditures && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                            </>
                        )}

                        {canExpenditures && (
                            <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("Expenditures")} style={styles.menuItem}>
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="wallet" color="#ef4444" size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'Expenditures'} variant={2} color={colors.text} fontSize={15} />
                                    <AppText label={'Track business expenses'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                </View>
                                <Lucide name="chevron-right" color={colors.border} size={18} />
                            </TouchableOpacity>
                        )}
                    </View>
                    </View>
                )}

                {/* Reports & Analytics Section */}
                {(canReports || canTransactions) && (
                    <View style={styles.section}>
                        <AppText label={'Reports & Analytics'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {canReports && (
                            <TouchableOpacity activeOpacity={.6} onPress={() => navigateToScreenOrUpgrade(navigation, user, 'Reports', subscriptionFeatures)} style={styles.menuItem}>
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="activity" color={config.THEME_COLOR} size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'Reports'} variant={2} color={colors.text} fontSize={15} />
                                    <AppText label={'View business reports and analytics'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                </View>
                                {renderPlanGateTrailing(reportsAccess)}
                            </TouchableOpacity>
                        )}
                        {canReports && canTransactions && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                        {canTransactions && (
                            <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("ProductTransactions")} style={styles.menuItem}>
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="database" color="#6b7280" size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'Transactions'} variant={2} color={colors.text} fontSize={15} />
                                    <AppText label={'View all product transactions'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                </View>
                                <Lucide name="chevron-right" color={colors.border} size={18} />
                            </TouchableOpacity>
                        )}
                    </View>
                    </View>
                )}

                {canCustomerOrderNotifications && (
                    <View style={styles.section}>
                        <AppText label={'Your orders'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <TouchableOpacity
                                activeOpacity={0.6}
                                onPress={() => navigation.navigate('Notifications')}
                                style={styles.menuItem}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="bell" color="#8b5cf6" size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'Order notifications'} variant={2} color={colors.text} fontSize={15} />
                                    <AppText
                                        label={'View order updates and turn push alerts on or off'}
                                        variant={2}
                                        color={colors.textTertiary}
                                        fontSize={12}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                                <Lucide name="chevron-right" color={colors.border} size={18} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* App Settings Section */}
                {showAppSettingsSection && (
                    <View style={styles.section}>
                        <AppText label={'App Settings'} variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {canNotificationsSetup && (
                            <>
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigateToScreenOrUpgrade(navigation, user, 'NotificationsSetup', subscriptionFeatures)} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="bell" color="#f59e0b" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Notifications'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText label={'Configure notification preferences'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                    </View>
                                    {renderPlanGateTrailing(notificationsSetupAccess)}
                                </TouchableOpacity>
                                {(canTenantsDirectory ||
                                    canBillingCatalog ||
                                    canAbout ||
                                    canMerchantPortalFromSettings) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canMerchantPortalFromSettings && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={() => navigation.navigate('MerchantPortal')}
                                    style={styles.menuItem}
                                >
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="handshake" color="#6366f1" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Merchants'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText
                                            label={'Partner merchants, onboarding & commissions'}
                                            variant={2}
                                            color={colors.textTertiary}
                                            fontSize={12}
                                            style={{ marginTop: 2 }}
                                        />
                                    </View>
                                    <Lucide name="chevron-right" color={colors.border} size={18} />
                                </TouchableOpacity>
                                {(canTenantsDirectory || canBillingCatalog) && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canTenantsDirectory && (
                            <>
                                <TouchableOpacity activeOpacity={.6} onPress={() => navigateToScreenOrUpgrade(navigation, user, 'TenantsDirectory', subscriptionFeatures)} style={styles.menuItem}>
                                    <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="building-2" color="#0ea5e9" size={20} />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <AppText label={'Tenant directory'} variant={2} color={colors.text} fontSize={15} />
                                        <AppText
                                            label={'Businesses, subscriptions, recent payments'}
                                            variant={2}
                                            color={colors.textTertiary}
                                            fontSize={12}
                                            style={{ marginTop: 2 }}
                                        />
                                    </View>
                                    {renderPlanGateTrailing(tenantsDirectoryAccess)}
                                </TouchableOpacity>
                                {canBillingCatalog && (
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                )}
                            </>
                        )}

                        {canBillingCatalog && (
                            <TouchableOpacity
                                activeOpacity={0.6}
                                onPress={() => navigateToScreenOrUpgrade(navigation, user, 'BillingCatalog', subscriptionFeatures)}
                                style={styles.menuItem}>
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="circle-dollar-sign" color="#059669" size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label="Billing catalog" variant={2} color={colors.text} fontSize={15} />
                                    <AppText
                                        label="Plans, onboarding fees, and add-on prices"
                                        variant={2}
                                        color={colors.textTertiary}
                                        fontSize={12}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                                {renderPlanGateTrailing(billingCatalogAccess)}
                            </TouchableOpacity>
                        )}

                        {canAbout && (canTenantsDirectory || canBillingCatalog || canMerchantPortalFromSettings || canOrderPayments || canNotificationsSetup) && (
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        )}

                        {canAbout && (
                            <TouchableOpacity activeOpacity={.6} onPress={() => navigation.navigate("AboutApp")} style={styles.menuItem}>
                                <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="info" color={config.THEME_COLOR} size={20} />
                                </View>
                                <View style={styles.menuContent}>
                                    <AppText label={'About this app'} variant={2} color={colors.text} fontSize={15} />
                                    <AppText label={'App version and information'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                                </View>
                                <Lucide name="chevron-right" color={colors.border} size={18} />
                            </TouchableOpacity>
                        )}

                        {(canNotificationsSetup ||
                            canOrderPayments ||
                            canAbout ||
                            canTenantsDirectory ||
                            canBillingCatalog ||
                            canMerchantPortalFromSettings) && (
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        )}
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={handleShareApp}
                            style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="share-2" color="#10b981" size={20} />
                            </View>
                            <View style={styles.menuContent}>
                                <AppText label={'Share app'} variant={2} color={colors.text} fontSize={15} />
                                <AppText label={'Share Shopynn with others'} variant={2} color={colors.textTertiary} fontSize={12} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    </View>
                    </View>
                )}

                <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={handleSignOut}
                    style={styles.signOutButton}>
                    <View
                        style={[
                            styles.signOutIcon,
                            { backgroundColor: colors.errorLight || 'rgba(220, 38, 38, 0.12)' },
                        ]}>
                        <Lucide name="log-out" color={colors.error || '#dc2626'} size={14} />
                    </View>
                    <AppText
                        label="Sign out"
                        color={colors.error || '#dc2626'}
                        fontSize={13}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>

                <View style={styles.versionFooter}>
                    <View
                        style={[
                            styles.versionPill,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                            },
                        ]}>
                        <AppText label="Shopynn" fontSize={11} color={colors.textTertiary} style={{ fontWeight: '600' }} />
                        <View style={[styles.versionDot, { backgroundColor: colors.border }]} />
                        <AppText
                            label={`v${config.VERSION_NUMBER ?? '1.20.3'}`}
                            fontSize={11}
                            color={colors.textSecondary}
                            variant={1}
                        />
                    </View>
                </View>
            </ScrollView>
            )}
        </SafeAreaView>
    )
}

export default Settings;

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 5
    },
    searchIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        marginTop: 10,
        marginBottom: 10,
        alignSelf: 'flex-end',
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 10,
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: 14,
        height: 48,
        borderRadius: 30,
        borderWidth: 1,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 0,
    },
    searchClear: {
        padding: 4,
    },
    searchEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        marginTop: 24,
        borderRadius: 12,
    },
    // Profile card
    profileCard: {
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8
    },
    profileContent: {
        alignItems: 'center',
    },
    profileImageContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        overflow: 'hidden',
        marginBottom: 16,
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
    profileImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileName: {
        marginBottom: 8,
        textAlign: 'center',
    },
    profileEmail: {
        marginBottom: 12,
        textAlign: 'center',
    },
    profileActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    // Section styles
    section: {
        marginBottom: 20
    },
    sectionTitle: {
        marginBottom: 8,
        marginLeft: 5,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'FiraSans-SemiBold'
    },
    sectionCard: {
        borderRadius: 5,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },
    // Menu item styles
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    menuContent: {
        flex: 1,
        marginLeft: 12
    },
    divider: {
        height: 1,
        marginLeft: 67
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        paddingLeft: 67,
        borderRadius: 5,
    },
    badge: {
        backgroundColor: '#f00',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    planGateTrailing: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planBadge: {
        backgroundColor: '#EEF2FF',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        paddingVertical: 10,
        marginTop: 4,
    },
    signOutIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    versionFooter: {
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 20,
    },
    versionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    versionDot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        marginHorizontal: 8,
    },
})