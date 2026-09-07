import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Subscription from '../containers/settings/subscription';
import Payment from '../containers/settings/payment';
import PaymentHistory from '../containers/settings/payment_history';
import PaymentWebView from '../containers/settings/payment_webview';
import PaymentInvoice from '../containers/settings/payment_invoice';
import MomoProcessing from '../containers/settings/momo_processing';
import MomoStatus from '../containers/settings/momo_status';

const Stack = createNativeStackNavigator();

/**
 * Standalone subscription/payment flow navigator.
 * Used when user is logged in but subscription is inactive (required payment),
 * and from Settings -> Subscription & Payment (inside MainNavigator we still use main stack).
 * @param {Object} props
 * @param {Object} [props.subscriptionInitialParams] - Passed to Subscription screen (e.g. { requiredPayment: true, onGoBack })
 * @param {boolean} [props.independent=true] - Use independent NavigationContainer for root usage
 */
function SubscriptionNavigator({ subscriptionInitialParams = {}, independent = true }) {
    return (
        <NavigationContainer independent={independent}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen
                    name="Subscription"
                    component={Subscription}
                    initialParams={subscriptionInitialParams}
                />
                <Stack.Screen name="Payment" component={Payment} />
                <Stack.Screen name="PaymentHistory" component={PaymentHistory} />
                <Stack.Screen name="PaymentWebView" component={PaymentWebView} />
                <Stack.Screen name="PaymentInvoice" component={PaymentInvoice} />
                <Stack.Screen name="MomoProcessing" component={MomoProcessing} />
                <Stack.Screen name="MomoStatus" component={MomoStatus} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default SubscriptionNavigator;
