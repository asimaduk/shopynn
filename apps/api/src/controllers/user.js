import { createUserService, deleteUserService, getAllUsersService, getUserByIdService, updateUserService, toggleUserActiveService, loginService, resetPasswordService, forgotPasswordService, getUserDetailsService, changePasswordWithTemporaryService, assignMerchantPermissionsToUserRoleService } from "../models/user.js";
import { createAuditLogService } from "../models/auditLog.js";
import { getPreferencesService, updatePreferencesService } from "../models/userPreferences.js";
import { handleResponse } from "../util/handleresponse.js";

export const createUser = async (req, res, next) => {
    try {
        const createResponse = await createUserService(req.body);
        if(createResponse.id) {
            handleResponse(res, 201, "User creation success.", createResponse);

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

export const updateUser = async (req, res, next) => {
    try {
        const updatedUser = await updateUserService({ ...req.body, id: req.body.id || req.user.id });
        if (!updatedUser) return handleResponse(res, 404, "Not found.");

        if (req.user && updatedUser?.id) {
            await createAuditLogService({
                user_id: req.user.id,
                tenant_id: req.user.tenant_id,
                action: "USER_UPDATE",
                entity_type: "user",
                entity_id: updatedUser.id,
                details: JSON.stringify({
                    updated_fields: Object.keys(req.body || {}),
                }),
                ip_address: req.ip,
            });
        }

        handleResponse(res, 201, "User updated.", updatedUser);
    } catch (error) {
        next(error);
    }
}

export const deleteUser = async (req, res, next) => {
    try {
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
        next(error);
    }
}

export const toggleUserActive = async (req, res, next) => {
    try {
        const { id, is_active } = req.body;
        if (!id || typeof is_active !== "boolean") {
            return handleResponse(res, 400, "id and is_active (boolean) are required.", null);
        }
        const updated = await toggleUserActiveService({ id, is_active });
        if (!updated) return handleResponse(res, 404, "Not found.", null);
        handleResponse(res, 200, "User status updated.", updated);
    } catch (error) {
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

export const resetPassword = async (req, res, next) => {
    try {
        const updateResponse = await resetPasswordService(req.body.password, req.body.old_password, req.user.id);        
        if(updateResponse.status === 201) {
            handleResponse(res, 201, "Password updated.", updateResponse);
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

export const getUserDetails = async (req, res, next) => {
    try {
        const user = await getUserDetailsService(req.params.id);
        if(!user) return handleResponse(res, 404, "Not found.");
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
