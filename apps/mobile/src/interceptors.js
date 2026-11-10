import axios from 'axios';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getAccessToken, clearTokens } from './utils/secureStorage';
import appconfig from './config';
import { rootNavigationRef } from './navigators/main';

const API_TIMEOUT = 30000;
const MAX_GET_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
import { SUBSCRIPTION_RENEWAL_CODES as SUBSCRIPTION_ERROR_CODES } from './utils/subscriptionAccess';
import AppAlert from './utils/appAlert';
import { clearStepUpToken, getStepUpToken, requestStepUpToken } from './utils/stepUp';
const FEATURE_GATE_CODES = new Set([
    'FEATURE_NOT_AVAILABLE',
    'SUBSCRIPTION_FEATURES_UNKNOWN',
]);

const goToSubscription = () => {
    if (rootNavigationRef.isReady()) {
        rootNavigationRef.navigate('Subscription');
    }
};
const getResponseCode = (error) => {
    const data = error?.response?.data;
    return String(
        data?.code ||
        data?.error?.code ||
        data?.data?.code ||
        ''
    ).toUpperCase();
};

let isAlertVisible = false;

const extractServerErrorMessage = (error) => {
    const responseData = error?.response?.data;

    if (typeof responseData === 'string' && responseData.trim()) {
        return responseData;
    }

    const directMessage =
        responseData?.message ||
        responseData?.error ||
        responseData?.detail ||
        responseData?.title ||
        responseData?.msg;
    if (typeof directMessage === 'string' && directMessage.trim()) {
        return directMessage;
    }

    if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
        return responseData.message.join(', ');
    }

    if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
        const parsedErrors = responseData.errors
            .map((entry) => {
                if (typeof entry === 'string') return entry;
                return entry?.message || entry?.msg || entry?.error;
            })
            .filter(Boolean);
        if (parsedErrors.length > 0) return parsedErrors.join(', ');
    }

    if (responseData?.errors && typeof responseData.errors === 'object') {
        const values = Object.values(responseData.errors).flat();
        const parsedErrors = values
            .map((entry) => {
                if (typeof entry === 'string') return entry;
                return entry?.message || entry?.msg || entry?.error;
            })
            .filter(Boolean);
        if (parsedErrors.length > 0) return parsedErrors.join(', ');
    }

    return error?.message || 'An unexpected error occurred.';
};

let sessionExpiredHandler = null;

/** Registered by the app root so a rejected token signs the user out. */
export const setSessionExpiredHandler = (handler) => {
    sessionExpiredHandler = handler;
};

const showSessionExpired = () => {
    if (isAlertVisible) return;
    isAlertVisible = true;
    Promise.resolve(sessionExpiredHandler?.()).catch(() => {});
    AppAlert.alert('', 'Your session has expired. Please sign in again.', [{ text: 'OK', onPress: () => { isAlertVisible = false; } }], { onDismiss: () => { isAlertVisible = false; } });
};

axios.defaults.timeout = API_TIMEOUT;

/** Shown in the signed-in devices list. */
const DEVICE_HEADERS = (() => {
    try {
        return {
            'X-Device-Name': `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`.trim(),
            'X-Platform': Platform.OS,
            'X-App-Version': DeviceInfo.getVersion(),
        };
    } catch {
        return { 'X-Platform': Platform.OS };
    }
})();

