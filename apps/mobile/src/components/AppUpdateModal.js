import React from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../config';
import useTheme from '../hooks/useTheme';
import AppText from './text';

/**
 * Soft or force app update prompt.
 * force: full-screen blocking; soft: dismissible modal with Skip.
 */
const AppUpdateModal = ({
    visible,
    force = false,
    title,
    message,
    latestVersion,
    currentVersion,
    onUpgrade,
    onSkip,
}) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    if (!visible) return null;

    const resolvedTitle = title || (force ? 'Update required' : 'Update available');
    const resolvedMessage =
        message?.trim() ||
        (force
            ? 'A new version is required to continue using Shopynn.'
            : 'A newer version of Shopynn is available. Update for the latest fixes and features.');

    const content = (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    paddingBottom: Math.max(20, insets.bottom + 8),
                },
                force && styles.cardForce,
            ]}
        >
            <View
                style={[
                    styles.iconWrap,
                    {
                        backgroundColor: force ? '#fee2e2' : `${config.THEME_COLOR}18`,
                    },
                ]}
            >
                <Lucide
                    name={force ? 'shield-alert' : 'sparkles'}
                    size={28}
                    color={force ? '#dc2626' : config.THEME_COLOR}
                />
            </View>

            <AppText
                label={resolvedTitle}
                variant={1}
                fontSize={22}
                color={colors.text}
                style={styles.title}
            />

            {(latestVersion || currentVersion) && (
                <View style={styles.versionRow}>
                    {currentVersion ? (
                        <View style={[styles.versionChip, { backgroundColor: colors.surfaceSecondary || colors.inputBackground }]}>
                            <AppText label={`v${currentVersion}`} fontSize={12} color={colors.textSecondary} />
                        </View>
                    ) : null}
                    {currentVersion && latestVersion ? (
                        <Lucide name="arrow-right" size={14} color={colors.textTertiary} style={{ marginHorizontal: 6 }} />
                    ) : null}
                    {latestVersion ? (
                        <View style={[styles.versionChip, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                            <AppText label={`v${latestVersion}`} fontSize={12} color={config.THEME_COLOR} />
                        </View>
                    ) : null}
                </View>
            )}

            <ScrollView
                style={styles.messageScroll}
                contentContainerStyle={styles.messageScrollContent}
                showsVerticalScrollIndicator={false}
            >
                <AppText
                    label={resolvedMessage}
                    fontSize={15}
                    color={colors.textSecondary}
                    style={styles.message}
                />
            </ScrollView>

            {force ? (
                <View style={[styles.forceBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b33' }]}>
                    <Lucide name="info" size={16} color="#b45309" />
                    <AppText
                        label="You must update to keep using the app."
                        fontSize={12}
                        color="#92400e"
                        style={{ marginLeft: 8, flex: 1 }}
                    />
                </View>
            ) : null}

            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onUpgrade}
                style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}
            >
                <Lucide name="download" size={18} color="#fff" />
                <AppText
                    label={Platform.OS === 'ios' ? 'Update in App Store' : 'Update in Play Store'}
                    variant={1}
                    fontSize={16}
                    color="#fff"
                    style={{ marginLeft: 8 }}
                />
            </TouchableOpacity>

            {!force ? (
                <TouchableOpacity activeOpacity={0.7} onPress={onSkip} style={styles.skipBtn}>
                    <AppText label="Not now" fontSize={15} color={colors.textSecondary} />
                </TouchableOpacity>
            ) : null}
        </View>
    );

    if (force) {
        return (
            <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
                <View style={[styles.forceRoot, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
                    <View style={[styles.forceAccent, { backgroundColor: config.THEME_COLOR }]} />
                    {content}
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onSkip}>
            <View style={styles.softBackdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onSkip} />
                <View style={styles.softCenter}>{content}</View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    forceRoot: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    forceAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 140,
        opacity: 0.12,
    },
    softBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    softCenter: {
        alignItems: 'center',
    },
    card: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 22,
        paddingTop: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOpacity: 0.12,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 8 },
        }),
    },
    cardForce: {
        borderWidth: 0,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        marginBottom: 10,
    },
    versionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    versionChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    messageScroll: {
        maxHeight: 160,
        marginBottom: 8,
    },
    messageScrollContent: {
        paddingBottom: 4,
    },
    message: {
        lineHeight: 22,
    },
    forceBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginTop: 8,
        marginBottom: 4,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: 12,
        marginTop: 16,
    },
    skipBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
});

export default AppUpdateModal;
