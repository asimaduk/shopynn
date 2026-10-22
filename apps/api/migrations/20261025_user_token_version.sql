-- Bumped to revoke every token issued to the user (password change, deactivation, sign out everywhere).
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
