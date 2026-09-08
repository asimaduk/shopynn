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
    FEATURES_BY_KEY[p.key] = { name: p.name, description: p.description, features: p.features };
});

/** @param {import('../services/api').billingCatalogGrouped | null | undefined} catalog */
export function buildPlansFromCatalog(catalog) {
    if (!catalog?.plans) return null;
    const plans = [];
    for (const tier of ['free', 'basic', 'standard', 'premium']) {
        const monthly = catalog.plans[tier]?.subscription_monthly;
        const onboarding = catalog.plans[tier]?.onboarding;
        const typeNum = TIER_TO_TYPE[tier];
        if (!typeNum) continue;
        const meta = FEATURES_BY_KEY[typeNum] || SUBSCRIPTION_PLANS.find((p) => p.value === typeNum);
        const monthlyAmount = monthly ? Number(monthly.amount_ghs) : 0;
        const onboardingAmount = onboarding ? Number(onboarding.amount_ghs) : 0;
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
        const amount = monthly ? Number(monthly.amount_ghs) : 0;
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
