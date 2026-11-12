import cron from "node-cron";
import pool from "../config/db.js";
import {
    getDailySalesSummaryService,
    getSalesPaymentMethodBreakdownService,
    getTopSellingProductsService,
} from "../models/sale.js";
import { createNotificationService } from "../models/notification.js";
import { getUserPermissionsService } from "../models/userRole.js";
import { sendToTokens } from "../services/firebaseMessaging.js";
import { sendEmailService } from "../models/mail.js";
import { button, renderEmail, signInUrl } from "../services/emailLayout.js";

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

function formatReportDate(label) {
    const d = new Date(`${label}T12:00:00`);
    if (Number.isNaN(d.getTime())) return label;
    return d.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Professional daily sales digest (Square / Shopify-style end-of-day report).
 * Only used when the day has at least one sale.
 */
export function buildDailySalesSummaryEmail({
    shopName,
    dateLabel,
    totalSales,
    transactionCount,
    averagePerSale,
    paymentMethods = [],
    topProducts = [],
}) {
    const brand = mailSenderName();
    const prettyDate = formatReportDate(dateLabel);
    const shop = (shopName && String(shopName).trim()) || "your shop";
    const total = formatMoney(totalSales);
    const avg = formatMoney(averagePerSale);
    const count = Number(transactionCount) || 0;
    const saleWord = count === 1 ? "sale" : "sales";
    const methods = Array.isArray(paymentMethods) ? paymentMethods : [];
    const products = Array.isArray(topProducts) ? topProducts : [];

    const paymentTextLines =
        methods.length > 0
            ? [
                  "Payment methods",
                  ...methods.map(
                      (m) =>
                          `  ${m.method}: ${formatMoney(m.totalAmount)} (${Number(m.transactionCount) || 0} txn${
                              Number(m.transactionCount) === 1 ? "" : "s"
                          })`
                  ),
                  "",
              ]
            : [];

    const productTextLines =
        products.length > 0
            ? [
                  "Top products",
                  ...products.map((p, i) => {
                      const name = (p.product_name && String(p.product_name).trim()) || "Unnamed product";
                      const units = Number(p.units_sold) || 0;
                      return `  ${i + 1}. ${name} — ${units} unit${units === 1 ? "" : "s"} · ${formatMoney(p.total_revenue)}`;
                  }),
                  "",
              ]
            : [];

    const subject = `Daily sales report — ${prettyDate}`;
    const title = "Daily sales report";
    const text = [
        `${brand} — Daily sales report`,
        "",
        `Shop: ${shop}`,
        `Date: ${prettyDate}`,
        "",
        `Gross sales: ${total}`,
        `Transactions: ${count} ${saleWord}`,
        `Average sale: ${avg}`,
        "",
        ...paymentTextLines,
        ...productTextLines,
        "Open Shopynn for staff performance and the full product mix.",
        "",
        `You are receiving this because Daily summary is enabled in your notification preferences.`,
        `— ${brand}`,
    ].join("\n");

    const paymentRowsHtml =
        methods.length === 0
            ? ""
            : methods
                  .map((m, idx) => {
                      const border = idx === 0 ? "" : "border-top:1px solid #eef0f3;";
                      return `<tr>
                  <td style="padding:10px 0;${border}font-size:14px;color:#111827;">${escapeHtml(m.method)}</td>
                  <td style="padding:10px 0;${border}font-size:13px;color:#6b7280;text-align:center;">${Number(m.transactionCount) || 0}</td>
                  <td style="padding:10px 0;${border}font-size:14px;font-weight:600;color:#111827;text-align:right;">${escapeHtml(
                      formatMoney(m.totalAmount)
                  )}</td>
                </tr>`;
                  })
                  .join("");

    const paymentSectionHtml =
        methods.length === 0
            ? ""
            : `
              <p style="margin:28px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:600;">Payment methods</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 6px;font-size:11px;color:#9ca3af;">Method</td>
                  <td style="padding:0 0 6px;font-size:11px;color:#9ca3af;text-align:center;">Txns</td>
                  <td style="padding:0 0 6px;font-size:11px;color:#9ca3af;text-align:right;">Amount</td>
                </tr>
                ${paymentRowsHtml}
              </table>`;

    const productRowsHtml =
        products.length === 0
            ? ""
            : products
                  .map((p, idx) => {
                      const name = (p.product_name && String(p.product_name).trim()) || "Unnamed product";
                      const units = Number(p.units_sold) || 0;
                      const border = idx === 0 ? "" : "border-top:1px solid #eef0f3;";
                      return `<tr>
                  <td style="padding:10px 0;${border}font-size:14px;color:#111827;">
                    <span style="display:inline-block;min-width:18px;color:#9ca3af;">${idx + 1}.</span>
                    ${escapeHtml(name)}
                  </td>
                  <td style="padding:10px 0;${border}font-size:13px;color:#6b7280;text-align:center;white-space:nowrap;">${units} sold</td>
                  <td style="padding:10px 0;${border}font-size:14px;font-weight:600;color:#111827;text-align:right;">${escapeHtml(
                      formatMoney(p.total_revenue)
                  )}</td>
                </tr>`;
                  })
                  .join("");

    const productSectionHtml =
        products.length === 0
            ? ""
            : `
              <p style="margin:28px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:600;">Top products</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${productRowsHtml}
              </table>`;

    const html = renderEmail({
        heading: "Daily sales report",
        preheader: `${count} ${saleWord} today totaling ${total}.`,
        footerNote:
            "You're receiving this because Daily summary is turned on in your notification preferences. Quiet days with no sales are skipped.",
        body: `
              <p style="margin:-8px 0 20px;font-size:14px;color:#64748b;">${escapeHtml(shop)} · ${escapeHtml(prettyDate)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 20px 8px;" colspan="2">
                    <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600;">Gross sales</p>
                    <p style="margin:6px 0 0;font-size:32px;line-height:1.2;font-weight:700;color:#0f172a;">${escapeHtml(total)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px 20px;width:50%;vertical-align:top;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;color:#64748b;">Transactions</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:600;color:#0f172a;">${count}</p>
                  </td>
                  <td style="padding:12px 20px 20px;width:50%;vertical-align:top;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;color:#64748b;">Average sale</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:600;color:#0f172a;">${escapeHtml(avg)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:15px;line-height:1.6;color:#334155;">
                You recorded <strong>${count} ${saleWord}</strong> today totaling <strong>${escapeHtml(total)}</strong>.
              </p>
              ${paymentSectionHtml}
              ${productSectionHtml}
              <p style="margin:24px 0 8px;font-size:15px;line-height:1.6;color:#334155;">
                Open Shopynn for staff performance and the full product mix.
              </p>
              ${button(signInUrl(), "Open Shopynn")}`,
    });

    return { subject, title, text, html };
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
        SELECT u.id, u.tenant_id, u.user_type, u.fcm_token, u.email, up.preferences,
               t.name AS tenant_name, t.organization AS tenant_organization
        FROM users u
        INNER JOIN user_preferences up ON up.user_id = u.id
        LEFT JOIN tenants t ON t.id = u.tenant_id
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
    let emailsSent = 0;
    let skippedNoSales = 0;

    for (const row of rows) {
        try {
            const user = await buildSalesUserContext(row);
            const summary = await getDailySalesSummaryService(user, { startDate, endDate });
            const total = Number(summary.totalSales ?? 0);
            const count = Number(summary.transactionCount ?? 0);
            const averagePerSale = Number(summary.averagePerSale ?? 0);
            const title = "Daily sales summary";
            const message = `${label}: ${formatMoney(total)} · ${count} sale${count === 1 ? "" : "s"}.`;

            // No sales today — skip email (and push/in-app) so owners aren't pinged on quiet days.
            if (count <= 0) {
                skippedNoSales += 1;
                continue;
            }

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
                    const shopName = row.tenant_organization || row.tenant_name || null;
                    const rangeQuery = { startDate, endDate };
                    const [paymentMethods, topProducts] = await Promise.all([
                        getSalesPaymentMethodBreakdownService(user, rangeQuery).catch(() => []),
                        getTopSellingProductsService(user, { ...rangeQuery, limit: 5 }).catch(() => []),
                    ]);
                    const email = buildDailySalesSummaryEmail({
                        shopName,
                        dateLabel: label,
                        totalSales: total,
                        transactionCount: count,
                        averagePerSale,
                        paymentMethods,
                        topProducts,
                    });
                    await sendEmailService({
                        sender_name: mailSenderName(),
                        receipient: String(row.email).trim(),
                        from: "noreply",
                        subject: email.subject,
                        title: email.title,
                        message: email.text,
                        text: email.text,
                        html: email.html,
                    });
                    emailsSent += 1;
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

    console.log(
        `[daily-sales-summary-job] Created ${sent} in-app summary(ies), emailed ${emailsSent}, skipped ${skippedNoSales} with no sales for ${label} (${rows.length} opted in).`
    );
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
