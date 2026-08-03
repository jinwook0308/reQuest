import {
  Router,
  type Request,
  type Response,
} from 'express'

import { pool } from '../config/db'
import { APP_USER_EMAIL } from '../config/app'

const subjectsRouter = Router()

subjectsRouter.get(
  '/',
  async (_request: Request, response: Response) => {
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
      console.error('과목 목록 조회 실패:', error)

      response.status(500).json({
        success: false,
        message: '과목 목록을 불러오지 못했습니다.',
      })
    }
  },
)

export default subjectsRouter
