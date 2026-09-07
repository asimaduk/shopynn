import { handleResponse } from "../util/handleresponse.js";
import {
    listBillingCatalogItemsService,
    getBillingCatalogGroupedService,
    updateBillingCatalogItemService,
    getBillingCatalogItemByIdService,
    createBillingCatalogItemService,
} from "../models/billingCatalog.js";
import { hasPermission } from "../middleware/requirePermission.js";

export const getBillingCatalog = async (req, res, next) => {
    try {
        const activeOnly = req.query.active_only !== "false";
        const grouped = req.query.grouped === "true";
        if (grouped) {
            const data = await getBillingCatalogGroupedService();
            return handleResponse(res, 200, "Billing catalog.", data);
        }
        const items = await listBillingCatalogItemsService({ activeOnly });
        handleResponse(res, 200, "Billing catalog.", { items });
    } catch (error) {
        next(error);
    }
};

export const getBillingCatalogPublic = async (req, res, next) => {
    try {
        const data = await getBillingCatalogGroupedService();
        handleResponse(res, 200, "Public billing catalog.", data);
    } catch (error) {
        next(error);
    }
};

export const updateBillingCatalogItem = async (req, res, next) => {
    try {
        if (!hasPermission(req, "tenants.directory.view")) {
            return handleResponse(res, 403, "Forbidden.", null);
        }
        const updated = await updateBillingCatalogItemService(req.params.id, req.body, req.user?.id);
        if (!updated) return handleResponse(res, 404, "Catalog item not found.", null);
        handleResponse(res, 200, "Catalog item updated.", { item: updated });
    } catch (error) {
        if (error.message?.includes("amount_ghs")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const createBillingCatalogItem = async (req, res, next) => {
    try {
        if (!hasPermission(req, "tenants.directory.view")) {
            return handleResponse(res, 403, "Forbidden.", null);
        }
        const created = await createBillingCatalogItemService(req.body, req.user?.id);
        handleResponse(res, 201, "Catalog item created.", { item: created });
    } catch (error) {
        if (error.message?.includes("required") || error.message?.includes("Only add-on")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const getBillingCatalogItem = async (req, res, next) => {
    try {
        const item = await getBillingCatalogItemByIdService(req.params.id);
        if (!item) return handleResponse(res, 404, "Not found.", null);
        handleResponse(res, 200, "OK.", { item });
    } catch (error) {
        next(error);
    }
};
