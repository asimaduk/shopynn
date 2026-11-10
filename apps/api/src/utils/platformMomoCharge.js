/**
 * Platform MoMo/card collection surcharge.
 * Default and minimum 2%. Who pays is per shop: customer (face + %) or shop (face, fee from withdrawal).
 */

export const PLATFORM_MOMO_CHARGE_KEY = "momo_payment_charge";

export const DEFAULT_MOMO_CHARGE_PERCENT = 2;
export const DEFAULT_MOMO_FEE_FLOOR_PERCENT = 2;
export const FEE_PAYER_CUSTOMER = "customer";
export const FEE_PAYER_SHOP = "shop";

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

export function normalizeFeePayer(raw) {
    return String(raw || "").trim().toLowerCase() === FEE_PAYER_SHOP
        ? FEE_PAYER_SHOP
        : FEE_PAYER_CUSTOMER;
}

export function getMomoFeePayerFromSettings(settings) {
    return normalizeFeePayer(settings?.momo_fee_payer);
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
 * @returns {{ face_amount: number, fee_amount: number, charge_amount: number, settlement_amount: number, percent: number, enabled: boolean, fee_payer: string }}
 */
export function computePlatformCollectionCharge(faceAmount, chargeSettings, feePayer) {
    const face = toMoney(faceAmount);
    const settings = normalizeMomoPaymentCharge(chargeSettings);
    const payer = normalizeFeePayer(feePayer);
    if (!settings.enabled || face <= 0) {
        return {
            face_amount: face,
            fee_amount: 0,
            charge_amount: face,
            settlement_amount: face,
            percent: settings.percent,
            enabled: settings.enabled,
            fee_payer: payer,
        };
    }
    const fee = toMoney((face * settings.percent) / 100);
    const shopPays = payer === FEE_PAYER_SHOP;
    return {
        face_amount: face,
        fee_amount: fee,
        charge_amount: shopPays ? face : toMoney(face + fee),
        settlement_amount: shopPays ? toMoney(Math.max(0, face - fee)) : face,
        percent: settings.percent,
        enabled: true,
        fee_payer: payer,
    };
}

/** Amount credited to the shop's withdrawable balance. */
export function settlementCreditAmount(payment) {
    const face =
        payment?.face_amount != null && Number.isFinite(Number(payment.face_amount))
            ? toMoney(payment.face_amount)
            : toMoney(payment?.amount);
    const fee = toMoney(payment?.fee_amount);
    if (normalizeFeePayer(payment?.fee_payer) === FEE_PAYER_SHOP) {
        return toMoney(Math.max(0, face - fee));
    }
    return face;
}
