import { handleResponse } from "../util/handleresponse.js";
import {
    getUserRolesService,
    getUserPermissionsService,
    assignRoleToUserService,
    removeRoleFromUserService,
    setUserRolesService,
    getUsersWithRolesService,
} from "../models/userRole.js";

export const getMyPermissions = async (req, res, next) => {
    try {
        const permissions = await getUserPermissionsService(req.user.id, req.user.tenant_id);
        handleResponse(res, 200, "My permissions.", { permissions });
    } catch (error) {
        next(error);
    }
};

export const getMyRoles = async (req, res, next) => {
    try {
        const roles = await getUserRolesService(req.user.id, req.user.tenant_id);
        handleResponse(res, 200, "My roles.", roles);
    } catch (error) {
        next(error);
    }
};

export const getUserRoles = async (req, res, next) => {
    try {
        const roles = await getUserRolesService(req.params.userId, req.user.tenant_id);
        handleResponse(res, 200, "User roles.", roles);
    } catch (error) {
        next(error);
    }
};

export const assignRole = async (req, res, next) => {
    try {
        const { role_id } = req.body;
        if (!role_id) return handleResponse(res, 400, "role_id required.");
        const roles = await assignRoleToUserService(
            req.params.userId,
            role_id,
            req.user.id,
            req.user.tenant_id
        );
        if (!roles) return handleResponse(res, 404, "User not found or not in your tenant.");
        handleResponse(res, 200, "Role assigned.", roles);
    } catch (error) {
        next(error);
    }
};

export const removeRole = async (req, res, next) => {
    try {
        const role_id = req.body.role_id ?? req.params.roleId;
        if (!role_id) return handleResponse(res, 400, "role_id required.");
        const removed = await removeRoleFromUserService(req.params.userId, role_id, req.user.tenant_id);
        if (!removed) return handleResponse(res, 404, "Assignment not found.");
        handleResponse(res, 200, "Role removed from user.");
    } catch (error) {
        next(error);
    }
};

export const setUserRoles = async (req, res, next) => {
    try {
        const role_ids = req.body.role_ids ?? req.body.roleIds ?? [];
        const roles = await setUserRolesService(
            req.params.userId,
            role_ids,
            req.user.id,
            req.user.tenant_id
        );
        if (!roles) return handleResponse(res, 404, "User not found or not in your tenant.");
        handleResponse(res, 200, "User roles updated.", roles);
    } catch (error) {
        next(error);
    }
};

export const getUsersWithRoles = async (req, res, next) => {
    try {
        const users = await getUsersWithRolesService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Users with roles.", users);
    } catch (error) {
        next(error);
    }
};
