import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import config from '../config';
import useTheme from '../hooks/useTheme';
import { canManageSubscription } from '../utils/permissions';

/**
 * Full-screen prompt when a subscription feature is not on the tenant's plan.
 */
const FeatureUpgradePrompt = ({
    navigation,
    user,
    featureTitle = 'This feature',
    requiredPlanName = 'Premium',
    description,
    bullets = [],
    currentPlanName,
}) => {
    const { colors } = useTheme();
    const canUpgrade = canManageSubscription(user);

    const defaultDescription =
        description ||
        `${featureTitle} is included on the ${requiredPlanName} plan. Upgrade to unlock it for your business.`;

    return (
        <View style={[styles.wrap, { backgroundColor: colors.background }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryShade }]}>
                <Lucide name="lock" size={36} color={config.THEME_COLOR} />
            </View>
            <AppText label={`${requiredPlanName} plan required`} variant={1} fontSize={22} color={colors.text} style={styles.title} />
            <AppText label={defaultDescription} fontSize={15} color={colors.textSecondary} style={styles.body} />
            {currentPlanName ? (
                <View style={[styles.planChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label="Your current plan" fontSize={12} color={colors.textTertiary} />
                    <AppText label={currentPlanName} variant={1} fontSize={16} color={colors.text} style={{ marginTop: 4 }} />
                </View>
            ) : null}
            {bullets.length > 0 ? (
                <View style={[styles.bulletCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {bullets.map((line) => (
                        <View key={line} style={styles.bulletRow}>
                            <Lucide name="check" size={16} color={config.THEME_COLOR} />
                            <AppText label={line} fontSize={14} color={colors.textSecondary} style={styles.bulletText} />
                        </View>
                    ))}
                </View>
            ) : null}
            {canUpgrade ? (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Subscription')}
                    style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}>
                    <AppText label={`View ${requiredPlanName} plan`} variant={1} fontSize={16} color={colors.textInverse} />
                </TouchableOpacity>
            ) : (
                <AppText
                    label="Ask your account owner or administrator to upgrade the subscription."
                    fontSize={14}
                    color={colors.textSecondary}
                    style={{ textAlign: 'center', marginTop: 8 }}
                />
            )}
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
                <AppText label="Go back" fontSize={15} color={config.THEME_COLOR} variant={1} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
        alignItems: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        textAlign: 'center',
        marginBottom: 12,
    },
    body: {
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    planChip: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        alignItems: 'center',
    },
    bulletCard: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        marginBottom: 24,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    bulletText: {
        flex: 1,
        marginLeft: 10,
        lineHeight: 20,
    },
    primaryBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    secondaryBtn: {
        paddingVertical: 10,
    },
});

export default FeatureUpgradePrompt;
