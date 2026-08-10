BEGIN;

ALTER TABLE study_records
    ADD COLUMN IF NOT EXISTS record_type VARCHAR(20)
        NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS certification_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS exam_date DATE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'study_records_record_type_check'
    ) THEN
        ALTER TABLE study_records
            ADD CONSTRAINT study_records_record_type_check
            CHECK (record_type IN ('general', 'certification'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'study_records_exam_type_check'
    ) THEN
        ALTER TABLE study_records
            ADD CONSTRAINT study_records_exam_type_check
            CHECK (
                exam_type IS NULL
                OR exam_type IN ('written', 'practical')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'study_records_certification_fields_check'
    ) THEN
        ALTER TABLE study_records
            ADD CONSTRAINT study_records_certification_fields_check
            CHECK (
                record_type = 'general'
                OR (
                    certification_name IS NOT NULL
                    AND exam_type IS NOT NULL
                )
            );
    END IF;
END
$$;

COMMIT;
