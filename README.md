# reQuest

학습 기록과 오답을 복습 퀘스트로 연결하는 자기주도 학습 플랫폼입니다. 사용자가 공부한 내용과 틀린 이유를 기록하면 복습 문제를 검토·수정한 뒤 퀴즈로 풀고, 결과를 통계에서 확인할 수 있습니다.

## 구현된 MVP

- 주간 학습 대시보드와 학습 항목 체크
- 학습 기록 작성, 목록, 상세보기, 삭제
- 오답 이미지 업로드와 오답노트 작성, 검색, 필터, 상세보기, 삭제
- 학습 기록·오답노트 기반 객관식, OX, 단답형 복습 문제 검토
- 서버 기준 채점, 즉시 피드백, 오답 재도전
- 복습 대기, 재도전 필요, 마스터 상태 관리
- 학습 시간, 이해도 변화, 과목별 통계, 학습 히트맵
- PostgreSQL 기반 영구 저장

복습 문제 초안은 OpenAI API를 이용해 생성합니다. OpenAI API 키가 설정되지 않았거나 AI 요청에 실패하면 규칙 기반 생성기를 대신 사용합니다. 생성된 문제는 바로 출제하지 않고 사용자가 문제·정답·해설을 검토하고 수정한 뒤 저장할 수 있습니다.

AI 문제 생성 API는 과도한 호출과 비용 발생을 방지하기 위해 IP당 10분에 최대 10회로 제한됩니다. 제한을 초과하면 HTTP 429 응답을 반환합니다.

복습 문제 초안은 `POST /api/review-quest-drafts/:sourceType/:sourceId`로 생성합니다. `sourceType`은 `study-record` 또는 `wrong-note`이며, 이 API는 초안만 반환하고 자동 저장하지 않습니다.

## 기술 스택

- 프론트엔드: React, TypeScript, Vite, React Router, Recharts, Lucide React, 페이지별 CSS
- 백엔드: Node.js, Express, TypeScript, Zod, Multer, OpenAI API, Helmet, express-rate-limit
- 데이터베이스: PostgreSQL
- 테스트: Node.js Test Runner, TypeScript 빌드, Oxlint

## 프로젝트 구조

```text
reQuest/
├─ frontend/              React 웹 애플리케이션
├─ backend/
│  ├─ database/           PostgreSQL 스키마, 시드, 마이그레이션
│  ├─ src/config/         환경설정, DB, 업로드 설정
│  ├─ src/routes/         REST API
│  └─ src/services/       퀴즈 채점 로직과 테스트
└─ README.md
```

## 처음 실행하기

### 1. PostgreSQL 준비

PostgreSQL에서 `request_db` 데이터베이스를 만든 뒤 다음 SQL을 순서대로 실행합니다.

1. 새 데이터베이스: `backend/database/schema.sql`
2. 개발용 사용자와 기본 과목: `backend/database/seed.sql`
3. 기존 MVP 데이터베이스만 해당: `backend/database/review_quests.sql`

새 데이터베이스에는 `schema.sql`에 복습 문제 테이블까지 포함되어 있으므로 3번 마이그레이션을 다시 실행할 필요가 없습니다.

### 2. 백엔드 설정과 실행

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

`backend/.env`의 `DB_PASSWORD`를 실제 PostgreSQL 비밀번호로 변경합니다. 기본 API 주소는 `http://localhost:4000/api`입니다.

### 3. 프론트엔드 설정과 실행

새 터미널에서 실행합니다.

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

기본 웹 주소는 `http://localhost:5173`입니다.

## 환경변수

백엔드:

- `PORT`: API 서버 포트
- `CORS_ORIGIN`: 접근을 허용할 프론트엔드 주소
- `APP_USER_EMAIL`: 로그인 기능 연결 전 사용할 개발용 사용자 이메일
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL 연결 정보
- `OPENAI_API_KEY`: OpenAI 복습 문제 생성에 사용하는 비밀 API 키
- `OPENAI_MODEL`: 문제 생성에 사용할 OpenAI 모델 이름

> 실제 `.env` 파일과 `OPENAI_API_KEY`, 데이터베이스 비밀번호는 GitHub에 올리지 않습니다. `.env.example`에는 실제 비밀정보 대신 예시 값만 작성합니다.

프론트엔드:

- `VITE_API_URL`: 백엔드 API 기본 주소

현재는 MVP 범위에서 `APP_USER_EMAIL`의 개발용 사용자를 사용합니다. 실제 배포 전에는 회원가입·로그인과 사용자별 인증을 연결해야 합니다.

## 품질 검사

```bash
cd backend
npm run typecheck
npm test
npm run build

cd ../frontend
npm run lint
npm run build
```

이미지는 JPG 또는 PNG만 허용하며 최대 크기는 10MB입니다. 업로드 파일 자체의 이미지 서명도 서버에서 확인합니다.
