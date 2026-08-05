import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import { APP_USER_EMAIL } from '../config/app'
import { normalizeUploadedFileName } from '../config/upload'

const studyRecordsRouter = Router()

const DEVELOPMENT_USER_EMAIL =
  APP_USER_EMAIL

function createImageUrl(
  request: Request,
  imagePath: string | null,
) {
  if (!imagePath) {
    return null
  }

  return `${request.protocol}://${request.get('host')}${imagePath}`
}

const createStudyRecordSchema = z.object({
  date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      '날짜 형식이 올바르지 않습니다.',
    ),
  subject: z.string().trim().min(1).max(50),
  unit: z.string().trim().min(1).max(150),
  minutes: z.coerce.number().int().min(0),
  learned: z.string().trim().min(1).max(5000, '학습 내용은 5000자를 초과할 수 없습니다.'),
  difficult: z.string().trim().max(5000, '어려운 내용은 5000자를 초과할 수 없습니다.').default(''),
  keywords: z.string().trim().max(1000, '키워드와 개념은 1000자를 초과할 수 없습니다.').default(''),
  understanding: z.coerce
    .number()
    .int()
    .min(1)
    .max(5),
})

/**
 * 학습 기록 목록 조회
 * GET /api/study-records
 */
studyRecordsRouter.get(
  '/',
  async (
    _request: Request,
    response: Response,
  ) => {
    try {
      const result = await pool.query(
        `
          SELECT
            study_records.id,
            TO_CHAR(
              study_records.study_date,
              'YYYY-MM-DD'
            ) AS date,
            COALESCE(
              subjects.name,
              '기타'
            ) AS subject,
            study_records.unit,
            study_records.minutes,
            study_records.learned,
            study_records.difficult,
            study_records.keywords,
            study_records.understanding,
            study_records.quest_status
              AS "questStatus",
            study_records.created_at
              AS "createdAt"

          FROM study_records

          INNER JOIN users
            ON users.id =
              study_records.user_id

          LEFT JOIN subjects
            ON subjects.id =
              study_records.subject_id

          WHERE users.email = $1

          ORDER BY
            study_records.study_date DESC,
            study_records.created_at DESC
        `,
        [DEVELOPMENT_USER_EMAIL],
      )

      response.status(200).json({
        success: true,
        data: result.rows,
      })
    } catch (error) {
      console.error(
        '학습 기록 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '학습 기록을 불러오지 못했습니다.',
      })
    }
  },
)

/**
 * 학습 기록 저장
 * POST /api/study-records
 */
