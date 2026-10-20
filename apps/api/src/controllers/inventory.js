import { handleResponse } from "../util/handleresponse.js";
import { assertOwnStockPayload } from "../util/tenantScope.js";
import { hasMultiStoreAccess } from "../middleware/requirePermission.js";
import { createBulkUpdatesService, getAllInventoriesService, getExpiringInventoriesService, getInventoryCountService, getSlowMovingInventoriesService, getStockSummaryService, getTopSellingInventoriesService, setInventoryReorderLevelService } from "../models/inventory.js";

export const getAllInventories = async (req, res, next) => {
    try {
        const inventories = await getAllInventoriesService(req.user.warehouse_id, req.user.tenant_id, req.query);
        handleResponse(res, 200, "Inventories list.", inventories);
    } catch (error) {
        next(error);
    }
};

export const getInventoryCount = async (req, res, next) => {
    try {
        const count = await getInventoryCountService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Inventory count.", count);
    } catch (error) {
        next(error);
    }
};

export const getLowStockInventories = async (req, res, next) => {
    try {
        const query = { ...req.query, stockStatus: "low" };
        const inventories = await getAllInventoriesService(req.user.warehouse_id, req.user.tenant_id, query, {
            allStores: hasMultiStoreAccess(req),
        });
        handleResponse(res, 200, "Low stock inventories.", inventories);
    } catch (error) {
        next(error);
    }
};

export const getSlowMovingInventories = async (req, res, next) => {
    try {
        const inventories = await getSlowMovingInventoriesService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Slow moving inventories.", inventories);
    } catch (error) {
        next(error);
    }
};

export const getExpiringInventories = async (req, res, next) => {
    try {
        const inventories = await getExpiringInventoriesService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Expiring inventories.", inventories);
    } catch (error) {
        next(error);
    }
};

export const getTopSellingInventories = async (req, res, next) => {
    try {
        const inventories = await getTopSellingInventoriesService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Top selling inventories.", inventories);
    } catch (error) {
        next(error);
    }
};

export const getStockSummary = async (req, res, next) => {
    try {
        const summary = await getStockSummaryService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Stock summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const createBulkUpdates = async (req, res, next) => {
    try {
        await assertOwnStockPayload(req);
        const update = await createBulkUpdatesService(req.body);
        handleResponse(res, 200, "Update respone.", update);
    } catch (error) {
        next(error);
    }
};

export const setInventoryReorderLevel = async (req, res, next) => {
    try {
        const level = Number(req.body?.minimum_stock_level);
        if (!Number.isFinite(level) || level < 0) {
            return handleResponse(res, 400, "Enter a reorder level of 0 or more.");
        }
        const scopeWarehouse = hasMultiStoreAccess(req) ? null : req.user.warehouse_id || null;
        const row = await setInventoryReorderLevelService(req.user.tenant_id, req.params.id, level, scopeWarehouse);
        if (!row) return handleResponse(res, 404, "Stock record not found.");
        handleResponse(res, 200, "Reorder level updated.", row);
    } catch (error) {
        next(error);
    }
};
