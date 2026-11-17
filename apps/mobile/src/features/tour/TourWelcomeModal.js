import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import TourMapGraphic from './TourMapGraphic';

/**
 * Absolute overlay (not RN Modal) so it does not clash with other post-login sheets.
 */
export default function TourWelcomeModal({
    visible,
    onStart,
    onDontShowAgain,
    onDismiss,
}) {
    const { colors } = useTheme();

    if (!visible) return null;

    return (
        <View style={styles.root} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={onDismiss}>
                <Pressable
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={(e) => e.stopPropagation?.()}
                >
                    <TourMapGraphic compact pinLabel="Let’s go" />
                    <AppText
                        label="Welcome to Shopynn"
                        variant={1}
                        fontSize={20}
                        color={colors.text}
                        style={{ marginTop: 14, textAlign: 'center' }}
                    />
                    <AppText
                        label="Take a short tour of selling, stock, customers, and reports. You can replay it anytime from More → Take a tour."
                        fontSize={14}
                        color={colors.textSecondary}
                        style={{ marginTop: 8, textAlign: 'center', lineHeight: 20 }}
                    />
                    <Pressable
                        onPress={onStart}
                        style={[styles.primary, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <AppText label="Start tour" color="#fff" variant={1} fontSize={15} />
                    </Pressable>
                    <Pressable onPress={onDontShowAgain} style={styles.secondary}>
                        <AppText label="Don’t show again" fontSize={14} color={colors.textTertiary} />
                    </Pressable>
                    <Pressable onPress={onDismiss} style={styles.secondary}>
                        <AppText label="Not now" fontSize={14} color={colors.textSecondary} />
                    </Pressable>
                </Pressable>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10050,
        elevation: 10050,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
        alignItems: 'center',
    },
    primary: {
        marginTop: 20,
        alignSelf: 'stretch',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    secondary: {
        marginTop: 12,
        paddingVertical: 6,
    },
});
