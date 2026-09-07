import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const normalizeVersion = (v) => String(v || "").trim();

const compareVersions = (a, b) => {
    const pa = normalizeVersion(a).split(".").map((n) => Number(n) || 0);
    const pb = normalizeVersion(b).split(".").map((n) => Number(n) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const va = pa[i] || 0;
        const vb = pb[i] || 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
};

export const createAppVersionService = async (payload = {}) => {
    const {
        platform,
        latest_version,
        min_supported_version = latest_version,
        force_update = false,
        status = "active",
        store_url = null,
        release_notes = null,
    } = payload;

    if (!platform || !latest_version) {
        throw new Error("platform and latest_version are required.");
    }

    const id = uuidv4();
    const now = new Date();
    const result = await pool.query(
        `INSERT INTO app_versions
            (id, platform, latest_version, min_supported_version, force_update, status, store_url, release_notes, created_at, updated_at)
         VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING *`,
        [
            id,
            String(platform).toLowerCase(),
            String(latest_version).trim(),
            String(min_supported_version).trim(),
            Boolean(force_update),
            status,
            store_url,
            release_notes,
            now,
        ]
    );
    return result.rows[0];
};

export const getAppVersionsService = async (requestQuery = {}) => {
    const platform = requestQuery.platform ? String(requestQuery.platform).toLowerCase() : null;
    const status = requestQuery.status || null;
    const conditions = [];
    const params = [];
    let i = 1;

    if (platform) {
        conditions.push(`platform = $${i++}`);
        params.push(platform);
    }
    if (status) {
        conditions.push(`status = $${i++}`);
        params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT id, platform, latest_version, min_supported_version, force_update, status, store_url, release_notes, created_at, updated_at
         FROM app_versions
         ${where}
         ORDER BY created_at DESC`,
        params
    );
    return result.rows;
};

export const getActiveAppVersionService = async (platform) => {
    const result = await pool.query(
        `SELECT id, platform, latest_version, min_supported_version, force_update, status, store_url, release_notes, created_at, updated_at
         FROM app_versions
         WHERE platform = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [String(platform).toLowerCase()]
    );
    return result.rows[0] || null;
};

export const checkAppVersionStatusService = async (payload = {}) => {
    const { platform, current_version } = payload;
    if (!platform || !current_version) {
        throw new Error("platform and current_version are required.");
    }

    const config = await getActiveAppVersionService(platform);
    if (!config) {
        return {
            platform: String(platform).toLowerCase(),
            current_version: String(current_version),
            update_status: "no_config",
            update_required: false,
            update_available: false,
            latest_version: null,
            min_supported_version: null,
            force_update: false,
            store_url: null,
            release_notes: null,
        };
    }

    const current = normalizeVersion(current_version);
    const latest = normalizeVersion(config.latest_version);
    const min = normalizeVersion(config.min_supported_version);

    const belowMin = compareVersions(current, min) < 0;
    const belowLatest = compareVersions(current, latest) < 0;

    const updateRequired = belowMin || Boolean(config.force_update && belowLatest);
    const updateAvailable = belowLatest;

    return {
        platform: config.platform,
        current_version: current,
        latest_version: latest,
        min_supported_version: min,
        force_update: Boolean(config.force_update),
        update_required: updateRequired,
        update_available: updateAvailable,
        update_status: updateRequired
            ? "update_required"
            : updateAvailable
              ? "update_available"
              : "up_to_date",
        store_url: config.store_url,
        release_notes: config.release_notes,
    };
};

