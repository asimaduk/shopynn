import { getUserPermissionsService } from "../models/userRole.js";

let permissionCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

async function getCachedPermissions(user_id, tenant_id) {
    const key = `${user_id}:${tenant_id}`;
    const cached = permissionCache.get(key);
    if (cached && Date.now() < cached.expires) return cached.permissions;
    const permissions = await getUserPermissionsService(user_id, tenant_id);
    permissionCache.set(key, { permissions, expires: Date.now() + CACHE_TTL_MS });
    return permissions;
}

/**
 * Middleware factory: require one or more permissions (user must have ALL).
 * Use after auth and requireActiveSubscription.
 * @param {...string} permissionCodes - e.g. requirePermission('users.manage', 'roles.assign')
 */
export function requirePermission(...permissionCodes) {
    const required = permissionCodes.filter(Boolean);
    return async (req, res, next) => {
        if (!req.user?.id || !req.user?.tenant_id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (required.length === 0) return next();
        try {
            const permissions = await getCachedPermissions(req.user.id, req.user.tenant_id);
            //console.log('permissions sliced', permissions?.slice(100));
            const hasAll = required.every((code) => permissions.includes(code));
            if (!hasAll) {
                return res.status(403).json({
                    error: "Forbidden",
                    code: "INSUFFICIENT_PERMISSIONS",
                    required: required,
                });
            }
            req.user.permissions = permissions;
            next();
        } catch (err) {
            next(err);
        }
    };
}

/**
 * Middleware: require that the user has at least one of the given permissions.
 */
export function requireAnyPermission(...permissionCodes) {
    const allowed = permissionCodes.filter(Boolean);
    return async (req, res, next) => {
        if (!req.user?.id || !req.user?.tenant_id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (allowed.length === 0) return next();
        try {
            const permissions = await getCachedPermissions(req.user.id, req.user.tenant_id);
            const hasAny = allowed.some((code) => permissions.includes(code));
            if (!hasAny) {
                return res.status(403).json({
                    error: "Forbidden",
                    code: "INSUFFICIENT_PERMISSIONS",
                    requiredOneOf: allowed,
                });
            }
            req.user.permissions = permissions;
            next();
        } catch (err) {
            next(err);
        }
    };
}

/**
 * Helper: check if the request user has a permission (for use inside controllers).
 */
export function hasPermission(req, code) {
    return Array.isArray(req.user?.permissions) && req.user.permissions.includes(code);
}
