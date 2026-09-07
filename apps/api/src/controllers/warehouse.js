import { createWarehouseService, getAllWarehousesService, getWarehouseByIdService, updateWarehouseService } from "../models/warehouse.js";
import { handleResponse } from "../util/handleresponse.js";
import { hasFeature } from "../middleware/requireFeature.js";

const CUSTOMER_SIGNUP_CODES_FEATURE = "orders.create";

function allowCustomerSignupCodes(req) {
    return hasFeature(req, CUSTOMER_SIGNUP_CODES_FEATURE);
}

export const createWarehouse = async (req, res, next) => {
    try {
        const body = { ...req.body, tenant_id: req.body.tenant_id ?? req.user?.tenant_id };
        if (
            body.reference_code != null &&
            String(body.reference_code).trim() !== "" &&
            !allowCustomerSignupCodes(req)
        ) {
            return handleResponse(res, 403, "Customer signup codes require the Premium plan.", {
                code: "FEATURE_NOT_AVAILABLE",
                requiredFeatures: [CUSTOMER_SIGNUP_CODES_FEATURE],
            });
        }
        const newWarehouse = await createWarehouseService(body, {
            allowReferenceCodes: allowCustomerSignupCodes(req),
        });
        if (newWarehouse?.message) {
            return handleResponse(res, 400, newWarehouse.message, newWarehouse);
        }
        if (!newWarehouse?.id) {
            return handleResponse(res, 400, "Could not create warehouse.", newWarehouse);
        }
        handleResponse(res, 201, "Warehouse creation success.", newWarehouse);
    } catch (error) {
        next(error);
    }
}

export const getAllWarehouses = async (req, res, next) => {
    try {
        const warehouses = await getAllWarehousesService(req.user, req.query);
        handleResponse(res, 200, "Warehouses list.", warehouses);
    } catch (error) {
        next(error);
    }
}

export const getWarehouseById = async (req, res, next) => {
    try {
        const warehouse = await getWarehouseByIdService(req.params.id);
        if(!warehouse) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Warehouse found.", warehouse);
    } catch (error) {
        next(error);
    }
}

export const updateWarehouse = async (req, res, next) => {
    try {
        req.body.id = req.params.id;
        req.body.tenant_id = req.body.tenant_id ?? req.user?.tenant_id;
        if (req.body.reference_code !== undefined && !allowCustomerSignupCodes(req)) {
            return handleResponse(res, 403, "Customer signup codes require the Premium plan.", {
                code: "FEATURE_NOT_AVAILABLE",
                requiredFeatures: [CUSTOMER_SIGNUP_CODES_FEATURE],
            });
        }
        const updatedWarehouse = await updateWarehouseService(req.body, {
            allowReferenceCodes: allowCustomerSignupCodes(req),
        });
        if (updatedWarehouse?.message) {
            return handleResponse(res, 400, updatedWarehouse.message, updatedWarehouse);
        }
        if (!updatedWarehouse) return handleResponse(res, 404, "Not found.");
        handleResponse(res, 201, "Warehouse updated.", updatedWarehouse);
    } catch (error) {
        next(error);
    }
}

export const deleteWarehouse = async (req, res, next) => {
    try {
        const deletedWarehouse = await updateWarehouseService(req.body.id);
        if(!deletedWarehouse) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Warehouse deleted.", deletedWarehouse);
    } catch (error) {
        next(error);
    }
}
