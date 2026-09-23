-- Optional: no schema change required — storefront phone OTP reuses email_verification_codes
-- with purpose = 'storefront_phone' (phone stored in email column, normalized).

-- Ensure Scale/online-order tenants can use public storefront when reference codes exist.
-- (No DDL beyond comment; kept for deploy ordering / docs.)
SELECT 1;
