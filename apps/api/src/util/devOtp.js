/**
 * Return SMS codes in API responses when SMS delivery fails. Opt-in only, so a deploy
 * that forgets NODE_ENV=production never hands codes to whoever asked for them.
 */
export const allowDevOtpInResponse = () => process.env.STOREFRONT_OTP_DEV === "true";
