import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import { isOpenAIConfigured } from '../config/openai'
import { aiRecommendationRateLimit } from '../middleware/aiRateLimit'
import { requireAuth } from '../middleware/requireAuth'
import { createOpenAIStudyRecommendations } from '../services/openAiStudyRecommendation'
import {
  createRuleBasedStudyRecommendations,
  type StudyRecommendation,
  type StudyRecommendationSource,
} from '../services/studyRecommendation'

const studyRecommendationsRouter = Router()

studyRecommendationsRouter.use(requireAuth)

const recordIdSchema = z.coerce.number().int().positive()

const recommendationListSchema = z
  .array(
    z.object({
      concept: z.string().min(1).max(300),
      reason: z.string().min(1).max(3000),
      action: z.string().min(1).max(3000),
      examArea: z.string().min(1).max(300).optional(),
      questionType: z.string().min(1).max(300).optional(),
    }),
  )
  .min(1)
  .max(3)

type RecommendationGenerator =
  | 'openai'
  | 'rule-based'
  | 'rule-based-fallback'

type StudyRecommendationSourceRow = {
  recordType: 'general' | 'certification'
  subject: string
  certificationName: string | null
  examType: 'written' | 'practical' | null
  examDate: string | null
  unit: string
  learned: string
  difficult: string
  keywords: string
  understanding: number | string
}

type StoredRecommendationRow = {
  generator: RecommendationGenerator | null
  recommendations: unknown
  updated_at: Date | string | null
}

async function saveRecommendationSet(
  userId: string,
  recordId: number,
  generator: RecommendationGenerator,
  recommendations: StudyRecommendation[],
) {
  const result = await pool.query<{
    updated_at: Date | string
  }>(
    `
      INSERT INTO study_recommendation_sets (
        user_id,
        study_record_id,
        generator,
        recommendations
      )
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (user_id, study_record_id)
      DO UPDATE SET
        generator = EXCLUDED.generator,
        recommendations = EXCLUDED.recommendations,
        updated_at = NOW()
      RETURNING updated_at
    `,
    [
      userId,
      recordId,
      generator,
      JSON.stringify(recommendations),
    ],
  )

  return result.rows[0]?.updated_at
}

studyRecommendationsRouter.get(
  '/:recordId',
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const recordIdResult = recordIdSchema.safeParse(
      request.params.recordId,
    )

    if (!userId) {
      response.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      })
      return
    }

    if (!recordIdResult.success) {
      response.status(400).json({
        success: false,
        message: '학습 기록 ID가 올바르지 않습니다.',
      })
      return
    }

    try {
      const result = await pool.query<StoredRecommendationRow>(
        `
          SELECT
            study_recommendation_sets.generator,
            study_recommendation_sets.recommendations,
            study_recommendation_sets.updated_at
          FROM study_records
          LEFT JOIN study_recommendation_sets
            ON study_recommendation_sets.study_record_id = study_records.id
            AND study_recommendation_sets.user_id = study_records.user_id
          WHERE
            study_records.id = $1
            AND study_records.user_id = $2
          LIMIT 1
        `,
        [recordIdResult.data, userId],
      )

      const storedSet = result.rows[0]

      if (!storedSet) {
        response.status(404).json({
          success: false,
          message: '학습 기록을 찾을 수 없습니다.',
        })
        return
      }

      if (!storedSet.generator) {
        response.status(200).json({
          success: true,
          message: '아직 저장된 AI 맞춤 추천이 없습니다.',
          data: null,
        })
        return
      }

      const recommendationsResult =
        recommendationListSchema.safeParse(
          storedSet.recommendations,
        )

      if (!recommendationsResult.success) {
        throw new Error(
          '저장된 AI 추천 데이터 형식이 올바르지 않습니다.',
        )
      }

      response.status(200).json({
        success: true,
        message: '저장된 AI 맞춤 추천을 불러왔습니다.',
        data: {
          generator: storedSet.generator,
          recommendations: recommendationsResult.data,
          updatedAt: storedSet.updated_at,
        },
      })
    } catch (error) {
      console.error('맞춤 학습 추천 조회 실패:', error)
      response.status(500).json({
        success: false,
        message:
          '저장된 AI 맞춤 추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      })
    }
  },
)

studyRecommendationsRouter.post(
  '/:recordId',
  aiRecommendationRateLimit,
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id
    const recordIdResult = recordIdSchema.safeParse(
      request.params.recordId,
    )

    if (!userId) {
      response.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      })
      return
    }

    if (!recordIdResult.success) {
      response.status(400).json({
        success: false,
        message: '학습 기록 ID가 올바르지 않습니다.',
      })
      return
    }

    try {
      const recordResult =
        await pool.query<StudyRecommendationSourceRow>(
          `
            SELECT
              study_records.record_type AS "recordType",
              COALESCE(subjects.name, '기타') AS subject,
              study_records.certification_name AS "certificationName",
              study_records.exam_type AS "examType",
              TO_CHAR(
                study_records.exam_date,
                'YYYY-MM-DD'
              ) AS "examDate",
              study_records.unit,
              study_records.learned,
              study_records.difficult,
              study_records.keywords,
              study_records.understanding
            FROM study_records
            LEFT JOIN subjects
              ON subjects.id = study_records.subject_id
            WHERE
              study_records.id = $1
              AND study_records.user_id = $2
            LIMIT 1
          `,
          [recordIdResult.data, userId],
        )

      const storedRecord = recordResult.rows[0]

      if (!storedRecord) {
        response.status(404).json({
          success: false,
          message: '학습 기록을 찾을 수 없습니다.',
        })
        return
      }

      const source: StudyRecommendationSource = {
        ...storedRecord,
        difficult: storedRecord.difficult ?? '',
        keywords: storedRecord.keywords ?? '',
        understanding: Number(storedRecord.understanding),
      }

      let generator: RecommendationGenerator
      let recommendations: StudyRecommendation[]
      let message: string

      if (isOpenAIConfigured) {
        try {
          recommendations =
            await createOpenAIStudyRecommendations(source)
          generator = 'openai'
          message =
            '저장된 학습 기록을 바탕으로 AI 맞춤 추천을 만들고 저장했습니다.'
        } catch (error) {
          console.warn(
            'OpenAI 학습 추천 실패, 기본 추천으로 전환:',
            error instanceof Error
              ? error.message
              : '알 수 없는 AI 오류',
          )
          recommendations =
            createRuleBasedStudyRecommendations(source)
          generator = 'rule-based-fallback'
          message =
            'AI 연결을 사용하지 못해 기본 추천을 만들고 저장했습니다.'
        }
      } else {
        recommendations =
          createRuleBasedStudyRecommendations(source)
        generator = 'rule-based'
        message =
          '저장된 기록을 바탕으로 기본 추천을 만들고 저장했습니다.'
      }

      const updatedAt = await saveRecommendationSet(
        userId,
        recordIdResult.data,
        generator,
        recommendations,
      )

      response.status(200).json({
        success: true,
        message,
        data: {
          generator,
          recommendationType: source.recordType,
          recommendations,
          updatedAt,
        },
      })
    } catch (error) {
      console.error('맞춤 학습 추천 생성 실패:', error)
      response.status(500).json({
        success: false,
        message:
          '맞춤 학습 추천을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
      })
    }
  },
)

export default studyRecommendationsRouter
