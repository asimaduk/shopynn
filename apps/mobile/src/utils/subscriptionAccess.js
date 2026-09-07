/** Mirrors ims-services `requireActiveSubscription` / ims-web `subscriptionRenewalFromMe`. */
export function isTenantSubscriptionActive(subscription) {
    if (!subscription?.id) return false;
    if (String(subscription.status || '').toLowerCase() !== 'active') return false;
    const now = new Date();
    if (subscription.start_at && new Date(subscription.start_at) > now) return false;
    if (subscription.end_at && new Date(subscription.end_at) < now) return false;
    return true;
}

export const SUBSCRIPTION_INACTIVE_MESSAGE = 'Subscription is not active.';

export const SUBSCRIPTION_RENEWAL_CODES = new Set([
    'SUBSCRIPTION_NOT_STARTED',
    'SUBSCRIPTION_REQUIRED',
    'SUBSCRIPTION_EXPIRED',
    'SUBSCRIPTION_INACTIVE',
]);
