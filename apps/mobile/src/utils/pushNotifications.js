import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { users as usersApi } from '../services/api';
import { hasFeature } from './permissions';

const PROMPTED_KEY = 'SHOPYNN_PUSH_PERMISSION_PROMPTED_V1';
const NOTIFICATIONS_FEATURE = 'notifications.view';

/**
 * TEMP: bypass Premium gate so we can verify FCM token → server.
 * Set to false (or remove) after a successful token sync test.
 */
const ALLOW_PUSH_WITHOUT_PREMIUM_FOR_TEST = false;

/** @type {null | ((request: object) => void)} */
let softPromptPresenter = null;

/** Register the React host that renders the custom soft-permission sheet. */
export function setNotificationSoftPromptPresenter(presenter) {
	softPromptPresenter = typeof presenter === 'function' ? presenter : null;
}

/** Push / in-app notification preferences are Premium-plan features. */
export function userCanUsePushNotifications(user) {
	if (ALLOW_PUSH_WITHOUT_PREMIUM_FOR_TEST) return true;
	return hasFeature(user, NOTIFICATIONS_FEATURE);
}

export async function hasAndroidNotificationPermission() {
	if (Platform.OS !== 'android') return true;
	if (Platform.Version < 33) return true;
	try {
		return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
	} catch {
		return false;
	}
}

async function hasIosNotificationPermission() {
	try {
		const status = await messaging().hasPermission();
		return (
			status === messaging.AuthorizationStatus.AUTHORIZED ||
			status === messaging.AuthorizationStatus.PROVISIONAL
		);
	} catch {
		return false;
	}
}

/** Cross-platform: whether the OS currently allows notifications. */
export async function hasNotificationPermission() {
	if (Platform.OS === 'ios') return hasIosNotificationPermission();
	return hasAndroidNotificationPermission();
}

async function requestAndroidSystemPermission() {
	const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
	if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
	if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
		await new Promise((resolve) => {
			Alert.alert(
				'Notifications blocked',
				'Enable notifications for Shopynn in your device settings to receive alerts.',
				[
					{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
					{
						text: 'Open settings',
						onPress: () => {
							Linking.openSettings().catch(() => {});
							resolve(false);
						},
					},
				],
			);
		});
	}
	return false;
}

async function requestIosSystemPermission() {
	try {
		const current = await messaging().hasPermission();
		if (
			current === messaging.AuthorizationStatus.AUTHORIZED ||
			current === messaging.AuthorizationStatus.PROVISIONAL
		) {
			await messaging().registerDeviceForRemoteMessages();
			return true;
		}

		// iOS only shows the system dialog once. After Deny, send the user to Settings.
		if (current === messaging.AuthorizationStatus.DENIED) {
			await new Promise((resolve) => {
				Alert.alert(
					'Notifications blocked',
					'Enable notifications for Shopynn in Settings → Notifications.',
					[
						{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
						{
							text: 'Open settings',
							onPress: () => {
								Linking.openSettings().catch(() => {});
								resolve(false);
							},
						},
					],
				);
			});
			return false;
		}

		const authStatus = await messaging().requestPermission();
		const enabled =
			authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
			authStatus === messaging.AuthorizationStatus.PROVISIONAL;
		if (!enabled) return false;
		await messaging().registerDeviceForRemoteMessages();
		return true;
	} catch {
		return false;
	}
}

async function requestSystemNotificationPermission() {
	if (Platform.OS === 'ios') return requestIosSystemPermission();
	if (Platform.OS === 'android' && Platform.Version >= 33) {
		return requestAndroidSystemPermission();
	}
	return true;
}

/**
 * Soft in-app explanation (custom sheet), then the system dialog only if user confirms.
 * Returns true when notifications are allowed afterward.
 */
export function promptForNotificationPermission({
	title = 'Stay up to date',
	message = 'Get timely alerts for MoMo payments, low stock, new orders, and your daily sales summary. You can change this anytime in Settings → Notifications.',
	confirmLabel = 'Enable notifications',
	cancelLabel = 'Not now',
} = {}) {
	return new Promise(async (resolve) => {
		const already = await hasNotificationPermission();
		if (already) {
			resolve(true);
			return;
		}

		// Android < 13: no runtime permission dialog.
		if (Platform.OS === 'android' && Platform.Version < 33) {
			resolve(true);
			return;
		}

		const finish = async (wantsEnable) => {
			await AsyncStorage.setItem(PROMPTED_KEY, '1').catch(() => {});
			if (!wantsEnable) {
				resolve(false);
				return;
			}
			try {
				resolve(await requestSystemNotificationPermission());
			} catch {
				resolve(false);
			}
		};

		if (softPromptPresenter) {
			softPromptPresenter({
				title,
				message,
				confirmLabel,
				cancelLabel,
				onResult: finish,
			});
			return;
		}

		// Fallback if host is not mounted yet
		Alert.alert(title, message, [
			{ text: cancelLabel, style: 'cancel', onPress: () => finish(false) },
			{ text: confirmLabel, onPress: () => finish(true) },
		]);
	});
}

/**
 * Upload current FCM token when permission is already granted.
 * Never shows a system permission dialog.
 */
export async function syncFcmTokenToServer() {
	try {
		const allowed = await hasNotificationPermission();
		if (!allowed) return null;
		if (Platform.OS === 'ios') {
			try {
				await messaging().registerDeviceForRemoteMessages();
			} catch (_) {
				/* already registered */
			}
		}
		const token = await messaging().getToken();
		if (!token) return null;
		await usersApi.updateMyFcmToken(token);
		return token;
	} catch (err) {
		if (__DEV__) {
			console.warn('FCM token sync failed', err?.message || err);
		}
		return null;
	}
}

/**
 * After login / session restore:
 * - If already granted → sync token
 * - Else if never soft-prompted → show custom sheet once (Not now = skip native dialog)
 */
export async function registerPushAfterLogin({ user, forcePrompt = false } = {}) {
	if (!userCanUsePushNotifications(user)) return;

	const allowed = await hasNotificationPermission();
	if (allowed) {
		await syncFcmTokenToServer();
		return;
	}

	const prompted = forcePrompt ? false : (await AsyncStorage.getItem(PROMPTED_KEY).catch(() => null)) === '1';
	if (prompted) return;

	const granted = await promptForNotificationPermission();
	if (granted) {
		await syncFcmTokenToServer();
	}
}

/** Open OS settings so the user can enable notifications after declining. */
export function openNotificationSettings() {
	return Linking.openSettings().catch(() => {});
}

export function subscribeFcmTokenRefresh() {
	try {
		return messaging().onTokenRefresh(async () => {
			await syncFcmTokenToServer();
		});
	} catch (_) {
		return () => {};
	}
}
