import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_PLATFORMS = new Set(["ios", "android"]);

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

const normalizePlatform = (platform) => String(platform || "").trim().toLowerCase();

const assertPlatform = (platform) => {
    const p = normalizePlatform(platform);
    if (!ALLOWED_PLATFORMS.has(p)) {
        throw Object.assign(new Error("platform must be ios or android."), { status: 400 });
    }
    return p;
};

const assertVersion = (value, fieldName) => {
    const v = normalizeVersion(value);
    if (!v) {
        throw Object.assign(new Error(`${fieldName} is required.`), { status: 400 });
    }
    if (!/^\d+(\.\d+)*$/.test(v)) {
        throw Object.assign(
            new Error(`${fieldName} must look like 1.0.0 (digits and dots only).`),
            { status: 400 }
        );
    }
    return v;
};

const deactivateOtherActiveForPlatform = async (client, platform, exceptId = null) => {
    if (exceptId) {
        await client.query(
            `UPDATE app_versions
             SET status = 'inactive', updated_at = now()
             WHERE platform = $1 AND status = 'active' AND id <> $2`,
            [platform, exceptId]
        );
        return;
    }
    await client.query(
        `UPDATE app_versions
         SET status = 'inactive', updated_at = now()
         WHERE platform = $1 AND status = 'active'`,
        [platform]
    );
};

export const createAppVersionService = async (payload = {}) => {
    const platform = assertPlatform(payload.platform);
    const latest_version = assertVersion(payload.latest_version, "latest_version");
    const min_supported_version = assertVersion(
        payload.min_supported_version ?? latest_version,
        "min_supported_version"
    );
    const force_update = Boolean(payload.force_update);
    const status = String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active";
    const store_url = payload.store_url ? String(payload.store_url).trim() : null;
    const release_notes = payload.release_notes ? String(payload.release_notes).trim().slice(0, 1000) : null;

    const id = uuidv4();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (status === "active") {
            await deactivateOtherActiveForPlatform(client, platform);
        }
        const result = await client.query(
            `INSERT INTO app_versions
                (id, platform, latest_version, min_supported_version, force_update, status, store_url, release_notes, created_at, updated_at)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
             RETURNING *`,
            [id, platform, latest_version, min_supported_version, force_update, status, store_url, release_notes]
        );
        await client.query("COMMIT");
        return result.rows[0];
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};

export const updateAppVersionService = async (id, payload = {}) => {
    if (!id) {
        throw Object.assign(new Error("id is required."), { status: 400 });
    }

    const existing = await pool.query(`SELECT * FROM app_versions WHERE id = $1`, [id]);
    const row = existing.rows[0];
    if (!row) {
        throw Object.assign(new Error("App version config not found."), { status: 404 });
    }

    const platform =
        payload.platform !== undefined ? assertPlatform(payload.platform) : row.platform;
    const latest_version =
        payload.latest_version !== undefined
            ? assertVersion(payload.latest_version, "latest_version")
            : row.latest_version;
    const min_supported_version =
        payload.min_supported_version !== undefined
            ? assertVersion(payload.min_supported_version, "min_supported_version")
            : row.min_supported_version;
    const force_update =
        payload.force_update !== undefined ? Boolean(payload.force_update) : Boolean(row.force_update);
    const status =
        payload.status !== undefined
            ? String(payload.status).trim().toLowerCase() === "inactive"
                ? "inactive"
                : "active"
            : row.status;
    const store_url =
        payload.store_url !== undefined
            ? payload.store_url
                ? String(payload.store_url).trim()
                : null
            : row.store_url;
    const release_notes =
        payload.release_notes !== undefined
            ? payload.release_notes
                ? String(payload.release_notes).trim().slice(0, 1000)
                : null
            : row.release_notes;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (status === "active") {
            await deactivateOtherActiveForPlatform(client, platform, id);
        }
        const result = await client.query(
            `UPDATE app_versions
             SET platform = $2,
                 latest_version = $3,
                 min_supported_version = $4,
                 force_update = $5,
                 status = $6,
                 store_url = $7,
                 release_notes = $8,
                 updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [id, platform, latest_version, min_supported_version, force_update, status, store_url, release_notes]
        );
        await client.query("COMMIT");
        return result.rows[0];
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};

export const getAppVersionsService = async (requestQuery = {}) => {
    const platform = requestQuery.platform ? normalizePlatform(requestQuery.platform) : null;
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
        [normalizePlatform(platform)]
    );
    return result.rows[0] || null;
};

export const checkAppVersionStatusService = async (payload = {}) => {
    const { platform, current_version } = payload;
    if (!platform || !current_version) {
        throw Object.assign(new Error("platform and current_version are required."), { status: 400 });
    }

    const config = await getActiveAppVersionService(platform);
    if (!config) {
        return {
            platform: normalizePlatform(platform),
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
