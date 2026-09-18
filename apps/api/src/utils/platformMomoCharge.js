/**
 * Platform MoMo/card collection surcharge (customer pays face + %).
 * Default and minimum 2%.
 */

export const PLATFORM_MOMO_CHARGE_KEY = "momo_payment_charge";

export const DEFAULT_MOMO_CHARGE_PERCENT = 2;
export const DEFAULT_MOMO_FEE_FLOOR_PERCENT = 2;

function feeFloorPercent() {
    const n = Number(process.env.PAYSTACK_MOMO_FEE_PERCENT);
    if (Number.isFinite(n) && n >= 0) return n;
    return DEFAULT_MOMO_FEE_FLOOR_PERCENT;
}

function toMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

function toPercent(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

/**
 * Normalize platform momo_payment_charge JSON.
 */
export function normalizeMomoPaymentCharge(raw) {
    const floor = feeFloorPercent();
    if (!raw || typeof raw !== "object") {
        return {
            enabled: true,
            percent: Math.max(DEFAULT_MOMO_CHARGE_PERCENT, floor),
            min_percent: floor,
        };
    }
    const enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);
    let percent = toPercent(raw.percent, DEFAULT_MOMO_CHARGE_PERCENT);
    if (enabled && percent < floor) percent = floor;
    return {
        enabled,
        percent,
        min_percent: floor,
    };
}

/**
 * Compute surcharge on a face-value amount.
 * @returns {{ face_amount: number, fee_amount: number, charge_amount: number, percent: number, enabled: boolean }}
 */
export function computePlatformCollectionCharge(faceAmount, chargeSettings) {
    const face = toMoney(faceAmount);
    const settings = normalizeMomoPaymentCharge(chargeSettings);
    if (!settings.enabled || face <= 0) {
        return {
            face_amount: face,
            fee_amount: 0,
            charge_amount: face,
            percent: settings.percent,
            enabled: settings.enabled,
        };
    }
    const fee = toMoney((face * settings.percent) / 100);
    return {
        face_amount: face,
        fee_amount: fee,
        charge_amount: toMoney(face + fee),
        percent: settings.percent,
        enabled: true,
    };
}

export function settlementCreditAmount(payment) {
    if (payment?.face_amount != null && Number.isFinite(Number(payment.face_amount))) {
        return toMoney(payment.face_amount);
    }
    return toMoney(payment?.amount);
}
