BEGIN;

CREATE TABLE IF NOT EXISTS daily_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    goal_date DATE NOT NULL,
    content VARCHAR(300) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT daily_goals_content_check
        CHECK (LENGTH(BTRIM(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date
    ON daily_goals(user_id, goal_date, created_at, id);

COMMIT;
