BEGIN;

CREATE TABLE IF NOT EXISTS ai_conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    collection_name VARCHAR(120) NOT NULL,
    study_mode VARCHAR(20) NOT NULL,
    title VARCHAR(120) NOT NULL DEFAULT '새 대화',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_conversations_study_mode_check
        CHECK (study_mode IN ('general', 'certification'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL
        REFERENCES ai_conversations(id)
        ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_messages_role_check
        CHECK (role IN ('user', 'assistant'))
);

CREATE TABLE IF NOT EXISTS ai_message_sources (
    message_id BIGINT NOT NULL
        REFERENCES ai_messages(id)
        ON DELETE CASCADE,
    study_record_id BIGINT NOT NULL
        REFERENCES study_records(id)
        ON DELETE CASCADE,
    PRIMARY KEY (message_id, study_record_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_collection
    ON ai_conversations(
        user_id,
        study_mode,
        collection_name,
        updated_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages(conversation_id, created_at);

COMMIT;
