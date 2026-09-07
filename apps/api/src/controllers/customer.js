import { createCustomerService, deleteCustomerService, getAllCustomersService, getCustomerByIdService, updateCustomerService } from "../models/customer.js";
import { getSalesByCustomerIdService } from "../models/sale.js";
import { handleResponse } from "../util/handleresponse.js";

export const createCustomer = async (req, res, next) => {
    try {
        const newCustomer = await createCustomerService(req.body);
        handleResponse(res, 201, "Customer creation success.", newCustomer);
    } catch (error) {
        next(error);
    }
}

export const getAllCustomers = async (req, res, next) => {
    try {
        const users = await getAllCustomersService(req.user, req.query);
        handleResponse(res, 200, "Customers list.", users);
    } catch (error) {
        next(error);
    }
}

export const getCustomerSales = async (req, res, next) => {
    try {
        const row = await getCustomerByIdService(req.user.tenant_id, req.params.id);
        if (!row) return handleResponse(res, 404, "Not found.");
        if (row.source === "account") {
            return handleResponse(res, 200, "Customer sales.", []);
        }
        const sales = await getSalesByCustomerIdService(req.user, req.params.id, req.query);
        handleResponse(res, 200, "Customer sales.", sales);
    } catch (error) {
        next(error);
    }
}

export const getCustomerById = async (req, res, next) => {
    try {
        const row = await getCustomerByIdService(req.user.tenant_id, req.params.id);
        if(!row) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Customer found.", row);
    } catch (error) {
        next(error);
    }
}

export const updateCustomer = async (req, res, next) => {
    try {
        const existing = await getCustomerByIdService(req.user.tenant_id, req.params.id);
        if (!existing) return handleResponse(res, 404, "Not found.");
        if (existing.source === "account") {
            return handleResponse(res, 400, "Account customers are managed as users, not POS customer records.");
        }
        const updatedCustomer = await updateCustomerService({ ...req.body, id: req.params.id }, req.user.tenant_id);
        if(!updatedCustomer) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Customer updated.", updatedCustomer);
    } catch (error) {
        next(error);
    }
}

export const deleteCustomer = async (req, res, next) => {
    try {
        const existing = await getCustomerByIdService(req.user.tenant_id, req.params.id);
        if (!existing) return handleResponse(res, 404, "Not found.");
        if (existing.source === "account") {
            return handleResponse(res, 400, "Account customers cannot be deleted from the customer directory. Deactivate the user instead.");
        }
        const deletedCustomer = await deleteCustomerService(req.user.tenant_id, req.params.id);
        if(!deletedCustomer) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Customer deleted.", deletedCustomer);
    } catch (error) {
        next(error);
    }
}