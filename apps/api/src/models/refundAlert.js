/**
 * Tells shop owners when someone else records a customer refund, so a staff refund can't go unnoticed.
 */

import pool from "../config/db.js";
import { createNotificationService } from "./notification.js";

const formatAmount = (value) => Number(value || 0).toFixed(2);

async function loadOwnerRows(tenantId, excludeUserId) {
    const r = await pool.query(
        `SELECT DISTINCT u.id, u.fcm_token
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id AND (r.tenant_id = u.tenant_id OR r.tenant_id IS NULL)
         WHERE u.tenant_id = $1
           AND u.id <> $2
           AND COALESCE(u.is_active, true) = true
           AND COALESCE(u.deleted, false) = false
           AND (u.user_type = 1 OR lower(coalesce(r.name, '')) = 'super admin')`,
        [tenantId, excludeUserId || ""]
    );
    return r.rows;
}

export async function notifyOwnersOfRefundService(actor, created) {
    const refund = Number(created?.refund_amount || 0);
    if (!created?.id || !actor?.tenant_id || !(refund > 0)) return;

    const owners = await loadOwnerRows(actor.tenant_id, actor.id);
    if (owners.length === 0) return;

    const by = await pool.query(
        `SELECT trim(concat_ws(' ', first_name, last_name)) AS name FROM users WHERE id = $1`,
        [actor.id]
    );
    const who = by.rows[0]?.name || "A staff member";
    const method = String(created.refund_method || "").replace(/_/g, " ");
    const ref = created.reference_number || "a return";
    const title = "Refund recorded";
    const message = `${who} refunded GHS ${formatAmount(refund)}${method ? ` (${method})` : ""} on ${ref}.`;

    await Promise.all(
        owners.map((row) =>
            createNotificationService({
                tenant_id: actor.tenant_id,
                user_id: row.id,
                type: "refund_recorded",
                title,
                message,
                metadata: { return_id: created.id, refund_amount: refund, refund_method: created.refund_method, actor_id: actor.id },
                link: `/trading/sales/returns/${created.id}`,
                mobile_screen: "ReturnDetails",
                mobile_params: { returnId: created.id },
            }).catch(() => null)
        )
    );

    const tokens = [...new Set(owners.map((row) => String(row.fcm_token || "").trim()).filter(Boolean))];
    if (tokens.length === 0) return;
    const { sendToTokens } = await import("../services/firebaseMessaging.js");
    await sendToTokens(tokens, {
        notification: { title, body: message },
        data: {
            type: "refund_recorded",
            return_id: String(created.id),
            mobile_screen: "ReturnDetails",
        },
    });
}
