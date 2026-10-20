/**
 * Let storefront checkout continue when SMS delivery fails; the code is only written to the
 * server logs, never returned to the caller. Opt-in so production fails closed by default.
 */
export const allowOtpWithoutSms = () => process.env.STOREFRONT_OTP_DEV === "true";
