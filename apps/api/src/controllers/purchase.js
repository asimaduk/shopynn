import { handleResponse } from "../util/handleresponse.js";
import { createPurchaseService, getAllPurchasesService, getAllPurchaseDetailsService, getPurchasesSummaryService, getSuppliersSummaryService, getPurchaseByIdService } from "../models/purchase.js";

export const createPurchase = async (req, res, next) => {
    try {
        const newPurchase = await createPurchaseService(req.body);
        handleResponse(res, 201, "Purchase creation success.", newPurchase);
    } catch (error) {
        // console.log('create err',typeof error);
        if(typeof error == 'object' && error.constraint === 'purchases_invoice_number_key') {
            // console.log('invoice number exists');
            handleResponse(res, 200, "Invoice number already exists.", {status: 409})
        }
        else {
            next(error);
        }
    }
}

export const getPurchaseById = async (req, res, next) => {
    try {
        const purchase = await getPurchaseByIdService(req.params.id);
        if(!purchase) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Purchase found.", purchase);
    } catch (error) {
        next(error);
    }
}

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
        const purchaseItems = await getAllPurchaseDetailsService();
        handleResponse(res, 200, "Purchases items list.", purchaseItems);
    } catch (error) {
        next(error);
    }
}