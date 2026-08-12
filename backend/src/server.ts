import path from 'node:path'

import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import helmet from 'helmet'
import multer from 'multer'

import { CORS_ORIGIN } from './config/app'
import { pool } from './config/db'
import aiConversationsRouter from './routes/aiConversations'
import authRouter from './routes/auth'
import reviewQuestDraftsRouter from './routes/reviewQuestDrafts'
import reviewQuestsRouter from './routes/reviewQuests'
import statisticsRouter from './routes/statistics'
import studyRecordsRouter from './routes/studyRecords'
import studyRecommendationsRouter from './routes/studyRecommendations'
import subjectsRouter from './routes/subjects'
import studySessionsRouter from './routes/studySessions'
import wrongNotesRouter from './routes/wrongNotes'

dotenv.config()

const app = express()

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
)


const PORT =
  Number(process.env.PORT) || 4000

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.use(
  '/uploads',
  express.static(
    path.resolve(
      __dirname,
      '../uploads',
    ),
  ),
)

app.use(
  '/api/auth',
  authRouter,
)

app.use(
  '/api/ai-conversations',
  aiConversationsRouter,
)

app.use(
  '/api/subjects',
  subjectsRouter,
)

app.use(
  '/api/study-records',
  studyRecordsRouter,
)

app.use(
  '/api/study-recommendations',
  studyRecommendationsRouter,
)

app.use(
  '/api/study-sessions',
  studySessionsRouter,
)

app.use(
  '/api/statistics',
  statisticsRouter,
)

app.use(
  '/api/wrong-notes',
  wrongNotesRouter,
)

app.use(
  '/api/review-quest-drafts',
  reviewQuestDraftsRouter,
)

app.use(
  '/api/review-quests',
  reviewQuestsRouter,
)

app.get(
  '/api/health',
  (
    _request: Request,
    response: Response,
  ) => {
    response.status(200).json({
      success: true,
      message:
        'reQuest 백엔드 서버가 정상적으로 실행 중입니다.',
      timestamp:
        new Date().toISOString(),
    })
  },
)

app.get(
  '/api/db-health',
  async (
    _request: Request,
    response: Response,
  ) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              NOW() AS database_time,
              current_database()
                AS database_name
          `,
        )

      response.status(200).json({
        success: true,
        message:
          'PostgreSQL 데이터베이스 연결에 성공했습니다.',
        databaseName:
          result.rows[0]
            .database_name,
        databaseTime:
          result.rows[0]
            .database_time,
      })
    } catch (error) {
      console.error(
        '데이터베이스 연결 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          'PostgreSQL 데이터베이스 연결에 실패했습니다.',
      })
    }
  },
)

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof multer.MulterError) {
      const isFileTooLarge =
        error.code === 'LIMIT_FILE_SIZE'

      response.status(400).json({
        success: false,
        message: isFileTooLarge
          ? '이미지는 10MB 이하만 업로드할 수 있습니다.'
          : '이미지 업로드 요청을 처리하지 못했습니다.',
      })
      return
    }

    if (
      error instanceof Error &&
      error.message ===
        'JPG 또는 PNG 이미지만 업로드할 수 있습니다.'
    ) {
      response.status(400).json({
        success: false,
        message: error.message,
      })
      return
    }

    console.error(
      '처리되지 않은 서버 오류:',
      error,
    )

    response.status(500).json({
      success: false,
      message: '서버에서 알 수 없는 오류가 발생했습니다.',
    })
  },
)

app.listen(PORT, () => {
  console.log(
    `reQuest 서버 실행: http://localhost:${PORT}`,
  )
})
