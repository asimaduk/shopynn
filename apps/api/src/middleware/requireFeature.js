/**
 * Middleware factory: require that the user's subscription includes specific features.
 * Must be used after auth and requireActiveSubscription (req.subscription.features must exist).
 *
 * @param {...string} requiredFeatures - One or more feature names. User must have ALL of them.
 * @returns {Function} Express middleware
 *
 * @example
 * // Single feature
 * router.get('/sales', auth, requireActiveSubscription, requireFeature('sales'), getSales);
 *
 * @example
 * // Multiple features (user must have all)
 * router.get('/reports', auth, requireActiveSubscription, requireFeature('sales', 'reports'), getReports);
 */
const requireFeature = (...requiredFeatures) => {
    return (req, res, next) => {
        if (!req.subscription?.features) {
            return res.status(403).json({
                error: "Subscription features could not be determined.",
                code: "SUBSCRIPTION_FEATURES_UNKNOWN",
            });
        }

        const allowed = new Set(
            req.subscription.features.map((f) => String(f).toLowerCase().trim()).filter(Boolean)
        );
        const missing = requiredFeatures.filter(
            (f) => !allowed.has(String(f).toLowerCase().trim())
        );

        if (missing.length > 0) {
            return res.status(403).json({
                error: "Your subscription does not include access to this feature.",
                code: "FEATURE_NOT_AVAILABLE",
                requiredFeatures: missing,
            });
        }

        next();
    };
};

/**
 * Helper to check if the current request's subscription has a feature (for use in controllers).
 * Only use after requireActiveSubscription has run.
 *
 * @param {object} req - Express request (must have req.subscription.features)
 * @param {string} featureName - Feature to check
 * @returns {boolean}
 */
export const hasFeature = (req, featureName) => {
    const features = req.subscription?.features ?? [];
    const key = (typeof featureName === "string" ? featureName : String(featureName)).toLowerCase();
    return features.some((f) => (typeof f === "string" ? f : String(f)).toLowerCase() === key);
};

export default requireFeature;
