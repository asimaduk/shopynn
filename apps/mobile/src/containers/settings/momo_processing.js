import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const MomoProcessing = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { amount, planName, momoNumber, momoNetwork, transactionId } = route.params || {};
    
    const [status, setStatus] = useState('processing'); // 'processing', 'pending', 'success', 'failed'
    const [pulseAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        // Simulate payment processing
        // In production, this would poll your backend API for payment status
        const timer = setTimeout(() => {
            // Simulate checking payment status
            // For demo, randomly set to success after 3 seconds
            setStatus('pending');
            // Navigate to check status screen after showing processing
            setTimeout(() => {
                navigation.replace('MomoStatus', {
                    amount,
                    planName,
                    momoNumber,
                    momoNetwork,
                    transactionId: transactionId || `TXN-${Date.now()}`,
                });
            }, 2000);
        }, 3000);

        // Pulse animation
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulseAnimation.start();

        return () => {
            clearTimeout(timer);
            pulseAnimation.stop();
        };
    }, []);

    const getNetworkName = () => {
        return momoNetwork?.charAt(0).toUpperCase() + momoNetwork?.slice(1) || 'Mobile Money';
    };

    return (
        <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader
                label="Processing Payment"
                onPress={() => navigation.goBack()}
            />
            <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.content}>
                    {/* Animated Icon */}
                    <Animated.View
                        style={[
                            styles.iconContainer,
                            { backgroundColor: colors.primaryShade },
                            { transform: [{ scale: pulseAnim }] },
                        ]}>
                        <Lucide name="smartphone" size={64} color={config.THEME_COLOR} />
                    </Animated.View>

                    {/* Status Text */}
                    <AppText
                        label="Processing Payment"
                        variant={1}
                        fontSize={24}
                        color={colors.text}
                        style={{ marginTop: 24 }}
                    />
                    <AppText
                        label="Please wait while we process your payment"
                        fontSize={16}
                        color={colors.textSecondary}
                        style={{ marginTop: 8, textAlign: 'center' }}
                    />

                    {/* Payment Details */}
                    <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.detailRow}>
                            <AppText label="Amount" fontSize={14} color={colors.textSecondary} />
                            <AppText label={formatter.format(amount).replace('GH₵', 'GHS ').trim()} variant={1} fontSize={16} color={colors.text} />
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label="Plan" fontSize={14} color={colors.textSecondary} />
                            <AppText label={planName} variant={2} fontSize={14} color={colors.text} />
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label="Mobile Money" fontSize={14} color={colors.textSecondary} />
                            <AppText label={`${getNetworkName()} - ${momoNumber}`} variant={2} fontSize={14} color={colors.text} />
                        </View>
                    </View>

                    {/* Loading Indicator */}
                    <View style={styles.loadingSection}>
                        <ActivityIndicator size="large" color={config.THEME_COLOR} />
                        <AppText
                            label="Waiting for confirmation..."
                            fontSize={14}
                            color={colors.textTertiary}
                            style={{ marginTop: 16 }}
                        />
                    </View>

                    {/* Instructions */}
                    <View style={[styles.instructionsCard, { backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="info" size={20} color={config.THEME_COLOR} />
                        <AppText
                            label="Please approve the payment request on your phone when prompted"
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ marginLeft: 12, flex: 1 }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsCard: {
        width: '100%',
        borderRadius: 12,
        padding: 16,
        marginTop: 32,
        borderWidth: 1,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 8,
    },
    loadingSection: {
        alignItems: 'center',
        marginTop: 32,
    },
    instructionsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 24,
        width: '100%',
    },
});

export default MomoProcessing;
