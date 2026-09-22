import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useDispatch } from 'react-redux';
import { SET_USER, SET_LOGGED_IN } from '../store/actions/user';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 25 * 60 * 1000; // warn 5 minutes before logout

/**
 * Idle session watchdog. Uses controllable dialog state (not Alert.alert)
 * so warnings dismiss cleanly on iOS when logout happens.
 */
const useInactivityTimer = (isLoggedIn) => {
    const dispatch = useDispatch();
    const timerRef = useRef(null);
    const warningTimerRef = useRef(null);
    const intervalRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);
    const lastActivityRef = useRef(Date.now());
    const isLoggedInRef = useRef(isLoggedIn);
    const resetTimerRef = useRef(() => {});

    const [warningVisible, setWarningVisible] = useState(false);
    const [expiredVisible, setExpiredVisible] = useState(false);

    useEffect(() => {
        isLoggedInRef.current = isLoggedIn;
        if (!isLoggedIn) {
            setWarningVisible(false);
            // Keep expiredVisible if we just timed out and want the user to acknowledge.
        }
    }, [isLoggedIn]);

    const clearTimers = useCallback(() => {
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
    }, []);

    const performLogout = useCallback(() => {
        clearTimers();
        setWarningVisible(false);
        dispatch({ type: SET_USER, payload: {} });
        dispatch({ type: SET_LOGGED_IN, payload: false });
    }, [clearTimers, dispatch]);

    const resetTimer = useCallback(() => {
        clearTimers();
        setWarningVisible(false);
        lastActivityRef.current = Date.now();

        if (!isLoggedInRef.current) return;

        warningTimerRef.current = setTimeout(() => {
            if (appStateRef.current === 'active' && isLoggedInRef.current) {
                setWarningVisible(true);
            }
        }, WARNING_TIME);

        timerRef.current = setTimeout(() => {
            if (appStateRef.current === 'active' && isLoggedInRef.current) {
                setWarningVisible(false);
                setExpiredVisible(true);
                performLogout();
            } else {
                setWarningVisible(false);
            }
        }, INACTIVITY_TIMEOUT);
    }, [clearTimers, performLogout]);

    useEffect(() => {
        resetTimerRef.current = resetTimer;
    }, [resetTimer]);

    const stayLoggedIn = useCallback(() => {
        setWarningVisible(false);
        if (isLoggedInRef.current) {
            resetTimerRef.current();
        }
    }, []);

    const dismissWarning = useCallback(() => {
        setWarningVisible(false);
    }, []);

    const dismissExpired = useCallback(() => {
        setExpiredVisible(false);
    }, []);

    useEffect(() => {
        if (!isLoggedIn) {
            clearTimers();
            setWarningVisible(false);
            lastActivityRef.current = Date.now();
            return undefined;
        }

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
                resetTimerRef.current();
            } else if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
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

        resetTimer();

        intervalRef.current = setInterval(() => {
            const timeSinceLastActivity = Date.now() - lastActivityRef.current;
            if (timeSinceLastActivity < 5000) {
                resetTimerRef.current();
            }
        }, 30000);

        return () => {
            subscription.remove();
            clearTimers();
            setWarningVisible(false);
        };
    }, [isLoggedIn, resetTimer, clearTimers]);

    return {
        resetTimer,
        onNavigationStateChange: () => resetTimer(),
        warningVisible,
        expiredVisible,
        stayLoggedIn,
        dismissWarning,
        dismissExpired,
    };
};

export default useInactivityTimer;
