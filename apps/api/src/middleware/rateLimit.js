import rateLimit from "express-rate-limit";

const MINUTE = 60 * 1000;

const tooMany = (message) => ({ error: message });

const target = (req) => {
    const b = req.body || {};
    const raw = b.phone ?? b.phone_number ?? b.email ?? b.username ?? b.login ?? "";
    return String(raw).trim().toLowerCase();
};

const limiter = ({ windowMs, limit, message, keyGenerator }) =>
    rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: tooMany(message),
        ...(keyGenerator ? { keyGenerator } : {}),
        skip: () => process.env.NODE_ENV === "test",
    });

const perIpAndTarget = (prefix) => (req) => `${prefix}:${req.ip}:${target(req)}`;

/** Sending a code by SMS or email: costs money and can be used to spam someone's phone. */
export const otpSendLimit = [
    limiter({ windowMs: 15 * MINUTE, limit: 30, message: "Too many code requests. Try again later." }),
    limiter({
        windowMs: 15 * MINUTE,
        limit: 5,
        message: "Too many codes sent to this number or email. Wait a few minutes and try again.",
        keyGenerator: perIpAndTarget("otp-send"),
    }),
];

/** Checking a code or password: slows down guessing. */
export const credentialCheckLimit = [
    limiter({ windowMs: 15 * MINUTE, limit: 60, message: "Too many attempts. Try again later." }),
    limiter({
        windowMs: 15 * MINUTE,
        limit: 10,
        message: "Too many attempts for this account. Wait a few minutes and try again.",
        keyGenerator: perIpAndTarget("cred-check"),
    }),
];

/** Public forms (contact, newsletter, chat start, storefront orders). */
export const publicFormLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: 20,
    message: "Too many requests. Try again later.",
});

/** Messages in an open site chat. */
export const publicChatMessageLimit = limiter({
    windowMs: 5 * MINUTE,
    limit: 30,
    message: "You're sending messages too quickly. Wait a moment.",
});

/** Authenticated uploads, keyed by user so a shared shop network isn't penalised. */
export const uploadLimit = limiter({
    windowMs: 10 * MINUTE,
    limit: 60,
    message: "Too many uploads. Try again in a few minutes.",
    keyGenerator: (req) => `upload:${req.user?.id ?? req.ip}`,
});
