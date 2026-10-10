import { createUserService, deleteUserService, getAllUsersService, getUserByIdService, updateUserService, toggleUserActiveService, loginService, resetPasswordService, forgotPasswordService, getUserDetailsService, changePasswordWithTemporaryService, assignMerchantPermissionsToUserRoleService } from "../models/user.js";
import { createAuditLogService } from "../models/auditLog.js";
import { recordAudit } from "../util/audit.js";
import { getPreferencesService, updatePreferencesService } from "../models/userPreferences.js";
import { handleResponse } from "../util/handleresponse.js";
import { getUserPermissionsService } from "../models/userRole.js";
import pool from "../config/db.js";
import { canAssignRole, isSuperAdminUser } from "../util/roleGrants.js";

const ROLE_TOO_POWERFUL = "You can't give someone a role with more access than you have.";
const OWNER_PROTECTED = "Only a Super Admin can change a Super Admin's account.";

/** Staff with user permissions still can't edit, disable or delete the shop owner. */
const isProtectedTarget = async (req, targetId) =>
    (await isSuperAdminUser(targetId, req.user.tenant_id)) && !(await isSuperAdminUser(req.user.id, req.user.tenant_id));

const isTenantUser = async (userId, tenantId) => {
    if (!userId || !tenantId) return false;
    const r = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [userId, tenantId]);
    return r.rowCount > 0;
};

const isTenantRole = async (roleId, tenantId) => {
    if (!roleId || !tenantId) return false;
    const r = await pool.query(`SELECT 1 FROM roles WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [roleId, tenantId]);
    return r.rowCount > 0;
};

const isTenantWarehouse = async (warehouseId, tenantId) => {
    if (!warehouseId || !tenantId) return false;
    const r = await pool.query(`SELECT 1 FROM warehouses WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [warehouseId, tenantId]);
    return r.rowCount > 0;
};

const pickDefined = (source, keys) =>
    Object.fromEntries(keys.filter((k) => source?.[k] !== undefined).map((k) => [k, source[k]]));

export const createUser = async (req, res, next) => {
    try {
        const tenantId = req.user.tenant_id;
        const body = req.body || {};
        if (body.role_id && !(await isTenantRole(body.role_id, tenantId))) {
            return handleResponse(res, 400, "Choose a role from your shop.");
        }
        if (body.role_id && !(await canAssignRole(req.user, body.role_id))) {
            return handleResponse(res, 403, ROLE_TOO_POWERFUL);
        }
        if (body.warehouse_id && !(await isTenantWarehouse(body.warehouse_id, tenantId))) {
            return handleResponse(res, 400, "Choose a branch from your shop.");
        }
        const createResponse = await createUserService({
            ...pickDefined(body, [
                "first_name",
                "last_name",
                "email",
                "phone",
                "password",
                "role_id",
                "warehouse_id",
                "registration_method",
                "email_credentials",
            ]),
            tenant_id: tenantId,
            assigned_by_user_id: req.user.id,
            isOnboarding: false,
        });
        if(createResponse.id) {
            handleResponse(res, 201, "User creation success.", createResponse);
            await recordAudit(req, "USER_CREATE", "user", createResponse.id, {
                email: body.email ?? null,
                role_id: body.role_id ?? null,
                warehouse_id: body.warehouse_id ?? null,
            });

            // After user creation, initialize preferences to defaults.
            await updatePreferencesService(createResponse.id, {}); // This will create the row with default prefs
        }
        else {
            handleResponse(res, 400, createResponse?.message || "An error occurred", createResponse);
        }
    } catch (error) {
        if(typeof error == 'object' && error.constraint === 'uq_emails') {
            handleResponse(res, 200, "Email already exists.", {status: 409})
        }
        else if(typeof error == 'object' && error.constraint === 'uq_phones') {
            handleResponse(res, 200, "Phone already exists.", {status: 409})
        }
        else {
            next(error);
        }
    }
}

export const getAllUsers = async (req, res, next) => {
    try {
        const users = await getAllUsersService(req.user);
        handleResponse(res, 200, "Users list.", users);
    } catch (error) {
        next(error);
    }
}

export const getUserById = async (req, res, next) => {
    try {
        const user = await getUserByIdService(req.user.id);
        if(!user) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "User found.", user);
    } catch (error) {
        next(error);
    }
}

const SELF_EDITABLE_USER_FIELDS = ["first_name", "last_name", "phone", "fcm_token"];
const ADMIN_EDITABLE_USER_FIELDS = ["first_name", "last_name", "email", "phone", "is_active", "warehouse_id", "role_id"];

