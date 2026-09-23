/** POS sale credit / partial payment helpers (mirrors order installments). */

export const toMoney = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/** payment_status integers on sales: 0=unpaid/on_credit, 1=paid, 2=partial */
export const salePaymentStatusFromAmounts = (totalAmount, amountPaid) => {
    const total = toMoney(totalAmount);
    const paid = toMoney(amountPaid);
    if (total <= 0) return 1;
    if (paid <= 0.001) return 0;
    if (paid + 0.02 >= total) return 1;
    return 2;
};

export const normalizeSalePaymentMethod = (method, paymentType) => {
    const m = String(method || "").trim().toLowerCase();
    if (m === "momo" || m === "mobile_money") return "momo";
    if (m === "cash") return "cash";
    if (m === "store_credit" || m === "credit") return "store_credit";
    if (m === "card" || m === "bank") return m === "card" ? "card" : "bank";
    if (m === "other") return "other";
    const t = Number(paymentType);
    if (t === 2) return "momo";
    if (t === 3) return "bank";
    if (t === 4) return "other";
    if (t === 1) return "cash";
    return m || "cash";
};

export const paymentTypeFromMethod = (method) => {
    const m = normalizeSalePaymentMethod(method);
    if (m === "momo") return 2;
    if (m === "bank" || m === "card") return 3;
    if (m === "other") return 4;
    return 1;
};

/**
 * Resolve amount_paid / balance_due / payment_status for a new sale.
 * - amount_paid payload wins when provided
 * - else full pay when tender covers total or MoMo confirmed
 * - customer required when not fully paid
 */
export function resolveSaleCreditAmounts({
    totalAmount,
    amount_paid: amountPaidRaw,
    customer_id,
    isMomo,
    isCash,
    resolvedTendered,
    payment_status: paymentStatusRaw,
}) {
    const total = toMoney(totalAmount);
    let amountPaid;

    if (amountPaidRaw != null && String(amountPaidRaw).trim() !== "") {
        amountPaid = toMoney(amountPaidRaw);
    } else if (isMomo) {
        amountPaid = total;
    } else if (isCash && resolvedTendered != null) {
        // Cash tendered for change: if tender >= total, fully paid; else treat tender as amount paid (partial)
        const tendered = toMoney(resolvedTendered);
        amountPaid = tendered + 0.001 >= total ? total : tendered;
    } else if (paymentStatusRaw === 0 || paymentStatusRaw === "0" || paymentStatusRaw === "unpaid") {
        amountPaid = 0;
    } else {
        amountPaid = total;
    }

    if (amountPaid < 0) amountPaid = 0;
    if (amountPaid > total + 0.02) amountPaid = total;

    const balanceDue = toMoney(Math.max(0, total - amountPaid));
    const paymentStatus = salePaymentStatusFromAmounts(total, amountPaid);

    if (balanceDue > 0.02 && !customer_id) {
        const err = new Error("A customer is required for credit or partial payment sales.");
        err.status = 400;
        err.code = "CUSTOMER_REQUIRED_FOR_CREDIT";
        throw err;
    }

    return { amountPaid: toMoney(amountPaid), balanceDue, paymentStatus };
}
