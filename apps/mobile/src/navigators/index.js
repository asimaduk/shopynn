import React, { useCallback, useEffect, useState } from 'react';
// import Toast from 'react-native-toast-message';
import { AppState, View, StatusBar, Linking, NativeModules, Platform, Alert, BackHandler } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import SplashScreen from 'react-native-splash-screen';
import axios from 'axios';
// import messaging from '@react-native-firebase/messaging';
import { SafeAreaView } from 'react-native-safe-area-context';
import JailMonkey from 'jail-monkey';
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import useTheme from '../hooks/useTheme';
import AuthNavigator from './auth';
import MainNavigator from './main';
import SubscriptionNavigator from './subscription';
import { SET_USER, SET_LOGGED_IN } from '../store/actions/user';
import { products as productsApi } from '../services/api';
import { syncPendingSales } from '../utils/syncPendingSales';
import useInactivityTimer from '../hooks/useInactivityTimer';
import ConfirmDialog from '../components/ConfirmDialog';
import AppUpdateModal from '../components/AppUpdateModal';

const ApplicationNavigator = () => {
    const [isBlocked, setIsBlocked] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(false);
    const [softUpdateVisible, setSoftUpdateVisible] = useState(false);
    const [updateReleaseNotes, setUpdateReleaseNotes] = useState('');
    const [latestVersion, setLatestVersion] = useState('');
    const [storeUrlOverride, setStoreUrlOverride] = useState('');
    const { ContactsModule, ExitManagerModule } = NativeModules || {};
    const user = useSelector(({ user }) => user);
    const subscriptionActive = useSelector(({ appSettings }) => appSettings?.subscriptionActive !== false);
    const dispatch = useDispatch();
    const { colors, isDark } = useTheme();
    
    const handleUpgrade = useCallback((storeUrl) => {
        const fallbackAndroid = 'https://play.google.com/store/apps/details?id=com.shopynn';
        const fallbackIos = 'https://apps.apple.com/us/app/shopynn/id6453170031';
        const link =
            (typeof storeUrl === 'string' && storeUrl.trim()) ||
            storeUrlOverride.trim() ||
            (Platform.OS === 'android' ? fallbackAndroid : fallbackIos);

        Linking.canOpenURL(link).then(
            (supported) => {
                if (supported) {
                    Linking.openURL(link);
                    return;
                }
                Alert.alert(
                    Platform.OS === 'android' ? 'Visit Play Store' : 'Visit App Store',
                    'Could not open the store automatically. Please open it manually to update this app.',
                );
            },
            () => {
                Alert.alert(
                    Platform.OS === 'android' ? 'Visit Play Store' : 'Visit App Store',
                    'Could not open the store automatically. Please open it manually to update this app.',
                );
            },
        );
    }, [storeUrlOverride]);

    const checkVersionUpgrade = useCallback(() => {
        axios.get('/app-versions/check', {
            params: {
                platform: Platform.OS,
                current_version: String(config.VERSION_NUMBER),
            },
        })
            .then((r) => {
                const payload = r?.data?.data || r?.data || {};
                const updateStatus = payload?.update_status;
                const notes = String(payload?.release_notes || '').trim();
                const storeUrl = String(payload?.store_url || '').trim();
                const latest = String(payload?.latest_version || '').trim();
                if (storeUrl) setStoreUrlOverride(storeUrl);
                if (latest) setLatestVersion(latest);
                setUpdateReleaseNotes(notes);

                // Only block when the server says update is required (below min, or force+behind latest).
                if (updateStatus === 'update_required') {
                    setForceUpdate(true);
                    return;
                }

                if (updateStatus === 'update_available') {
                    setSoftUpdateVisible(true);
                }
            })
            .catch(() => {});
    }, []);

    const checkJailBroken = async () => {
        let disAllow = JailMonkey.isJailBroken()
        
        //comment this during development, for it will always return true
        //disAllow = await JailMonkey.isDebuggedMode()

        setIsBlocked(disAllow)

        // getSimState
        if (ContactsModule?.getSimState) {
            ContactsModule.getSimState((res)=> {
                // console.log('getSimState val',res);
                if(res === 'not-available') {
                    setIsBlocked(true)
                }
            })
        }
            
    }
    
    useEffect(()=> {
        checkJailBroken()

        NetInfo.fetch()
            .then(netState=> {
                if(netState.isConnected){
                    checkVersionUpgrade();
                }
            })

        // Delay hide so it runs after SplashScreen.show()'s async Dialog post
        // (calling hide too early leaves the splash stuck forever).
        const hideSplash = () => {
            try {
                SplashScreen?.hide?.();
            } catch (_) {}
        };
        const t1 = setTimeout(hideSplash, 400);
        const t2 = setTimeout(hideSplash, 1200);

       return ()=> {
            clearTimeout(t1);
            clearTimeout(t2);
       } 
    },[]);

    useEffect(() => {
        let lastConnected = null;
        let debounceTimer = null;

        const flushPending = () => {
            syncPendingSales().catch(() => {});
            productsApi.list().catch(() => {});
        };

        const unsubscribe = NetInfo.addEventListener((state) => {
            const connected = !!state?.isConnected;
            if (lastConnected === null) {
                lastConnected = connected;
                return;
            }
            // Transition: offline -> online
            if (!lastConnected && connected) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(flushPending, 800);
            }
            lastConnected = connected;
        });

        const onAppState = (next) => {
            if (next === 'active') {
                NetInfo.fetch().then((state) => {
                    if (state?.isConnected) flushPending();
                });
            }
        };
        const appSub = AppState.addEventListener('change', onAppState);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            unsubscribe && unsubscribe();
            appSub?.remove?.();
        };
    }, []);

    const checkFCMToken = async () => {
        // if(Platform.OS == 'android'){
        //     if(Platform.Version >= 33){
        //         const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        //         if(status == 'granted'){
        //             await messaging().registerDeviceForRemoteMessages();
        //             const tkn = await messaging().getToken();
        //             // console.log('andr tokn',tkn)
        //             if(tkn.length > 0){
        //                 AsyncStorage.setItem('BRS_FCM_TOKEN',tkn)
        //             }
        //         }
        //     }
        //     else {
        //         await messaging().registerDeviceForRemoteMessages();
        //         const tkn = await messaging().getToken();
        //         // console.log('andr tokn',tkn)
        //         if(tkn.length > 0){
        //             AsyncStorage.setItem('BRS_FCM_TOKEN',tkn)
        //         }
        //     }
        // }
    }

    const quitApp = () => {
        if(Platform.OS==='android') {
            BackHandler.exitApp()
        }
        else {
            if(ExitManagerModule) {
                ExitManagerModule.exitApp()
            }
        }
    }

    const isLoggedIn = user?.isLoggedIn;
    const {
        onNavigationStateChange,
        warningVisible,
        expiredVisible,
        stayLoggedIn,
        dismissWarning,
        dismissExpired,
    } = useInactivityTimer(!!isLoggedIn);

    const statusBarBackgroundColor =
        Platform.OS === 'android' && !isLoggedIn ? config.THEME_COLOR : colors.background;
    const statusBarStyle = !isLoggedIn ? 'light-content' : (isDark ? 'light-content' : 'dark-content');

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right']}>
            <StatusBar
                barStyle={statusBarStyle}
                backgroundColor={statusBarBackgroundColor}
                translucent={Platform.OS === 'android'}
            />
            <View
                style={{
                    width: '100%',
                    height: 100,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: !isLoggedIn ? config.THEME_COLOR : colors.surface,
                }}
            />
            {user?.isLoggedIn
                ? !subscriptionActive
                        ? (
                            <SubscriptionNavigator
                                independent={true}
                                subscriptionInitialParams={{
                                    requiredPayment: true,
                                    onGoBack: () => {
                                        dispatch({ type: SET_USER, payload: {} });
                                        dispatch({ type: SET_LOGGED_IN, payload: false });
                                    },
                                }}
                            />
                        )
                        :
                        <MainNavigator user={user} onNavigationStateChange={onNavigationStateChange} />
                :
                <AuthNavigator />
            }

            <AppUpdateModal
                visible={forceUpdate}
                force
                message={updateReleaseNotes}
                latestVersion={latestVersion}
                currentVersion={String(config.VERSION_NUMBER || '')}
                onUpgrade={() => handleUpgrade()}
            />

            <AppUpdateModal
                visible={softUpdateVisible && !forceUpdate}
                force={false}
                message={updateReleaseNotes}
                latestVersion={latestVersion}
                currentVersion={String(config.VERSION_NUMBER || '')}
                onUpgrade={() => {
                    handleUpgrade();
                    setSoftUpdateVisible(false);
                }}
                onSkip={() => setSoftUpdateVisible(false)}
            />

            <ConfirmDialog
                visible={warningVisible && !!isLoggedIn}
                icon="clock"
                title="Session Timeout Warning"
                message="You have been inactive for a while. You will be logged out soon if no activity is detected."
                cancelLabel="OK"
                confirmLabel="Stay Logged In"
                onCancel={dismissWarning}
                onConfirm={stayLoggedIn}
            />

            <ConfirmDialog
                visible={expiredVisible}
                icon="log-out"
                title="Session Expired"
                message="You have been inactive too long and were logged out for security reasons."
                confirmLabel="OK"
                hideCancel
                onCancel={dismissExpired}
                onConfirm={dismissExpired}
            />
        </SafeAreaView>
    )
}

export default ApplicationNavigator;