import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { APP_USER_EMAIL } from '../config/app'
import { pool } from '../config/db'
import {
  createRuleBasedReviewQuestions,
  type ReviewQuestSource,
} from '../services/reviewQuestGenerator'

const reviewQuestDraftsRouter = Router()

const sourceParamsSchema = z.object({
  sourceType: z.enum([
    'study-record',
    'wrong-note',
  ]),
  sourceId: z.coerce
    .number()
    .int()
    .positive(),
})

async function loadSource(
  sourceType: 'study-record' | 'wrong-note',
  sourceId: number,
) {
  const query =
    sourceType === 'wrong-note'
      ? `
          SELECT
            COALESCE(subjects.name, '기타')
              AS subject,
            wrong_notes.unit,
            '' AS learned,
            '' AS difficult,
            '' AS keywords,
            wrong_notes.mistake_question
              AS "mistakeQuestion",
            wrong_notes.wrong_answer
              AS "wrongAnswer",
            wrong_notes.correct_answer
              AS "correctAnswer",
            wrong_notes.mistake_reason
              AS "mistakeReason",
            wrong_notes.concepts

          FROM wrong_notes

          INNER JOIN users
            ON users.id = wrong_notes.user_id

          LEFT JOIN subjects
            ON subjects.id = wrong_notes.subject_id

          WHERE
            wrong_notes.id = $1
            AND users.email = $2

          LIMIT 1
        `
      : `
          SELECT
            COALESCE(subjects.name, '기타')
              AS subject,
            study_records.unit,
            study_records.learned,
            study_records.difficult,
            study_records.keywords,
            '' AS "mistakeQuestion",
            '' AS "wrongAnswer",
            '' AS "correctAnswer",
            '' AS "mistakeReason",
            '' AS concepts

          FROM study_records

          INNER JOIN users
            ON users.id = study_records.user_id

          LEFT JOIN subjects
            ON subjects.id = study_records.subject_id

          WHERE
            study_records.id = $1
            AND users.email = $2

          LIMIT 1
        `

  const result = await pool.query(
    query,
    [sourceId, APP_USER_EMAIL],
  )

  return (
    result.rows[0] as
      | ReviewQuestSource
      | undefined
  )
}

/**
 * 검토 전 복습 문제 초안 생성
 * POST /api/review-quest-drafts/:sourceType/:sourceId
 */
reviewQuestDraftsRouter.post(
  '/:sourceType/:sourceId',
  async (
    request: Request,
    response: Response,
  ) => {
    const paramsResult =
      sourceParamsSchema.safeParse(
        request.params,
      )

    if (!paramsResult.success) {
      response.status(400).json({
        success: false,
        message:
          '복습 문제를 생성할 주소가 올바르지 않습니다.',
      })
      return
    }

    const {
      sourceType,
      sourceId,
    } = paramsResult.data

    try {
      const source = await loadSource(
        sourceType,
        sourceId,
      )

      if (!source) {
        response.status(404).json({
          success: false,
          message:
            '복습 문제를 생성할 학습 자료를 찾지 못했습니다.',
        })
        return
      }

      const questions =
        createRuleBasedReviewQuestions(
          source,
        )

      response.status(200).json({
        success: true,
        message:
          '검토할 복습 문제 초안이 생성되었습니다.',
        data: {
          sourceType,
          sourceId,
          generator: 'rule-based',
          questions,
        },
      })
    } catch (error) {
      console.error(
        '복습 문제 초안 생성 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '복습 문제 초안을 생성하지 못했습니다.',
      })
    }
  },
)

export default reviewQuestDraftsRouter
