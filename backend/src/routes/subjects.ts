import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import { requireAuth } from '../middleware/requireAuth'

const subjectsRouter = Router()

subjectsRouter.use(requireAuth)

const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      1,
      '과목명을 입력해 주세요.',
    )
    .max(
      50,
      '과목명은 50자 이하로 입력해 주세요.',
    ),
})

subjectsRouter.get(
  '/',
  async (
    request: Request,
    response: Response,
  ) => {
    const userId =
      request.authUser?.id

    if (!userId) {
      response.status(401).json({
        success: false,
        message:
          '로그인이 필요합니다.',
      })
      return
    }

    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              name
            FROM subjects
            WHERE user_id = $1
            ORDER BY id ASC
          `,
          [userId],
        )

      response.status(200).json({
        success: true,
        data: result.rows,
      })
    } catch (error) {
      console.error(
        '과목 목록 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '과목 목록을 불러오지 못했습니다.',
      })
    }
  },
)

subjectsRouter.post(
  '/',
  async (
    request: Request,
    response: Response,
  ) => {
    const userId =
      request.authUser?.id

    if (!userId) {
      response.status(401).json({
        success: false,
        message:
          '로그인이 필요합니다.',
      })
      return
    }

    const bodyResult =
      createSubjectSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        success: false,
        message:
          bodyResult.error
            .issues[0]?.message ??
          '과목명이 올바르지 않습니다.',
      })
      return
    }

    const { name } =
      bodyResult.data

    try {
      const result =
        await pool.query(
          `
            INSERT INTO subjects (
              user_id,
              name
            )
            VALUES ($1, $2)
            RETURNING
              id,
              name
          `,
          [userId, name],
        )

      response.status(201).json({
        success: true,
        message:
          '새 과목 노트가 만들어졌습니다.',
        data: result.rows[0],
      })
    } catch (error) {
      const databaseError =
        error as {
          code?: string
        }

      if (
        databaseError.code ===
        '23505'
      ) {
        response.status(409).json({
          success: false,
          message:
            '이미 등록된 과목입니다.',
        })
        return
      }

      console.error(
        '과목 추가 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '과목을 추가하지 못했습니다.',
      })
    }
  },
)

export default subjectsRouter