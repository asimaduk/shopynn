-- Email OTP verification for signup flows (e.g. shop owner owner_email)

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id varchar(40) PRIMARY KEY,
    email varchar(255) NOT NULL,
    purpose varchar(50) NOT NULL DEFAULT 'shop_owner_signup',
    code_hash varchar(128) NOT NULL,
    verification_token varchar(64),
    attempts int NOT NULL DEFAULT 0,
    expires_at timestamp NOT NULL,
    verified_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_email_purpose
    ON email_verification_codes (lower(email), purpose, created_at DESC);
