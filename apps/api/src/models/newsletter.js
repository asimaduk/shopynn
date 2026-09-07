import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { sendEmailService } from "./mail.js";
import { isValidEmail, normalizeEmail } from "../utils/emailNormalize.js";

const BRAND_NAME = "Shopynn";

export const subscribeNewsletterService = async ({ email, source = "website" }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
        throw new Error("A valid email address is required.");
    }

    const existing = await pool.query(
        `SELECT id, status FROM newsletter_subscribers WHERE lower(email) = $1 LIMIT 1`,
        [normalized]
    );

    const now = new Date();
    if (existing.rowCount > 0) {
        const row = existing.rows[0];
        if (row.status === "active") {
            return { subscriber: { id: row.id, email: normalized, status: "active" }, alreadySubscribed: true };
        }
        const updated = await pool.query(
            `UPDATE newsletter_subscribers
             SET status = 'active', subscribed_at = $2, unsubscribed_at = NULL, source = COALESCE($3, source), updated_at = $2
             WHERE id = $1
             RETURNING *`,
            [row.id, now, source || null]
        );
        return { subscriber: updated.rows[0], alreadySubscribed: false, reactivated: true };
    }

    const id = uuidv4();
    const inserted = await pool.query(
        `INSERT INTO newsletter_subscribers (id, email, status, source, subscribed_at, created_at, updated_at)
         VALUES ($1, $2, 'active', $3, $4, $4, $4)
         RETURNING *`,
        [id, normalized, source || null, now]
    );
    return { subscriber: inserted.rows[0], alreadySubscribed: false };
};

export const unsubscribeNewsletterService = async ({ email }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
        throw new Error("A valid email address is required.");
    }

    const now = new Date();
    const result = await pool.query(
        `UPDATE newsletter_subscribers
         SET status = 'unsubscribed', unsubscribed_at = $2, updated_at = $2
         WHERE lower(email) = $1 AND status = 'active'
         RETURNING *`,
        [normalized, now]
    );
    return { subscriber: result.rows[0] || null };
};

