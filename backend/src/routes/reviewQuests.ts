import {
  Router,
  type Request,
  type Response,
} from 'express'
import type {
  PoolClient,
} from 'pg'
import { z } from 'zod'

import { pool } from '../config/db'
import {
  requireAuth,
} from '../middleware/requireAuth'
import {
  gradeAnswer,
  gradeSubmittedAnswers,
  type GradedQuizAnswer,
} from '../services/quizGrading'

const reviewQuestsRouter =
  Router()

reviewQuestsRouter.use(requireAuth)

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

const questionSchema =
  z.object({
    id: z
      .number()
      .int()
      .positive(),

    kind: z.enum([
      'multiple-choice',
      'ox',
      'short-answer',
    ]),

    concept: z
      .string()
      .trim()
      .min(1)
      .max(
        1000,
        '키워드와 개념은 1000자를 초과할 수 없습니다.',
      ),

    prompt: z
      .string()
      .trim()
      .min(1)
      .max(
        5000,
        '복습 문제는 5000자를 초과할 수 없습니다.',
      ),

    options: z
      .array(
        z
          .string()
          .trim()
          .max(
            1000,
            '선택지 내용은 1000자를 초과할 수 없습니다.',
          ),
      )
      .max(4),

    answer: z
      .string()
      .trim()
      .min(1)
      .max(
        2000,
        '정답은 2000자를 초과할 수 없습니다.',
      ),

    explanation: z
      .string()
      .trim()
      .min(1)
      .max(
        5000,
        '해설은 5000자를 초과할 수 없습니다.',
      ),
  })

const saveQuestSetSchema =
  z
    .object({
      questions: z
        .array(questionSchema)
        .min(3)
        .max(5),
    })
    .superRefine(
      (data, context) => {
        data.questions.forEach(
          (
            question,
            questionIndex,
          ) => {
            if (
              question.kind ===
              'multiple-choice'
            ) {
              if (
                question.options
                  .length !== 4
              ) {
                context.addIssue({
                  code: 'custom',
                  path: [
                    'questions',
                    questionIndex,
                    'options',
                  ],
                  message:
                    '객관식 문제는 선택지가 4개여야 합니다.',
                })

                return
              }

              if (
                question.options.some(
                  (option) =>
                    !option.trim(),
                )
              ) {
                context.addIssue({
                  code: 'custom',
                  path: [
                    'questions',
                    questionIndex,
                    'options',
                  ],
                  message:
                    '객관식 선택지를 모두 입력해 주세요.',
                })
              }

              if (
                !question.options.includes(
                  question.answer,
                )
              ) {
                context.addIssue({
                  code: 'custom',
                  path: [
                    'questions',
                    questionIndex,
                    'answer',
                  ],
                  message:
                    '객관식 정답은 선택지 중 하나여야 합니다.',
                })
              }
            }

            if (
              question.kind ===
                'ox' &&
              !['O', 'X'].includes(
                question.answer,
              )
            ) {
              context.addIssue({
                code: 'custom',
                path: [
                  'questions',
                  questionIndex,
                  'answer',
                ],
                message:
                  'OX 문제의 정답은 O 또는 X여야 합니다.',
              })
            }
          },
        )
      },
    )

const quizAnswerSchema =
  z.object({
    questionId: z
      .number()
      .int()
      .positive(),

    userAnswer: z
      .string()
      .max(
        5000,
        '퀴즈 답변은 5000자를 초과할 수 없습니다.',
      ),
  })

const storedGradedAnswerSchema =
  quizAnswerSchema.extend({
    isCorrect: z.boolean(),
  })

const gradeAnswerSchema =
  z.object({
    questionId: z
      .number()
      .int()
      .positive(),

    userAnswer: z
      .string()
      .max(
        5000,
        '퀴즈 답변은 5000자를 초과할 수 없습니다.',
      ),
  })

const saveAttemptSchema =
  z.object({
    answers: z
      .array(quizAnswerSchema)
      .min(1),

    mode: z.enum([
      'original',
      'retry',
    ]),
  })

type SourceType =
  | 'study-record'
  | 'wrong-note'

function getAuthenticatedUserId(
  request: Request,
) {
  const userId =
    request.authUser?.id

  if (!userId) {
    throw new Error(
      '인증 사용자 정보가 없습니다.',
    )
  }

  return userId
}

function createQuizQuestions(
  questions: z.infer<
    typeof questionSchema
  >[],
) {
  return questions.map(
    ({
      answer: _answer,
      explanation: _explanation,
      ...question
    }) => question,
  )
}

