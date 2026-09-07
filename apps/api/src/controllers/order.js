import {
    createOrderService,
    getOrderByIdService,
    getOrderStatusHistoryService,
    getOrdersService,
    initiateOrderPaymentService,
    initiatePartialOrderPaymentService,
    submitOrderPaymentOtpService,
    updateOrderService,
    updateOrderStatusService,
} from "../models/order.js";
import { handleResponse } from "../util/handleresponse.js";

export const createOrder = async (req, res, next) => {
    try {
        const order = await createOrderService(req.user, req.body);
        handleResponse(res, 201, "Order created.", order);
    } catch (error) {
        if (error.message?.includes("required") || error.message?.includes("must")) {
            return handleResponse(res, 400, error.message);
        }
        if (error.message?.includes("Minimum order")) {
            return handleResponse(res, 400, error.message);
        }
        if (error.message?.includes("cannot create") || error.message?.includes("not linked")) {
            return handleResponse(res, 403, error.message);
        }
        if (
            error.message?.includes("Pay over time") ||
            error.message?.includes("pay-over-time") ||
            error.message?.includes("Minimum initial") ||
            error.message?.includes("Minimum payment") ||
            error.message?.includes("eligible") ||
            error.message?.includes("Initial payment")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const getOrders = async (req, res, next) => {
    try {
        const orders = await getOrdersService(req.user, req.query);
        handleResponse(res, 200, "Orders list.", orders);
    } catch (error) {
        next(error);
    }
};

export const getMyOrders = async (req, res, next) => {
    try {
        const orders = await getOrdersService(req.user, req.query);
        const mine = Array.isArray(orders)
            ? orders.filter((o) => !o.customer_user_id || o.customer_user_id === req.user.id)
            : [];
        handleResponse(res, 200, "My orders list.", mine);
    } catch (error) {
        next(error);
    }
};

export const getOrderById = async (req, res, next) => {
    try {
        const order = await getOrderByIdService(req.user, req.params.id);
        if (!order) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Order found.", order);
    } catch (error) {
        next(error);
    }
};

export const updateOrder = async (req, res, next) => {
    try {
        const updated = await updateOrderService(req.user, req.params.id, req.body);
        if (!updated) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Order updated.", updated);
    } catch (error) {
        if (error.message?.includes("Only pending or confirmed")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const updateOrderStatus = async (req, res, next) => {
    try {
        const { status, reason } = req.body || {};
        if (!status) return handleResponse(res, 400, "status is required.");
        const updated = await updateOrderStatusService(req.user, req.params.id, status, reason);
        if (!updated) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Order status updated.", updated);
    } catch (error) {
        if (error.message?.includes("Invalid status transition")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const cancelOrder = async (req, res, next) => {
    try {
        const updated = await updateOrderStatusService(
            req.user,
            req.params.id,
            "cancelled",
            req.body?.reason || "Order cancelled"
        );
        if (!updated) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Order cancelled.", updated);
    } catch (error) {
        if (error.message?.includes("Invalid status transition")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const getOrderStatusHistory = async (req, res, next) => {
    try {
        const history = await getOrderStatusHistoryService(req.user, req.params.id);
        if (!history) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Order status history.", history);
    } catch (error) {
        next(error);
    }
};

export const initiateOrderPayment = async (req, res, next) => {
    try {
        const result = await initiateOrderPaymentService(req.user, req.params.id, req.body || {});
        const hasRedirect = result.redirect_url != null;
        if (hasRedirect) {
            handleResponse(res, 200, "Checkout session created.", result);
        } else {
            handleResponse(res, 200, "Mobile money charge initiated.", result);
        }
    } catch (error) {
        if (error.message?.includes("Order not found")) {
            return handleResponse(res, 404, error.message);
        }
        if (error.message?.includes("Only the customer")) {
            return handleResponse(res, 403, error.message);
        }
        if (
            error.message?.includes("Payment is available") ||
            error.message?.includes("already paid") ||
            error.message?.includes("cannot be started") ||
            error.message?.includes("Invalid order total") ||
            error.message?.includes("mobile money") ||
            error.message?.includes("required")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const initiatePartialOrderPayment = async (req, res, next) => {
    try {
        const result = await initiatePartialOrderPaymentService(req.user, req.params.id, req.body || {});
        const hasRedirect = result.redirect_url != null;
        if (hasRedirect) {
            handleResponse(res, 200, "Partial payment checkout created.", result);
        } else {
            handleResponse(res, 200, "Partial mobile money charge initiated.", result);
        }
    } catch (error) {
        if (error.message?.includes("Order not found")) {
            return handleResponse(res, 404, error.message);
        }
        if (error.message?.includes("Only the customer")) {
            return handleResponse(res, 403, error.message);
        }
        if (
            error.message?.includes("Payment is available") ||
            error.message?.includes("already fully paid") ||
            error.message?.includes("pay-over-time") ||
            error.message?.includes("Minimum payment") ||
            error.message?.includes("cannot exceed") ||
            error.message?.includes("mobile money") ||
            error.message?.includes("required") ||
            error.message?.includes("greater than zero")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const submitOrderPaymentOtp = async (req, res, next) => {
    try {
        const { reference, otp } = req.body || {};
        const result = await submitOrderPaymentOtpService(req.user, req.params.id, reference, otp);
        handleResponse(res, 200, "OTP submitted.", result);
    } catch (error) {
        if (error.message?.includes("reference and otp")) {
            return handleResponse(res, 400, error.message);
        }
        if (error.message?.includes("Order not found")) {
            return handleResponse(res, 404, error.message);
        }
        if (error.message?.includes("Only the customer") || error.message?.includes("Invalid payment reference")) {
            return handleResponse(res, 403, error.message);
        }
        next(error);
    }
};
