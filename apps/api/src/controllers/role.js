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
import { getUserPermissionsService } from "../models/userRole.js";
import pool from "../config/db.js";

const SUPER_ADMIN_ROLE_NAME = "super admin";

const isReservedRoleName = (name) => String(name || "").trim().toLowerCase() === SUPER_ADMIN_ROLE_NAME;

const isSuperAdminRole = async (roleId, tenantId) => {
    const r = await pool.query(`SELECT name FROM roles WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [roleId, tenantId]);
    return isReservedRoleName(r.rows[0]?.name);
};

/** Role editors may only grant permissions they hold themselves. */
const findUngrantablePermissions = async (req, permissionIds) => {
    const ids = (permissionIds || []).filter(Boolean);
    if (ids.length === 0) return [];
    const [callerCodes, requested] = await Promise.all([
        getUserPermissionsService(req.user.id, req.user.tenant_id),
        pool.query(`SELECT code FROM permissions WHERE id = ANY($1::text[])`, [ids]),
    ]);
    const held = new Set(callerCodes);
    return requested.rows.map((r) => r.code).filter((code) => !held.has(code));
};

const rejectRoleChange = async (req, res, { roleId, name, permissionIds }) => {
    if (name !== undefined && isReservedRoleName(name)) {
        handleResponse(res, 400, "That role name is reserved.");
        return true;
    }
    if (roleId && (await isSuperAdminRole(roleId, req.user.tenant_id))) {
        handleResponse(res, 400, "The Super Admin role can't be changed.");
        return true;
    }
    const ungrantable = await findUngrantablePermissions(req, permissionIds);
    if (ungrantable.length > 0) {
        handleResponse(res, 403, "You can't grant permissions you don't have.", { permissions: ungrantable });
        return true;
    }
    return false;
};

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
        const payload = { ...req.body, tenant_id: req.user.tenant_id };
        const requestedIds = payload.permission_ids ?? payload.permissionIds ?? payload.permissions;
        const permissionIds = Array.isArray(requestedIds)
            ? requestedIds.map((p) => (typeof p === "string" ? p : p?.id))
            : [];
        if (await rejectRoleChange(req, res, { name: payload.name ?? "", permissionIds })) return;
        const role = await createRoleService(payload);
        handleResponse(res, 201, "Role created.", role);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("Customer role")) {
            return handleResponse(res, 400, error.message);
        }
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
        delete payload.tenant_id;
        if (await rejectRoleChange(req, res, { roleId: req.params.id, name: payload.name, permissionIds: payload.permission_ids })) return;

        const role = await updateRoleService(req.params.id, payload, req.user.tenant_id);
        if (!role) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Role updated.", role);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("Customer role")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const deleteRole = async (req, res, next) => {
    try {
        if (await rejectRoleChange(req, res, { roleId: req.params.id })) return;
        const deleted = await deleteRoleService(req.params.id, req.user.tenant_id);
        if (!deleted) return handleResponse(res, 404, "Role not found.");
        if (deleted.status) return handleResponse(res, deleted.status, deleted.message);
        handleResponse(res, 200, "Role deleted.");
    } catch (error) {
        if (
            error?.message === "Role is assigned to users and cannot be deleted." ||
            error?.status === 400 ||
            error?.message?.includes("Customer role")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const addPermissionToRole = async (req, res, next) => {
    try {
        const { permission_id } = req.body;
        if (!permission_id) return handleResponse(res, 400, "permission_id required.");
        if (await rejectRoleChange(req, res, { roleId: req.params.id, permissionIds: [permission_id] })) return;
        const permissions = await addPermissionToRoleService(req.params.id, permission_id, req.user.tenant_id);
        if (!permissions) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Permission added to role.", permissions);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("Customer role")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const removePermissionFromRole = async (req, res, next) => {
    try {
        const permission_id = req.body.permission_id ?? req.params.permissionId;
        if (!permission_id) return handleResponse(res, 400, "permission_id required.");
        if (await rejectRoleChange(req, res, { roleId: req.params.id })) return;
        const removed = await removePermissionFromRoleService(req.params.id, permission_id, req.user.tenant_id);
        if (!removed) return handleResponse(res, 404, "Role or permission not found.");
        handleResponse(res, 200, "Permission removed from role.");
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("Customer role")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const setRolePermissions = async (req, res, next) => {
    try {
        const permission_ids = req.body.permission_ids ?? req.body.permissionIds ?? [];
        if (await rejectRoleChange(req, res, { roleId: req.params.id, permissionIds: permission_ids })) return;
        const permissions = await setRolePermissionsService(req.params.id, permission_ids, req.user.tenant_id);
        if (!permissions) return handleResponse(res, 404, "Role not found.");
        handleResponse(res, 200, "Role permissions updated.", permissions);
    } catch (error) {
        if (error?.status === 400 || error?.message?.includes("Customer role")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};
