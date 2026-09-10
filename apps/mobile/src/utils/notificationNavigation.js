import { DeviceEventEmitter } from 'react-native';

export const NOTIFICATION_OPENED_EVENT = 'SHOPYNN_NOTIFICATION_OPENED';
export const LOW_STOCK_SCREEN = 'ItemsToReorder';
export const LOW_STOCK_NOTIFICATION_ID = 1001;

/** @type {any} */
let pendingOpenedNotification = null;

export function buildLowStockNotificationPayload(count) {
    return {
        type: 'LOW_STOCK',
        screen: LOW_STOCK_SCREEN,
        count: String(count ?? ''),
    };
}

export function parseNotificationPayload(notification) {
    if (!notification || typeof notification !== 'object') {
        return {};
    }

    let data = notification.data ?? notification.userInfo ?? {};
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (_) {
            data = {};
        }
    }
    if (!data || typeof data !== 'object') {
        data = {};
    }

    return {
        ...data,
        type: data.type || notification.type,
        screen: data.screen || notification.screen,
        title: data.title || notification.title,
    };
}

export function isLowStockNotification(notification) {
    const payload = parseNotificationPayload(notification);
    if (payload.type === 'LOW_STOCK' || payload.screen === LOW_STOCK_SCREEN) {
        return true;
    }
    const title = String(payload.title || notification?.title || '').toLowerCase();
    return title === 'low stock';
}

export function wasNotificationOpened(notification) {
    if (!notification) return false;
    const interaction = notification.userInteraction;
    if (
        interaction === true ||
        interaction === 1 ||
        interaction === '1' ||
        interaction === 'true'
    ) {
        return true;
    }
    // Android action tap (non-dismiss)
    if (notification.action && notification.action !== 'DismissedNotification') {
        return true;
    }
    return false;
}

export function emitNotificationOpened(notification) {
    pendingOpenedNotification = notification;
    DeviceEventEmitter.emit(NOTIFICATION_OPENED_EVENT, notification);
}

export function navigateForNotification(navigationRef, notification) {
    if (!notification || !isLowStockNotification(notification)) {
        return false;
    }
    if (!navigationRef?.isReady?.()) {
        return false;
    }
    try {
        navigationRef.navigate(LOW_STOCK_SCREEN);
        return true;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Low-stock notification navigation failed', e);
        return false;
    }
}

/**
 * Call when MainNavigator mounts / becomes ready so cold-start taps still navigate.
 */
export function flushPendingNotificationNavigation(navigationRef) {
    if (!pendingOpenedNotification) {
        return false;
    }
    if (navigateForNotification(navigationRef, pendingOpenedNotification)) {
        pendingOpenedNotification = null;
        return true;
    }
    return false;
}

export function clearPendingNotificationNavigation() {
    pendingOpenedNotification = null;
}