studyRecordsRouter.post(
  '/',
  async (
    request: Request,
    response: Response,
  ) => {
    const validationResult =
      createStudyRecordSchema.safeParse(
        request.body,
      )

    if (!validationResult.success) {
      response.status(400).json({
        success: false,
        message:
          '입력한 학습 기록을 확인해 주세요.',
        errors:
          validationResult.error.flatten()
            .fieldErrors,
      })

      return
    }

    const {
      date,
      subject,
      unit,
      minutes,
      learned,
      difficult,
      keywords,
      understanding,
    } = validationResult.data

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const userResult =
        await client.query(
          `
            SELECT id
            FROM users
            WHERE email = $1
            LIMIT 1
          `,
          [DEVELOPMENT_USER_EMAIL],
        )

      if (userResult.rows.length === 0) {
        throw new Error(
          '개발용 사용자를 찾지 못했습니다.',
        )
      }

      const userId = userResult.rows[0].id

      const subjectResult =
        await client.query(
          `
            INSERT INTO subjects (
              user_id,
              name
            )
            VALUES ($1, $2)

            ON CONFLICT (
              user_id,
              name
            )
            DO UPDATE SET
              name = EXCLUDED.name

            RETURNING id
          `,
          [userId, subject],
        )

      const subjectId =
        subjectResult.rows[0].id

      const recordResult =
        await client.query(
          `
            INSERT INTO study_records (
              user_id,
              subject_id,
              study_date,
              unit,
              minutes,
              learned,
              difficult,
              keywords,
              understanding
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9
            )
            RETURNING
              id,
              TO_CHAR(
                study_date,
                'YYYY-MM-DD'
              ) AS date,
              unit,
              minutes,
              learned,
              difficult,
              keywords,
              understanding,
              created_at AS "createdAt"
          `,
          [
            userId,
            subjectId,
            date,
            unit,
            minutes,
            learned,
            difficult,
            keywords,
            understanding,
          ],
        )

      await client.query('COMMIT')

      response.status(201).json({
        success: true,
        message:
          '학습 기록이 저장되었습니다.',
        data: {
          ...recordResult.rows[0],
          subject,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')

      console.error(
        '학습 기록 저장 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '학습 기록을 저장하지 못했습니다.',
      })
    } finally {
      client.release()
    }
  },
)

/**
 * 학습 기록 상세 조회
 * GET /api/study-records/:recordId
 */
studyRecordsRouter.get(
  '/:recordId',
  async (
    request: Request,
    response: Response,
  ) => {
    const recordIdResult = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(request.params.recordId)

    if (!recordIdResult.success) {
      response.status(400).json({
        success: false,
        message:
          '학습 기록 ID가 올바르지 않습니다.',
      })

      return
    }

    try {
      const result = await pool.query(
        `
          SELECT
            study_records.id,
            TO_CHAR(
              study_records.study_date,
              'YYYY-MM-DD'
            ) AS date,
            COALESCE(
              subjects.name,
              '기타'
            ) AS subject,
            study_records.unit,
            study_records.minutes,
            study_records.learned,
            study_records.difficult,
            study_records.keywords,
            study_records.understanding,
            study_records.created_at
              AS "createdAt",

            latest_wrong_note.mistake_question
              AS "mistakeQuestion",
            latest_wrong_note.wrong_answer
              AS "wrongAnswer",
            latest_wrong_note.correct_answer
              AS "correctAnswer",
            latest_wrong_note.mistake_reason
              AS "mistakeReason",
            latest_wrong_note.wrong_image_path
              AS "wrongImagePath",
            latest_wrong_note.wrong_image_name
              AS "wrongImageName",
            study_records.quest_status
              AS "questStatus"

          FROM study_records

          INNER JOIN users
            ON users.id =
              study_records.user_id

          LEFT JOIN subjects
            ON subjects.id =
              study_records.subject_id

          LEFT JOIN LATERAL (
            SELECT
              wrong_notes.mistake_question,
              wrong_notes.wrong_answer,
              wrong_notes.correct_answer,
              wrong_notes.mistake_reason,
              wrong_notes.wrong_image_path,
              wrong_notes.wrong_image_name,
              wrong_notes.quest_status

            FROM wrong_notes

            WHERE
              wrong_notes.study_record_id =
                study_records.id

            ORDER BY
              wrong_notes.created_at DESC

            LIMIT 1
          ) AS latest_wrong_note
            ON TRUE

          WHERE
            study_records.id = $1
            AND users.email = $2

          LIMIT 1
        `,
        [
          recordIdResult.data,
          DEVELOPMENT_USER_EMAIL,
        ],
      )

      if (result.rows.length === 0) {
        response.status(404).json({
          success: false,
          message:
            '학습 기록을 찾지 못했습니다.',
        })

        return
      }

      const {
        wrongImagePath,
        wrongImageName,
        ...record
      } = result.rows[0]

      response.status(200).json({
        success: true,
        data: {
          ...record,
          wrongImageName:
            normalizeUploadedFileName(
              wrongImageName,
            ),
          wrongImage: createImageUrl(
            request,
            wrongImagePath,
          ),
        },
      })
    } catch (error) {
      console.error(
        '학습 기록 상세 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '학습 기록 상세 정보를 불러오지 못했습니다.',
      })
    }
  },
)

/**
 * 학습 기록 삭제
 * DELETE /api/study-records/:recordId
 */
studyRecordsRouter.delete(
  '/:recordId',
  async (
    request: Request,
    response: Response,
  ) => {
    const recordIdResult = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(request.params.recordId)

    if (!recordIdResult.success) {
      response.status(400).json({
        success: false,
        message:
          '학습 기록 ID가 올바르지 않습니다.',
      })

      return
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      await client.query(
        `
          DELETE FROM review_quest_sets
          USING users

          WHERE
            review_quest_sets.user_id = users.id
            AND users.email = $1
            AND review_quest_sets.source_type =
              'study-record'
            AND review_quest_sets.source_id = $2
        `,
        [
          DEVELOPMENT_USER_EMAIL,
          recordIdResult.data,
        ],
      )

      const result = await client.query(
        `
          DELETE FROM study_records
          USING users

          WHERE
            study_records.id = $1
            AND study_records.user_id =
              users.id
            AND users.email = $2

          RETURNING study_records.id
        `,
        [
          recordIdResult.data,
          DEVELOPMENT_USER_EMAIL,
        ],
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')

        response.status(404).json({
          success: false,
          message:
            '삭제할 학습 기록을 찾지 못했습니다.',
        })

        return
      }

      await client.query('COMMIT')

      response.status(200).json({
        success: true,
        message:
          '학습 기록이 삭제되었습니다.',
        data: {
          id: result.rows[0].id,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')

      console.error(
        '학습 기록 삭제 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '학습 기록을 삭제하지 못했습니다.',
      })
    } finally {
      client.release()
    }
  },
)

export default studyRecordsRouter
