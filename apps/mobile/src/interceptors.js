import axios from 'axios';
import { Alert } from 'react-native';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './utils/secureStorage';
import appconfig from './config';
import { rootNavigationRef } from './navigators/main';

const API_TIMEOUT = 30000;
const AUTH_REFRESH_PATH = '/auth/refresh';
const MAX_GET_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
import { SUBSCRIPTION_RENEWAL_CODES as SUBSCRIPTION_ERROR_CODES } from './utils/subscriptionAccess';
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
let isRefreshing = false;
let failedQueue = [];

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

const processQueue = (err, token = null) => {
    failedQueue.forEach((prom) => (token ? prom.resolve(token) : prom.reject(err)));
    failedQueue = [];
};

const showSessionExpired = () => {
    if (isAlertVisible) return;
    isAlertVisible = true;
    Alert.alert('', 'Access denied.', [{ text: 'OK', onPress: () => { isAlertVisible = false; } }], { onDismiss: () => { isAlertVisible = false; } });
};

axios.defaults.timeout = API_TIMEOUT;

axios.interceptors.request.use(
    async (config) => {
        const access_token = await getAccessToken();
        if (access_token) config.headers['Authorization'] = `Bearer ${access_token}`;
        if (!config.url.includes(appconfig.BASE_API)) {
            config.url = `${appconfig.BASE_API}${config.url}`;
        }
        
        console.log('config url', config.url);
        
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
        const isAuthEndpoint = url.indexOf('/auth/login') !== -1 || url.indexOf('/users/login') !== -1 || url.indexOf(AUTH_REFRESH_PATH) !== -1 || url.indexOf('/users/me') !== -1;

        // Let login flow handle subscription-gated /users/me without generic alerts.
        if (isSubscriptionGateOnMe) {
            // console.log('subscription gate on me', error);
            return Promise.reject(error);
        }

        if (status === 401 && !isAuthEndpoint && !originalRequest._retry) {
            const refreshToken = await getRefreshToken();
            if (refreshToken && !isRefreshing) {
                originalRequest._retry = true;
                isRefreshing = true;
                try {
                    const baseUrl = appconfig.BASE_API;
                    const res = await axios.post(baseUrl + AUTH_REFRESH_PATH, { refresh_token: refreshToken }, { timeout: 10000 });
                    const newAccess = res?.data?.access_token ?? res?.data?.accessToken;
                    if (newAccess) {
                        const newRefresh = res?.data?.refresh_token ?? res?.data?.refreshToken;
                        await setTokens(newAccess, newRefresh ?? undefined);
                        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
                        processQueue(null, newAccess);
                        return axios(originalRequest);
                    }
                } catch (refreshErr) {
                    processQueue(refreshErr, null);
                    await clearTokens();
                    showSessionExpired();
                    return Promise.reject(refreshErr);
                } finally {
                    isRefreshing = false;
                }
            }
            if (refreshToken && isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve: (token) => { originalRequest.headers['Authorization'] = `Bearer ${token}`; resolve(axios(originalRequest)); }, reject });
                });
            }
            showSessionExpired();
        } else if (status === 403 && !isAuthEndpoint && FEATURE_GATE_CODES.has(responseCode)) {
            Alert.alert(
                'Feature unavailable',
                extractServerErrorMessage(error) || 'This feature requires a higher subscription plan.',
                [
                    { text: 'Not now', style: 'cancel' },
                    { text: 'View plans', onPress: goToSubscription },
                ]
            );
        } else if (status === 403 && !isAuthEndpoint && responseCode === 'INSUFFICIENT_PERMISSIONS') {
            Alert.alert(
                'Access denied',
                extractServerErrorMessage(error) || 'You do not have permission for this action.',
                [{ text: 'OK', style: 'cancel' }],
            );
        } else if (status === 403 && !isAuthEndpoint) {
            showSessionExpired();
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
            if (!isLoginEndpoint) {
                Alert.alert('Error', extractServerErrorMessage(error));
            }
        }

        return Promise.reject(error);
    }
);