axios.interceptors.request.use(
    async (config) => {
        const url = String(config.url || '');
        const isPublicAuth =
            url.includes('/users/login') ||
            url.includes('/users/forgot-password') ||
            url.includes('/users/customer-signup') ||
            url.includes('/users/shop-owner-signup');

        if (!isPublicAuth) {
            const existingAuth =
                config.headers?.Authorization ||
                config.headers?.authorization;
            if (!existingAuth) {
                const access_token = await getAccessToken();
                if (access_token) config.headers['Authorization'] = `Bearer ${access_token}`;
            }
        } else if (config.headers) {
            delete config.headers.Authorization;
            delete config.headers.authorization;
        }

        config.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...config.headers,
        };

        if (!url.includes(appconfig.BASE_API)) {
            config.url = `${appconfig.BASE_API}${url.startsWith('/') ? url : `/${url}`}`;
        }

        if (String(config.url).startsWith(appconfig.BASE_API)) {
            Object.assign(config.headers, DEVICE_HEADERS);
            const stepUpToken = getStepUpToken();
            if (stepUpToken && !config.headers['X-Step-Up-Token']) config.headers['X-Step-Up-Token'] = stepUpToken;
        }

        if (__DEV__) {
            console.log('config url', config.url);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (__DEV__) {
            console.log('Axios error:', extractServerErrorMessage(error));
        }
        const originalRequest = error.config;

        if (error && !error.response && !axios.isCancel(error)) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || /timeout/i.test(error.message || '')) {
                error.message = 'This is taking longer than expected. Check your connection and try again.';
            } else if (error.message === 'Network Error') {
                error.message = "Can't reach Shopynn right now. Check your internet connection and try again.";
            }
        }

        if (error && error.response === undefined) {
            const isGet = originalRequest?.method?.toLowerCase() === 'get';
            const retries = originalRequest._retryCount ?? 0;
            if (isGet && retries < MAX_GET_RETRIES) {
                originalRequest._retryCount = retries + 1;
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (retries + 1)));
                return axios(originalRequest);
            }
            return Promise.reject(error);
        }

        const status = error.response?.status;
        const url = originalRequest?.url || '';
        const responseCode = getResponseCode(error);
        const isSubscriptionGateOnMe =
            status === 403 &&
            (url.indexOf('/users/me') !== -1 || url.indexOf('/me') !== -1) &&
            SUBSCRIPTION_ERROR_CODES.has(responseCode);
        const isAuthEndpoint = url.indexOf('/auth/login') !== -1 || url.indexOf('/users/login') !== -1 || url.indexOf('/users/me') !== -1;

        // Let login flow handle subscription-gated /users/me without generic alerts.
        if (isSubscriptionGateOnMe) {
            // console.log('subscription gate on me', error);
            return Promise.reject(error);
        }

        if (status === 403 && responseCode === 'STEP_UP_REQUIRED' && !originalRequest._stepUp) {
            originalRequest._stepUp = true;
            clearStepUpToken();
            const token = await requestStepUpToken();
            if (token) {
                originalRequest.headers['X-Step-Up-Token'] = token;
                return axios(originalRequest);
            }
            error.message = 'Cancelled. Confirm the code to continue.';
            if (error.response?.data) error.response.data.message = error.message;
            return Promise.reject(error);
        }

        if (status === 401 && !isAuthEndpoint) {
            await clearTokens();
            showSessionExpired();
        } else if (status === 403 && !isAuthEndpoint && FEATURE_GATE_CODES.has(responseCode)) {
            if (!originalRequest?.skipErrorAlert) {
                AppAlert.alert(
                    'Feature unavailable',
                    extractServerErrorMessage(error) || 'This feature requires a higher subscription plan.',
                    [
                        { text: 'Not now', style: 'cancel' },
                        { text: 'View plans', onPress: goToSubscription },
                    ]
                );
            }
        } else if (status === 403 && !isAuthEndpoint && responseCode === 'INSUFFICIENT_PERMISSIONS') {
            if (!originalRequest?.skipErrorAlert) {
                AppAlert.alert(
                    'Access denied',
                    extractServerErrorMessage(error) || 'You do not have permission for this action.',
                    [{ text: 'OK', style: 'cancel' }],
                );
            }
        } else if (status === 403 && !isAuthEndpoint) {
            if (!originalRequest?.skipErrorAlert) {
                showSessionExpired();
            }
        } else if (status >= 500 && originalRequest?.method?.toLowerCase() === 'get') {
            const retries = originalRequest._retryCount ?? 0;
            if (retries < MAX_GET_RETRIES) {
                originalRequest._retryCount = retries + 1;
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (retries + 1)));
                return axios(originalRequest);
            }
        }
        else {
            const isLoginEndpoint = url.indexOf('/login') !== -1;
            // New Sale MoMo flow shows its own alerts — avoid double dialogs.
            const isHandledMomoEndpoint =
                url.indexOf('/payments/initiate') !== -1 ||
                url.indexOf('/payments/submit-otp') !== -1 ||
                url.indexOf('/payments/verify') !== -1 ||
                url.indexOf('/payments/pos-') !== -1 ||
                url.indexOf('/payments/pos/') !== -1;
            // Change-email screen shows an inline banner instead of Alert.
            const isHandledChangeEmailEndpoint = url.indexOf('/users/me/change-email') !== -1;
            const isHandledChangePhoneEndpoint = url.indexOf('/users/me/change-phone') !== -1;
            const skipErrorAlert = Boolean(originalRequest?.skipErrorAlert);
            if (
                !isLoginEndpoint &&
                !isHandledMomoEndpoint &&
                !isHandledChangeEmailEndpoint &&
                !isHandledChangePhoneEndpoint &&
                !skipErrorAlert
            ) {
                AppAlert.alert('Error', extractServerErrorMessage(error));
            }
        }

        return Promise.reject(error);
    }
);