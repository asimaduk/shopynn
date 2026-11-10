-- One row per sign-in, so users can see their signed-in devices and sign out one of them.
-- API tokens carry the row id (sid); revoking the row rejects that token. Rows whose token_version
-- is behind users.token_version were ended by a sign-out-everywhere and are no longer listed.

CREATE TABLE IF NOT EXISTS user_sessions (
    id varchar(40) PRIMARY KEY,
    user_id varchar(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_version integer NOT NULL DEFAULT 0,
    device_name varchar(120),
    platform varchar(20),
    app_version varchar(40),
    ip varchar(64),
    user_agent varchar(300),
    created_at timestamp NOT NULL DEFAULT now(),
    last_seen_at timestamp NOT NULL DEFAULT now(),
    revoked_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
    ON user_sessions (user_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;