async function sourceExists(
  client: PoolClient,
  sourceType: SourceType,
  sourceId: number,
  userId: number | string,
) {
  const query =
    sourceType === 'wrong-note'
      ? `
          SELECT id
          FROM wrong_notes
          WHERE
            id = $1
            AND user_id = $2
          LIMIT 1
        `
      : `
          SELECT id
          FROM study_records
          WHERE
            id = $1
            AND user_id = $2
          LIMIT 1
        `

  const result =
    await client.query(
      query,
      [
        sourceId,
        userId,
      ],
    )

  return result.rows.length > 0
}

async function updateSourceStatus(
  client: PoolClient,
  sourceType: SourceType,
  sourceId: number,
  userId: number | string,
  status:
    | 'ready'
    | 'retry-required'
    | 'completed',
) {
  const query =
    sourceType === 'wrong-note'
      ? `
          UPDATE wrong_notes
          SET
            quest_status = $1,
            updated_at = NOW()
          WHERE
            id = $2
            AND user_id = $3
        `
      : `
          UPDATE study_records
          SET
            quest_status = $1,
            updated_at = NOW()
          WHERE
            id = $2
            AND user_id = $3
        `

  await client.query(
    query,
    [
      status,
      sourceId,
      userId,
    ],
  )
}

/**
 * 정답을 제외한 퀴즈 문제 조회
 * GET /api/review-quests/:sourceType/:sourceId/quiz
 */
reviewQuestsRouter.get(
  '/:sourceType/:sourceId/quiz',
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
          '퀴즈 주소가 올바르지 않습니다.',
      })
      return
    }

    const userId =
      getAuthenticatedUserId(
        request,
      )

    const {
      sourceType,
      sourceId,
    } = paramsResult.data

    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              source_type
                AS "sourceType",
              source_id
                AS "sourceId",
              status,
              questions,
              updated_at
                AS "updatedAt"

            FROM review_quest_sets

            WHERE
              user_id = $1
              AND source_type = $2
              AND source_id = $3

            LIMIT 1
          `,
          [
            userId,
            sourceType,
            sourceId,
          ],
        )

      if (
        result.rows.length === 0
      ) {
        response.status(404).json({
          success: false,
          message:
            '검토 완료된 복습 문제가 없습니다.',
        })
        return
      }

      const questionsResult =
        z
          .array(questionSchema)
          .safeParse(
            result.rows[0]
              .questions,
          )

      if (
        !questionsResult.success
      ) {
        throw new Error(
          '저장된 복습 문제 형식이 올바르지 않습니다.',
        )
      }

      response.status(200).json({
        success: true,
        data: {
          ...result.rows[0],
          questions:
            createQuizQuestions(
              questionsResult.data,
            ),
        },
      })
    } catch (error) {
      console.error(
        '퀴즈 문제 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '퀴즈 문제를 불러오지 못했습니다.',
      })
    }
  },
)

/**
 * 문제 한 개 서버 채점
 * POST /api/review-quests/:sourceType/:sourceId/grade
 */
reviewQuestsRouter.post(
  '/:sourceType/:sourceId/grade',
  async (
    request: Request,
    response: Response,
  ) => {
    const paramsResult =
      sourceParamsSchema.safeParse(
        request.params,
      )

    const bodyResult =
      gradeAnswerSchema.safeParse(
        request.body,
      )

    if (
      !paramsResult.success ||
      !bodyResult.success
    ) {
      response.status(400).json({
        success: false,
        message:
          '제출한 답안을 확인해 주세요.',
      })
      return
    }

    const userId =
      getAuthenticatedUserId(
        request,
      )

    const {
      sourceType,
      sourceId,
    } = paramsResult.data

    const {
      questionId,
      userAnswer,
    } = bodyResult.data

    try {
      const result =
        await pool.query(
          `
            SELECT questions
            FROM review_quest_sets

            WHERE
              user_id = $1
              AND source_type = $2
              AND source_id = $3

            LIMIT 1
          `,
          [
            userId,
            sourceType,
            sourceId,
          ],
        )

      if (
        result.rows.length === 0
      ) {
        response.status(404).json({
          success: false,
          message:
            '채점할 복습 문제를 찾지 못했습니다.',
        })
        return
      }

      const questionsResult =
        z
          .array(questionSchema)
          .safeParse(
            result.rows[0]
              .questions,
          )

      if (
        !questionsResult.success
      ) {
        throw new Error(
          '저장된 복습 문제 형식이 올바르지 않습니다.',
        )
      }

      const question =
        questionsResult.data.find(
          (savedQuestion) =>
            savedQuestion.id ===
            questionId,
        )

      if (!question) {
        response.status(404).json({
          success: false,
          message:
            '채점할 문제를 찾지 못했습니다.',
        })
        return
      }

      response.status(200).json({
        success: true,
        data: {
          questionId,
          isCorrect:
            gradeAnswer(
              question,
              userAnswer,
            ),
          correctAnswer:
            question.answer,
          explanation:
            question.explanation,
        },
      })
    } catch (error) {
      console.error(
        '답안 채점 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '답안을 채점하지 못했습니다.',
      })
    }
  },
)

/**
 * 복습 문제 조회
 * GET /api/review-quests/:sourceType/:sourceId
 */
reviewQuestsRouter.get(
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
          '복습 문제 주소가 올바르지 않습니다.',
      })
      return
    }

    const userId =
      getAuthenticatedUserId(
        request,
      )

    const {
      sourceType,
      sourceId,
    } = paramsResult.data

    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              source_type
                AS "sourceType",
              source_id
                AS "sourceId",
              status,
              questions,
              created_at
                AS "createdAt",
              updated_at
                AS "updatedAt"

            FROM review_quest_sets

            WHERE
              user_id = $1
              AND source_type = $2
              AND source_id = $3

            LIMIT 1
          `,
          [
            userId,
            sourceType,
            sourceId,
          ],
        )

      if (
        result.rows.length === 0
      ) {
        response.status(404).json({
          success: false,
          message:
            '저장된 복습 문제가 없습니다.',
        })
        return
      }

      response.status(200).json({
        success: true,
        data: result.rows[0],
      })
    } catch (error) {
      console.error(
        '복습 문제 조회 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '복습 문제를 불러오지 못했습니다.',
      })
    }
  },
)

