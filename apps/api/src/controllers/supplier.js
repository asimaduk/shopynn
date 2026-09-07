import { createSupplierService, getAllSuppliersService, getSupplierByIdService, updateSupplierService } from "../models/supplier.js";
import { getPurchasesBySupplierIdService } from "../models/purchase.js";
import { handleResponse } from "../util/handleresponse.js";

export const createSupplier = async (req, res, next) => {
    try {
        const newSupplier = await createSupplierService(req.body);
        handleResponse(res, 201, "Supplier creation success.", newSupplier);
    } catch (error) {
        next(error);
    }
}

export const getAllSuppliers = async (req, res, next) => {
    try {
        const warehouses = await getAllSuppliersService(req.user, req.query);
        handleResponse(res, 200, "Suppliers list.", warehouses);
    } catch (error) {
        next(error);
    }
}

export const getSupplierPurchases = async (req, res, next) => {
    try {
        const purchases = await getPurchasesBySupplierIdService(req.user, req.params.id, req.query);
        handleResponse(res, 200, "Supplier purchases.", purchases);
    } catch (error) {
        next(error);
    }
};

export const getSupplierById = async (req, res, next) => {
    try {
        const warehouse = await getSupplierByIdService(req.params.id);
        if(!warehouse) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Supplier found.", warehouse);
    } catch (error) {
        next(error);
    }
}

export const updateSupplier = async (req, res, next) => {
    try {
        const updatedSupplier = await updateSupplierService({...req.body, id: req.params.id});
        if(!updatedSupplier) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Supplier updated.", updatedSupplier);
    } catch (error) {
        next(error);
    }
}

export const deleteSupplier = async (req, res, next) => {
    try {
        const deletedSupplier = await updateSupplierService(req.body.id);
        if(!deletedSupplier) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Supplier deleted.", deletedSupplier);
    } catch (error) {
        next(error);
    }
}
