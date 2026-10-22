/**
 * Let storefront checkout continue when SMS delivery fails; the code is only written to the
 * server logs, never returned to the caller. Opt-in so production fails closed by default.
 */
export const allowOtpWithoutSms = () => process.env.STOREFRONT_OTP_DEV === "true";

/** One-time codes reach the logs only on dev setups that opted in with STOREFRONT_OTP_DEV. */
export const otpForLog = (code) => (allowOtpWithoutSms() ? code : "[hidden]");

export const maskPhone = (phone) => {
    const s = String(phone || "");
    return s.length > 4 ? `${"*".repeat(s.length - 4)}${s.slice(-4)}` : "****";
};

export const maskEmail = (email) => {
    const [local, domain] = String(email || "").split("@");
    if (!domain) return "***";
    return `${local.slice(0, 2)}***@${domain}`;
};