/**
 * 검토한 복습 문제 저장
 * PUT /api/review-quests/:sourceType/:sourceId
 */
reviewQuestsRouter.put(
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
          '복습 문제 주소가 올바르지 않습니다.',
      })
      return
    }

    const bodyResult =
      saveQuestSetSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        success: false,
        message:
          '복습 문제 내용을 확인해 주세요.',
        errors:
          bodyResult.error
            .flatten()
            .fieldErrors,
      })
      return
    }

    const userId =
      getAuthenticatedUserId(
        request,
      )

    const {
      sourceType,
      sourceId,
    } = paramsResult.data

    const { questions } =
      bodyResult.data

    const client =
      await pool.connect()

    try {
      await client.query('BEGIN')

      const exists =
        await sourceExists(
          client,
          sourceType,
          sourceId,
          userId,
        )

      if (!exists) {
        await client.query(
          'ROLLBACK',
        )

        response.status(404).json({
          success: false,
          message:
            '복습 문제를 만들 학습 자료를 찾지 못했습니다.',
        })
        return
      }

      const result =
        await client.query(
          `
            INSERT INTO review_quest_sets (
              user_id,
              source_type,
              source_id,
              status,
              questions
            )
            VALUES (
              $1,
              $2,
              $3,
              'reviewed',
              $4::JSONB
            )

            ON CONFLICT (
              user_id,
              source_type,
              source_id
            )
            DO UPDATE SET
              status = 'reviewed',
              questions =
                EXCLUDED.questions,
              updated_at = NOW()

            RETURNING
              id,
              source_type
                AS "sourceType",
              source_id
                AS "sourceId",
              status,
              questions,
              created_at
                AS "createdAt",
              updated_at
                AS "updatedAt"
          `,
          [
            userId,
            sourceType,
            sourceId,
            JSON.stringify(
              questions,
            ),
          ],
        )

      await updateSourceStatus(
        client,
        sourceType,
        sourceId,
        userId,
        'ready',
      )

      await client.query('COMMIT')

      response.status(200).json({
        success: true,
        message:
          '복습 문제가 저장되었습니다.',
        data: result.rows[0],
      })
    } catch (error) {
      await client.query(
        'ROLLBACK',
      )

      console.error(
        '복습 문제 저장 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '복습 문제를 저장하지 못했습니다.',
      })
    } finally {
      client.release()
    }
  },
)

/**
 * 퀴즈 결과 저장
 * POST /api/review-quests/:sourceType/:sourceId/attempts
 */