export const listNewsletterSubscribersService = async (query = {}) => {
    const conditions = [];
    const params = [];
    let idx = 1;

    const status = query.status ? String(query.status).toLowerCase() : null;
    if (status) {
        conditions.push(`status = $${idx++}`);
        params.push(status);
    }

    const search = query.q ?? query.search;
    if (search && String(search).trim()) {
        conditions.push(`email ILIKE $${idx++}`);
        params.push(`%${String(search).trim()}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT id, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at
         FROM newsletter_subscribers
         ${where}
         ORDER BY subscribed_at DESC NULLS LAST, created_at DESC`,
        params
    );
    return result.rows;
};

export const updateNewsletterSubscriberStatusService = async (id, status) => {
    const normalizedStatus = String(status || "").toLowerCase();
    if (!["active", "unsubscribed"].includes(normalizedStatus)) {
        throw new Error("status must be active or unsubscribed.");
    }
    const now = new Date();
    const result = await pool.query(
        `UPDATE newsletter_subscribers
         SET status = $2,
             subscribed_at = CASE WHEN $2 = 'active' THEN COALESCE(subscribed_at, $3) ELSE subscribed_at END,
             unsubscribed_at = CASE WHEN $2 = 'unsubscribed' THEN $3 ELSE NULL END,
             updated_at = $3
         WHERE id = $1
         RETURNING *`,
        [id, normalizedStatus, now]
    );
    return result.rows[0] || null;
};

export const listNewsletterCampaignsService = async (query = {}) => {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.status) {
        conditions.push(`c.status = $${idx++}`);
        params.push(String(query.status).toLowerCase());
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT c.*, u.first_name AS sent_by_first_name, u.last_name AS sent_by_last_name, u.email AS sent_by_email
         FROM newsletter_campaigns c
         LEFT JOIN users u ON u.id = c.sent_by
         ${where}
         ORDER BY COALESCE(c.sent_at, c.created_at) DESC`,
        params
    );
    return result.rows;
};

export const getNewsletterCampaignByIdService = async (id) => {
    const campaignRes = await pool.query(
        `SELECT c.*, u.first_name AS sent_by_first_name, u.last_name AS sent_by_last_name, u.email AS sent_by_email
         FROM newsletter_campaigns c
         LEFT JOIN users u ON u.id = c.sent_by
         WHERE c.id = $1`,
        [id]
    );
    if (campaignRes.rowCount === 0) return null;

    const recipientsRes = await pool.query(
        `SELECT id, campaign_id, subscriber_id, email, status, sent_at, error_message, created_at
         FROM newsletter_campaign_recipients
         WHERE campaign_id = $1
         ORDER BY created_at`,
        [id]
    );

    return { campaign: campaignRes.rows[0], recipients: recipientsRes.rows };
};

export const createNewsletterCampaignService = async (payload = {}, userId = null) => {
    const subject = String(payload.subject || "").trim();
    if (!subject) throw new Error("subject is required.");

    const id = uuidv4();
    const now = new Date();
    const result = await pool.query(
        `INSERT INTO newsletter_campaigns (id, subject, body_html, body_text, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'draft', $5, $5)
         RETURNING *`,
        [id, subject, payload.body_html || null, payload.body_text || null, now]
    );
    return result.rows[0];
};

export const updateNewsletterCampaignService = async (id, payload = {}) => {
    const existing = await pool.query(`SELECT status FROM newsletter_campaigns WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return null;
    if (existing.rows[0].status === "sent") {
        throw new Error("Sent newsletters cannot be edited.");
    }

    const subject = payload.subject !== undefined ? String(payload.subject).trim() : null;
    if (subject !== null && !subject) throw new Error("subject cannot be empty.");

    const now = new Date();
    const result = await pool.query(
        `UPDATE newsletter_campaigns
         SET subject = COALESCE($2, subject),
             body_html = COALESCE($3, body_html),
             body_text = COALESCE($4, body_text),
             updated_at = $5
         WHERE id = $1 AND status = 'draft'
         RETURNING *`,
        [id, subject, payload.body_html ?? null, payload.body_text ?? null, now]
    );
    return result.rows[0] || null;
};

export const sendNewsletterCampaignService = async (id, userId) => {
    const campaignRes = await pool.query(`SELECT * FROM newsletter_campaigns WHERE id = $1`, [id]);
    if (campaignRes.rowCount === 0) return null;

    const campaign = campaignRes.rows[0];
    if (campaign.status === "sent") {
        throw new Error("This newsletter was already sent.");
    }
    if (!String(campaign.subject || "").trim()) {
        throw new Error("subject is required before sending.");
    }

    const subscribersRes = await pool.query(
        `SELECT id, email FROM newsletter_subscribers WHERE status = 'active' ORDER BY subscribed_at`
    );
    const subscribers = subscribersRes.rows;
    if (subscribers.length === 0) {
        throw new Error("No active subscribers to send to.");
    }

    const htmlBody =
        campaign.body_html ||
        `<div style="font-family:sans-serif;line-height:1.5">${(campaign.body_text || "").replace(/\n/g, "<br/>")}</div>`;
    const textBody = campaign.body_text || String(campaign.body_html || "").replace(/<[^>]+>/g, " ");

    let sentCount = 0;
    const now = new Date();

    for (const sub of subscribers) {
        const recipientId = uuidv4();
        await pool.query(
            `INSERT INTO newsletter_campaign_recipients (id, campaign_id, subscriber_id, email, status, created_at)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [recipientId, id, sub.id, sub.email, now]
        );

        try {
            await sendEmailService({
                sender_name: BRAND_NAME,
                receipient: sub.email,
                subject: campaign.subject,
                html: htmlBody,
                text: textBody,
            });
            await pool.query(
                `UPDATE newsletter_campaign_recipients SET status = 'sent', sent_at = $2 WHERE id = $1`,
                [recipientId, now]
            );
            sentCount += 1;
        } catch (err) {
            await pool.query(
                `UPDATE newsletter_campaign_recipients
                 SET status = 'failed', error_message = $2
                 WHERE id = $1`,
                [recipientId, String(err?.message || err).slice(0, 500)]
            );
        }
    }

    const updated = await pool.query(
        `UPDATE newsletter_campaigns
         SET status = 'sent', sent_at = $2, sent_by = $3, recipient_count = $4, updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [id, now, userId || null, sentCount]
    );

    return { campaign: updated.rows[0], sentCount, totalSubscribers: subscribers.length };
};