export const updateUser = async (req, res, next) => {
    try {
        const tenantId = req.user.tenant_id;
        const targetId = req.params.id === "me" ? req.user.id : req.params.id;
        const body = req.body || {};
        let payload;
        if (targetId === req.user.id) {
            payload = pickDefined(body, SELF_EDITABLE_USER_FIELDS);
        } else {
            const permissions = await getUserPermissionsService(req.user.id, tenantId);
            if (!permissions.includes("users.update")) {
                return res.status(403).json({ error: "Forbidden", code: "INSUFFICIENT_PERMISSIONS", required: ["users.update"] });
            }
            if (!(await isTenantUser(targetId, tenantId))) return handleResponse(res, 404, "Not found.");
            if (await isProtectedTarget(req, targetId)) return handleResponse(res, 403, OWNER_PROTECTED);
            if (body.role_id && !(await isTenantRole(body.role_id, tenantId))) {
                return handleResponse(res, 400, "Choose a role from your shop.");
            }
            if (body.role_id && !(await canAssignRole(req.user, body.role_id))) {
                return handleResponse(res, 403, ROLE_TOO_POWERFUL);
            }
            if (body.warehouse_id && !(await isTenantWarehouse(body.warehouse_id, tenantId))) {
                return handleResponse(res, 400, "Choose a branch from your shop.");
            }
            payload = pickDefined(body, ADMIN_EDITABLE_USER_FIELDS);
        }
        const updatedUser = await updateUserService({ ...payload, id: targetId });
        if (!updatedUser) return handleResponse(res, 404, "Not found.");

        if (req.user && updatedUser?.id) {
            await createAuditLogService({
                user_id: req.user.id,
                tenant_id: req.user.tenant_id,
                action: "USER_UPDATE",
                entity_type: "user",
                entity_id: updatedUser.id,
                details: JSON.stringify({
                    updated_fields: Object.keys(payload),
                }),
                ip_address: req.ip,
            });
            if (payload.role_id) {
                await recordAudit(req, "USER_ROLE_CHANGE", "user", updatedUser.id, { role_id: payload.role_id });
            }
        }

        handleResponse(res, 201, "User updated.", updatedUser);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("App signup customer")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
}

export const deleteUser = async (req, res, next) => {
    try {
        if (req.params.id === req.user.id) return handleResponse(res, 400, "You can't delete your own account here.");
        if (!(await isTenantUser(req.params.id, req.user.tenant_id))) return handleResponse(res, 404, "Not found.");
        if (await isProtectedTarget(req, req.params.id)) return handleResponse(res, 403, OWNER_PROTECTED);
        const deletedUser = await deleteUserService({
            id: req.params.id,
            deleted_by: req.user?.id ?? null,
            deleted_reason: req.body?.reason ?? null,
        });
        if(!deletedUser) return handleResponse(res, 404, "Not found.")

        if (req.user && deletedUser?.id) {
            await createAuditLogService({
                user_id: req.user.id,
                tenant_id: req.user.tenant_id,
                action: "USER_DELETE",
                entity_type: "user",
                entity_id: deletedUser.id,
                details: JSON.stringify({
                    deleted_reason: req.body?.reason ?? null,
                }),
                ip_address: req.ip,
            });
        }

        handleResponse(res, 200, "User deleted.", deletedUser);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("App signup customer")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
}

export const toggleUserActive = async (req, res, next) => {
    try {
        const { id, is_active } = req.body;
        if (!id || typeof is_active !== "boolean") {
            return handleResponse(res, 400, "id and is_active (boolean) are required.", null);
        }
        if (id === req.user.id) return handleResponse(res, 400, "You can't deactivate your own account.", null);
        if (!(await isTenantUser(id, req.user.tenant_id))) return handleResponse(res, 404, "Not found.", null);
        if (await isProtectedTarget(req, id)) return handleResponse(res, 403, OWNER_PROTECTED, null);
        const updated = await toggleUserActiveService({ id, is_active });
        if (!updated) return handleResponse(res, 404, "Not found.", null);
        handleResponse(res, 200, "User status updated.", updated);
        await recordAudit(req, is_active ? "USER_ENABLE" : "USER_DISABLE", "user", id);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("App signup customer")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
}

export const loginUser = async (req, res, next) => {
    try {
        const info = await loginService(req.body);
        if (info?.passwordExpired) {
            handleResponse(res, 403, "Your password has expired. Please reset your password.", {
                passwordExpired: true,
                code: "PASSWORD_EXPIRED",
            });
            return;
        }
        if (info?.isActive === false) {
            handleResponse(res, 403, "Your account is inactive. Contact your administrator.", {
                isActive: false,
                code: "ACCOUNT_INACTIVE",
            });
            return;
        }
        if (info && info.token) {
            handleResponse(res, 200, "Login success.", info);
        }
        else {
            handleResponse(res, 400, "Login failed. Email & password mismatch.", info);
        }
    } catch (error) {
        next(error);
    }
}

export const sendPhoneLoginOtp = async (req, res, next) => {
    try {
        const { sendPhoneLoginOtpService } = await import("../models/phoneLogin.js");
        const data = await sendPhoneLoginOtpService(req.body || {});
        handleResponse(res, 200, "OTP sent.", data);
    } catch (error) {
        const payload = {};
        if (error?.code) payload.code = error.code;
        if (error?.retry_after_seconds != null) payload.retry_after_seconds = error.retry_after_seconds;
        return handleResponse(
            res,
            error.status || 400,
            error.message || "Failed.",
            Object.keys(payload).length ? payload : null
        );
    }
};

export const verifyPhoneLoginOtp = async (req, res, next) => {
    try {
        const { verifyPhoneLoginOtpService } = await import("../models/phoneLogin.js");
        const data = await verifyPhoneLoginOtpService(req.body || {});
        handleResponse(res, 200, "Login success.", data);
    } catch (error) {
        const payload = {};
        if (error?.code) payload.code = error.code;
        if (error?.attempts_remaining != null) payload.attempts_remaining = error.attempts_remaining;
        return handleResponse(
            res,
            error.status || 400,
            error.message || "Failed.",
            Object.keys(payload).length ? payload : null
        );
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const updateResponse = await resetPasswordService(req.body.password, req.body.old_password, req.user.id);        
        if(updateResponse.status === 201) {
            handleResponse(res, 201, "Password updated.", updateResponse);
            await recordAudit(req, "PASSWORD_CHANGE", "user", req.user.id);
        }
        else {
            handleResponse(res, updateResponse.status || 400, updateResponse.message || "Failed.", updateResponse);
        }
    } catch (error) {
        next(error);
    }
}

export const forgotPassword = async (req, res, next) => {
    try {
        const result = await forgotPasswordService(req.body.email);
        if (result.status === 400) {
            handleResponse(res, 400, result.message || "Email is required.", null);
            return;
        }
        handleResponse(
            res,
            200,
            "If an account exists with this email, a temporary password has been sent. Please log in and set a new password.",
            null
        );
    } catch (error) {
        next(error);
    }
};

export const changePasswordWithTemporary = async (req, res, next) => {
    try {
        const result = await changePasswordWithTemporaryService({
            user_id: req.user.id,
            current_password: req.body.current_password,
            new_password: req.body.new_password,
        });

        if (result.status !== 200) {
            return handleResponse(res, result.status || 400, result.message || "Failed.", null);
        }

        handleResponse(res, 200, "Password changed successfully.", null);
        await recordAudit(req, "PASSWORD_CHANGE", "user", req.user.id, { from_temporary: true });
    } catch (error) {
        next(error);
    }
};

export const getMyPreferences = async (req, res, next) => {
    try {
        const preferences = await getPreferencesService(req.user.id);
        handleResponse(res, 200, "User preferences.", preferences);
    } catch (error) {
        next(error);
    }
};

export const updateMyPreferences = async (req, res, next) => {
    try {
        const preferences = await updatePreferencesService(req.user.id, req.body);
        handleResponse(res, 200, "Preferences updated.", preferences);
    } catch (error) {
        next(error);
    }
};

/** Persist the signed-in user's device FCM token (push). Auth only — allowed when subscription is expired. */
export const updateMyFcmToken = async (req, res, next) => {
    try {
        const raw = req.body?.fcm_token;
        if (raw !== null && raw !== undefined && typeof raw !== "string") {
            return handleResponse(res, 400, "fcm_token must be a string or null.", null);
        }
        const fcm_token = raw == null ? null : String(raw).trim() || null;
        const updatedUser = await updateUserService({ id: req.user.id, fcm_token });
        if (!updatedUser) return handleResponse(res, 404, "Not found.");
        handleResponse(res, 200, "FCM token updated.", { id: updatedUser.id });
    } catch (error) {
        next(error);
    }
};

export const getUserDetails = async (req, res, next) => {
    try {
        const user = await getUserDetailsService(req.params.id);
        if (!user || user.tenant_id !== req.user.tenant_id) return handleResponse(res, 404, "Not found.");
        handleResponse(res, 200, "User details.", user);
    } catch (error) {
        next(error);
    }
}

export const assignMerchantPermissionsToUserRole = async (req, res, next) => {
    try {
        const { user_id, role_id } = req.body || {};
        if (!user_id || !role_id) {
            return handleResponse(res, 400, "user_id and role_id are required.", null);
        }

        const result = await assignMerchantPermissionsToUserRoleService({
            user_id,
            role_id,
            tenant_id: req.user?.tenant_id,
            assigned_by: req.user?.id,
        });

        if (!result || result.status >= 400) {
            return handleResponse(res, result?.status || 400, result?.message || "Failed.", null);
        }

        handleResponse(res, 200, "Merchant permissions tied and role assigned.", result);
    } catch (error) {
        next(error);
    }
};