reviewQuestsRouter.post(
  '/:sourceType/:sourceId/attempts',
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
          '퀴즈 주소가 올바르지 않습니다.',
      })
      return
    }

    const bodyResult =
      saveAttemptSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        success: false,
        message:
          '퀴즈 결과를 확인해 주세요.',
      })
      return
    }

    const userId =
      getAuthenticatedUserId(
        request,
      )

    const {
      sourceType,
      sourceId,
    } = paramsResult.data

    const {
      answers,
      mode,
    } = bodyResult.data

    const client =
      await pool.connect()

    try {
      await client.query('BEGIN')

      const questSetResult =
        await client.query(
          `
            SELECT
              id,
              questions
            FROM review_quest_sets
            WHERE
              user_id = $1
              AND source_type = $2
              AND source_id = $3
            LIMIT 1
          `,
          [
            userId,
            sourceType,
            sourceId,
          ],
        )

      if (
        questSetResult.rows
          .length === 0
      ) {
        await client.query(
          'ROLLBACK',
        )

        response.status(404).json({
          success: false,
          message:
            '저장된 복습 문제를 찾지 못했습니다.',
        })
        return
      }

      const questSetId =
        questSetResult.rows[0].id

      const questionsResult =
        z
          .array(questionSchema)
          .safeParse(
            questSetResult.rows[0]
              .questions,
          )

      if (
        !questionsResult.success
      ) {
        throw new Error(
          '저장된 복습 문제 형식이 올바르지 않습니다.',
        )
      }

      let expectedQuestionIds =
        questionsResult.data.map(
          (question) =>
            question.id,
        )

      let savedRetryRound = 0

      if (mode === 'retry') {
        const previousAttemptResult =
          await client.query(
            `
              SELECT
                answers,
                retry_round
                  AS "retryRound"
              FROM quiz_attempts
              WHERE
                user_id = $1
                AND quest_set_id = $2
                AND status =
                  'retry-required'
              ORDER BY
                completed_at DESC
              LIMIT 1
            `,
            [
              userId,
              questSetId,
            ],
          )

        if (
          previousAttemptResult.rows
            .length === 0
        ) {
          await client.query(
            'ROLLBACK',
          )

          response.status(400).json({
            success: false,
            message:
              '재도전할 이전 오답 결과가 없습니다.',
          })
          return
        }

        const previousAnswersResult =
          z
            .array(
              storedGradedAnswerSchema,
            )
            .safeParse(
              previousAttemptResult
                .rows[0].answers,
            )

        if (
          !previousAnswersResult.success
        ) {
          throw new Error(
            '저장된 이전 퀴즈 결과 형식이 올바르지 않습니다.',
          )
        }

        expectedQuestionIds =
          previousAnswersResult.data
            .filter(
              (answer) =>
                !answer.isCorrect,
            )
            .map(
              (answer) =>
                answer.questionId,
            )

        savedRetryRound =
          Number(
            previousAttemptResult
              .rows[0].retryRound,
          ) + 1
      }

      const submittedQuestionIds =
        new Set(
          answers.map(
            (answer) =>
              answer.questionId,
          ),
        )

      const answersCoverExpectedQuestions =
        submittedQuestionIds.size ===
          expectedQuestionIds.length &&
        expectedQuestionIds.every(
          (questionId) =>
            submittedQuestionIds.has(
              questionId,
            ),
        )

      if (
        !answersCoverExpectedQuestions
      ) {
        await client.query(
          'ROLLBACK',
        )

        response.status(400).json({
          success: false,
          message:
            '현재 퀴즈의 모든 문제에 답해 주세요.',
        })
        return
      }

      let gradedAnswers:
        GradedQuizAnswer[]

      try {
        gradedAnswers =
          gradeSubmittedAnswers(
            questionsResult.data,
            answers,
          )
      } catch (error) {
        await client.query(
          'ROLLBACK',
        )

        response.status(400).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : '제출한 답안을 확인해 주세요.',
        })
        return
      }

      const correctCount =
        gradedAnswers.filter(
          (answer) =>
            answer.isCorrect,
        ).length

      const totalCount =
        gradedAnswers.length

      const attemptStatus =
        correctCount === totalCount
          ? 'completed'
          : 'retry-required'

      const attemptResult =
        await client.query(
          `
            INSERT INTO quiz_attempts (
              user_id,
              quest_set_id,
              source_type,
              source_id,
              answers,
              correct_count,
              total_count,
              status,
              mode,
              retry_round
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5::JSONB,
              $6,
              $7,
              $8,
              $9,
              $10
            )

            RETURNING
              id,
              source_type
                AS "sourceType",
              source_id
                AS "sourceId",
              answers,
              correct_count
                AS "correctCount",
              total_count
                AS "totalCount",
              status,
              mode,
              retry_round
                AS "retryRound",
              completed_at
                AS "completedAt"
          `,
          [
            userId,
            questSetId,
            sourceType,
            sourceId,
            JSON.stringify(
              gradedAnswers,
            ),
            correctCount,
            totalCount,
            attemptStatus,
            mode,
            savedRetryRound,
          ],
        )

      await updateSourceStatus(
        client,
        sourceType,
        sourceId,
        userId,
        attemptStatus,
      )

      await client.query('COMMIT')

      response.status(201).json({
        success: true,
        message:
          '퀴즈 결과가 저장되었습니다.',
        data: attemptResult.rows[0],
      })
    } catch (error) {
      await client.query(
        'ROLLBACK',
      )

      console.error(
        '퀴즈 결과 저장 실패:',
        error,
      )

      response.status(500).json({
        success: false,
        message:
          '퀴즈 결과를 저장하지 못했습니다.',
      })
    } finally {
      client.release()
    }
  },
)

export default reviewQuestsRouter