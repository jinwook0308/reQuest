BEGIN;

CREATE TABLE IF NOT EXISTS study_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    record_type VARCHAR(20) NOT NULL DEFAULT 'general',
    mode VARCHAR(20) NOT NULL,
    subject VARCHAR(120) NOT NULL,
    unit VARCHAR(150) NOT NULL,
    target_minutes INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_resumed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    focused_seconds INTEGER NOT NULL DEFAULT 0,
    paused_seconds INTEGER NOT NULL DEFAULT 0,
    interruption_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT study_sessions_record_type_check
        CHECK (record_type IN ('general', 'certification')),
    CONSTRAINT study_sessions_mode_check
        CHECK (mode IN ('focus', 'practice')),
    CONSTRAINT study_sessions_status_check
        CHECK (status IN ('running', 'paused', 'completed', 'cancelled')),
    CONSTRAINT study_sessions_target_minutes_check
        CHECK (target_minutes BETWEEN 1 AND 1440),
    CONSTRAINT study_sessions_seconds_check
        CHECK (
            focused_seconds >= 0
            AND paused_seconds >= 0
            AND interruption_count >= 0
        )
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_created
    ON study_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_status
    ON study_sessions(user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_one_active_per_user
    ON study_sessions(user_id)
    WHERE status IN ('running', 'paused');

COMMIT;
