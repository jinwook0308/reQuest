import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleX,
  FileQuestion,
  RotateCcw,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'

import './QuizPage.css'
import { apiFetch } from '../../lib/api'

type SourceType =
  | 'study-record'
  | 'wrong-note'

type QuestionKind =
  | 'multiple-choice'
  | 'ox'
  | 'short-answer'

type ReviewQuestion = {
  id: number
  kind: QuestionKind
  concept: string
  prompt: string
  options: string[]
}

type QuestSet = {
  id: number
  sourceType: SourceType
  sourceId: number
  status: 'reviewed'
  questions: ReviewQuestion[]
  updatedAt: string
}

type SourceRecord = {
  id: number
  subject: string
  unit: string
}

type QuizMode =
  | 'original'
  | 'retry'

type QuizAnswerResult = {
  questionId: number
  userAnswer: string
}

type GradeResult = {
  questionId: number
  isCorrect: boolean
  correctAnswer: string
  explanation: string
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type QuestSetApiItem = {
  id: number | string
  sourceType: SourceType
  sourceId: number | string
  status: 'reviewed'
  questions: ReviewQuestion[]
  updatedAt: string
}

type SourceApiItem = {
  id: number | string
  subject: string
  unit: string
}

const questionTypeLabels: Record<
  QuestionKind,
  string
> = {
  'multiple-choice': '객관식',
  ox: 'OX',
  'short-answer': '단답형',
}

async function loadQuestSet(
  sourceType: SourceType,
  sourceId: string,
  signal: AbortSignal,
): Promise<QuestSet> {
  const response = await apiFetch(
    `/review-quests/${sourceType}/${sourceId}/quiz`,
    { signal },
  )

  const result =
    (await response.json()) as ApiResponse<QuestSetApiItem>

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '출제할 문제가 없습니다.',
    )
  }

  return {
    id: Number(result.data.id),
    sourceType:
      result.data.sourceType,
    sourceId:
      Number(result.data.sourceId),
    status: result.data.status,
    questions:
      result.data.questions,
    updatedAt:
      result.data.updatedAt,
  }
}

async function loadSourceRecord(
  sourceType: SourceType,
  sourceId: string,
  signal: AbortSignal,
): Promise<SourceRecord> {
  const endpoint =
    sourceType === 'wrong-note'
      ? `/wrong-notes/${sourceId}`
      : `/study-records/${sourceId}`

  const response = await apiFetch(
    endpoint,
    { signal },
  )

  const result =
    (await response.json()) as ApiResponse<SourceApiItem>

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '학습 자료를 불러오지 못했습니다.',
    )
  }

  return {
    id: Number(result.data.id),
    subject: result.data.subject,
    unit: result.data.unit,
  }
}

function QuestionPrompt({
  prompt,
}: {
  prompt: string
}) {
  const normalizedPrompt =
    prompt.replace(/\r\n/g, '\n')

  const codeBlockPattern =
    /```(?:[a-zA-Z0-9_+-]+)?\s*\n([\s\S]*?)```/g

  const parts: Array<{
    type: 'text' | 'code'
    value: string
  }> = []

  let lastIndex = 0
  let match =
    codeBlockPattern.exec(
      normalizedPrompt,
    )

  while (match) {
    const textBeforeCode =
      normalizedPrompt.slice(
        lastIndex,
        match.index,
      )

    if (textBeforeCode.trim()) {
      parts.push({
        type: 'text',
        value: textBeforeCode.trim(),
      })
    }

    parts.push({
      type: 'code',
      value: match[1].trimEnd(),
    })

    lastIndex =
      codeBlockPattern.lastIndex

    match = codeBlockPattern.exec(
      normalizedPrompt,
    )
  }

  const remainingText =
    normalizedPrompt.slice(lastIndex)

  if (remainingText.trim()) {
    parts.push({
      type: 'text',
      value: remainingText.trim(),
    })
  }

  return (
    <div className="quiz-question-prompt">
      {parts.map((part, index) =>
        part.type === 'code' ? (
          <pre
            className="quiz-question-code"
            key={`code-${index}`}
          >
            <code>{part.value}</code>
          </pre>
        ) : (
          <p key={`text-${index}`}>
            {part.value}
          </p>
        ),
      )}
    </div>
  )
}

