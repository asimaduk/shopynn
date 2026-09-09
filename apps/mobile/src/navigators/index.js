import React, { useCallback, useEffect, useState } from 'react';
// import Toast from 'react-native-toast-message';
import { AppState, View, Text, StatusBar, Linking, NativeModules, Dimensions, TouchableOpacity, Platform, Alert, PermissionsAndroid, Image, BackHandler } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
// import SplashScreen from 'react-native-splash-screen';
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

const ApplicationNavigator = () => {
    const [isBlocked, setIsBlocked] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(false);
    const [forceUpdateReleaseNotes, setForceUpdateReleaseNotes] = useState('');
    const { ContactsModule, ExitManagerModule } = NativeModules || {};
    const user = useSelector(({ user }) => user);
    const subscriptionActive = useSelector(({ appSettings }) => appSettings?.subscriptionActive !== false);
    const dispatch = useDispatch();
    const { colors, isDark } = useTheme();
    
    const handleUpgrade = useCallback(() => {
        if (Platform.OS == 'android') {
            Linking.openURL("http://play.google.com/store/apps/details?id=com.shopynn");
        }
        else {
            // TODO: replace with Shopynn App Store id when listing is live
            const link = 'https://apps.apple.com/us/app/shopynn/id6453170031';
            Linking.canOpenURL(link).then(supported => {
                supported && Linking.openURL(link);
            }, () => {
                Alert.alert('Visit Appstore', 'Could not open appstore automatically, kindly open it manually to update this app');
            });
        }
    }, []);

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
                const shouldForce =
                    updateStatus === 'update_required' ||
                    payload?.force_update === true ||
                    payload?.force_update === 'TRUE';

                if (shouldForce) {
                    setForceUpdateReleaseNotes(payload?.release_notes || '');
                    setForceUpdate(true);
                    return;
                }

                if (updateStatus === 'update_available') {
                    Alert.alert('New Version', 'There is a new version of this app. Kindly upgrade.', [
                        { text: 'Skip' },
                        { text: 'Upgrade Now', onPress: handleUpgrade },
                    ]);
                }
            })
            .catch(() => {});
    }, [handleUpgrade]);

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

        // setTimeout(() => {
        //     SplashScreen.hide();
        // }, 0);

        checkFCMToken()

       return ()=> {} 
    },[]);

    useEffect(() => {
        let lastConnected = null;
        let debounceTimer = null;

        const unsubscribe = NetInfo.addEventListener((state) => {
            const connected = !!state?.isConnected;
            if (lastConnected === null) {
                lastConnected = connected;
                return;
            }
            // Transition: offline -> online
            if (!lastConnected && connected) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    // Warm/update product cache in background (best-effort).
                    productsApi.list().catch(() => {});
                }, 800);
            }
            lastConnected = connected;
        });

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            unsubscribe && unsubscribe();
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
    const statusBarBackgroundColor =
        Platform.OS === 'android' && !isLoggedIn ? config.THEME_COLOR : colors.background;
    const statusBarStyle = !isLoggedIn ? 'light-content' : (isDark ? 'light-content' : 'dark-content');
    const releaseNotesText = forceUpdateReleaseNotes?.trim() || 'A new version is required to continue using this app.';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar
                barStyle={statusBarStyle}
                backgroundColor={statusBarBackgroundColor}
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
            {forceUpdate && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 2000,
                        backgroundColor: colors.background,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 24,
                    }}
                >
                    <View
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            backgroundColor: colors.surface,
                            borderRadius: 12,
                            padding: 20,
                            elevation: 4,
                        }}
                    >
                        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Update Required</Text>
                        <Text style={{ marginTop: 12, fontSize: 15, color: colors.text }}>
                            {releaseNotesText}
                        </Text>
                        <TouchableOpacity
                            onPress={handleUpgrade}
                            style={{
                                marginTop: 20,
                                backgroundColor: config.THEME_COLOR,
                                borderRadius: 10,
                                height: 46,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Upgrade Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
                        <MainNavigator user={user} />
                :
                <AuthNavigator />
            }
        </SafeAreaView>
    )
}

export default ApplicationNavigator;