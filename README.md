# reQuest

학습 기록과 오답을 복습 퀘스트로 연결하는 자기주도 학습 플랫폼입니다.

## 현재 구현된 프론트엔드 MVP

- 주간 학습 대시보드
- 학습 기록 작성, 목록, 상세보기
- 오답 이미지와 오답노트 등록
- 오답노트 검색, 필터, 상태 관리
- 객관식, OX, 단답형 복습 문제
- 즉시 채점과 오답 재도전
- 복습 대기, 재도전 필요, 마스터 상태
- 학습시간, 이해도, 히트맵 통계

현재 MVP는 브라우저 `localStorage`와 규칙 기반 Mock Generator를 사용합니다.
이후 Node.js, Express, PostgreSQL과 실제 AI Adapter를 연결할 예정입니다.

## 기술 스택

- React
- TypeScript
- Vite
- React Router
- Recharts
- Lucide React
- 페이지별 CSS

## 로컬 실행

```bash
cd frontend
npm install
npm run dev
```

기본 개발 주소는 `http://localhost:5173`입니다.

## 품질 검사

```bash
cd frontend
npm run lint
npm run build
```

## 프로젝트 구조

```text
reQuest/
├─ frontend/   React 프론트엔드 MVP
├─ backend/    Express 백엔드 예정
└─ docs/       설계 및 오픈소스 문서 예정
```

