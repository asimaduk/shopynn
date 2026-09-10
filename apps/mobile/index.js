
/**
 * @format
*/
// FCM commented out for iOS - uncomment when Firebase is properly configured
import messaging from '@react-native-firebase/messaging';
import {AppRegistry, Platform} from 'react-native';
import App from './src/app';
import {name as appName} from './app.json';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emitNotificationOpened,
  isLowStockNotification,
  wasNotificationOpened,
} from './src/utils/notificationNavigation';

// Register background handler so FCM *data-only* messages can still be shown
// when the app is in the background or quit.
// If the payload already includes `notification`, Android displays it — do not
// post a second local notification (that causes duplicate tray entries).
if (Platform.OS === 'android') {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    try {
      // System / FCM already renders notification+data messages in the tray.
      if (remoteMessage?.notification?.title || remoteMessage?.notification?.body) {
        return;
      }

      const body = remoteMessage?.data?.body || remoteMessage?.data?.message;
      if (!body) {
        return;
      }
      let payload = body;
      try {
        payload = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {
        // Plain-string data body (e.g. broadcast) — show once as a local notif.
        PushNotification.localNotification({
          channelId: 'channel-shopynn',
          title: String(remoteMessage?.data?.title || 'Shopynn'),
          message: String(body),
          smallIcon: 'ic_notification',
          largeIcon: 'ic_launcher',
          color: '#0A74DA',
          userInfo: remoteMessage?.data || {},
        });
        return;
      }

      if (payload && payload.message && payload.notificationType === 'GENERAL') {
        PushNotification.localNotification({
          channelId: 'channel-shopynn',
          title: 'Shopynn',
          message: payload.message,
          smallIcon: 'ic_notification',
          largeIcon: 'ic_launcher',
          color: '#0A74DA',
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Background FCM handling error', e);
    }
  });
}
// iOS FCM handler commented out
// } else {
//   const alertBody = remoteMessage?._alert?.body;
//   if (!alertBody) {
//     return;
//   }
//
//   let payload = alertBody;
//   try {
//     payload = typeof alertBody === 'string' ? JSON.parse(alertBody) : alertBody;
//   } catch (e) {
//     payload = {message: String(alertBody), notificationType: 'GENERAL'};
//   }
//
//   if (payload && payload.message && payload.notificationType === 'GENERAL') {
//     const request = {
//       id: `${Date.now()}`,
//       title: 'Shopynn',
//       subtitle: '',
//       body: payload.message,
//       category: 'n_a',
//       userInfo: payload,
//     };
//
//     PushNotificationIOS.addNotificationRequest(request);
//   }
// }

// Must be outside of any component LifeCycle (such as `componentDidMount`).
// Create the main Android notification channel early in app startup.
if (Platform.OS === 'android') {
  PushNotification.createChannel(
    {
      channelId: 'channel-shopynn',
      channelName: 'Shopynn Notifications',
      channelDescription: 'General notifications for Shopynn',
      importance: 4, // high importance
      vibrate: true,
      soundName: 'default',
    },
    created => {
      // eslint-disable-next-line no-console
      console.log('Notification channel channel-shopynn created:', created);
    },
  );
}

PushNotification.configure({
  // Called when FCM/APNs token is generated
  onRegister: function (token) {
    // iOS FCM token registration commented out
    // if (Platform.OS === 'ios') {
    //   AsyncStorage.setItem('IMSC_FCM_TOKEN', token.token).catch(() => {});
    // }
  },

  // Called when a remote or local notification is opened/received
  onNotification: function (notification) {
    console.log('push notification', notification);

    if (wasNotificationOpened(notification)) {
      emitNotificationOpened(notification);
    }

    if (Platform.OS === 'ios') {
      notification.finish?.(PushNotificationIOS.FetchResult.NoData);
    }
  },

  onAction: function (notification) {
    console.log('push notification action', notification);
    if (wasNotificationOpened(notification) || isLowStockNotification(notification)) {
      emitNotificationOpened(notification);
    }
  },

  // Called when the user fails to register for remote notifications (iOS)
  onRegistrationError: function (err) {
    // eslint-disable-next-line no-console
    console.error(err.message, err);
  },

  // iOS ONLY: permissions to request - commented out
  // permissions: {
  //   alert: true,
  //   badge: true,
  //   sound: true,
  // },

  // Pop the initial notification automatically
  popInitialNotification: true,

  // iOS permission request disabled
  requestPermissions: false, // Platform.OS === 'ios',
});

// Cold start: ensure tray tap is handled even if configure's pop races React mount.
PushNotification.popInitialNotification((notification) => {
  if (!notification) return;
  emitNotificationOpened(notification);
});

AppRegistry.registerComponent(appName, () => App);
