BEGIN;

-- 개발 및 기능 테스트에 사용할 임시 사용자
INSERT INTO users (
    nickname,
    email
)
VALUES (
    'reQuest 테스트 사용자',
    'dev@request.local'
)
ON CONFLICT (email)
DO UPDATE SET
    nickname = EXCLUDED.nickname,
    updated_at = NOW();

-- 테스트 사용자의 기본 학습 과목
INSERT INTO subjects (
    user_id,
    name
)
SELECT
    users.id,
    subject_names.name
FROM users
CROSS JOIN (
    VALUES
        ('수학'),
        ('국어'),
        ('영어'),
        ('과학'),
        ('사회'),
        ('프로그래밍'),
        ('기타')
) AS subject_names(name)
WHERE users.email = 'dev@request.local'
ON CONFLICT (user_id, name)
DO NOTHING;

COMMIT;

-- 입력된 데이터 확인
SELECT
    users.id AS user_id,
    users.nickname,
    users.email,
    subjects.id AS subject_id,
    subjects.name AS subject_name
FROM users
LEFT JOIN subjects
    ON subjects.user_id = users.id
WHERE users.email = 'dev@request.local'
ORDER BY subjects.id;