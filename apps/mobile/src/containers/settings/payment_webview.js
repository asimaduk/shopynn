import React, { useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useDispatch } from 'react-redux';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import { payments } from '../../services/api';
import { setSubscriptionActive } from '../../store/actions/appSettings';

const extractReferenceFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const lower = url.toLowerCase();
    try {
        const qIdx = url.indexOf('?');
        if (qIdx !== -1) {
            const query = url.slice(qIdx + 1);
            const params = new URLSearchParams(query);
            const ref = params.get('reference') || params.get('trxref');
            if (ref) return ref;
        }
    } catch (_) {
        /* ignore */
    }
    const m = url.match(/[?&]reference=([^&]+)/i);
    if (m) return decodeURIComponent(m[1]);
    const m2 = url.match(/[?&]trxref=([^&]+)/i);
    if (m2) return decodeURIComponent(m2[1]);
    if (lower.includes('success') && lower.includes('reference=')) {
        const m3 = url.match(/reference=([^&\s]+)/i);
        if (m3) return decodeURIComponent(m3[1]);
    }
    return null;
};

const isGatewayUrl = (url) => {
    const m = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
    return Boolean(m && /(^|\.)paystack\.(com|co)$/i.test(m[1]));
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PaymentWebView = ({ navigation, route }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const {
        checkoutUrl,
        amount,
        planName,
        billingCycle,
        nextBillingDate,
        paymentReference,
        orderId,
        screenTitle,
        successNavigateTo,
        successNavigateParams,
    } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const webViewRef = React.useRef(null);
    const verifiedRef = useRef(false);
    const callbackHandledRef = useRef(false);

    const defaultCheckoutUrl =
        checkoutUrl || `https://checkout.example.com/payment?amount=${amount}&plan=${planName}`;

    const expectedRef = paymentReference || null;

    // Leave the gateway page out of the stack; return to an existing order details screen if there is one.
    const leaveToOrderDetails = (params) => {
        const routes = navigation.getState?.()?.routes || [];
        if (routes.slice(0, -1).some((r) => r?.name === 'MyOrderDetails')) {
            navigation.popTo('MyOrderDetails', params);
        } else {
            navigation.replace('MyOrderDetails', params);
        }
    };

    const finishSuccess = () => {
        if (verifiedRef.current) return;
        verifiedRef.current = true;
        const isSubscription = route.params?.flowType === 'subscription' || successNavigateTo === 'Subscription';
        if (isSubscription) {
            dispatch(setSubscriptionActive(true));
        }
        Alert.alert(
            'Payment successful',
            isSubscription ? 'Your subscription payment was completed.' : 'Your payment was completed.',
            [
                {
                    text: 'OK',
                    onPress: () => {
                        if (successNavigateTo === 'MyOrderDetails') {
                            leaveToOrderDetails(successNavigateParams || { orderId });
                        } else if (successNavigateTo) {
                            navigation.navigate(successNavigateTo, successNavigateParams || {});
                        } else if (orderId) {
                            leaveToOrderDetails({ orderId });
                        } else {
                            navigation.goBack();
                        }
                    },
                },
            ],
        );
    };

    const verifyOnce = async (ref) => {
        if (!ref || verifiedRef.current) return;
        try {
            const result = await payments.verify(ref);
            const status = String(result?.status || '').toLowerCase();
            if (status === 'success' || status === 'completed') {
                finishSuccess();
            }
        } catch (_) {
            /* user may need to retry verify from order screen */
        }
    };

    /** Gateway redirected back to the callback URL: confirm with the API instead of loading that page. */
    const handleGatewayCallback = async (ref) => {
        if (callbackHandledRef.current) return;
        callbackHandledRef.current = true;
        setLoading(true);
        for (let attempt = 0; attempt < 4 && !verifiedRef.current; attempt += 1) {
            if (attempt > 0) await wait(2000);
            await verifyOnce(ref);
        }
        setLoading(false);
        if (verifiedRef.current) return;
        Alert.alert(
            'Payment processing',
            'We could not confirm your payment yet. It will update on your order once the bank confirms.',
            [
                {
                    text: 'OK',
                    onPress: () => {
                        if (orderId) {
                            leaveToOrderDetails({ orderId });
                        } else {
                            navigation.goBack();
                        }
                    },
                },
            ],
        );
    };

    const handleShouldStartLoad = (request) => {
        const url = request?.url || '';
        if (request?.isTopFrame === false || isGatewayUrl(url)) return true;
        const ref = extractReferenceFromUrl(url) || (callbackHandledRef.current ? expectedRef : null);
        if (!ref) return true;
        if (expectedRef && String(ref).toLowerCase() !== String(expectedRef).toLowerCase()) return true;
        handleGatewayCallback(ref);
        return false;
    };

    const handleNavigationStateChange = (navState) => {
        setCanGoBack(navState.canGoBack);
        setLoading(navState.loading);

        const url = navState.url || '';
        const urlLower = url.toLowerCase();
        const refFromUrl = extractReferenceFromUrl(url);
        const refToUse = refFromUrl || expectedRef;

        if (expectedRef && urlLower.includes(expectedRef.toLowerCase())) {
            verifyOnce(expectedRef);
        }

        if (
            refToUse &&
            (urlLower.includes('reference=') ||
                urlLower.includes('trxref=') ||
                urlLower.includes('callback') ||
                urlLower.includes('success'))
        ) {
            verifyOnce(refToUse);
        }

        if (urlLower.includes('cancel') || urlLower.includes('payment-failed') || urlLower.includes('failed')) {
            Alert.alert('Payment cancelled', 'You can try again when ready.', [{ text: 'OK' }]);
        }
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('WebView error: ', nativeEvent);
        if (callbackHandledRef.current || verifiedRef.current) return;
        const refInUrl = extractReferenceFromUrl(nativeEvent?.url);
        if (refInUrl && !isGatewayUrl(nativeEvent?.url)) {
            handleGatewayCallback(refInUrl);
            return;
        }
        Alert.alert(
            'Error',
            'Failed to load payment page. Please check your internet connection and try again.',
            [
                { text: 'Retry', onPress: () => webViewRef.current?.reload() },
                { text: 'Cancel', onPress: () => navigation.goBack() },
            ]
        );
    };

    return (
        <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader
                label={screenTitle || 'Card payment'}
                onPress={() => {
                    if (canGoBack) {
                        webViewRef.current?.goBack();
                    } else {
                        navigation.goBack();
                    }
                }}
            />
            {loading && (
                <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading payment page..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            )}
            <WebView
                ref={webViewRef}
                source={{ uri: defaultCheckoutUrl }}
                style={styles.webview}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                onNavigationStateChange={handleNavigationStateChange}
                onError={handleError}
                onHttpError={handleError}
                startInLoadingState={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                allowsBackForwardNavigationGestures={true}
                renderLoading={() => (
                    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                        <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
});

export default PaymentWebView;
