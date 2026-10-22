import crypto from "crypto";

/** Six-digit one-time code (100000–999999) from the OS CSPRNG. */
export const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const PASSWORD_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$_";

/** Uniformly random password from the CSPRNG (randomInt avoids modulo bias). */
export const generatePassword = (length = 12) => {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)];
    }
    return result;
};
