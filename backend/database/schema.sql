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
    unit VARCHAR(150) NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    learned TEXT NOT NULL DEFAULT '',
    difficult TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    understanding SMALLINT NOT NULL DEFAULT 3,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT study_records_minutes_check
        CHECK (minutes >= 0),

    CONSTRAINT study_records_understanding_check
        CHECK (understanding BETWEEN 1 AND 5)
);

-- 4. 오답노트
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

-- 조회 속도를 높이는 인덱스
CREATE INDEX IF NOT EXISTS idx_subjects_user_id
    ON subjects(user_id);

CREATE INDEX IF NOT EXISTS idx_study_records_user_date
    ON study_records(user_id, study_date DESC);

CREATE INDEX IF NOT EXISTS idx_study_records_subject_id
    ON study_records(subject_id);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_user_date
    ON wrong_notes(user_id, study_date DESC);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_study_record_id
    ON wrong_notes(study_record_id);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_status
    ON wrong_notes(quest_status);

COMMIT;