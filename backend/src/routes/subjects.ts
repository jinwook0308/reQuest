import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { APP_USER_EMAIL } from '../config/app'
import { pool } from '../config/db'

const subjectsRouter = Router()

const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '과목명을 입력해 주세요.')
    .max(
      50,
      '과목명은 50자 이하로 입력해 주세요.',
    ),
})

subjectsRouter.get(
  '/',
  async (
    _request: Request,
    response: Response,
  ) => {
    try {
      const result = await pool.query(
        `
          SELECT
            subjects.id,
            subjects.name
          FROM subjects
          INNER JOIN users
            ON users.id = subjects.user_id
          WHERE users.email = $1
          ORDER BY subjects.id ASC
        `,
        [APP_USER_EMAIL],
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

/**
 * 사용자 과목 추가
 * POST /api/subjects
 */
subjectsRouter.post(
  '/',
  async (
    request: Request,
    response: Response,
  ) => {
    const bodyResult =
      createSubjectSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        success: false,
        message:
          bodyResult.error.issues[0]?.message ??
          '과목명이 올바르지 않습니다.',
      })
      return
    }

    const { name } = bodyResult.data

    try {
      const result = await pool.query(
        `
          INSERT INTO subjects (
            user_id,
            name
          )
          SELECT
            users.id,
            $1
          FROM users
          WHERE users.email = $2
          RETURNING
            subjects.id,
            subjects.name
        `,
        [name, APP_USER_EMAIL],
      )

      if (result.rows.length === 0) {
        response.status(404).json({
          success: false,
          message:
            '과목을 추가할 사용자를 찾지 못했습니다.',
        })
        return
      }

      response.status(201).json({
        success: true,
        message:
          '새 과목 노트가 만들어졌습니다.',
        data: result.rows[0],
      })
    } catch (error) {
      const databaseError = error as {
        code?: string
      }

      if (databaseError.code === '23505') {
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