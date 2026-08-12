import {
  unlink,
} from 'node:fs/promises'
import path from 'node:path'

import {
  Router,
  type Request,
  type Response,
} from 'express'
import { z } from 'zod'

import { pool } from '../config/db'
import {
  normalizeUploadedFileName,
  validateUploadedImage,
  wrongNoteImageUpload,
} from '../config/upload'
import {
  requireAuth,
} from '../middleware/requireAuth'

const wrongNotesRouter =
  Router()

wrongNotesRouter.use(requireAuth)

const createWrongNoteSchema =
  z.object({
    studyRecordId: z
      .string()
      .trim()
      .optional()
      .default(''),

    date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        '날짜 형식이 올바르지 않습니다.',
      ),

    subject: z
      .string()
      .trim()
      .min(
        1,
        '과목을 입력해 주세요.',
      )
      .max(
        50,
        '과목은 50자 이하로 입력해 주세요.',
      ),

    unit: z
      .string()
      .trim()
      .max(
        150,
        '단원은 150자 이하로 입력해 주세요.',
      ),

    mistakeQuestion: z
      .string()
      .trim()
      .min(
        1,
        '문제 내용을 입력해 주세요.',
      )
      .max(
        5000,
        '문제 내용은 5000자를 초과할 수 없습니다.',
      ),

    wrongAnswer: z
      .string()
      .trim()
      .min(
        1,
        '내가 작성한 오답을 입력해 주세요.',
      )
      .max(
        2000,
        '오답은 2000자를 초과할 수 없습니다.',
      ),

    correctAnswer: z
      .string()
      .trim()
      .min(
        1,
        '실제 정답을 입력해 주세요.',
      )
      .max(
        2000,
        '정답은 2000자를 초과할 수 없습니다.',
      ),

    mistakeReason: z
      .string()
      .trim()
      .min(
        1,
        '틀린 이유를 입력해 주세요.',
      )
      .max(
        5000,
        '틀린 이유는 5000자를 초과할 수 없습니다.',
      ),

    concepts: z
      .string()
      .trim()
      .min(
        1,
        '관련 개념을 입력해 주세요.',
      )
      .max(
        1000,
        '키워드와 개념은 1000자를 초과할 수 없습니다.',
      ),
  })

function createImageUrl(
  request: Request,
  imagePath: string | null,
) {
  if (!imagePath) {
    return null
  }

  return `${request.protocol}://${request.get('host')}${imagePath}`
}

async function removeUploadedFile(
  filePath?: string,
) {
  if (!filePath) {
    return
  }

  try {
    await unlink(filePath)
  } catch (error) {
    console.error(
      '업로드 이미지 삭제 실패:',
      error,
    )
  }
}

/**
 * 오답노트 목록 조회
 * GET /api/wrong-notes
 */
