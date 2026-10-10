/** Mirrors ims-services `requireActiveSubscription` / ims-web `subscriptionRenewalFromMe`. */
export function isTenantSubscriptionActive(subscription) {
    if (!subscription?.id) return false;
    if (String(subscription.status || '').toLowerCase() !== 'active') return false;
    const now = new Date();
    if (subscription.start_at && new Date(subscription.start_at) > now) return false;
    if (subscription.end_at && new Date(subscription.end_at) < now) return false;
    return true;
}

/** Redux-shaped plan + feature list from a `/subscriptions/current` response. */
export function subscriptionStateFromResponse(subResponse, fallbackFeatures = []) {
    const sub = subResponse?.subscription ?? subResponse;
    const features = Array.isArray(sub?.features)
        ? sub.features.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
        : fallbackFeatures;
    const plan = sub
        ? {
              name: sub.name ?? sub.planName ?? sub.plan?.name ?? 'Scale',
              id: sub.id ?? sub.plan_id ?? sub.plan?.id,
              amount: sub.amount != null ? Number(sub.amount) : undefined,
              billingInterval: sub.billing_interval ?? sub.billingCycle ?? sub.plan?.billing_interval,
              endAt: sub.end_at ?? sub.nextBillingDate ?? sub.plan?.end_at,
              status: sub.status ?? sub.state,
          }
        : null;
    return { sub, plan, features };
}

export const SUBSCRIPTION_INACTIVE_MESSAGE = 'Subscription is not active.';

export const SUBSCRIPTION_RENEWAL_CODES = new Set([
    'SUBSCRIPTION_NOT_STARTED',
    'SUBSCRIPTION_REQUIRED',
    'SUBSCRIPTION_EXPIRED',
    'SUBSCRIPTION_INACTIVE',
]);
