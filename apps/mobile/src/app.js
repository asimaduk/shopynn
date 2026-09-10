import 'react-native-gesture-handler';
import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/lib/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import str from './store';
import ApplicationNavigator from './navigators';
import Toast from 'react-native-toast-message';
import './interceptors';
import { configureSocialAuth } from './utils/socialAuth';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import { useEffect } from 'react';
import { Alert, LogBox, Platform } from 'react-native';
import { getDeviceSecurityState } from './utils/deviceSecurity';
import SplashScreen from 'react-native-splash-screen';
import {
	subscribeFcmTokenRefresh,
	syncFcmTokenToServer,
	userCanUsePushNotifications,
} from './utils/pushNotifications';
import NotificationPermissionHost from './components/NotificationPermissionHost';
// LogBox.ignoreLogs(['Reanimated 2']);
LogBox.ignoreAllLogs();

const { store, persistor } = str();

function showForegroundPush(remoteMessage) {
	const title =
		remoteMessage?.notification?.title ??
		remoteMessage?.data?.title ??
		'Shopynn';
	const body =
		remoteMessage?.notification?.body ??
		remoteMessage?.data?.body ??
		remoteMessage?.data?.message ??
		'New notification';

	PushNotification.localNotification({
		channelId: 'channel-shopynn',
		title: String(title),
		message: String(body),
		playSound: true,
		vibrate: true,
		smallIcon: 'ic_notification',
		largeIcon: 'ic_launcher',
		color: '#0A74DA',
		userInfo: remoteMessage?.data || {},
	});
}

function PushLifecycle() {
	const user = useSelector((s) => s?.user);
	const isLoggedIn = user?.isLoggedIn;
	const canUsePush = userCanUsePushNotifications(user);

	useEffect(() => {
		if (Platform.OS !== 'android') return undefined;

		const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
			try {
				showForegroundPush(remoteMessage);
			} catch (err) {
				if (__DEV__) {
					console.warn('FCM foreground display failed', err?.message || err);
				}
			}
		});
		const unsubscribeRefresh = canUsePush ? subscribeFcmTokenRefresh() : () => {};

		return () => {
			unsubscribeMessage?.();
			unsubscribeRefresh?.();
		};
	}, [canUsePush]);

	useEffect(() => {
		if (Platform.OS !== 'android' || !isLoggedIn || !canUsePush) return undefined;
		syncFcmTokenToServer();
		return undefined;
	}, [isLoggedIn, canUsePush]);

	return null;
}

const App = () => {
	useEffect(() => {
		configureSocialAuth();
	}, []);
	useEffect(() => {
		const securityState = getDeviceSecurityState();
		if (securityState?.isCompromised) {
			Alert.alert(
				'Security warning',
				'This device appears to be rooted/jailbroken or insecure. Sensitive local data protection may be reduced.',
			);
		}
	}, []);

	return (
		<SafeAreaProvider>
			<Provider store={store}>
				<PersistGate
					loading={null}
					persistor={persistor}
					onBeforeLift={() => {
						// Hide after rehydrate; slight delay avoids race with native show().
						setTimeout(() => {
							try {
								SplashScreen?.hide?.();
							} catch (_) {}
						}, 500);
					}}
				>
					<>
						<PushLifecycle />
						<ApplicationNavigator />
						<NotificationPermissionHost />
						<Toast />
					</>
				</PersistGate>
			</Provider>
		</SafeAreaProvider>
	);
};

export default App;
