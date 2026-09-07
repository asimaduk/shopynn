import cron from "node-cron";
import pool from "../config/db.js";
import { getDailySalesSummaryService } from "../models/sale.js";
import { createNotificationService } from "../models/notification.js";
import { getUserPermissionsService } from "../models/userRole.js";
import { sendToTokens } from "../services/firebaseMessaging.js";
import { sendEmailService } from "../models/mail.js";

/** 9:00 PM every day (server local time unless DAILY_SALES_SUMMARY_CRON_TZ is set). */
const DEFAULT_CRON = "0 21 * * *";

function cronExpr() {
    return process.env.DAILY_SALES_SUMMARY_CRON?.trim() || DEFAULT_CRON;
}

/**
 * Matches cheqstock `notifications_setup.js` / ims-web `NotificationsTab` — `types` can be
 * an object `{ dailySummary: true, ... }` or legacy string array including `"dailySummary"`.
 */
function isDailySummaryOptIn(prefs) {
    if (!prefs || typeof prefs !== "object") return false;
    const types = prefs.notifications?.types;
    if (!types) return false;
    if (Array.isArray(types)) return types.includes("dailySummary");
    if (typeof types === "object") return types.dailySummary === true;
    return false;
}

function wantsPush(prefs) {
    if (!prefs?.notifications || typeof prefs.notifications !== "object") return true;
    return prefs.notifications.push !== false;
}

/** Mirrors `userPreferences` default `notifications.email: true`. */
function wantsEmail(prefs) {
    if (!prefs?.notifications || typeof prefs.notifications !== "object") return true;
    return prefs.notifications.email !== false;
}

function mailSenderName() {
    return process.env.MAIL_SENDER_NAME?.trim() || "Shopynn";
}

function looksLikeEmail(s) {
    const t = String(s ?? "").trim();
    return t.length > 3 && t.includes("@") && !t.includes(" ");
}

function formatMoney(n) {
    try {
        return new Intl.NumberFormat("en-GH", {
            style: "currency",
            currency: "GHS",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
            .format(Number(n) || 0)
            .replace("GH₵", "GHS ");
    } catch {
        return `GHS ${(Number(n) || 0).toFixed(2)}`;
    }
}

/** Calendar day bounds in the server process timezone (same as subscription-style jobs). */
function todayLocalRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return {
        startDate: start.toISOString(),
        endDate: endDay.toISOString(),
        label,
    };
}

async function loadDailySummarySubscriberRows() {
    const result = await pool.query(`
        SELECT u.id, u.tenant_id, u.user_type, u.fcm_token, u.email, up.preferences
        FROM users u
        INNER JOIN user_preferences up ON up.user_id = u.id
        WHERE COALESCE(u.is_active, true) = true
          AND COALESCE(u.deleted, false) = false
    `);
    return result.rows.filter((row) => isDailySummaryOptIn(row.preferences));
}

async function buildSalesUserContext(row) {
    const permissions = await getUserPermissionsService(row.id, row.tenant_id).catch(() => []);
    return {
        id: row.id,
        tenant_id: row.tenant_id,
        user_type: row.user_type ?? undefined,
        permissions,
    };
}

export async function runDailySalesSummaryNotifications() {
    const { startDate, endDate, label } = todayLocalRange();
    const rows = await loadDailySummarySubscriberRows();
    let sent = 0;

    for (const row of rows) {
        try {
            const user = await buildSalesUserContext(row);
            const summary = await getDailySalesSummaryService(user, { startDate, endDate });
            const total = Number(summary.totalSales ?? 0);
            const count = Number(summary.transactionCount ?? 0);
            const title = "Daily sales summary";
            const message = `${label}: ${formatMoney(total)} · ${count} sale${count === 1 ? "" : "s"}.`;

            await createNotificationService({
                tenant_id: row.tenant_id,
                user_id: row.id,
                type: "daily_sales_summary",
                title,
                message,
                metadata: { date: label, totalSales: total, transactionCount: count },
                icon: null,
                mobile_screen: "DailySales",
            });

            if (wantsPush(row.preferences) && row.fcm_token) {
                await sendToTokens(row.fcm_token, {
                    notification: { title, body: message },
                    data: {
                        type: "daily_sales_summary",
                        date: label,
                        totalSales: String(total),
                        transactionCount: String(count),
                    },
                });
            }

            if (wantsEmail(row.preferences) && looksLikeEmail(row.email)) {
                try {
                    await sendEmailService({
                        sender_name: mailSenderName(),
                        receipient: String(row.email).trim(),
                        subject: `Daily sales summary — ${label}`,
                        title,
                        message: `${message}\n\nYou are receiving this because Daily summary is enabled in your notification preferences.`,
                    });
                } catch (emailErr) {
                    console.error(
                        `[daily-sales-summary-job] Email failed for user ${row.id}:`,
                        emailErr?.message || emailErr
                    );
                }
            }
            sent += 1;
        } catch (err) {
            console.error(`[daily-sales-summary-job] User ${row.id}:`, err?.message || err);
        }
    }

    console.log(`[daily-sales-summary-job] Created ${sent} in-app summary(ies) for ${label} (${rows.length} opted in).`);
    return sent;
}

export function startDailySalesSummaryNotificationJob() {
    if (process.env.DAILY_SALES_SUMMARY_JOB_ENABLED === "false") {
        console.log("[daily-sales-summary-job] Disabled via DAILY_SALES_SUMMARY_JOB_ENABLED=false.");
        return;
    }

    const expr = cronExpr();
    const tz = process.env.DAILY_SALES_SUMMARY_CRON_TZ?.trim();
    const opts = tz ? { timezone: tz } : {};

    cron.schedule(
        expr,
        async () => {
            try {
                await runDailySalesSummaryNotifications();
            } catch (err) {
                console.error("[daily-sales-summary-job] Run failed:", err);
            }
        },
        opts
    );

    console.log(
        `[daily-sales-summary-job] Scheduled "${expr}"${tz ? ` (timezone: ${tz})` : " (server local time)"}.`
    );
}
