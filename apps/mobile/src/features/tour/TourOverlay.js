import React, { useMemo } from 'react';
import {
    Dimensions,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const PAD = 8;
const HOLE_RADIUS = 10;
const CARD_MAX = 240;

function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Dim overlay + coachmark. Card is always clamped on-screen with a close control.
 */
export default function TourOverlay({
    visible,
    step,
    stepIndex,
    stepCount,
    rect,
    onNext,
    onBack,
    onSkip,
}) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: winW, height: winH } = Dimensions.get('window');
    const safeTop = finiteOr(insets.top, 0);
    const safeBottom = finiteOr(insets.bottom, 0);

    const hole = useMemo(() => {
        if (!rect) return null;
        const left = finiteOr(rect.x - PAD, NaN);
        const top = finiteOr(rect.y - PAD, NaN);
        const width = finiteOr(rect.width + PAD * 2, NaN);
        const height = finiteOr(rect.height + PAD * 2, NaN);
        if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            return null;
        }
        return {
            left: Math.max(0, left),
            top: Math.max(0, top),
            width: Math.min(winW, width),
            height: Math.min(winH, height),
        };
    }, [rect, winW, winH]);

    /** Keep the coachmark fully inside the safe viewport. */
    const cardTop = useMemo(() => {
        const minTop = safeTop + 12;
        const maxTop = Math.max(minTop, winH - safeBottom - CARD_MAX - 16);
        if (!hole) {
            return Math.min(maxTop, Math.max(minTop, winH * 0.28));
        }
        const below = hole.top + hole.height + 16;
        if (below <= maxTop) return Math.max(minTop, below);
        const above = hole.top - CARD_MAX - 12;
        if (above >= minTop) return Math.min(maxTop, above);
        return Math.min(maxTop, Math.max(minTop, winH * 0.35));
    }, [hole, safeTop, safeBottom, winH]);

    if (!visible || !step) return null;

    const isLast = stepIndex >= stepCount - 1;
    const canBack = stepIndex > 0;
    const title = step.title || 'Tour';
    const description = step.description || 'Continue to the next step, or skip the tour.';

    return (
        <View style={styles.root} pointerEvents="box-none">
            {hole ? (
                <>
                    <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.top }]} />
                    <View
                        style={[
                            styles.dim,
                            {
                                top: hole.top + hole.height,
                                left: 0,
                                right: 0,
                                bottom: 0,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.dim,
                            {
                                top: hole.top,
                                left: 0,
                                width: hole.left,
                                height: hole.height,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.dim,
                            {
                                top: hole.top,
                                left: hole.left + hole.width,
                                right: 0,
                                height: hole.height,
                            },
                        ]}
                    />
                    <View
                        pointerEvents="none"
                        style={[
                            styles.holeBorder,
                            {
                                top: hole.top,
                                left: hole.left,
                                width: hole.width,
                                height: hole.height,
                                borderColor: config.THEME_COLOR,
                            },
                        ]}
                    />
                </>
            ) : (
                <View style={[styles.dim, StyleSheet.absoluteFill]} />
            )}

            <Pressable
                onPress={onSkip}
                hitSlop={12}
                style={[styles.closeFab, { top: safeTop + 10, backgroundColor: colors.surface }]}
                accessibilityLabel="Close tour"
            >
                <Lucide name="x" size={20} color={colors.text} />
            </Pressable>

            <View
                style={[
                    styles.card,
                    {
                        top: cardTop,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        marginHorizontal: 20,
                    },
                ]}
            >
                <AppText
                    label={`${stepIndex + 1} of ${stepCount}`}
                    fontSize={12}
                    color={colors.textTertiary}
                    style={{ marginBottom: 6 }}
                />
                <AppText
                    label={title}
                    variant={1}
                    fontSize={18}
                    color={colors.text}
                    style={{ marginBottom: 8 }}
                />
                <AppText
                    label={description}
                    fontSize={14}
                    color={colors.textSecondary}
                    style={{ marginBottom: 16, lineHeight: 20 }}
                />
                <View style={styles.actions}>
                    <Pressable onPress={onSkip} hitSlop={8} style={styles.skipBtn}>
                        <AppText label="Skip" fontSize={14} color={colors.textTertiary} />
                    </Pressable>
                    <View style={styles.navBtns}>
                        {canBack ? (
                            <Pressable
                                onPress={onBack}
                                style={[styles.btn, styles.btnGhost, { borderColor: colors.border }]}
                            >
                                <AppText label="Back" fontSize={14} color={colors.text} variant={1} />
                            </Pressable>
                        ) : null}
                        <Pressable
                            onPress={onNext}
                            style={[styles.btn, { backgroundColor: config.THEME_COLOR }]}
                        >
                            <AppText
                                label={isLast ? 'Done' : 'Next'}
                                fontSize={14}
                                color="#fff"
                                variant={1}
                            />
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10100,
        elevation: 10100,
    },
    dim: {
        position: 'absolute',
        backgroundColor: 'rgba(15, 23, 42, 0.62)',
    },
    holeBorder: {
        position: 'absolute',
        borderRadius: HOLE_RADIUS,
        borderWidth: 2,
        backgroundColor: 'transparent',
    },
    closeFab: {
        position: 'absolute',
        right: 16,
        zIndex: 2,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    card: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        zIndex: 2,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    skipBtn: {
        paddingVertical: 8,
        paddingRight: 8,
    },
    navBtns: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: 72,
        alignItems: 'center',
    },
    btnGhost: {
        backgroundColor: 'transparent',
        borderWidth: StyleSheet.hairlineWidth,
    },
});
