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
	registerPushAfterLogin,
	subscribeFcmTokenRefresh,
	userCanUsePushNotifications,
} from './utils/pushNotifications';
import { handleIncomingRemoteMessageData } from './utils/notificationNavigation';
import NotificationPermissionHost from './components/NotificationPermissionHost';
// LogBox.ignoreLogs(['Reanimated 2']);
LogBox.ignoreAllLogs();

const { store, persistor } = str();

function isFirebaseReady() {
	try {
		// Lazy require so missing native init does not crash module load.
		// eslint-disable-next-line global-require
		const firebaseApp = require('@react-native-firebase/app').default;
		return Boolean(firebaseApp?.apps?.length);
	} catch (_) {
		return false;
	}
}

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
		if (!isFirebaseReady()) {
			return undefined;
		}

		let unsubscribeMessage = () => {};
		try {
			unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
				try {
					handleIncomingRemoteMessageData(remoteMessage);
					if (Platform.OS === 'android') {
						showForegroundPush(remoteMessage);
					}
				} catch (err) {
					if (__DEV__) {
						console.warn('FCM foreground display failed', err?.message || err);
					}
				}
			});
		} catch (err) {
			if (__DEV__) {
				console.warn('FCM onMessage unavailable', err?.message || err);
			}
		}

		const unsubscribeRefresh = canUsePush ? subscribeFcmTokenRefresh() : () => {};

		return () => {
			unsubscribeMessage?.();
			unsubscribeRefresh?.();
		};
	}, [canUsePush]);

	useEffect(() => {
		if (!isLoggedIn || !canUsePush || !isFirebaseReady()) {
			return undefined;
		}
		// Soft custom sheet once; system dialog only after Enable. Never prompts if deferred.
		registerPushAfterLogin({ user }).catch(() => {});
		return undefined;
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on login/plan gate
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
