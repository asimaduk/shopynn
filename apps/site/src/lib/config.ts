/** Shopynn API origin, no trailing slash */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/$/, "");

/** Web app origin for sign-in links */
export const WEB_APP_URL = (import.meta.env.VITE_WEB_APP_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

export const SIGN_IN_URL = `${WEB_APP_URL}/sign-in`;
