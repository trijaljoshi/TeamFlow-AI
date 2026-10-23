-- Run once against the same PostgreSQL database used by the backend.
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_created
    ON password_reset_otps (email, created_at DESC);

-- Existing deadline scheduler references these columns. Add them safely.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS deadline_3d_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deadline_1d_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deadline_missed_email_sent BOOLEAN NOT NULL DEFAULT FALSE;
