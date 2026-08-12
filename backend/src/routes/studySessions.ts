import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import { requireAuth } from '../middleware/requireAuth'

const studySessionsRouter = Router()

studySessionsRouter.use(requireAuth)

const sessionIdSchema = z.coerce.number().int().positive()

const createSessionSchema = z.object({
  recordType: z
    .enum(['general', 'certification'])
    .default('general'),
  mode: z.enum(['focus', 'practice']),
  subject: z
    .string()
    .trim()
    .min(1, '공부 과목을 입력해 주세요.')
    .max(120, '공부 과목은 120자 이하로 입력해 주세요.'),
  unit: z
    .string()
    .trim()
    .min(1, '공부할 내용을 입력해 주세요.')
    .max(150, '공부할 내용은 150자 이하로 입력해 주세요.'),
  targetMinutes: z.coerce
    .number()
    .int()
    .min(1, '목표 시간은 1분 이상이어야 합니다.')
    .max(1440, '목표 시간은 1440분 이하로 입력해 주세요.'),
})

const pauseSessionSchema = z.object({
  interruption: z.boolean().optional().default(false),
})

const sessionSelect = `
  SELECT
    id,
    record_type AS "recordType",
    mode,
    subject,
    unit,
    target_minutes AS "targetMinutes",
    status,
    started_at AS "startedAt",
    ended_at AS "endedAt",
    focused_seconds AS "storedFocusedSeconds",
    paused_seconds AS "pausedSeconds",
    interruption_count AS "interruptionCount",
    focused_seconds +
      CASE
        WHEN status = 'running' AND last_resumed_at IS NOT NULL
          THEN GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - last_resumed_at)))::INTEGER
          )
        ELSE 0
      END AS "elapsedSeconds"
  FROM study_sessions
`

async function findSession(
  sessionId: number,
  userId: string,
) {
  const result = await pool.query(
    `${sessionSelect}
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  )

  return result.rows[0] ?? null
}

studySessionsRouter.post(
  '/',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id

    if (!userId) {
      response.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      })
      return
    }

    const parsed = createSessionSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.',
      })
      return
    }

    try {
      const activeResult = await pool.query(
        `${sessionSelect}
         WHERE user_id = $1
           AND status IN ('running', 'paused')
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId],
      )

      if (activeResult.rows[0]) {
        response.status(409).json({
          success: false,
          message: '이미 진행 중인 공부 세션이 있습니다.',
          data: activeResult.rows[0],
        })
        return
      }

      const { recordType, mode, subject, unit, targetMinutes } = parsed.data
      const inserted = await pool.query(
        `
          INSERT INTO study_sessions (
            user_id,
            record_type,
            mode,
            subject,
            unit,
            target_minutes,
            status,
            last_resumed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'running', NOW())
          RETURNING id
        `,
        [userId, recordType, mode, subject, unit, targetMinutes],
      )

      const session = await findSession(
        Number(inserted.rows[0].id),
        userId,
      )

      response.status(201).json({
        success: true,
        message: '공부 세션을 시작했습니다.',
        data: session,
      })
    } catch (error) {
      console.error('공부 세션 시작 실패:', error)
      response.status(500).json({
        success: false,
        message: '공부 세션을 시작하지 못했습니다.',
      })
    }
  },
)

