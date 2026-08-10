BEGIN;

CREATE TABLE IF NOT EXISTS study_recommendation_sets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    study_record_id BIGINT NOT NULL
        REFERENCES study_records(id)
        ON DELETE CASCADE,
    generator VARCHAR(30) NOT NULL,
    recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT study_recommendation_generator_check
        CHECK (
            generator IN (
                'openai',
                'rule-based',
                'rule-based-fallback'
            )
        ),
    CONSTRAINT study_recommendations_json_check
        CHECK (JSONB_TYPEOF(recommendations) = 'array'),
    CONSTRAINT study_recommendation_record_unique
        UNIQUE (user_id, study_record_id)
);

CREATE INDEX IF NOT EXISTS idx_study_recommendation_sets_record
    ON study_recommendation_sets(user_id, study_record_id);

COMMIT;
