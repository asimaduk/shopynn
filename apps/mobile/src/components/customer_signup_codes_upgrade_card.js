import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import config from '../config';
import { canManageSubscription } from '../utils/permissions';

/**
 * Inline Premium upsell for customer signup codes on warehouse forms.
 */
export default function CustomerSignupCodesUpgradeCard({ navigation, user, colors, subscriptionFeatures }) {
    const canUpgrade = canManageSubscription(user, subscriptionFeatures);

    return (
        <View style={[styles.card, { backgroundColor: colors.primaryShade, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <Lucide name="lock" size={18} color={config.THEME_COLOR} />
                <AppText label="Premium: Customer signup codes" variant={1} fontSize={15} color={colors.text} style={styles.title} />
            </View>
            <AppText
                label="Upgrade to generate per-store codes customers use when signing up for online ordering."
                fontSize={13}
                color={colors.textSecondary}
                style={styles.body}
            />
            {canUpgrade ? (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Subscription')}
                    style={[styles.btn, { backgroundColor: config.THEME_COLOR }]}>
                    <AppText label="View Premium plan" variant={1} fontSize={14} color={colors.textInverse} />
                </TouchableOpacity>
            ) : (
                <AppText
                    label="Ask your account owner to upgrade to Premium."
                    fontSize={12}
                    color={colors.textTertiary}
                    style={{ marginTop: 4 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        flex: 1,
        marginLeft: 8,
    },
    body: {
        lineHeight: 20,
        marginBottom: 10,
    },
    btn: {
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
});
