import { handleResponse } from "../util/handleresponse.js";
import { getAllPermissionsService, getPermissionByIdService } from "../models/permission.js";
import { SUPER_ADMIN_EXCLUDED_PERMISSION_CODES } from "../constants/permissionCodes.js";

const SHOP_EXCLUDED_CODES = new Set(SUPER_ADMIN_EXCLUDED_PERMISSION_CODES.map((c) => c.toLowerCase()));

/** Shops only see permissions their plan includes; platform admins see everything. */
const filterToShopPlan = (req, permissions) => {
    if (Number(req.user?.user_type) === 1) return permissions;
    const planFeatures = new Set((req.subscription?.features || []).map((f) => String(f).toLowerCase()));
    return permissions.filter((p) => {
        const code = String(p.code || "").toLowerCase();
        return planFeatures.has(code) && !SHOP_EXCLUDED_CODES.has(code);
    });
};

export const getAllPermissions = async (req, res, next) => {
    try {
        const permissions = await getAllPermissionsService(req.query);
        handleResponse(res, 200, "Permissions.", filterToShopPlan(req, permissions));
    } catch (error) {
        next(error);
    }
};

export const getPermissionById = async (req, res, next) => {
    try {
        const permission = await getPermissionByIdService(req.params.id);
        if (!permission) return handleResponse(res, 404, "Permission not found.");
        handleResponse(res, 200, "Permission.", permission);
    } catch (error) {
        next(error);
    }
};
