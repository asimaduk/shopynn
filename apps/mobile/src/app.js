import 'react-native-gesture-handler';
import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/lib/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import str from './store';
import ApplicationNavigator from './navigators';
import Toast from 'react-native-toast-message';
import './interceptors';
import { configureSocialAuth } from './utils/socialAuth';
import messaging from '@react-native-firebase/messaging';
import { useEffect } from 'react';
import { Alert, LogBox, Platform } from 'react-native';
import { getDeviceSecurityState } from './utils/deviceSecurity';
// LogBox.ignoreLogs(['Reanimated 2']);
LogBox.ignoreAllLogs();

const { store, persistor } = str();

const App = () => {
    useEffect(() => {
        configureSocialAuth();
    }, []);
    useEffect(() => {
        if (Platform.OS === 'android') {
            messaging().getToken().then(() => { /* FCM token saved/used without logging */ });
        }
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
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                {/* <SafeAreaProvider> */}
                    <>
                        <ApplicationNavigator />
                        <Toast />
                    </>
                {/* </SafeAreaProvider> */}
            </PersistGate>
        </Provider>
    );
}

export default App;