function QuizPage() {
  const {
    recordId,
    wrongNoteId,
  } = useParams()

  const navigate = useNavigate()

  const isWrongNoteSource =
    Boolean(wrongNoteId)

  const sourceType: SourceType =
    isWrongNoteSource
      ? 'wrong-note'
      : 'study-record'

  const sourceId =
    wrongNoteId ?? recordId

  const [questSet, setQuestSet] =
    useState<QuestSet | null>(null)

  const [record, setRecord] =
    useState<SourceRecord | null>(
      null,
    )

  const [
    quizQuestions,
    setQuizQuestions,
  ] = useState<ReviewQuestion[]>([])

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState('')

  const [
    isSavingAttempt,
    setIsSavingAttempt,
  ] = useState(false)

  const [isGrading, setIsGrading] =
    useState(false)

  const [quizMode, setQuizMode] =
    useState<QuizMode>('original')

  const [retryRound, setRetryRound] =
    useState(0)

  const [
    currentQuestionIndex,
    setCurrentQuestionIndex,
  ] = useState(0)

  const [
    userAnswers,
    setUserAnswers,
  ] = useState<
    Record<number, string>
  >({})

  const [
    gradedResults,
    setGradedResults,
  ] = useState<
    Record<number, GradeResult>
  >({})

  const [message, setMessage] =
    useState('')

  const [isFinished, setIsFinished] =
    useState(false)

  useEffect(() => {
    const controller =
      new AbortController()

    const loadQuiz = async () => {
      if (!sourceId) {
        setLoadError(
          '퀴즈 주소가 올바르지 않습니다.',
        )
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setLoadError('')

        const [
          loadedQuestSet,
          loadedRecord,
        ] = await Promise.all([
          loadQuestSet(
            sourceType,
            sourceId,
            controller.signal,
          ),

          loadSourceRecord(
            sourceType,
            sourceId,
            controller.signal,
          ),
        ])

        if (
          controller.signal.aborted
        ) {
          return
        }

        setQuestSet(
          loadedQuestSet,
        )

        setRecord(loadedRecord)

        setQuizQuestions(
          loadedQuestSet.questions,
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        console.error(
          '퀴즈 조회 실패:',
          error,
        )

        setLoadError(
          error instanceof Error
            ? error.message
            : '문제를 불러오지 못했습니다.',
        )
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setIsLoading(false)
        }
      }
    }

    void loadQuiz()

    return () => {
      controller.abort()
    }
  }, [sourceId, sourceType])

  if (isLoading) {
    return (
      <main className="quiz-page">
        <section className="quiz-empty">
          <BookOpen size={31} />

          <h1>
            {isWrongNoteSource
              ? 'AI 오답 문제를 불러오는 중이에요.'
              : '복습 문제를 불러오는 중이에요.'}
          </h1>

          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    )
  }

  if (
    loadError ||
    !questSet ||
    !record ||
    !sourceId ||
    quizQuestions.length === 0
  ) {
    return (
      <main className="quiz-page">
        <section className="quiz-empty">
          <BookOpen size={31} />

          <h1>
            {isWrongNoteSource
              ? '생성된 AI 오답 문제가 없어요.'
              : '검토 완료된 복습 문제가 없어요.'}
          </h1>

          <p>
            {loadError ||
              (isWrongNoteSource
                ? '오답노트에서 AI 오답 문제를 생성해 주세요.'
                : '먼저 복습 문제를 생성하고 검토해 주세요.')}
          </p>

          <Link
            to={
              isWrongNoteSource
                ? `/wrong-notes/${sourceId}`
                : `/quest-review/${sourceId}`
            }
          >
            {isWrongNoteSource
              ? '오답노트로 돌아가기'
              : '문제 검토 페이지로 이동'}
          </Link>
        </section>
      </main>
    )
  }

  const questions =
    quizQuestions

  const currentQuestion =
    questions[currentQuestionIndex]

  const currentAnswer =
    userAnswers[
      currentQuestion.id
    ] ?? ''

  const isCurrentGraded =
    currentQuestion.id in
    gradedResults

  const isCurrentCorrect =
    gradedResults[
      currentQuestion.id
    ]?.isCorrect ?? false

  const currentGradeResult =
    gradedResults[
      currentQuestion.id
    ]

  const completedCount =
    Object.keys(
      gradedResults,
    ).length

  const progressPercentage =
    (completedCount /
      questions.length) *
    100

  const correctCount =
    Object.values(
      gradedResults,
    ).filter(
      (result) => result.isCorrect,
    ).length

  const handleAnswerChange = (
    answer: string,
  ) => {
    if (isCurrentGraded) {
      return
    }

    setUserAnswers(
      (previousAnswers) => ({
        ...previousAnswers,
        [currentQuestion.id]:
          answer,
      }),
    )

    setMessage('')
  }

  const handleGrade = async () => {
    if (!currentAnswer.trim()) {
      setMessage(
        '답을 선택하거나 입력해 주세요.',
      )

      return
    }

    try {
      setIsGrading(true)
      setMessage('')

      const response = await apiFetch(
        `/review-quests/${sourceType}/${sourceId}/grade`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            questionId:
              currentQuestion.id,
            userAnswer:
              currentAnswer,
          }),
        },
      )

      const result =
        (await response.json()) as ApiResponse<GradeResult>

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            '답안을 채점하지 못했습니다.',
        )
      }

      setGradedResults(
        (previousResults) => ({
          ...previousResults,
          [currentQuestion.id]:
            result.data as GradeResult,
        }),
      )
    } catch (error) {
      console.error(
        '답안 채점 실패:',
        error,
      )

      setMessage(
        error instanceof Error
          ? error.message
          : '답안을 채점하지 못했습니다.',
      )
    } finally {
      setIsGrading(false)
    }
  }

  const saveQuizAttempt =
    async () => {
      const answers: QuizAnswerResult[] =
        questions.map(
          (question) => ({
            questionId:
              question.id,
            userAnswer:
              userAnswers[
                question.id
              ] ?? '',
          }),
        )

      try {
        setIsSavingAttempt(true)

        const response =
          await apiFetch(
            `/review-quests/${sourceType}/${sourceId}/attempts`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                answers,
                mode: quizMode,
              }),
            },
          )

        const result =
          (await response.json()) as ApiResponse<unknown>

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              '퀴즈 결과를 저장하지 못했습니다.',
          )
        }

        return true
      } catch (error) {
        console.error(
          '퀴즈 결과 저장 실패:',
          error,
        )

        setMessage(
          error instanceof Error
            ? error.message
            : '퀴즈 결과를 저장하지 못했습니다.',
        )

        return false
      } finally {
        setIsSavingAttempt(false)
      }
    }

  const handleNext = async () => {
    if (!isCurrentGraded) {
      setMessage(
        '먼저 정답을 확인해 주세요.',
      )

      return
    }

    const isLastQuestion =
      currentQuestionIndex ===
      questions.length - 1

    if (isLastQuestion) {
      const saved =
        await saveQuizAttempt()

      if (saved) {
        setIsFinished(true)
      }

      return
    }

    setCurrentQuestionIndex(
      (previousIndex) =>
        previousIndex + 1,
    )

    setMessage('')
  }

  const resetQuizState = () => {
    setCurrentQuestionIndex(0)
    setUserAnswers({})
    setGradedResults({})
    setMessage('')
    setIsFinished(false)
  }

  const handleRestartAll = () => {
    setQuizQuestions(
      questSet.questions,
    )

    setQuizMode('original')
    setRetryRound(0)
    resetQuizState()
  }

  const handleRetryIncorrect = () => {
    navigate(
      isWrongNoteSource
        ? `/quest-review/wrong-note/${sourceId}`
        : `/quest-review/${sourceId}`,
    )
  }

  if (isFinished) {
    const incorrectQuestions =
      questions.filter(
        (question) =>
          !gradedResults[
            question.id
          ]?.isCorrect,
      )

    const scorePercentage =
      Math.round(
        (correctCount /
          questions.length) *
          100,
      )

    const isFullyCompleted =
      correctCount ===
      questions.length

    return (
      <main className="quiz-page">
        <div className="quiz-container">
          <section className="quiz-result-card">
            <span className="quiz-result-icon">
              {isFullyCompleted ? (
                <Trophy size={35} />
              ) : (
                <Target size={35} />
              )}
            </span>

            <span className="quiz-result-eyebrow">
              {quizMode === 'retry'
                ? `RETRY QUEST · ${retryRound}`
                : 'QUEST RESULT'}
            </span>

            <h1>
              {isFullyCompleted
                ? quizMode ===
                  'retry'
                  ? '변형 복습까지 통과했어요!'
                  : '모든 개념을 통과했어요!'
                : 'AI로 새로운 변형 문제를 만들어 볼까요?'}
            </h1>

            <p>
              총 {questions.length}
              문제 중 {correctCount}
              문제를 맞혔습니다.
            </p>

            <strong className="quiz-result-score">
              {scorePercentage}
              <small>점</small>
            </strong>

            {isFullyCompleted && (
              <div className="quiz-complete-notice">
                <CheckCircle2
                  size={20}
                />

                <div>
                  <strong>
                    학습 완료
                  </strong>

                  <span>
                    필요한 모든 개념
                    문제를 통과했습니다.
                  </span>
                </div>
              </div>
            )}

            {incorrectQuestions.length >
              0 && (
              <div className="quiz-incorrect-list">
                <h2>
                  다시 확인할 문제
                </h2>

                {incorrectQuestions.map(
                  (
                    question,
                    questionIndex,
                  ) => (
                    <div
                      key={
                        question.id
                      }
                    >
                      <span>
                        {questionIndex +
                          1}
                      </span>

                      <div>
                        <strong>
                          {
                            question.concept
                          }
                        </strong>

                        <p>
                          {
                            question.prompt
                          }
                        </p>

                        <small>
                          내 답:{' '}
                          {userAnswers[
                            question.id
                          ] ||
                            '입력하지 않음'}
                        </small>

                        <small>
                          정답:{' '}
                          {
                            gradedResults[
                              question.id
                            ]
                              ?.correctAnswer
                          }
                        </small>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            <div className="quiz-result-actions">
              {incorrectQuestions.length >
              0 ? (
                <button
                  type="button"
                  className="is-retry"
                  onClick={
                    handleRetryIncorrect
                  }
                >
                  <Shuffle
                    size={17}
                  />
                  AI 변형 문제 만들기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    handleRestartAll
                  }
                >
                  <RotateCcw
                    size={17}
                  />
                  전체 문제 다시 풀기
                </button>
              )}

              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  navigate(
                    isWrongNoteSource
                      ? `/wrong-notes/${questSet.sourceId}`
                      : `/history/${questSet.sourceId}`,
                  )
                }
              >
                학습 기록으로 돌아가기
                <ArrowRight
                  size={17}
                />
              </button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="quiz-page">
      <div className="quiz-container">
        <div className="quiz-topbar">
          <Link
            to={
              isWrongNoteSource
                ? `/wrong-notes/${questSet.sourceId}`
                : `/quest-review/${questSet.sourceId}`
            }
          >
            <ArrowLeft size={17} />
            {isWrongNoteSource
              ? '오답노트로 돌아가기'
              : '문제 검토로 돌아가기'}
          </Link>

          <span>
            {quizMode === 'retry'
              ? `변형 복습 ${retryRound}회차`
              : `${
                  currentQuestionIndex +
                  1
                } / ${
                  questions.length
                }`}
          </span>
        </div>

        <header className="quiz-heading">
          <span className="quiz-heading-icon">
            {quizMode ===
            'retry' ? (
              <Shuffle size={25} />
            ) : (
              <Sparkles size={25} />
            )}
          </span>

          <div>
            <span className="quiz-eyebrow">
              {quizMode === 'retry'
                ? `RETRY QUEST · ${retryRound}`
                : isWrongNoteSource
                  ? 'AI WRONG ANSWER QUEST'
                  : 'REVIEW QUEST'}
            </span>

            <h1>
              {record.unit ||
                (isWrongNoteSource
                  ? 'AI 오답 문제'
                  : '복습 퀘스트')}
            </h1>

            <p>
              {quizMode === 'retry'
                ? '틀린 문제의 형식을 바꿔 다시 확인합니다.'
                : '한 문제씩 풀고 취약한 개념을 확인해 보세요.'}
            </p>
          </div>
        </header>

        <section className="quiz-progress">
          <div>
            <span>
              {quizMode === 'retry'
                ? '변형 복습 진행률'
                : '학습 진행률'}
            </span>

            <strong>
              {completedCount} /{' '}
              {questions.length} 완료
            </strong>
          </div>

          <div className="quiz-progress-track">
            <span
              style={{
                width:
                  `${progressPercentage}%`,
              }}
            />
          </div>
        </section>

        <article className="quiz-question-card">
          <div className="quiz-question-meta">
            <span>
              <FileQuestion size={16} />

              {
                questionTypeLabels[
                  currentQuestion.kind
                ]
              }
            </span>

            <strong>
              {
                currentQuestion.concept
              }
            </strong>
          </div>

          <div className="quiz-question-content">
            <span className="quiz-question-count">
              {quizMode === 'retry'
                ? `변형 문제 ${
                    currentQuestionIndex +
                    1
                  }`
                : `문제 ${
                    currentQuestionIndex +
                    1
                  }`}
            </span>

            <QuestionPrompt
              prompt={
                currentQuestion.prompt
              }
            />

            {currentQuestion.kind ===
              'multiple-choice' && (
              <div className="quiz-choice-list">
                {currentQuestion.options.map(
                  (
                    option,
                    optionIndex,
                  ) => (
                    <button
                      type="button"
                      className={
                        currentAnswer ===
                        option
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() =>
                        handleAnswerChange(
                          option,
                        )
                      }
                      disabled={
                        isCurrentGraded
                      }
                      key={
                        optionIndex
                      }
                    >
                      <span>
                        {optionIndex +
                          1}
                      </span>

                      {option}
                    </button>
                  ),
                )}
              </div>
            )}

            {currentQuestion.kind ===
              'ox' && (
              <div className="quiz-ox-list">
                {['O', 'X'].map(
                  (option) => (
                    <button
                      type="button"
                      className={
                        currentAnswer ===
                        option
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() =>
                        handleAnswerChange(
                          option,
                        )
                      }
                      disabled={
                        isCurrentGraded
                      }
                      key={option}
                    >
                      {option}
                    </button>
                  ),
                )}
              </div>
            )}

            {currentQuestion.kind ===
              'short-answer' && (
              <label className="quiz-short-answer">
                <span>
                  답을 입력해 주세요.
                </span>

                <textarea
                  value={
                    currentAnswer
                  }
                  onChange={(event) =>
                    handleAnswerChange(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    isCurrentGraded
                  }
                  rows={4}
                  placeholder="핵심 개념을 포함해 답을 작성해 보세요."
                />
              </label>
            )}

            {message && (
              <p className="quiz-warning">
                {message}
              </p>
            )}

            {isCurrentGraded && (
              <div
                className={`quiz-feedback ${
                  isCurrentCorrect
                    ? 'is-correct'
                    : 'is-wrong'
                }`}
              >
                {isCurrentCorrect ? (
                  <CheckCircle2
                    size={22}
                  />
                ) : (
                  <CircleX
                    size={22}
                  />
                )}

                <div>
                  <strong>
                    {isCurrentCorrect
                      ? '정답이에요!'
                      : '아쉬워요. 다시 확인해 보세요.'}
                  </strong>

                  {!isCurrentCorrect && (
                    <span>
                      정답:{' '}
                      {
                        currentGradeResult
                          ?.correctAnswer
                      }
                    </span>
                  )}

                  <p>
                    {
                      currentGradeResult
                        ?.explanation
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="quiz-question-actions">
            {!isCurrentGraded ? (
              <button
                type="button"
                className="quiz-check-button"
                onClick={() =>
                  void handleGrade()
                }
                disabled={isGrading}
              >
                {isGrading
                  ? '채점 중...'
                  : '정답 확인'}
              </button>
            ) : (
              <button
                type="button"
                className="quiz-next-button"
                onClick={() =>
                  void handleNext()
                }
                disabled={
                  isSavingAttempt
                }
              >
                {isSavingAttempt
                  ? '결과 저장 중...'
                  : currentQuestionIndex ===
                      questions.length -
                        1
                    ? '결과 확인'
                    : '다음 문제'}

                <ArrowRight
                  size={18}
                />
              </button>
            )}
          </div>
        </article>
      </div>
    </main>
  )
}

export default QuizPage
