import { handleResponse } from "../util/handleresponse.js";
import { assertOwnRecord, assertOwnStockPayload } from "../util/tenantScope.js";
import {
    createPurchaseService,
    getAllPurchasesService,
    getAllPurchaseDetailsService,
    getPurchasesSummaryService,
    getSuppliersSummaryService,
    getPurchaseByIdService,
    updatePurchasePaymentService,
} from "../models/purchase.js";

export const createPurchase = async (req, res, next) => {
    try {
        const invoiceNumber = typeof req.body?.invoice_number === 'string' ? req.body.invoice_number.trim() : '';
        if (!invoiceNumber) {
            return handleResponse(res, 400, "Invoice number is required.");
        }
        await assertOwnStockPayload(req);
        const newPurchase = await createPurchaseService({ ...req.body, invoice_number: invoiceNumber });
        handleResponse(res, 201, "Purchase creation success.", newPurchase);
    } catch (error) {
        if (error?.code === '23505' && ['purchases_invoice_number_key', 'purchases_tenant_invoice_number_unique'].includes(error.constraint)) {
            handleResponse(res, 409, "This invoice number is already used for another purchase in your shop.");
        }
        else {
            next(error);
        }
    }
}

export const getPurchaseById = async (req, res, next) => {
    try {
        await assertOwnRecord(req, "purchases", req.params.id);
        const purchase = await getPurchaseByIdService(req.params.id);
        if(!purchase) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Purchase found.", purchase);
    } catch (error) {
        next(error);
    }
}

export const updatePurchasePayment = async (req, res, next) => {
    try {
        const purchase = await updatePurchasePaymentService(req.user, req.params.id, req.body || {});
        handleResponse(res, 200, "Purchase payment updated.", purchase);
    } catch (error) {
        if (error.status === 404 || error.message === "Purchase not found.") {
            return handleResponse(res, 404, "Purchase not found.");
        }
        if (
            error.message?.includes("payment") ||
            error.message?.includes("required") ||
            error.message?.includes("amount")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const getAllPurchases = async (req, res, next) => {
    try {
        const purchases = await getAllPurchasesService(req.user, req.query);
        handleResponse(res, 200, "Purchases list.", purchases);
    } catch (error) {
        next(error);
    }
};

export const getPurchasesSummary = async (req, res, next) => {
    try {
        const summary = await getPurchasesSummaryService(req.user, req.query);
        handleResponse(res, 200, "Purchases summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getSuppliersSummary = async (req, res, next) => {
    try {
        const summary = await getSuppliersSummaryService(req.user, req.query);
        handleResponse(res, 200, "Suppliers summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getAllPurchaseDetails = async (req, res, next) => {
    try {
        const purchaseItems = await getAllPurchaseDetailsService(req.user.tenant_id);
        handleResponse(res, 200, "Purchases items list.", purchaseItems);
    } catch (error) {
        next(error);
    }
}