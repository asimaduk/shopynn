import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import { payments } from '../../services/api';
import { setSubscriptionActive } from '../../store/actions/appSettings';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

function mapVerifyStatus(result) {
    const s = String(result?.status || '').toLowerCase();
    if (s === 'success' || s === 'completed') return 'success';
    if (s === 'failed' || s === 'error') return 'failed';
    return 'pending';
}

const MomoStatus = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const {
        amount,
        planName,
        momoNumber,
        momoNetwork,
        transactionId,
        transactionRef,
        mode = 'subscription',
        orderId,
        successNavigateTo,
        successNavigateParams,
    } = route.params || {};
    
    const [status, setStatus] = useState('checking'); // 'checking', 'pending', 'success', 'failed'
    const [checking, setChecking] = useState(true);

    const verifyPaymentStatus = useCallback(async () => {
        if (!transactionRef) {
            setStatus('pending');
            setChecking(false);
            return;
        }
        setChecking(true);
        setStatus('checking');
        try {
            const result = await payments.verify(transactionRef);
            setStatus(mapVerifyStatus(result));
        } catch (_) {
            setStatus('pending');
        } finally {
            setChecking(false);
        }
    }, [transactionRef]);

    useEffect(() => {
        if ((mode === 'order' || mode === 'subscription') && transactionRef) {
            verifyPaymentStatus();
            return;
        }
        setChecking(false);
        setStatus('pending');
    }, [mode, transactionRef, verifyPaymentStatus]);

    const handleCheckAgain = () => {
        verifyPaymentStatus();
    };

    const getStatusConfig = () => {
        const title = mode === 'order' ? 'Order Payment Status' : 'Plan Payment Status';
        switch (status) {
            case 'success':
                return {
                    icon: 'circle-check',
                    iconColor: '#10b981',
                    bgColor: '#dcfce7',
                    title: `${title} Successful`,
                    message: 'Your payment has been processed successfully!',
                    buttonLabel: 'Done',
                    buttonAction: () => {
                        if (mode === 'order') {
                            navigation.navigate(
                                successNavigateTo || 'MyOrderDetails',
                                successNavigateParams || { orderId }
                            );
                            return;
                        }
                        if (mode === 'subscription') {
                            dispatch(setSubscriptionActive(true));
                            navigation.navigate('Subscription');
                            return;
                        }
                        navigation.pop(2);
                    },
                };
            case 'pending':
                return {
                    icon: 'clock',
                    iconColor: '#f59e0b',
                    bgColor: '#fef3c7',
                    title: 'Payment Pending',
                    message: 'Your payment is still being processed. Please check again in a few moments.',
                    buttonLabel: 'Check Again',
                    buttonAction: handleCheckAgain,
                };
            case 'failed':
                return {
                    icon: 'x-circle',
                    iconColor: '#ef4444',
                    bgColor: '#fee2e2',
                    title: 'Payment Failed',
                    message: 'Your payment could not be processed. Please try again.',
                    buttonLabel: 'Try Again',
                    buttonAction: () => navigation.goBack(),
                };
            default:
                return {
                    icon: 'loader',
                    iconColor: config.THEME_COLOR,
                    bgColor: colors.primaryShade,
                    title: 'Checking Status',
                    message: 'Please wait while we check your payment status...',
                    buttonLabel: null,
                    buttonAction: null,
                };
        }
    };

    const statusConfig = getStatusConfig();
    const getNetworkName = () => {
        return momoNetwork?.charAt(0).toUpperCase() + momoNetwork?.slice(1) || 'Mobile Money';
    };

    return (
        <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader
                label={mode === 'order' ? 'Order Payment Status' : 'Plan Payment Status'}
                onPress={() => navigation.goBack()}
            />
            <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.content}>
                    {/* Status Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: statusConfig.bgColor }]}>
                        {checking || status === 'checking' ? (
                            <ActivityIndicator size="large" color={statusConfig.iconColor} />
                        ) : (
                            <Lucide name={statusConfig.icon} size={64} color={statusConfig.iconColor} />
                        )}
                    </View>

                    {/* Status Text */}
                    <AppText
                        label={statusConfig.title}
                        variant={1}
                        fontSize={24}
                        color={colors.text}
                        style={{ marginTop: 24 }}
                    />
                    <AppText
                        label={statusConfig.message}
                        fontSize={16}
                        color={colors.textSecondary}
                        style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}
                    />

                    {/* Payment Details */}
                    <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.detailRow}>
                            <AppText label="Transaction ID" fontSize={14} color={colors.textSecondary} />
                            <AppText label={transactionId} variant={2} fontSize={12} color={colors.text} />
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label="Amount" fontSize={14} color={colors.textSecondary} />
                            <AppText label={formatter.format(amount).replace('GH₵', 'GHS ').trim()} variant={1} fontSize={16} color={colors.text} />
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label={mode === 'order' ? 'Order' : 'Plan'} fontSize={14} color={colors.textSecondary} />
                            <AppText label={planName} variant={2} fontSize={14} color={colors.text} />
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label="Mobile Money" fontSize={14} color={colors.textSecondary} />
                            <AppText label={`${getNetworkName()} - ${momoNumber}`} variant={2} fontSize={14} color={colors.text} />
                        </View>
                    </View>

                    {/* Action Button */}
                    {statusConfig.buttonLabel && !checking && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={statusConfig.buttonAction}
                            style={[styles.actionButton, { backgroundColor: config.THEME_COLOR }]}>
                            <AppText
                                label={statusConfig.buttonLabel}
                                variant={1}
                                fontSize={16}
                                color={colors.textInverse}
                            />
                        </TouchableOpacity>
                    )}

                    {/* Check Again Button (for pending status) */}
                    {/* {status === 'pending' && !checking && (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleCheckAgain}
                            style={[styles.secondaryButton, { borderColor: colors.border }]}>
                            <Lucide name="refresh-cw" size={18} color={config.THEME_COLOR} />
                            <AppText
                                label="Refresh Status"
                                fontSize={14}
                                color={config.THEME_COLOR}
                                style={{ marginLeft: 8 }}
                            />
                        </TouchableOpacity>
                    )} */}
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
    actionButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 32,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 12,
        borderRadius: 5,
        borderWidth: 1,
        marginTop: 12,
    },
});

export default MomoStatus;
