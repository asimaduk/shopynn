import pool from "../config/db.js";
import {
    PLATFORM_MOMO_CHARGE_KEY,
    normalizeMomoPaymentCharge,
    computePlatformCollectionCharge,
} from "../utils/platformMomoCharge.js";

export async function getPlatformSettingService(key) {
    const res = await pool.query(
        `SELECT key, value, updated_at, updated_by FROM platform_settings WHERE key = $1 LIMIT 1`,
        [key]
    );
    return res.rows[0] || null;
}

export async function upsertPlatformSettingService(key, value, updatedBy = null) {
    const res = await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, now(), $3)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = now(),
               updated_by = EXCLUDED.updated_by
         RETURNING key, value, updated_at, updated_by`,
        [key, JSON.stringify(value), updatedBy]
    );
    return res.rows[0];
}

export async function getMomoPaymentChargeSettingsService() {
    const row = await getPlatformSettingService(PLATFORM_MOMO_CHARGE_KEY);
    return normalizeMomoPaymentCharge(row?.value);
}

export async function updateMomoPaymentChargeSettingsService(patch, updatedBy = null) {
    const current = await getMomoPaymentChargeSettingsService();
    const next = normalizeMomoPaymentCharge({
        ...current,
        ...(patch && typeof patch === "object" ? patch : {}),
    });
    await upsertPlatformSettingService(PLATFORM_MOMO_CHARGE_KEY, {
        enabled: next.enabled,
        percent: next.percent,
    }, updatedBy);
    return next;
}

export async function computeChargeForFaceAmountService(faceAmount) {
    const settings = await getMomoPaymentChargeSettingsService();
    return computePlatformCollectionCharge(faceAmount, settings);
}
