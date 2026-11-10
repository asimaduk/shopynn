import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

const header = (req, name, max) => {
    const value = String(req.get(name) || "").trim();
    return value ? value.slice(0, max) : null;
};

/** Makes the caller's IP and device headers available to services that don't receive `req`. */
export const requestContextMiddleware = (req, _res, next) => {
    storage.run(
        {
            ip: req.ip ? String(req.ip).slice(0, 64) : null,
            userAgent: header(req, "user-agent", 300),
            deviceName: header(req, "x-device-name", 120),
            platform: header(req, "x-platform", 20),
            appVersion: header(req, "x-app-version", 40),
        },
        next
    );
};

export const getRequestContext = () => storage.getStore() || {};
