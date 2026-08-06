import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import {
  isOpenAIConfigured,
} from '../config/openai'
import {
  aiRateLimit,
} from '../middleware/aiRateLimit'
import {
  requireAuth,
} from '../middleware/requireAuth'
import {
  createOpenAIReviewQuestions,
} from '../services/openAiReviewQuestGenerator'
import {
  createRuleBasedReviewQuestions,
  type ReviewQuestionDraft,
  type ReviewQuestSource,
} from '../services/reviewQuestGenerator'

const reviewQuestDraftsRouter =
  Router()

reviewQuestDraftsRouter.use(
  requireAuth,
)

type ReviewQuestionGenerator =
  | 'openai'
  | 'rule-based'
  | 'rule-based-fallback'

interface GeneratedReviewQuestions {
  generator: ReviewQuestionGenerator
  questions: ReviewQuestionDraft[]
}

const sourceParamsSchema =
  z.object({
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
  sourceType:
    | 'study-record'
    | 'wrong-note',
  sourceId: number,
  userId: string,
) {
  const query =
    sourceType === 'wrong-note'
      ? `
          SELECT
            COALESCE(
              subjects.name,
              '기타'
            ) AS subject,
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
            wrong_notes.concepts,
            wrong_notes.wrong_image_path
              AS "wrongImagePath"

          FROM wrong_notes

          LEFT JOIN subjects
            ON subjects.id =
              wrong_notes.subject_id

          WHERE
            wrong_notes.id = $1
            AND wrong_notes.user_id = $2

          LIMIT 1
        `
      : `
          SELECT
            COALESCE(
              subjects.name,
              '기타'
            ) AS subject,
            study_records.unit,
            study_records.learned,
            study_records.difficult,
            study_records.keywords,
            '' AS "mistakeQuestion",
            '' AS "wrongAnswer",
            '' AS "correctAnswer",
            '' AS "mistakeReason",
            '' AS concepts,
            NULL::TEXT
              AS "wrongImagePath"

          FROM study_records

          LEFT JOIN subjects
            ON subjects.id =
              study_records.subject_id

          WHERE
            study_records.id = $1
            AND study_records.user_id = $2

          LIMIT 1
        `

  const result =
    await pool.query(
      query,
      [
        sourceId,
        userId,
      ],
    )

  return result.rows[0] as
    | ReviewQuestSource
    | undefined
}

function getErrorMessage(
  error: unknown,
) {
  if (error instanceof Error) {
    return error.message
  }

  return '알 수 없는 AI 오류'
}

async function generateReviewQuestions(
  source: ReviewQuestSource,
): Promise<GeneratedReviewQuestions> {
  if (!isOpenAIConfigured) {
    return {
      generator: 'rule-based',
      questions:
        createRuleBasedReviewQuestions(
          source,
        ),
    }
  }

  try {
    const questions =
      await createOpenAIReviewQuestions(
        source,
      )

    return {
      generator: 'openai',
      questions,
    }
  } catch (error) {
    console.warn(
      'OpenAI 문제 생성 실패, 규칙 기반 생성기로 전환:',
      getErrorMessage(error),
    )

    return {
      generator:
        'rule-based-fallback',
      questions:
        createRuleBasedReviewQuestions(
          source,
        ),
    }
  }
}

/**
 * 검토 전 복습 문제 초안 생성
 * POST /api/review-quest-drafts/:sourceType/:sourceId
 */
reviewQuestDraftsRouter.post(
  '/:sourceType/:sourceId',
  aiRateLimit,
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
      const source =
        await loadSource(
          sourceType,
          sourceId,
          userId,
        )

      if (!source) {
        response.status(404).json({
          success: false,
          message:
            '복습 문제를 생성할 학습 자료를 찾지 못했습니다.',
        })
        return
      }

      const {
        generator,
        questions,
      } =
        await generateReviewQuestions(
          source,
        )

      const message =
        generator === 'openai'
          ? 'AI가 검토할 복습 문제 초안을 생성했습니다.'
          : generator ===
              'rule-based-fallback'
            ? 'AI 연결을 사용하지 못해 기본 복습 문제를 생성했습니다.'
            : '검토할 기본 복습 문제 초안이 생성되었습니다.'

      response.status(200).json({
        success: true,
        message,
        data: {
          sourceType,
          sourceId,
          generator,
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