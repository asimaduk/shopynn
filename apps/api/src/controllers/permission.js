import { handleResponse } from "../util/handleresponse.js";
import { getAllPermissionsService, getPermissionByIdService } from "../models/permission.js";

export const getAllPermissions = async (req, res, next) => {
    try {
        const permissions = await getAllPermissionsService(req.query);
        handleResponse(res, 200, "Permissions.", permissions);
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
