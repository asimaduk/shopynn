import { useEffect, useRef, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { SET_USER, SET_LOGGED_IN } from '../store/actions/user';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 3 minutes in milliseconds
const WARNING_TIME = 25 * 60 * 1000; // 2.5 minutes - show warning 30 seconds before logout

const useInactivityTimer = (isLoggedIn, onNavigationStateChange) => {
    const dispatch = useDispatch();
    const timerRef = useRef(null);
    const warningTimerRef = useRef(null);
    const intervalRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);
    const lastActivityRef = useRef(Date.now());
    const warningShownRef = useRef(false);
    const isLoggedInRef = useRef(isLoggedIn);

    // Keep ref in sync with prop
    useEffect(() => {
        isLoggedInRef.current = isLoggedIn;
    }, [isLoggedIn]);

    const resetTimer = useCallback(() => {
        // Clear existing timers
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (warningTimerRef.current) {
            clearTimeout(warningTimerRef.current);
            warningTimerRef.current = null;
        }
        
        // Clear warning alert if it's shown
        if (warningShownRef.current) {
            // Dismiss any open alerts by showing a new one that immediately dismisses
            // Note: React Native doesn't have a direct way to dismiss alerts, 
            // but resetting the flag prevents the logout alert from showing if warning was dismissed
            warningShownRef.current = false;
        }
        
        lastActivityRef.current = Date.now();

        if (!isLoggedInRef.current) return;

        // Set warning timer (2.5 minutes)
        warningTimerRef.current = setTimeout(() => {
            // Double-check user is still logged in before showing warning
            if (appStateRef.current === 'active' && isLoggedInRef.current) {
                warningShownRef.current = true;
                Alert.alert(
                    'Session Timeout Warning',
                    'You have been inactive for 2.5 minutes. You will be logged out in 30 seconds if no activity is detected.',
                    [
                        {
                            text: 'Stay Logged In',
                            onPress: () => {
                                // Check again before resetting (user might have logged out)
                                if (isLoggedInRef.current) {
                                    resetTimer(); // Reset timer on user interaction
                                }
                            },
                        },
                        {text: 'Ok'}
                    ],
                    { cancelable: false }
                );
            } else {
                // User logged out before warning could show, clear flag
                warningShownRef.current = false;
            }
        }, WARNING_TIME);

        // Set logout timer (3 minutes)
        timerRef.current = setTimeout(() => {
            // Double-check user is still logged in before logging out
            if (appStateRef.current === 'active' && isLoggedInRef.current) {
                // Clear warning alert flag
                warningShownRef.current = false;
                
                // Clear warning timer if it's still pending
                if (warningTimerRef.current) {
                    clearTimeout(warningTimerRef.current);
                    warningTimerRef.current = null;
                }
                
                // Clear interval
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                
                Alert.alert(
                    'Session Expired',
                    'You have been inactive for 3 minutes. You have been logged out for security reasons.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Clear all timers and flags before logging out
                                warningShownRef.current = false;
                                if (timerRef.current) {
                                    clearTimeout(timerRef.current);
                                    timerRef.current = null;
                                }
                                if (warningTimerRef.current) {
                                    clearTimeout(warningTimerRef.current);
                                    warningTimerRef.current = null;
                                }
                                if (intervalRef.current) {
                                    clearInterval(intervalRef.current);
                                    intervalRef.current = null;
                                }
                                // Dispatch logout actions
                                dispatch({ type: SET_USER, payload: {} });
                                dispatch({ type: SET_LOGGED_IN, payload: false });
                            },
                        },
                    ],
                    { cancelable: false }
                );
            } else {
                // User already logged out, clear flag
                warningShownRef.current = false;
            }
        }, INACTIVITY_TIMEOUT);
    }, [dispatch]);

    useEffect(() => {
        if (!isLoggedIn) {
            // Clear all timers when logged out
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (warningTimerRef.current) {
                clearTimeout(warningTimerRef.current);
                warningTimerRef.current = null;
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            // Clear warning alert flag
            warningShownRef.current = false;
            // Reset last activity to prevent any pending checks
            lastActivityRef.current = Date.now();
            return;
        }

        // Handle app state changes
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // App came to foreground - reset timer
                resetTimer();
            } else if (
                appStateRef.current === 'active' &&
                nextAppState.match(/inactive|background/)
            ) {
                // App went to background - pause timers
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
                if (warningTimerRef.current) {
                    clearTimeout(warningTimerRef.current);
                    warningTimerRef.current = null;
                }
            }
            appStateRef.current = nextAppState;
        });

        // Initial timer setup
        resetTimer();

        // Reset timer periodically (every 30 seconds) to catch any missed interactions
        intervalRef.current = setInterval(() => {
            const timeSinceLastActivity = Date.now() - lastActivityRef.current;
            if (timeSinceLastActivity < 5000) {
                // If there was activity in last 5 seconds, reset timer
                resetTimer();
            }
        }, 30000);

        return () => {
            subscription.remove();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (warningTimerRef.current) {
                clearTimeout(warningTimerRef.current);
                warningTimerRef.current = null;
            }
            // Clear warning alert if shown
            if (warningShownRef.current) {
                warningShownRef.current = false;
            }
        };
    }, [isLoggedIn, resetTimer]);

    // Expose reset function and return navigation state change handler
    return { resetTimer, onNavigationStateChange: () => resetTimer() };
};

export default useInactivityTimer;
