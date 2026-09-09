import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { canManageSubscription } from '../../utils/permissions';
import { useSelector } from 'react-redux';

const SCREEN_COPY = {
    ProductTransfers: {
        title: 'Stock transfers',
        plan: 'Standard',
        description: 'Move inventory between branches with full transfer history.',
        bullets: ['Create transfers between warehouses', 'Track in-transit stock', 'Audit trail per branch'],
    },
    AdjustedQuantities: {
        title: 'Stock adjustments',
        plan: 'Standard',
        description: 'Correct quantities after counts, damage, or shrinkage.',
        bullets: ['Adjustment history', 'Reason codes', 'Inventory accuracy'],
    },
    StockCountHistory: {
        title: 'Stock count / audit',
        plan: 'Premium',
        description: 'Run physical counts and reconcile system stock.',
        bullets: ['Count sessions', 'Variance reports', 'Adjustment workflow'],
    },
    Warehouses: {
        title: 'Multi-store / branches',
        plan: 'Standard',
        description: 'Manage multiple warehouses or branches on one account.',
        bullets: ['Branch setup', 'Per-store inventory', 'Transfers between stores'],
    },
    Orders: {
        title: 'Online orders',
        plan: 'Premium',
        description: 'Accept and manage customer orders from your store.',
        bullets: ['Store order queue', 'Customer checkout', 'Order payments'],
    },
    Reports: {
        title: 'Reports',
        plan: 'Standard',
        description: 'Business reports and analytics for day-to-day decisions.',
        bullets: ['Sales & inventory reports', 'Operational summaries'],
    },
    Users: {
        title: 'User management',
        plan: 'Basic',
        description: 'Add staff and manage up to 3 users on the Basic plan.',
        bullets: ['Create users', 'Deactivate accounts', 'Upgrade for more users and roles'],
    },
    Roles: {
        title: 'Roles & permissions',
        plan: 'Standard',
        description: 'Fine-grained access control for your team.',
        bullets: ['Custom roles', 'Permission sets'],
    },
    NotificationsSetup: {
        title: 'Notifications',
        plan: 'Premium',
        description: 'In-app alerts and notification preferences.',
        bullets: ['Order alerts', 'Low stock signals', 'Push settings'],
    },
    OrderPayments: {
        title: 'Order payments',
        plan: 'Premium',
        description: 'View payments linked to customer orders.',
        bullets: ['Payment records', 'Order settlement'],
    },
    OrderSettlements: {
        title: 'Order settlements',
        plan: 'Premium',
        description: 'Digital order revenue collected by Shopynn and payouts to your business.',
        bullets: ['Available balance', 'Payout history'],
    },
    ItemsToReorder: {
        title: 'Reorder list',
        plan: 'Standard',
        description: 'See what is running low and needs replenishment.',
        bullets: ['Low-stock alerts', 'Reorder suggestions'],
    },
    ExpiringSoon: {
        title: 'Expiring stock',
        plan: 'Standard',
        description: 'Track batches nearing expiry before you lose stock.',
        bullets: ['Expiry dates', 'FEFO visibility'],
    },
    DailySales: {
        title: 'Daily sales overview',
        plan: 'Basic',
        description: 'Full daily sales chart and history beyond the dashboard snapshot.',
        bullets: ['7, 14, and 30-day trends', 'Custom date ranges'],
    },
};

const UpgradePrompt = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user: u }) => u);
    const screen = route.params?.screen;
    const requiredPlanName = route.params?.requiredPlanName;
    const copy = SCREEN_COPY[screen] || {
        title: route.params?.featureTitle || 'This feature',
        plan: requiredPlanName || 'Standard',
        description: route.params?.description || 'Upgrade your plan to unlock this feature.',
        bullets: [],
    };
    const canUpgrade = canManageSubscription(user);

    const planLabel = requiredPlanName || copy.plan;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader label="Plan upgrade" onPress={() => navigation.goBack()} />
            <View style={{ flex: 1, padding: 24, paddingBottom: 24 + insets.bottom, alignItems: 'center' }}>
                <View
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: `${config.THEME_COLOR}18`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                    }}
                >
                    <Lucide name="lock" size={32} color={config.THEME_COLOR} />
                </View>
                <AppText label={`${planLabel} plan required`} fontSize={20} variant={1} color={colors.text} />
                <AppText
                    label={copy.description || `${copy.title} is included on the ${planLabel} plan.`}
                    fontSize={14}
                    color={colors.textSecondary}
                    style={{ marginTop: 10, textAlign: 'center', lineHeight: 21 }}
                />
                {(copy.bullets || []).map((line) => (
                    <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, width: '100%', maxWidth: 360 }}>
                        <Lucide name="check" size={16} color={config.THEME_COLOR} style={{ marginTop: 2 }} />
                        <AppText label={line} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 8, flex: 1 }} />
                    </View>
                ))}
                {canUpgrade ? (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Subscription', { scrollToPlans: true })}
                        style={{
                            marginTop: 28,
                            backgroundColor: config.THEME_COLOR,
                            paddingVertical: 14,
                            paddingHorizontal: 24,
                            borderRadius: 6,
                            width: '100%',
                            maxWidth: 360,
                            alignItems: 'center',
                        }}
                    >
                        <AppText label="View plans & upgrade" color="#fff" fontSize={15} variant={1} />
                    </TouchableOpacity>
                ) : (
                    <AppText
                        label="Ask your account owner or administrator to upgrade the subscription."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 28, textAlign: 'center' }}
                    />
                )}
                {canUpgrade ? (
                    <AppText
                        label="Select a plan and complete payment to unlock this feature."
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginTop: 12, textAlign: 'center', maxWidth: 360 }}
                    />
                ) : null}
            </View>
        </SafeAreaView>
    );
};

export default UpgradePrompt;
