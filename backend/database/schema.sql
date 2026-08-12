BEGIN;

-- 1. 사용자
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 사용자별 학습 과목
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT subjects_user_name_unique
        UNIQUE (user_id, name)
);

-- 3. 학습 기록
CREATE TABLE IF NOT EXISTS study_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    subject_id BIGINT
        REFERENCES subjects(id)
        ON DELETE SET NULL,

    study_date DATE NOT NULL DEFAULT CURRENT_DATE,
    record_type VARCHAR(20) NOT NULL DEFAULT 'general',
    certification_name VARCHAR(120),
    exam_type VARCHAR(20),
    exam_date DATE,
    unit VARCHAR(150) NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    learned TEXT NOT NULL DEFAULT '',
    difficult TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    understanding SMALLINT NOT NULL DEFAULT 3,
    quest_status VARCHAR(30) NOT NULL DEFAULT 'not-generated',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT study_records_minutes_check
        CHECK (minutes >= 0),

    CONSTRAINT study_records_understanding_check
        CHECK (understanding BETWEEN 1 AND 5),

    CONSTRAINT study_records_record_type_check
        CHECK (
            record_type IN (
                'general',
                'certification'
            )
        ),

    CONSTRAINT study_records_exam_type_check
        CHECK (
            exam_type IS NULL
            OR exam_type IN (
                'written',
                'practical'
            )
        ),

    CONSTRAINT study_records_certification_fields_check
        CHECK (
            record_type = 'general'
            OR (
                certification_name IS NOT NULL
                AND exam_type IS NOT NULL
            )
        ),

    CONSTRAINT study_records_quest_status_check
        CHECK (
            quest_status IN (
                'not-generated',
                'ready',
                'retry-required',
                'completed'
            )
        )
);

-- 학습 집중 세션
-- 실제 학습 기록과 별도로 타이머의 진행 상태와 집중 지표만 저장합니다.
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

-- 4. 학습 기록별 AI 맞춤 추천
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

-- 5. 검토를 마친 복습 문제 세트
CREATE TABLE IF NOT EXISTS review_quest_sets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL,
    source_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'reviewed',
    questions JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT review_quest_source_type_check
        CHECK (source_type IN ('study-record', 'wrong-note')),
    CONSTRAINT review_quest_status_check
        CHECK (status IN ('reviewed')),
    CONSTRAINT review_quest_questions_check
        CHECK (JSONB_TYPEOF(questions) = 'array'),
    CONSTRAINT review_quest_source_unique
        UNIQUE (user_id, source_type, source_id)
);

-- 6. 복습 퀴즈 응시 결과
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
    answers JSONB NOT NULL DEFAULT '[]'::JSONB,
    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    retry_round INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT quiz_attempt_source_type_check
        CHECK (source_type IN ('study-record', 'wrong-note')),
    CONSTRAINT quiz_attempt_status_check
        CHECK (status IN ('completed', 'retry-required')),
    CONSTRAINT quiz_attempt_mode_check
        CHECK (mode IN ('original', 'retry')),
    CONSTRAINT quiz_attempt_score_check
        CHECK (
            total_count > 0
            AND correct_count >= 0
            AND correct_count <= total_count
        ),
    CONSTRAINT quiz_attempt_retry_round_check
        CHECK (retry_round >= 0),
    CONSTRAINT quiz_attempt_answers_check
        CHECK (JSONB_TYPEOF(answers) = 'array')
);

-- 7. 오답노트
CREATE TABLE IF NOT EXISTS wrong_notes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    study_record_id BIGINT
        REFERENCES study_records(id)
        ON DELETE SET NULL,
    subject_id BIGINT
        REFERENCES subjects(id)
        ON DELETE SET NULL,

    study_date DATE NOT NULL DEFAULT CURRENT_DATE,
    unit VARCHAR(150) NOT NULL DEFAULT '',
    mistake_question TEXT NOT NULL,
    wrong_answer TEXT NOT NULL DEFAULT '',
    correct_answer TEXT NOT NULL DEFAULT '',
    mistake_reason TEXT NOT NULL DEFAULT '',
    concepts TEXT NOT NULL DEFAULT '',

    wrong_image_path TEXT,
    wrong_image_name VARCHAR(255),

    quest_status VARCHAR(30) NOT NULL DEFAULT 'not-generated',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wrong_notes_quest_status_check
        CHECK (
            quest_status IN (
                'not-generated',
                'ready',
                'retry-required',
                'completed'
            )
        )
);

-- 8. 과목별 AI 복습 대화
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

-- 조회 속도를 높이는 인덱스
CREATE INDEX IF NOT EXISTS idx_subjects_user_id
    ON subjects(user_id);

CREATE INDEX IF NOT EXISTS idx_study_records_user_date
    ON study_records(user_id, study_date DESC);

CREATE INDEX IF NOT EXISTS idx_study_records_subject_id
    ON study_records(subject_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_created
    ON study_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_status
    ON study_sessions(user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_one_active_per_user
    ON study_sessions(user_id)
    WHERE status IN ('running', 'paused');

CREATE INDEX IF NOT EXISTS idx_study_recommendation_sets_record
    ON study_recommendation_sets(user_id, study_record_id);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_user_date
    ON wrong_notes(user_id, study_date DESC);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_study_record_id
    ON wrong_notes(study_record_id);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_status
    ON wrong_notes(quest_status);

CREATE INDEX IF NOT EXISTS idx_review_quest_sets_source
    ON review_quest_sets(user_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_source
    ON quiz_attempts(
        user_id,
        source_type,
        source_id,
        completed_at DESC
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
