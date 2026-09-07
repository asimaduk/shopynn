/** ims-services API origin, no trailing slash */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

/** ims-web app origin for sign-in links */
export const WEB_APP_URL = (import.meta.env.VITE_WEB_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const SIGN_IN_URL = `${WEB_APP_URL}/sign-in`;
