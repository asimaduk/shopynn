import { escapeHtml } from "../util/escapeHtml.js";

/**
 * Shared HTML shell and building blocks for every Shopynn email.
 * Table layout with inline styles so it renders the same in Gmail, Outlook and phone mail apps.
 * Block helpers return HTML strings; callers escape user-provided text before passing it in.
 */

const C = {
    brand: "#0A74DA",
    brandDark: "#085CAD",
    ink: "#0f172a",
    body: "#334155",
    muted: "#64748b",
    faint: "#94a3b8",
    border: "#e2e8f0",
    panel: "#f8fafc",
    page: "#f1f5f9",
    warnBg: "#fff7ed",
    warnBorder: "#fdba74",
    warnInk: "#9a3412",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

const siteUrl = () => (process.env.MAIL_SITE_URL || "https://shopynn.app").replace(/\/$/, "");
const logoUrl = () => process.env.MAIL_LOGO_URL || `${siteUrl()}/logo/shopynn-icon.png`;
const supportAddress = () => `support@${(process.env.MAIL_DOMAIN || "shopynn.app").trim().toLowerCase()}`;

/** Dashboard sign-in page for links in account emails. */
export const signInUrl = () => `${(process.env.WEB_APP_URL || "https://dashboard.shopynn.app").replace(/\/$/, "")}/sign-in`;

export const paragraph = (html, { muted = false, small = false } = {}) =>
    `<p style="margin:0 0 16px;font-size:${small ? 13 : 15}px;line-height:1.6;color:${muted ? C.muted : C.body};">${html}</p>`;

export const greeting = (name) => paragraph(`Hi ${escapeHtml(name || "there")},`);

/** Large one-time code, easy to read and copy on a phone. */
export const codeBlock = (code, caption = "") => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
  <tr><td align="center" style="background:${C.panel};border:1px solid ${C.border};border-radius:10px;padding:22px 16px;">
    <div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:8px;color:${C.ink};">${escapeHtml(code)}</div>
    ${caption ? `<div style="margin-top:8px;font-size:13px;color:${C.muted};">${caption}</div>` : ""}
  </td></tr>
</table>`;

/** Label / value rows in a bordered panel (sign-in details, invoice summary, stock alert). */
export const detailsTable = (rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${C.panel};border:1px solid ${C.border};border-radius:10px;">
  ${rows
      .map(
          ([label, value, opts = {}], i) => `<tr>
    <td style="padding:12px 16px;${i ? `border-top:1px solid ${C.border};` : ""}font-size:13px;color:${C.muted};width:42%;vertical-align:top;">${label}</td>
    <td style="padding:12px 16px;${i ? `border-top:1px solid ${C.border};` : ""}font-size:${opts.mono ? 16 : 14}px;font-weight:600;color:${C.ink};${opts.mono ? `font-family:${MONO};letter-spacing:1px;` : ""}word-break:break-word;overflow-wrap:anywhere;">${value}</td>
  </tr>`,
      )
      .join("")}
</table>`;

export const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
  <tr><td style="border-radius:8px;background:${C.brand};">
    <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
  </td></tr>
</table>`;

/** Highlighted note; `warning` for security-sensitive messages. */
export const notice = (html, tone = "info") => {
    const warn = tone === "warning";
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
  <tr><td style="background:${warn ? C.warnBg : "#eff6ff"};border-left:4px solid ${warn ? C.warnBorder : C.brand};border-radius:6px;padding:12px 16px;font-size:13px;line-height:1.55;color:${warn ? C.warnInk : C.body};">${html}</td></tr>
</table>`;
};

export const steps = (items) => `
<ol style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:${C.body};">
  ${items.map((item) => `<li style="margin-bottom:4px;">${item}</li>`).join("")}
</ol>`;

export const signoff = (from = "The Shopynn team") => paragraph(`Regards,<br/>${escapeHtml(from)}`);

/** Escaped free text with line breaks kept (staff replies, broadcasts). */
export const textBlock = (text) => paragraph(escapeHtml(text).replace(/\r?\n/g, "<br/>"));

/**
 * Full email document.
 * `body`: HTML string or array of block strings. `brandName`: header name (a shop name for invoices).
 * `showLogo`: Shopynn mark in the header. `footerNote`: why they got it / how to opt out (HTML).
 * `helpHtml`: replaces the Shopynn support line (e.g. invoices, where replies go to the shop).
 */
export function renderEmail({ heading, body, preheader = "", brandName = "Shopynn", showLogo = true, footerNote = "", helpHtml }) {
    const content = Array.isArray(body) ? body.join("\n") : body;
    const brand = escapeHtml(brandName);
    const site = siteUrl();
    const logo = showLogo
        ? `<td style="padding-right:10px;vertical-align:middle;"><img src="${logoUrl()}" width="32" height="32" alt="" style="display:block;border:0;width:32px;height:32px;border-radius:8px;" /></td>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          ${logo}
          <td style="vertical-align:middle;font-size:18px;font-weight:700;color:${C.ink};letter-spacing:-0.2px;">${brand}</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
        <div style="height:4px;background:${C.brand};line-height:4px;font-size:0;">&nbsp;</div>
        <div style="padding:32px 32px 16px;">
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};">${escapeHtml(heading)}</h1>
          ${content}
        </div>
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${C.faint};text-align:center;">
        ${footerNote ? `<p style="margin:0 0 8px;">${footerNote}</p>` : ""}
        <p style="margin:0 0 4px;">${helpHtml ?? `Need help? Reply to this email or write to <a href="mailto:${supportAddress()}" style="color:${C.muted};">${supportAddress()}</a>.`}</p>
        <p style="margin:0;">${showLogo ? "Shopynn · Run your whole shop from your phone · " : "Sent with Shopynn · "}<a href="${site}" style="color:${C.muted};">${site.replace(/^https?:\/\//, "")}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
