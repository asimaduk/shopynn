import { handleResponse } from "../util/handleresponse.js";
import {
    getAllRolesService,
    getRoleByIdService,
    getRolePermissionsService,
    createRoleService,
    updateRoleService,
    deleteRoleService,
    addPermissionToRoleService,
    removePermissionFromRoleService,
    setRolePermissionsService,
} from "../models/role.js";

export const getAllRoles = async (req, res, next) => {
    try {
        const roles = await getAllRolesService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Roles.", roles);
    } catch (error) {
        next(error);
    }
};

export const getRoleById = async (req, res, next) => {
    try {
        const role = await getRoleByIdService(req.params.id, req.user.tenant_id);
        if (!role) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Role.", role);
    } catch (error) {
        next(error);
    }
};

export const getRolePermissions = async (req, res, next) => {
    try {
        const permissions = await getRolePermissionsService(req.params.id, req.user.tenant_id);
        handleResponse(res, 200, "Role permissions.", permissions);
    } catch (error) {
        next(error);
    }
};

export const createRole = async (req, res, next) => {
    try {
        const payload = { ...req.body, tenant_id: req.body.tenant_id ?? req.user.tenant_id };
        const role = await createRoleService(payload);
        handleResponse(res, 201, "Role created.", role);
    } catch (error) {
        next(error);
    }
};

export const updateRole = async (req, res, next) => {
    try {
        // Accept a few common payload shapes for permissions updates:
        // - permission_ids / permissionIds: ["permId", ...]
        // - permissions: ["permId", ...] OR [{id: "permId"}, ...]
        const payload = { ...req.body };
        const permsRaw = payload.permission_ids ?? payload.permissionIds ?? payload.permissions;
        if (permsRaw !== undefined) {
            const list = Array.isArray(permsRaw) ? permsRaw : [];
            payload.permission_ids = list
                .map((p) => (typeof p === "string" ? p : p?.id))
                .filter(Boolean);
        }

        const role = await updateRoleService(req.params.id, payload, req.user.tenant_id);
        if (!role) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Role updated.", role);
    } catch (error) {
        next(error);
    }
};

export const deleteRole = async (req, res, next) => {
    try {
        const deleted = await deleteRoleService(req.params.id, req.user.tenant_id);
        if (!deleted) return handleResponse(res, 404, "Role not found.");
        if (deleted.status) return handleResponse(res, deleted.status, deleted.message);
        handleResponse(res, 200, "Role deleted.");
    } catch (error) {
        if (error?.message === "Role is assigned to users and cannot be deleted.") {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const addPermissionToRole = async (req, res, next) => {
    try {
        const { permission_id } = req.body;
        if (!permission_id) return handleResponse(res, 400, "permission_id required.");
        const permissions = await addPermissionToRoleService(req.params.id, permission_id, req.user.tenant_id);
        if (!permissions) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Permission added to role.", permissions);
    } catch (error) {
        next(error);
    }
};

export const removePermissionFromRole = async (req, res, next) => {
    try {
        const permission_id = req.body.permission_id ?? req.params.permissionId;
        if (!permission_id) return handleResponse(res, 400, "permission_id required.");
        const removed = await removePermissionFromRoleService(req.params.id, permission_id, req.user.tenant_id);
        if (!removed) return handleResponse(res, 404, "Role or permission not found.");
        handleResponse(res, 200, "Permission removed from role.");
    } catch (error) {
        next(error);
    }
};

export const setRolePermissions = async (req, res, next) => {
    try {
        const permission_ids = req.body.permission_ids ?? req.body.permissionIds ?? [];
        const permissions = await setRolePermissionsService(req.params.id, permission_ids, req.user.tenant_id);
        if (!permissions) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Role permissions updated.", permissions);
    } catch (error) {
        next(error);
    }
};
