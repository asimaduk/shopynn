/**
 * Routes that intentionally skip a permission check. Every other route must run `auth`
 * plus requirePermission / requireAnyPermission / requireMerchant / requireAdminDb.
 * `auth: true` entries must still require sign-in. Add an entry only with a reason a
 * reviewer can verify.
 */
const PUBLIC = (reason) => ({ auth: false, reason });
const SELF = (reason) => ({ auth: true, reason });

export const ROUTE_GUARD_ALLOWLIST = {
    "POST /users/login": PUBLIC("Sign-in."),
    "POST /users/phone-login/send-otp": PUBLIC("Sign-in."),
    "POST /users/phone-login/verify": PUBLIC("Sign-in."),
    "POST /users/forgot-password": PUBLIC("Password recovery."),
    "POST /users/customer-signup/verify-reference": PUBLIC("Storefront customer sign-up."),
    "POST /users/customer-signup/send-otp": PUBLIC("Storefront customer sign-up."),
    "POST /users/customer-signup/verify-otp": PUBLIC("Storefront customer sign-up."),
    "POST /users/customer-signup": PUBLIC("Storefront customer sign-up."),
    "POST /users/shop-owner-signup/send-email-otp": PUBLIC("Shop owner sign-up."),
    "POST /users/shop-owner-signup/verify-email-otp": PUBLIC("Shop owner sign-up."),
    "POST /tenants/setup": PUBLIC("Shop sign-up; requires a verified owner email token."),
    "POST /payments/webhook": PUBLIC("Paystack webhook; verified by HMAC signature."),
    "GET /images/": PUBLIC("Image bytes for <img> tags and the storefront."),
    "GET /app-versions/check": PUBLIC("App update check."),
    "POST /public/newsletter/subscribe": PUBLIC("Marketing site form."),
    "POST /public/newsletter/unsubscribe": PUBLIC("Marketing site form."),
    "POST /public/contact": PUBLIC("Marketing site form."),
    "POST /public/chat/session": PUBLIC("Marketing site chat."),
    "GET /public/chat/session/:token": PUBLIC("Marketing site chat; visitor token."),
    "POST /public/chat/session/:token/messages": PUBLIC("Marketing site chat; visitor token."),
    "GET /public/billing/catalog": PUBLIC("Public plan prices."),
    "GET /public/store/:code": PUBLIC("Public storefront."),
    "GET /public/store/:code/catalog": PUBLIC("Public storefront."),
    "GET /public/store/:code/products/:productId": PUBLIC("Public storefront."),
    "POST /public/store/:code/otp/send": PUBLIC("Storefront checkout phone check."),
    "POST /public/store/:code/otp/verify": PUBLIC("Storefront checkout phone check."),
    "POST /public/store/:code/orders": PUBLIC("Storefront checkout; requires storefront token."),
    "POST /public/store/:code/orders/:orderId/payments/verify": PUBLIC("Storefront checkout; verified with Paystack."),

    "GET /users/me": SELF("Own profile."),
    "POST /users/me/profile-image": SELF("Own profile image."),
    "DELETE /users/me/profile-image": SELF("Own profile image."),
    "GET /users/me/preferences": SELF("Own preferences."),
    "PUT /users/me/preferences": SELF("Own preferences."),
    "PUT /users/me/fcm-token": SELF("Own push token."),
    "POST /users/me/change-email/send-otp": SELF("Own email change, OTP-verified."),
    "POST /users/me/change-email/verify": SELF("Own email change, OTP-verified."),
    "POST /users/me/change-phone/send-otp": SELF("Own phone change, OTP-verified."),
    "POST /users/me/change-phone/verify": SELF("Own phone change, OTP-verified."),
    "POST /users/reset-password": SELF("Own password; requires the current password."),
    "POST /users/change-password": SELF("Own temporary password change."),
    "PUT /users/:id": SELF("Self edits limited to name/phone; editing others checks users.update in the controller."),
    "GET /user-management/me/permissions": SELF("Own permissions."),
    "GET /user-management/me/roles": SELF("Own roles."),
    "GET /subscriptions/current": SELF("Own shop's plan."),
    "GET /tenants/me/printer-setup-entitlement": SELF("Own shop's entitlement."),
    "GET /tenants/me/go-live-nav": SELF("Own shop's onboarding checklist."),
    "GET /merchants/me": SELF("Own merchant profile, if any."),
    "GET /platform-settings/momo-payment-charge": SELF("Read-only MoMo fee shown at checkout."),
    "POST /images/": SELF("Upload into the caller's own shop folder."),
    "GET /industries/": SELF("Reference list used on the company profile."),
    "GET /industries/:id": SELF("Reference list used on the company profile."),
};
