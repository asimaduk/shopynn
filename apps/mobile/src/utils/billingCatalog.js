import { CHOOSEABLE_SUBSCRIPTION_PLANS, SUBSCRIPTION_PLANS } from '../constants/subscriptionPlans';

/** Folded into assisted go-live — never offer as separate add-ons. */
export const FOLDED_SETUP_ADDON_CODES = new Set(['addon_csv_import', 'addon_opening_stock']);

export function isFoldedSetupAddon(code) {
    return FOLDED_SETUP_ADDON_CODES.has(String(code || ''));
}

export function filterSellableAddons(addons = []) {
    return (addons || []).filter((a) => a && !isFoldedSetupAddon(a.code) && a.is_active !== false);
}

const TIER_TO_TYPE = { free: 1, basic: 2, standard: 3, premium: 4 };
const TYPE_TO_TIER = { 1: 'free', 2: 'basic', 3: 'standard', 4: 'premium' };

const FEATURES_BY_KEY = {};
CHOOSEABLE_SUBSCRIPTION_PLANS.forEach((p) => {
    FEATURES_BY_KEY[p.key] = {
        name: p.name,
        description: p.description,
        features: p.features,
        amount: p.amount,
    };
});

const FALLBACK_MONTHLY_GHS = { 1: 0, 2: 229, 3: 429, 4: 799 };

/** @param {import('../services/api').billingCatalogGrouped | null | undefined} catalog */
export function buildPlansFromCatalog(catalog) {
    const plansMap = catalog?.plans;
    if (!plansMap || typeof plansMap !== 'object' || !Object.keys(plansMap).length) {
        // Empty catalog (common after DB restore) — callers should use hardcoded plan amounts.
        return null;
    }
    const plans = [];
    for (const tier of ['free', 'basic', 'standard', 'premium']) {
        const monthly = plansMap[tier]?.subscription_monthly;
        const onboarding = plansMap[tier]?.onboarding;
        const typeNum = TIER_TO_TYPE[tier];
        if (!typeNum) continue;
        const meta = FEATURES_BY_KEY[typeNum] || SUBSCRIPTION_PLANS.find((p) => p.value === typeNum);
        const catalogMonthly = monthly != null
            ? Number(monthly.amount_ghs ?? monthly.amountGhs ?? monthly.amount ?? 0)
            : NaN;
        const fallbackMonthly = FALLBACK_MONTHLY_GHS[typeNum] ?? FEATURES_BY_KEY[typeNum]?.amount ?? 0;
        const monthlyAmount = Number.isFinite(catalogMonthly) && catalogMonthly > 0
            ? catalogMonthly
            : fallbackMonthly;
        const onboardingAmount = onboarding
            ? Number(onboarding.amount_ghs ?? onboarding.amountGhs ?? onboarding.amount ?? 0)
            : 0;
        plans.push({
            v: typeNum,
            title: meta?.name || tier,
            amountBold:
                typeNum === 1 ? 'GHS 0.00' : `GHS ${monthlyAmount.toFixed(2)}`,
            amountSub: typeNum === 1 ? '14-day trial' : 'per month',
            onboardingGhs: onboardingAmount,
            monthlyGhs: monthlyAmount,
            description:
                meta?.description ||
                (typeNum === 1
                    ? 'Try core features. Upgrade or add paid services when ready.'
                    : 'Includes onboarding + first month when collected via agent.'),
        });
    }
    return plans.length ? plans : null;
}

export function buildSignupPlansFromCatalog(catalog) {
    if (!catalog?.plans) return null;
    return [1, 2, 3, 4].map((value) => {
        const tier = TYPE_TO_TIER[value];
        const monthly = catalog.plans[tier]?.subscription_monthly;
        const catalogAmount = monthly != null
            ? Number(monthly.amount_ghs ?? monthly.amountGhs ?? monthly.amount ?? 0)
            : NaN;
        const amount = Number.isFinite(catalogAmount) && catalogAmount > 0
            ? catalogAmount
            : (FALLBACK_MONTHLY_GHS[value] ?? 0);
        const base = SUBSCRIPTION_PLANS.find((p) => p.value === value);
        if (value === 1) {
            return { ...base, label: 'Free — 14 days' };
        }
        return {
            ...base,
            label: `${FEATURES_BY_KEY[value]?.name || tier} — GHS ${amount}/mo`,
        };
    });
}

export function isFreeTierTenant(tenant) {
    return String(tenant?.subscription_name || '').toLowerCase() === 'free';
}

export function computeQuoteTotalFromSelection(catalog, planType, addonCodes = []) {
    if (!catalog) return 0;
    const tier = TYPE_TO_TIER[planType];
    let total = 0;
    if (planType > 1) {
        const onboarding = catalog.plans[tier]?.onboarding;
        const monthly = catalog.plans[tier]?.subscription_monthly;
        if (onboarding) total += Number(onboarding.amount_ghs) || 0;
        if (monthly) total += Number(monthly.amount_ghs) || 0;
    }
    const codes = new Set(addonCodes);
    for (const a of filterSellableAddons(catalog.addons)) {
        if (codes.has(a.code)) total += Number(a.amount_ghs) || 0;
    }
    return Math.round(total * 100) / 100;
}