wrongNotesRouter.get(
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
              wrong_notes.id,
              wrong_notes.study_record_id
                AS "studyRecordId",
              TO_CHAR(
                wrong_notes.study_date,
                'YYYY-MM-DD'
              ) AS date,
              COALESCE(
                subjects.name,
                '기타'
              ) AS subject,
              COALESCE(
                study_records.record_type,
                CASE
                  WHEN subjects.name = '자격증'
                    THEN 'certification'
                  ELSE 'general'
                END
              ) AS "recordType",
              study_records.certification_name
                AS "certificationName",
              wrong_notes.unit,
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
                AS "wrongImagePath",
              wrong_notes.wrong_image_name
                AS "wrongImageName",
              wrong_notes.quest_status
                AS "questStatus",
              wrong_notes.created_at
                AS "createdAt"

            FROM wrong_notes

            LEFT JOIN subjects
              ON subjects.id =
                wrong_notes.subject_id

            LEFT JOIN study_records
              ON study_records.id =
                wrong_notes.study_record_id
              AND study_records.user_id =
                wrong_notes.user_id

            WHERE
              wrong_notes.user_id = $1

            ORDER BY
              wrong_notes.study_date DESC,
              wrong_notes.created_at DESC
          `,
          [userId],
        )

      const wrongNotes =
        result.rows.map(
          (wrongNote) => {
            const {
              wrongImagePath,
              wrongImageName,
              ...remainingWrongNote
            } = wrongNote

            return {
              ...remainingWrongNote,
              wrongImageName:
                normalizeUploadedFileName(
                  wrongImageName,
                ),
              wrongImage:
                createImageUrl(
                  request,
                  wrongImagePath,
                ),
            }
          },
        )

      response.status(200).json({
        success: true,
        data: wrongNotes,
      })
    } catch (error) {
      console.error(
        '오답노트 목록 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '오답노트 목록을 불러오지 못했습니다.',
      })
    }
  },
)

/**
 * 오답노트 상세 조회
 * GET /api/wrong-notes/:wrongNoteId
 */
wrongNotesRouter.get(
  '/:wrongNoteId',
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

    const wrongNoteIdResult =
      z.coerce
        .number()
        .int()
        .positive()
        .safeParse(
          request.params.wrongNoteId,
        )

    if (
      !wrongNoteIdResult.success
    ) {
      response.status(400).json({
        success: false,
        message:
          '오답노트 ID가 올바르지 않습니다.',
      })
      return
    }

    try {
      const result =
        await pool.query(
          `
            SELECT
              wrong_notes.id,
              wrong_notes.study_record_id
                AS "studyRecordId",
              TO_CHAR(
                wrong_notes.study_date,
                'YYYY-MM-DD'
              ) AS date,
              COALESCE(
                subjects.name,
                '기타'
              ) AS subject,
              COALESCE(
                study_records.record_type,
                CASE
                  WHEN subjects.name = '자격증'
                    THEN 'certification'
                  ELSE 'general'
                END
              ) AS "recordType",
              study_records.certification_name
                AS "certificationName",
              wrong_notes.unit,
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
                AS "wrongImagePath",
              wrong_notes.wrong_image_name
                AS "wrongImageName",
              wrong_notes.quest_status
                AS "questStatus",
              wrong_notes.created_at
                AS "createdAt"

            FROM wrong_notes

            LEFT JOIN subjects
              ON subjects.id =
                wrong_notes.subject_id

            LEFT JOIN study_records
              ON study_records.id =
                wrong_notes.study_record_id
              AND study_records.user_id =
                wrong_notes.user_id

            WHERE
              wrong_notes.id = $1
              AND wrong_notes.user_id = $2

            LIMIT 1
          `,
          [
            wrongNoteIdResult.data,
            userId,
          ],
        )

      if (
        result.rows.length === 0
      ) {
        response.status(404).json({
          success: false,
          message:
            '오답노트를 찾지 못했습니다.',
        })
        return
      }

      const {
        wrongImagePath,
        wrongImageName,
        ...wrongNote
      } = result.rows[0]

      response.status(200).json({
        success: true,
        data: {
          ...wrongNote,
          wrongImageName:
            normalizeUploadedFileName(
              wrongImageName,
            ),
          wrongImage:
            createImageUrl(
              request,
              wrongImagePath,
            ),
        },
      })
    } catch (error) {
      console.error(
        '오답노트 상세 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '오답노트 상세 정보를 불러오지 못했습니다.',
      })
    }
  },
)

/**
 * 오답노트 저장
 * POST /api/wrong-notes
 *
 * 이미지 필드 이름: wrongImage
 */
wrongNotesRouter.post(
  '/',
  wrongNoteImageUpload.single(
    'wrongImage',
  ),
  async (
    request: Request,
    response: Response,
  ) => {
    const userId =
      request.authUser?.id

    if (!userId) {
      await removeUploadedFile(
        request.file?.path,
      )

      response.status(401).json({
        success: false,
        message:
          '로그인이 필요합니다.',
      })
      return
    }

    const validationResult =
      createWrongNoteSchema.safeParse(
        request.body,
      )

    if (!validationResult.success) {
      await removeUploadedFile(
        request.file?.path,
      )

      response.status(400).json({
        success: false,
        message:
          '입력한 오답노트 내용을 확인해 주세요.',
        errors:
          validationResult.error
            .flatten()
            .fieldErrors,
      })
      return
    }

    if (!request.file) {
      response.status(400).json({
        success: false,
        message:
          '오답 문제 이미지를 등록해 주세요.',
      })
      return
    }

    try {
      const isValidImage =
        await validateUploadedImage(
          request.file.path,
          request.file.mimetype,
        )

      if (!isValidImage) {
        await removeUploadedFile(
          request.file.path,
        )

        response.status(400).json({
          success: false,
          message:
            '이미지 파일의 실제 형식을 확인해 주세요.',
        })
        return
      }
    } catch (error) {
      await removeUploadedFile(
        request.file.path,
      )

      console.error(
        '업로드 이미지 검증 실패:',
        error,
      )

      response.status(400).json({
        success: false,
        message:
          '업로드한 이미지를 확인하지 못했습니다.',
      })
      return
    }

    const {
      studyRecordId,
      date,
      subject,
      unit,
      mistakeQuestion,
      wrongAnswer,
      correctAnswer,
      mistakeReason,
      concepts,
    } = validationResult.data

    let normalizedStudyRecordId:
      | number
      | null = null

    if (studyRecordId) {
      const parsedStudyRecordId =
        Number(studyRecordId)

      if (
        !Number.isInteger(
          parsedStudyRecordId,
        ) ||
        parsedStudyRecordId <= 0
      ) {
        await removeUploadedFile(
          request.file.path,
        )

        response.status(400).json({
          success: false,
          message:
            '연결할 학습 기록 ID가 올바르지 않습니다.',
        })
        return
      }

      normalizedStudyRecordId =
        parsedStudyRecordId
    }

    const client =
      await pool.connect()

    try {
      await client.query('BEGIN')

      if (
        normalizedStudyRecordId !==
        null
      ) {
        const linkedRecordResult =
          await client.query(
            `
              SELECT id
              FROM study_records
              WHERE
                id = $1
                AND user_id = $2
              LIMIT 1
            `,
            [
              normalizedStudyRecordId,
              userId,
            ],
          )

        if (
          linkedRecordResult.rows
            .length === 0
        ) {
          await client.query(
            'ROLLBACK',
          )

          await removeUploadedFile(
            request.file.path,
          )

          response.status(404).json({
            success: false,
            message:
              '연결할 학습 기록을 찾지 못했습니다.',
          })
          return
        }
      }

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
        subjectResult.rows[0]?.id

      if (!subjectId) {
        throw new Error(
          '과목 저장 결과가 없습니다.',
        )
      }

      const savedImagePath =
        `/uploads/wrong-notes/${request.file.filename}`

      const wrongNoteResult =
        await client.query(
          `
            INSERT INTO wrong_notes (
              user_id,
              study_record_id,
              subject_id,
              study_date,
              unit,
              mistake_question,
              wrong_answer,
              correct_answer,
              mistake_reason,
              concepts,
              wrong_image_path,
              wrong_image_name
            )
            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11, $12
            )
            RETURNING
              id,
              study_record_id
                AS "studyRecordId",
              TO_CHAR(
                study_date,
                'YYYY-MM-DD'
              ) AS date,
              unit,
              mistake_question
                AS "mistakeQuestion",
              wrong_answer
                AS "wrongAnswer",
              correct_answer
                AS "correctAnswer",
              mistake_reason
                AS "mistakeReason",
              concepts,
              wrong_image_name
                AS "wrongImageName",
              quest_status
                AS "questStatus",
              created_at
                AS "createdAt"
          `,
          [
            userId,
            normalizedStudyRecordId,
            subjectId,
            date,
            unit,
            mistakeQuestion,
            wrongAnswer,
            correctAnswer,
            mistakeReason,
            concepts,
            savedImagePath,
            normalizeUploadedFileName(
              request.file.originalname,
            ),
          ],
        )

      const savedWrongNote =
        wrongNoteResult.rows[0]

      if (!savedWrongNote) {
        throw new Error(
          '오답노트 저장 결과가 없습니다.',
        )
      }

      await client.query('COMMIT')

      response.status(201).json({
        success: true,
        message:
          '오답노트가 저장되었습니다.',
        data: {
          ...savedWrongNote,
          subject,
          wrongImage:
            createImageUrl(
              request,
              savedImagePath,
            ),
        },
      })
    } catch (error) {
      await client.query(
        'ROLLBACK',
      )

      await removeUploadedFile(
        request.file.path,
      )

      console.error(
        '오답노트 저장 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '오답노트를 저장하지 못했습니다.',
      })
    } finally {
      client.release()
    }
  },
)

/**
 * 오답노트 삭제
 * DELETE /api/wrong-notes/:wrongNoteId
 */
wrongNotesRouter.delete(
  '/:wrongNoteId',
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

    const wrongNoteIdResult =
      z.coerce
        .number()
        .int()
        .positive()
        .safeParse(
          request.params.wrongNoteId,
        )

    if (
      !wrongNoteIdResult.success
    ) {
      response.status(400).json({
        success: false,
        message:
          '오답노트 ID가 올바르지 않습니다.',
      })
      return
    }

    const client =
      await pool.connect()

    try {
      await client.query('BEGIN')

      await client.query(
        `
          DELETE FROM review_quest_sets
          WHERE
            user_id = $1
            AND source_type =
              'wrong-note'
            AND source_id = $2
        `,
        [
          userId,
          wrongNoteIdResult.data,
        ],
      )

      const result =
        await client.query(
          `
            DELETE FROM wrong_notes
            WHERE
              id = $1
              AND user_id = $2

            RETURNING
              id,
              wrong_image_path
                AS "wrongImagePath"
          `,
          [
            wrongNoteIdResult.data,
            userId,
          ],
        )

      if (
        result.rows.length === 0
      ) {
        await client.query(
          'ROLLBACK',
        )

        response.status(404).json({
          success: false,
          message:
            '삭제할 오답노트를 찾지 못했습니다.',
        })
        return
      }

      await client.query('COMMIT')

      const imagePath =
        result.rows[0]
          .wrongImagePath

      if (imagePath) {
        const imageFilePath =
          path.resolve(
            __dirname,
            '../../uploads/wrong-notes',
            path.basename(
              imagePath,
            ),
          )

        await removeUploadedFile(
          imageFilePath,
        )
      }

      response.status(200).json({
        success: true,
        message:
          '오답노트가 삭제되었습니다.',
        data: {
          id: result.rows[0].id,
        },
      })
    } catch (error) {
      await client.query(
        'ROLLBACK',
      )

      console.error(
        '오답노트 삭제 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '오답노트를 삭제하지 못했습니다.',
      })
    } finally {
      client.release()
    }
  },
)

export default wrongNotesRouter
