import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_PREFERENCES = {
    notifications: {
        push: true,
        email: true,
        types: ["low_stock", "new_sale", "expiring_stock", "order_created", "general"],
    },
    locale: "en",
    timezone: "UTC",
};

/**
 * Get preferences for a user. Returns merged default + stored preferences.
 * Only the owning user should call this (enforced by controller).
 */
export const getPreferencesService = async (userId) => {
    const result = await pool.query(
        "SELECT preferences FROM user_preferences WHERE user_id = $1",
        [userId]
    );
    const stored = result.rows[0]?.preferences;
    const prefs = typeof stored === "object" && stored !== null ? stored : {};

    //check where these keys are present and delete them
    if (prefs['tenant_id']) {
        delete prefs['tenant_id'];
    }
    if (prefs['creator_id']) {
        delete prefs['creator_id'];
    }
    if (prefs['warehouse_id']) {
        delete prefs['warehouse_id'];
    }

    return deepMerge({ ...DEFAULT_PREFERENCES }, prefs);
};

/**
 * Update preferences for a user. Merges payload into existing (or creates row).
 * Payload can be partial, e.g. { notifications: { push: false } }.
 */
export const updatePreferencesService = async (userId, payload) => {
    if (!payload || typeof payload !== "object") {
        return getPreferencesService(userId);
    }

    const existing = await pool.query(
        "SELECT id, preferences FROM user_preferences WHERE user_id = $1",
        [userId]
    );

    const current = existing.rows[0]?.preferences;
    const base = typeof current === "object" && current !== null ? current : {};
    const merged = deepMerge({ ...base }, payload);

    const now = new Date();

    if (existing.rows.length === 0) {
        const id = uuidv4();
        await pool.query(
            `INSERT INTO user_preferences (id, user_id, preferences, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $4)`,
            [id, userId, JSON.stringify(merged), now]
        );
    } else {
        await pool.query(
            "UPDATE user_preferences SET preferences = $1, updated_at = $2 WHERE user_id = $3",
            [JSON.stringify(merged), now, userId]
        );
    }

    return getPreferencesService(userId);
};

function deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key]) &&
            target[key] &&
            typeof target[key] === "object" &&
            !Array.isArray(target[key])
        ) {
            out[key] = deepMerge({ ...target[key] }, source[key]);
        } else {
            out[key] = source[key];
        }
    }
    return out;
}