studySessionsRouter.get(
  '/active',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id

    if (!userId) {
      response.status(401).json({ success: false, message: '로그인이 필요합니다.' })
      return
    }

    try {
      const result = await pool.query(
        `${sessionSelect}
         WHERE user_id = $1
           AND status IN ('running', 'paused')
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId],
      )

      response.json({
        success: true,
        data: result.rows[0] ?? null,
      })
    } catch (error) {
      console.error('진행 중인 공부 세션 조회 실패:', error)
      response.status(500).json({
        success: false,
        message: '진행 중인 공부 세션을 불러오지 못했습니다.',
      })
    }
  },
)

studySessionsRouter.get(
  '/',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id

    if (!userId) {
      response.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      })
      return
    }

    const parsedDays = z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .safeParse(request.query.days ?? 120)

    if (!parsedDays.success) {
      response.status(400).json({
        success: false,
        message: '조회 기간은 1일에서 365일 사이로 입력해 주세요.',
      })
      return
    }

    try {
      const result = await pool.query(
        `${sessionSelect}
         WHERE user_id = $1
           AND status = 'completed'
           AND ended_at >= NOW() - ($2::TEXT || ' days')::INTERVAL
         ORDER BY ended_at ASC, id ASC`,
        [userId, parsedDays.data],
      )

      response.json({
        success: true,
        data: result.rows,
      })
    } catch (error) {
      console.error('완료된 공부 세션 조회 실패:', error)
      response.status(500).json({
        success: false,
        message: '완료된 공부 세션을 불러오지 못했습니다.',
      })
    }
  },
)

studySessionsRouter.get(
  '/summary',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const days = Math.min(
      365,
      Math.max(1, Number(request.query.days) || 30),
    )

    if (!userId) {
      response.status(401).json({ success: false, message: '로그인이 필요합니다.' })
      return
    }

    try {
      const result = await pool.query(
        `
          SELECT
            COUNT(*)::INTEGER AS "sessionCount",
            COALESCE(SUM(focused_seconds), 0)::INTEGER AS "totalFocusedSeconds",
            COALESCE(ROUND(AVG(focused_seconds)), 0)::INTEGER AS "averageFocusedSeconds",
            COALESCE(SUM(interruption_count), 0)::INTEGER AS "interruptionCount",
            COUNT(*) FILTER (WHERE mode = 'focus')::INTEGER AS "focusSessionCount",
            COUNT(*) FILTER (WHERE mode = 'practice')::INTEGER AS "practiceSessionCount",
            COUNT(*) FILTER (
              WHERE focused_seconds >= target_minutes * 60
            )::INTEGER AS "completedTargetCount"
          FROM study_sessions
          WHERE user_id = $1
            AND status = 'completed'
            AND ended_at >= NOW() - ($2::TEXT || ' days')::INTERVAL
        `,
        [userId, days],
      )

      response.json({
        success: true,
        data: {
          days,
          ...result.rows[0],
        },
      })
    } catch (error) {
      console.error('집중 세션 통계 조회 실패:', error)
      response.status(500).json({
        success: false,
        message: '집중 세션 통계를 불러오지 못했습니다.',
      })
    }
  },
)

studySessionsRouter.get(
  '/:sessionId',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const parsedId = sessionIdSchema.safeParse(request.params.sessionId)

    if (!userId) {
      response.status(401).json({ success: false, message: '로그인이 필요합니다.' })
      return
    }

    if (!parsedId.success) {
      response.status(400).json({ success: false, message: '세션 번호가 올바르지 않습니다.' })
      return
    }

    try {
      const session = await findSession(parsedId.data, userId)

      if (!session) {
        response.status(404).json({ success: false, message: '공부 세션을 찾을 수 없습니다.' })
        return
      }

      response.json({ success: true, data: session })
    } catch (error) {
      console.error('공부 세션 조회 실패:', error)
      response.status(500).json({ success: false, message: '공부 세션을 불러오지 못했습니다.' })
    }
  },
)

studySessionsRouter.patch(
  '/:sessionId/pause',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const parsedId = sessionIdSchema.safeParse(request.params.sessionId)
    const parsedBody = pauseSessionSchema.safeParse(request.body ?? {})

    if (!userId) {
      response.status(401).json({ success: false, message: '로그인이 필요합니다.' })
      return
    }

    if (!parsedId.success || !parsedBody.success) {
      response.status(400).json({ success: false, message: '일시정지 요청이 올바르지 않습니다.' })
      return
    }

    try {
      const result = await pool.query(
        `
          UPDATE study_sessions
          SET
            focused_seconds = focused_seconds + GREATEST(
              0,
              FLOOR(EXTRACT(EPOCH FROM (NOW() - last_resumed_at)))::INTEGER
            ),
            status = 'paused',
            paused_at = NOW(),
            last_resumed_at = NULL,
            interruption_count = interruption_count + $3,
            updated_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND status = 'running'
          RETURNING id
        `,
        [parsedId.data, userId, parsedBody.data.interruption ? 1 : 0],
      )

      if (!result.rows[0]) {
        response.status(409).json({ success: false, message: '현재 세션은 일시정지할 수 없습니다.' })
        return
      }

      response.json({
        success: true,
        message: parsedBody.data.interruption
          ? '화면 이탈을 감지해 집중 학습을 일시정지했습니다.'
          : '공부 세션을 일시정지했습니다.',
        data: await findSession(parsedId.data, userId),
      })
    } catch (error) {
      console.error('공부 세션 일시정지 실패:', error)
      response.status(500).json({ success: false, message: '공부 세션을 일시정지하지 못했습니다.' })
    }
  },
)

studySessionsRouter.patch(
  '/:sessionId/resume',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const parsedId = sessionIdSchema.safeParse(request.params.sessionId)

    if (!userId) {
      response.status(401).json({ success: false, message: '로그인이 필요합니다.' })
      return
    }

    if (!parsedId.success) {
      response.status(400).json({ success: false, message: '세션 번호가 올바르지 않습니다.' })
      return
    }

    try {
      const result = await pool.query(
        `
          UPDATE study_sessions
          SET
            paused_seconds = paused_seconds + GREATEST(
              0,
              FLOOR(EXTRACT(EPOCH FROM (NOW() - paused_at)))::INTEGER
            ),
            status = 'running',
            last_resumed_at = NOW(),
            paused_at = NULL,
            updated_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND status = 'paused'
          RETURNING id
        `,
        [parsedId.data, userId],
      )

      if (!result.rows[0]) {
        response.status(409).json({ success: false, message: '현재 세션은 다시 시작할 수 없습니다.' })
        return
      }

      response.json({
        success: true,
        message: '공부 세션을 다시 시작했습니다.',
        data: await findSession(parsedId.data, userId),
      })
    } catch (error) {
      console.error('공부 세션 재개 실패:', error)
      response.status(500).json({ success: false, message: '공부 세션을 다시 시작하지 못했습니다.' })
    }
  },
)

studySessionsRouter.patch(
  '/:sessionId/finish',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const parsedId = sessionIdSchema.safeParse(request.params.sessionId)

    if (!userId) {
      response.status(401).json({ success: false, message: '로그인이 필요합니다.' })
      return
    }

    if (!parsedId.success) {
      response.status(400).json({ success: false, message: '세션 번호가 올바르지 않습니다.' })
      return
    }

    try {
      const result = await pool.query(
        `
          UPDATE study_sessions
          SET
            focused_seconds = focused_seconds +
              CASE
                WHEN status = 'running' AND last_resumed_at IS NOT NULL
                  THEN GREATEST(
                    0,
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - last_resumed_at)))::INTEGER
                  )
                ELSE 0
              END,
            paused_seconds = paused_seconds +
              CASE
                WHEN status = 'paused' AND paused_at IS NOT NULL
                  THEN GREATEST(
                    0,
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - paused_at)))::INTEGER
                  )
                ELSE 0
              END,
            status = 'completed',
            ended_at = NOW(),
            last_resumed_at = NULL,
            paused_at = NULL,
            updated_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND status IN ('running', 'paused')
          RETURNING id
        `,
        [parsedId.data, userId],
      )

      if (!result.rows[0]) {
        response.status(409).json({ success: false, message: '이미 종료되었거나 존재하지 않는 세션입니다.' })
        return
      }

      response.json({
        success: true,
        message: '공부 세션을 종료했습니다.',
        data: await findSession(parsedId.data, userId),
      })
    } catch (error) {
      console.error('공부 세션 종료 실패:', error)
      response.status(500).json({ success: false, message: '공부 세션을 종료하지 못했습니다.' })
    }
  },
)

export default studySessionsRouter
