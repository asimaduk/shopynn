import pool from "../config/db.js";
import { sendToTokens } from "../services/firebaseMessaging.js";
import { sendEmailService } from "../models/mail.js";
import { sendSmsService, isSmsConfigured } from "../services/sms.js";
import { createNotificationService } from "../models/notification.js";

const FCM_CHUNK = 450;

function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * @param {{ audience: 'myself' | 'all', user: { id: string } }} opts
 */
export async function getBroadcastAudienceService({ audience, user }) {
    if (audience === "myself") {
        const r = await pool.query(
            `SELECT id, email, phone, fcm_token, tenant_id, first_name, last_name
             FROM users
             WHERE id = $1 AND deleted = false AND is_active = true`,
            [user.id]
        );
        return r.rows;
    }

    const r = await pool.query(
        `SELECT id, email, phone, fcm_token, tenant_id, first_name, last_name
         FROM users
         WHERE deleted = false
           AND is_active = true
           AND coalesce(user_type, '') <> 'customer'`
    );
    return r.rows;
}

export async function getBroadcastAudienceCountsService({ audience, user }) {
    const rows = await getBroadcastAudienceService({ audience, user });
    let push = 0;
    let email = 0;
    let sms = 0;
    for (const row of rows) {
        if (String(row.fcm_token || "").trim()) push += 1;
        if (String(row.email || "").trim()) email += 1;
        if (String(row.phone || "").trim()) sms += 1;
    }
    return {
        audience,
        recipients: rows.length,
        push,
        email,
        sms,
        sms_configured: isSmsConfigured(),
    };
}

/**
 * Platform broadcast: push / email / SMS to myself or all staff users.
 */
export async function sendBroadcastService({
    audience = "myself",
    channels = {},
    title,
    body,
    user,
    createInApp = true,
}) {
    const titleTrim = String(title || "").trim();
    const bodyTrim = String(body || "").trim();
    if (!titleTrim) throw new Error("title is required");
    if (!bodyTrim) throw new Error("body is required");

    const wantPush = Boolean(channels.push);
    const wantEmail = Boolean(channels.email);
    const wantSms = Boolean(channels.sms);
    if (!wantPush && !wantEmail && !wantSms) {
        throw new Error("Select at least one channel: push, email, or sms");
    }

    const aud = audience === "all" ? "all" : "myself";
    const recipients = await getBroadcastAudienceService({ audience: aud, user });

    const summary = {
        audience: aud,
        recipients: recipients.length,
        push: { attempted: 0, success: 0, failure: 0 },
        email: { attempted: 0, success: 0, failure: 0 },
        sms: { attempted: 0, success: 0, failure: 0, skipped_unconfigured: 0 },
        in_app: { created: 0 },
    };

    if (wantPush) {
        const tokens = [
            ...new Set(
                recipients
                    .map((r) => String(r.fcm_token || "").trim())
                    .filter(Boolean)
            ),
        ];
        summary.push.attempted = tokens.length;
        for (let i = 0; i < tokens.length; i += FCM_CHUNK) {
            const chunk = tokens.slice(i, i + FCM_CHUNK);
            const result = await sendToTokens(chunk, {
                notification: { title: titleTrim, body: bodyTrim },
                data: {
                    type: "broadcast",
                    title: titleTrim,
                    body: bodyTrim,
                },
            });
            summary.push.success += result.successCount || 0;
            summary.push.failure += result.failureCount || 0;
        }
    }

    if (wantEmail) {
        for (const row of recipients) {
            const to = String(row.email || "").trim();
            if (!to) continue;
            summary.email.attempted += 1;
            try {
                await sendEmailService({
                    sender_name: "Shopynn",
                    receipient: to,
                    subject: titleTrim,
                    text: bodyTrim,
                    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">
                        <h2 style="margin:0 0 12px">${escapeHtml(titleTrim)}</h2>
                        <p style="white-space:pre-wrap;margin:0">${escapeHtml(bodyTrim)}</p>
                    </div>`,
                });
                summary.email.success += 1;
            } catch (err) {
                summary.email.failure += 1;
                console.warn("broadcast email failed", to, err?.message || err);
            }
        }
    }

    if (wantSms) {
        if (!isSmsConfigured()) {
            const withPhone = recipients.filter((r) => String(r.phone || "").trim()).length;
            summary.sms.skipped_unconfigured = withPhone;
        } else {
            for (const row of recipients) {
                const phone = String(row.phone || "").trim();
                if (!phone) continue;
                summary.sms.attempted += 1;
                const result = await sendSmsService({
                    to: phone,
                    message: `${titleTrim}\n${bodyTrim}`.slice(0, 320),
                });
                if (result.ok) summary.sms.success += 1;
                else summary.sms.failure += 1;
            }
        }
    }

    if (createInApp && (wantPush || wantEmail || wantSms)) {
        for (const row of recipients) {
            if (!row.tenant_id || !row.id) continue;
            try {
                await createNotificationService({
                    tenant_id: row.tenant_id,
                    user_id: row.id,
                    type: "broadcast",
                    title: titleTrim,
                    message: bodyTrim,
                    metadata: { source: "platform_broadcast", audience: aud },
                    icon: "bell",
                });
                summary.in_app.created += 1;
            } catch (err) {
                console.warn("broadcast in-app failed", row.id, err?.message || err);
            }
        }
    }

    return summary;
}
