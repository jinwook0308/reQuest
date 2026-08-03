BEGIN;

ALTER TABLE study_records
ADD COLUMN IF NOT EXISTS quest_status VARCHAR(30)
NOT NULL DEFAULT 'not-generated';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'study_records_quest_status_check'
    ) THEN
        ALTER TABLE study_records
        ADD CONSTRAINT study_records_quest_status_check
        CHECK (
            quest_status IN (
                'not-generated',
                'ready',
                'retry-required',
                'completed'
            )
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS review_quest_sets (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    source_type VARCHAR(30) NOT NULL,
    source_id BIGINT NOT NULL,

    status VARCHAR(30) NOT NULL
        DEFAULT 'reviewed',

    questions JSONB NOT NULL
        DEFAULT '[]'::JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT review_quest_source_type_check
        CHECK (
            source_type IN (
                'study-record',
                'wrong-note'
            )
        ),

    CONSTRAINT review_quest_status_check
        CHECK (
            status IN ('reviewed')
        ),

    CONSTRAINT review_quest_questions_check
        CHECK (
            JSONB_TYPEOF(questions) = 'array'
        ),

    CONSTRAINT review_quest_source_unique
        UNIQUE (
            user_id,
            source_type,
            source_id
        )
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    quest_set_id BIGINT NOT NULL
        REFERENCES review_quest_sets(id)
        ON DELETE CASCADE,

    source_type VARCHAR(30) NOT NULL,
    source_id BIGINT NOT NULL,

    answers JSONB NOT NULL
        DEFAULT '[]'::JSONB,

    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,

    status VARCHAR(30) NOT NULL,
    mode VARCHAR(20) NOT NULL,

    retry_round INTEGER NOT NULL
        DEFAULT 0,

    completed_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT quiz_attempt_source_type_check
        CHECK (
            source_type IN (
                'study-record',
                'wrong-note'
            )
        ),

    CONSTRAINT quiz_attempt_status_check
        CHECK (
            status IN (
                'completed',
                'retry-required'
            )
        ),

    CONSTRAINT quiz_attempt_mode_check
        CHECK (
            mode IN (
                'original',
                'retry'
            )
        ),

    CONSTRAINT quiz_attempt_score_check
        CHECK (
            total_count > 0
            AND correct_count >= 0
            AND correct_count <= total_count
        ),

    CONSTRAINT quiz_attempt_retry_round_check
        CHECK (retry_round >= 0),

    CONSTRAINT quiz_attempt_answers_check
        CHECK (
            JSONB_TYPEOF(answers) = 'array'
        )
);

CREATE INDEX IF NOT EXISTS
    idx_review_quest_sets_source
ON review_quest_sets (
    user_id,
    source_type,
    source_id
);

CREATE INDEX IF NOT EXISTS
    idx_quiz_attempts_source
ON quiz_attempts (
    user_id,
    source_type,
    source_id,
    completed_at DESC
);

COMMIT;