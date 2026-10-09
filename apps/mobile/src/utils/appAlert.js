import { Alert } from 'react-native';

/**
 * Drop-in replacement for React Native's Alert.alert, rendered by <AppAlertHost /> with the app's
 * dialog styling. Same signature: (title, message?, buttons?, options?).
 *
 * Hosts are plain overlay views, so one must be mounted inside every native Modal (AppModal does
 * this) — iOS cannot present a second Modal over one that is already showing. The most recently
 * mounted host renders the alert. Falls back to the system alert when no host is mounted.
 */
const hosts = [];
const queue = [];
let nextId = 1;

const emit = () => {
    const current = queue[0] || null;
    hosts.forEach((fn, i) => fn(i === hosts.length - 1 ? current : null));
};

export const subscribeAppAlerts = (fn) => {
    hosts.push(fn);
    emit();
    return () => {
        const idx = hosts.lastIndexOf(fn);
        if (idx !== -1) hosts.splice(idx, 1);
        emit();
    };
};

export const dismissAppAlert = (id) => {
    const idx = queue.findIndex((a) => a.id === id);
    if (idx !== -1) queue.splice(idx, 1);
    emit();
};

export const appAlert = (title, message, buttons, options = {}) => {
    if (!hosts.length) {
        Alert.alert(title, message, buttons, options);
        return;
    }
    const list = Array.isArray(buttons) && buttons.length ? buttons : [{ text: 'OK' }];
    queue.push({
        id: nextId++,
        title: title == null ? '' : String(title),
        message: message == null ? '' : String(message),
        buttons: list.map((b) => ({ text: b?.text || 'OK', style: b?.style || 'default', onPress: b?.onPress })),
        options: options || {},
    });
    emit();
};

const AppAlert = { alert: appAlert };

export default AppAlert;
