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

async function requestSystemNotificationPermission() {
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

/**
 * Soft in-app explanation (custom sheet when host is mounted), then the system dialog.
 * Returns true when notifications are allowed afterward.
 */
export function promptForNotificationPermission({
	title = 'Stay up to date',
	message = 'Get timely alerts for low stock, new orders, and your daily sales summary. You can change this anytime in Settings.',
	confirmLabel = 'Enable notifications',
	cancelLabel = 'Not now',
} = {}) {
	return new Promise(async (resolve) => {
		if (Platform.OS !== 'android') {
			resolve(true);
			return;
		}
		if (Platform.Version < 33) {
			resolve(true);
			return;
		}

		const already = await hasAndroidNotificationPermission();
		if (already) {
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

/** Upload current device FCM token for the signed-in user (best-effort). */
export async function syncFcmTokenToServer() {
	if (Platform.OS !== 'android') return null;
	try {
		const allowed = await hasAndroidNotificationPermission();
		if (!allowed) return null;
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
 * After login / session restore (Premium notifications feature only):
 * - If already granted → sync token
 * - Else if never soft-prompted → show priming sheet once, then sync on grant
 */
export async function registerPushAfterLogin({ user, forcePrompt = false } = {}) {
	if (Platform.OS !== 'android') return;
	if (!userCanUsePushNotifications(user)) return;

	const allowed = await hasAndroidNotificationPermission();
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

export function subscribeFcmTokenRefresh() {
	if (Platform.OS !== 'android') return () => {};
	return messaging().onTokenRefresh(async () => {
		await syncFcmTokenToServer();
	});
}
