import fs from "node:fs/promises";
import path from "node:path";

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Sender mailboxes. Each email picks one by purpose (`from: "support"`); the address is
 * `<local>@MAIL_DOMAIN` unless overridden with MAIL_FROM_<NAME> (e.g. MAIL_FROM_SUPPORT).
 * Every address must be on a domain verified in Resend.
 */
const SENDERS = {
    noreply: { local: "no-reply", name: "Shopynn" },
    support: { local: "support", name: "Shopynn Support" },
    billing: { local: "billing", name: "Shopynn Billing" },
    hello: { local: "hello", name: "Shopynn" },
};

const DEFAULT_SENDER = "noreply";

const mailDomain = () => (process.env.MAIL_DOMAIN || "shopynn.app").trim().toLowerCase();

export const senderAddress = (key) => {
    const sender = SENDERS[key] ? key : DEFAULT_SENDER;
    const override = process.env[`MAIL_FROM_${sender.toUpperCase()}`]?.trim();
    return override || `${SENDERS[sender].local}@${mailDomain()}`;
};

const formatAddress = (name, address) => {
    const clean = String(name || "").replace(/["<>\r\n]/g, "").trim();
    return clean ? `${clean} <${address}>` : address;
};

const toList = (value) => {
    if (!value) return [];
    const list = Array.isArray(value) ? value : String(value).split(",");
    return list.map((v) => String(v).trim()).filter(Boolean);
};

/**
 * Resolves who an email is from and where replies go.
 * `from` is a sender key (noreply, support, billing, hello); unknown keys fall back to noreply.
 * no-reply mail gets Reply-To support@ unless the caller sets `reply_to`.
 */
export const resolveSender = ({ from, sender_name, reply_to } = {}) => {
    const key = SENDERS[from] ? from : DEFAULT_SENDER;
    const address = senderAddress(key);
    const replyTo = toList(reply_to);
    if (!replyTo.length && key === "noreply") replyTo.push(senderAddress("support"));
    return {
        from: formatAddress(sender_name || SENDERS[key].name, address),
        replyTo,
    };
};

const toResendAttachment = async (att) => {
    let content = att.content;
    if (content == null && att.path) content = await fs.readFile(att.path);
    if (content == null) return null;
    const base64 = Buffer.isBuffer(content)
        ? content.toString("base64")
        : att.encoding === "base64"
          ? String(content)
          : Buffer.from(String(content)).toString("base64");
    const out = { filename: att.filename || (att.path ? path.basename(att.path) : "attachment"), content: base64 };
    if (att.contentType) out.content_type = att.contentType;
    if (att.cid) out.content_id = att.cid;
    return out;
};

export const buildResendPayload = async (data) => {
    const { receipient, subject, title, message, bcc, text, html, attachments } = data;
    const { from, replyTo } = resolveSender(data);
    const payload = {
        from,
        to: toList(receipient),
        subject,
        html: html ?? `<b>${title ?? ""}</b>\n<p>${message ?? ""}</p>`,
    };
    if (text) payload.text = text;
    const bccList = toList(bcc);
    if (bccList.length) payload.bcc = bccList;
    if (replyTo.length) payload.reply_to = replyTo;
    if (Array.isArray(attachments) && attachments.length > 0) {
        payload.attachments = (await Promise.all(attachments.map(toResendAttachment))).filter(Boolean);
    }
    return payload;
};

export const sendEmailService = async (data) => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Email is not configured (RESEND_API_KEY is missing).");

    const payload = await buildResendPayload(data);
    if (!payload.to.length) throw new Error("Email has no recipient.");

    const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`Resend ${res.status}: ${body?.message || body?.name || "send failed"}`);
    }
    console.log("Message sent:", body.id);
    return { messageId: body.id };
};
