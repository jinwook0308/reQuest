import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import { requireAuth } from '../middleware/requireAuth'

const dailyGoalsRouter = Router()

dailyGoalsRouter.use(requireAuth)

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)

    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, '존재하는 날짜를 입력해 주세요.')

const contentSchema = z
  .string()
  .trim()
  .min(1, '하루 목표 내용을 입력해 주세요.')
  .max(300, '하루 목표는 300자 이하로 입력해 주세요.')

const dateRangeSchema = z
  .object({
    startDate: dateKeySchema,
    endDate: dateKeySchema,
  })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    message: '조회 시작일은 종료일보다 늦을 수 없습니다.',
  })

const createGoalSchema = z.object({
  date: dateKeySchema,
  content: contentSchema,
})

const updateGoalSchema = z
  .object({
    content: contentSchema.optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine(
    ({ content, isCompleted }) => content !== undefined || isCompleted !== undefined,
    {
      message: '수정할 하루 목표 정보를 입력해 주세요.',
    },
  )

const goalIdSchema = z.coerce.number().int().positive()

function sendValidationError(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({
    success: false,
    message: issues[0]?.message ?? '입력값을 확인해 주세요.',
    data: {
      issues: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  })
}

dailyGoalsRouter.get('/', async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const parsed = dateRangeSchema.safeParse(request.query)

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  try {
    const result = await pool.query(
      `
          SELECT
            id::TEXT AS id,
            TO_CHAR(goal_date, 'YYYY-MM-DD') AS date,
            content,
            is_completed AS "isCompleted",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM daily_goals
          WHERE
            user_id = $1
            AND goal_date BETWEEN $2::DATE AND $3::DATE
          ORDER BY goal_date ASC, created_at ASC, id ASC
        `,
      [userId, parsed.data.startDate, parsed.data.endDate],
    )

    response.status(200).json({
      success: true,
      message: '하루 목표 목록을 불러왔습니다.',
      data: result.rows,
    })
  } catch (error) {
    console.error('하루 목표 목록 조회 실패:', error)

    response.status(500).json({
      success: false,
      message: '하루 목표를 불러오지 못했습니다.',
    })
  }
})

dailyGoalsRouter.post('/', async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const parsed = createGoalSchema.safeParse(request.body)

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  try {
    const result = await pool.query(
      `
          INSERT INTO daily_goals (
            user_id,
            goal_date,
            content
          )
          VALUES ($1, $2::DATE, $3)
          RETURNING
            id::TEXT AS id,
            TO_CHAR(goal_date, 'YYYY-MM-DD') AS date,
            content,
            is_completed AS "isCompleted",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
      [userId, parsed.data.date, parsed.data.content],
    )

    response.status(201).json({
      success: true,
      message: '하루 목표를 추가했습니다.',
      data: {
        goal: result.rows[0],
      },
    })
  } catch (error) {
    console.error('하루 목표 추가 실패:', error)

    response.status(500).json({
      success: false,
      message: '하루 목표를 추가하지 못했습니다.',
    })
  }
})

dailyGoalsRouter.patch('/:goalId', async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const goalId = goalIdSchema.safeParse(request.params.goalId)
  const parsed = updateGoalSchema.safeParse(request.body)

  if (!goalId.success) {
    sendValidationError(response, goalId.error.issues)
    return
  }

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  try {
    const result = await pool.query(
      `
          UPDATE daily_goals
          SET
            content = COALESCE($3::TEXT, content),
            is_completed = COALESCE($4::BOOLEAN, is_completed),
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING
            id::TEXT AS id,
            TO_CHAR(goal_date, 'YYYY-MM-DD') AS date,
            content,
            is_completed AS "isCompleted",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
      [goalId.data, userId, parsed.data.content ?? null, parsed.data.isCompleted ?? null],
    )

    const goal = result.rows[0]

    if (!goal) {
      response.status(404).json({
        success: false,
        message: '수정할 하루 목표를 찾을 수 없습니다.',
      })
      return
    }

    response.status(200).json({
      success: true,
      message: '하루 목표를 수정했습니다.',
      data: { goal },
    })
  } catch (error) {
    console.error('하루 목표 수정 실패:', error)

    response.status(500).json({
      success: false,
      message: '하루 목표를 수정하지 못했습니다.',
    })
  }
})

dailyGoalsRouter.delete('/:goalId', async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const goalId = goalIdSchema.safeParse(request.params.goalId)

  if (!goalId.success) {
    sendValidationError(response, goalId.error.issues)
    return
  }

  try {
    const result = await pool.query(
      `
          DELETE FROM daily_goals
          WHERE id = $1 AND user_id = $2
          RETURNING id::TEXT AS id
        `,
      [goalId.data, userId],
    )

    if (!result.rows[0]) {
      response.status(404).json({
        success: false,
        message: '삭제할 하루 목표를 찾을 수 없습니다.',
      })
      return
    }

    response.status(200).json({
      success: true,
      message: '하루 목표를 삭제했습니다.',
      data: {
        id: result.rows[0].id,
      },
    })
  } catch (error) {
    console.error('하루 목표 삭제 실패:', error)

    response.status(500).json({
      success: false,
      message: '하루 목표를 삭제하지 못했습니다.',
    })
  }
})

export default dailyGoalsRouter
