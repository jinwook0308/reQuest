import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { APP_USER_EMAIL } from '../config/app'
import { pool } from '../config/db'

const statisticsRouter = Router()

const querySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(7)
    .max(365)
    .default(30),
})

/**
 * 과목별 공부시간과 개인 성장 추이 조회
 * GET /api/statistics/learning?days=30
 */
statisticsRouter.get(
  '/learning',
  async (
    request: Request,
    response: Response,
  ) => {
    const queryResult = querySchema.safeParse(
      request.query,
    )

    if (!queryResult.success) {
      response.status(400).json({
        success: false,
        message:
          '조회 기간은 7일에서 365일 사이여야 합니다.',
      })
      return
    }

    const { days } = queryResult.data

    try {
      const [
        subjectResult,
        growthResult,
      ] = await Promise.all([
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
                SUM(study_records.minutes),
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

            INNER JOIN users
              ON users.id =
                study_records.user_id

            LEFT JOIN subjects
              ON subjects.id =
                study_records.subject_id

            WHERE
              users.email = $1
              AND study_records.study_date
                >= CURRENT_DATE
                - ($2::INTEGER - 1)

            GROUP BY
              subjects.name

            ORDER BY
              "totalMinutes" DESC,
              subject ASC
          `,
          [
            APP_USER_EMAIL,
            days,
          ],
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
                SUM(study_records.minutes),
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

            INNER JOIN users
              ON users.id =
                study_records.user_id

            WHERE
              users.email = $1
              AND study_records.study_date
                >= CURRENT_DATE
                - ($2::INTEGER - 1)

            GROUP BY
              study_records.study_date

            ORDER BY
              study_records.study_date ASC
          `,
          [
            APP_USER_EMAIL,
            days,
          ],
        ),
      ])

      const totalMinutes =
        subjectResult.rows.reduce(
          (
            total,
            subject,
          ) =>
            total +
            Number(
              subject.totalMinutes,
            ),
          0,
        )

      const subjects =
        subjectResult.rows.map(
          (subject) => {
            const subjectMinutes =
              Number(
                subject.totalMinutes,
              )

            return {
              subject:
                subject.subject,
              recordCount:
                Number(
                  subject.recordCount,
                ),
              totalMinutes:
                subjectMinutes,
              averageUnderstanding:
                Number(
                  subject.averageUnderstanding,
                ),
              percentage:
                totalMinutes > 0
                  ? Number(
                      (
                        (subjectMinutes /
                          totalMinutes) *
                        100
                      ).toFixed(1),
                    )
                  : 0,
            }
          },
        )

      const growth =
        growthResult.rows.map(
          (day) => ({
            date: day.date,
            recordCount:
              Number(
                day.recordCount,
              ),
            totalMinutes:
              Number(
                day.totalMinutes,
              ),
            averageUnderstanding:
              Number(
                day.averageUnderstanding,
              ),
          }),
        )

      const firstUnderstanding =
        growth.length > 0
          ? growth[0]
              .averageUnderstanding
          : 0

      const currentUnderstanding =
        growth.length > 0
          ? growth[
              growth.length - 1
            ].averageUnderstanding
          : 0

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
            change: Number(
              (
                currentUnderstanding -
                firstUnderstanding
              ).toFixed(2),
            ),
          },
        },
      })
    } catch (error) {
      console.error(
        '학습 통계 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '학습 통계를 불러오지 못했습니다.',
      })
    }
  },
)

export default statisticsRouter