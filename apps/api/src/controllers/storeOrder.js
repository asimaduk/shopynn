import {
    getOrderDeliveryService,
    getOrderByIdService,
    getOrderStatusHistoryService,
    getStoreOrdersService,
    markOrderPaidCashService,
    recordPartialCashForOrderService,
    upsertOrderDeliveryService,
    updateOrderStatusService,
} from "../models/order.js";
import { handleResponse } from "../util/handleresponse.js";

export const getStoreOrders = async (req, res, next) => {
    try {
        const orders = await getStoreOrdersService(req.user, req.query);
        handleResponse(res, 200, "Store orders list.", orders);
    } catch (error) {
        next(error);
    }
};

export const getStoreOrderById = async (req, res, next) => {
    try {
        const order = await getOrderByIdService(req.user, req.params.id);
        if (!order) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Store order found.", order);
    } catch (error) {
        next(error);
    }
};

export const updateStoreOrderStatus = async (req, res, next) => {
    try {
        const status = req.body?.status;
        if (!status) return handleResponse(res, 400, "status is required.");
        const updated = await updateOrderStatusService(req.user, req.params.id, status, req.body?.reason || null);
        if (!updated) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Store order status updated.", updated);
    } catch (error) {
        if (
            error.message?.includes("Invalid status transition") ||
            error.message?.includes("balance is paid") ||
            error.message?.includes("fulfillment until")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const recordStoreOrderPartialCash = async (req, res, next) => {
    try {
        const updated = await recordPartialCashForOrderService(req.user, req.params.id, req.body || {});
        if (!updated) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Partial cash payment recorded.", updated);
    } catch (error) {
        if (
            error.message?.includes("pay-over-time") ||
            error.message?.includes("already zero") ||
            error.message?.includes("Minimum payment") ||
            error.message?.includes("cannot exceed") ||
            error.message?.includes("greater than zero")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const getStoreOrderHistory = async (req, res, next) => {
    try {
        const history = await getOrderStatusHistoryService(req.user, req.params.id);
        if (!history) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Store order history.", history);
    } catch (error) {
        next(error);
    }
};

export const getStoreOrderDelivery = async (req, res, next) => {
    try {
        const delivery = await getOrderDeliveryService(req.user, req.params.id);
        if (delivery === null) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Store order delivery.", delivery);
    } catch (error) {
        next(error);
    }
};

export const upsertStoreOrderDelivery = async (req, res, next) => {
    try {
        const delivery = await upsertOrderDeliveryService(req.user, req.params.id, req.body || {});
        if (!delivery) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Store order delivery updated.", delivery);
    } catch (error) {
        if (error.message?.includes("Delivery details are only allowed")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const markStoreOrderPaid = async (req, res, next) => {
    try {
        const updated = await markOrderPaidCashService(req.user, req.params.id, req.body || {});
        if (!updated) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Order payment marked as paid.", updated);
    } catch (error) {
        if (
            error.message?.includes("already marked as paid") ||
            error.message?.includes("Cash payment can only be marked") ||
            error.message?.includes("invalid for cash payment") ||
            error.message?.includes("partial cash payment")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};
