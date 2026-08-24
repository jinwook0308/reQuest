import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import { requireAuth } from '../middleware/requireAuth'
import { calculateStudyStreak, getKoreaDateKey } from '../services/studyStreak'

const statisticsRouter = Router()

statisticsRouter.use(requireAuth)

/**
 * 학습 기록과 완료한 순공 세션을 합친 연속 학습 통계
 * GET /api/statistics/streak
 */
statisticsRouter.get('/streak', async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const today = getKoreaDateKey()

  try {
    const result = await pool.query<{ date: string }>(
      `
          SELECT TO_CHAR(activity_date, 'YYYY-MM-DD') AS date
          FROM (
            SELECT study_date AS activity_date
            FROM study_records
            WHERE user_id = $1 AND study_date <= $2::DATE

            UNION

            SELECT
              (ended_at AT TIME ZONE 'Asia/Seoul')::DATE AS activity_date
            FROM study_sessions
            WHERE
              user_id = $1
              AND status = 'completed'
              AND ended_at IS NOT NULL
              AND (ended_at AT TIME ZONE 'Asia/Seoul')::DATE <= $2::DATE
          ) AS activity_dates
          ORDER BY activity_date ASC
        `,
      [userId, today],
    )

    const streak = calculateStudyStreak(
      result.rows.map((row) => row.date),
      today,
    )

    response.status(200).json({
      success: true,
      message: '연속 학습 통계를 불러왔습니다.',
      data: streak,
    })
  } catch (error) {
    console.error('연속 학습 통계 조회 실패:', error)

    response.status(500).json({
      success: false,
      message: '연속 학습 통계를 불러오지 못했습니다.',
    })
  }
})

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
})

/**
 * 과목별 공부시간과 개인 성장 추이 조회
 * GET /api/statistics/learning?days=30
 */
statisticsRouter.get('/learning', async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const queryResult = querySchema.safeParse(request.query)

  if (!queryResult.success) {
    response.status(400).json({
      success: false,
      message: '조회 기간은 7일에서 365일 사이여야 합니다.',
    })
    return
  }

  const { days } = queryResult.data

  try {
    const [subjectResult, growthResult] = await Promise.all([
      pool.query(
        `
            SELECT
              COALESCE(
                subjects.name,
                '기타'
              ) AS subject,

              COUNT(*)::INTEGER
                AS "recordCount",

              COALESCE(
                SUM(
                  study_records.minutes
                ),
                0
              )::INTEGER
                AS "totalMinutes",

              ROUND(
                AVG(
                  study_records.understanding
                )::NUMERIC,
                2
              )::FLOAT8
                AS "averageUnderstanding"

            FROM study_records

            LEFT JOIN subjects
              ON subjects.id =
                study_records.subject_id

            WHERE
              study_records.user_id = $1
              AND study_records.study_date
                >= CURRENT_DATE
                - ($2::INTEGER - 1)

            GROUP BY
              subjects.name

            ORDER BY
              "totalMinutes" DESC,
              subject ASC
          `,
        [userId, days],
      ),

      pool.query(
        `
            SELECT
              TO_CHAR(
                study_records.study_date,
                'YYYY-MM-DD'
              ) AS date,

              COUNT(*)::INTEGER
                AS "recordCount",

              COALESCE(
                SUM(
                  study_records.minutes
                ),
                0
              )::INTEGER
                AS "totalMinutes",

              ROUND(
                AVG(
                  study_records.understanding
                )::NUMERIC,
                2
              )::FLOAT8
                AS "averageUnderstanding"

            FROM study_records

            WHERE
              study_records.user_id = $1
              AND study_records.study_date
                >= CURRENT_DATE
                - ($2::INTEGER - 1)

            GROUP BY
              study_records.study_date

            ORDER BY
              study_records.study_date ASC
          `,
        [userId, days],
      ),
    ])

    const totalMinutes = subjectResult.rows.reduce(
      (total, subject) => total + Number(subject.totalMinutes),
      0,
    )

    const subjects = subjectResult.rows.map((subject) => {
      const subjectMinutes = Number(subject.totalMinutes)

      return {
        subject: subject.subject,
        recordCount: Number(subject.recordCount),
        totalMinutes: subjectMinutes,
        averageUnderstanding: Number(subject.averageUnderstanding),
        percentage:
          totalMinutes > 0
            ? Number(((subjectMinutes / totalMinutes) * 100).toFixed(1))
            : 0,
      }
    })

    const growth = growthResult.rows.map((day) => ({
      date: day.date,
      recordCount: Number(day.recordCount),
      totalMinutes: Number(day.totalMinutes),
      averageUnderstanding: Number(day.averageUnderstanding),
    }))

    const firstUnderstanding = growth.length > 0 ? growth[0].averageUnderstanding : 0

    const currentUnderstanding =
      growth.length > 0 ? growth[growth.length - 1].averageUnderstanding : 0

    response.status(200).json({
      success: true,
      data: {
        days,
        totalMinutes,
        subjects,
        growth,
        growthSummary: {
          firstUnderstanding,
          currentUnderstanding,
          change: Number((currentUnderstanding - firstUnderstanding).toFixed(2)),
        },
      },
    })
  } catch (error) {
    console.error('학습 통계 조회 실패:', error)

    response.status(500).json({
      success: false,
      message: '학습 통계를 불러오지 못했습니다.',
    })
  }
})

export default statisticsRouter
