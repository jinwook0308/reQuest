import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
  answer: string
  explanation: string
}

type SavedQuestSet = {
  recordId: number
  status: 'reviewed'
  questions: ReviewQuestion[]
  updatedAt: string
}

type SavedStudyRecord = {
  id: number
  date: string
  subject: string
  unit: string
  minutes: string
  learned: string
  difficult: string
  keywords: string
  understanding: number
  questStatus?: string
}


type SavedWrongNote = {
  id: number
  date: string
  subject: string
  unit: string
  questStatus: string
}


type QuizMode = 'original' | 'retry'

type QuizAnswerResult = {
  questionId: number
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
}

type QuizAttempt = {
  id: number
  recordId: number
  sourceType: 'study-record' | 'wrong-note'
  answers: QuizAnswerResult[]
  correctCount: number
  totalCount: number
  status: 'completed' | 'retry-required'
  mode: QuizMode
  retryRound: number
  completedAt: string
}

const questionTypeLabels: Record<QuestionKind, string> = {
  'multiple-choice': '객관식',
  ox: 'OX',
  'short-answer': '단답형',
}

function loadQuestSet(
  recordId: string | undefined,
): SavedQuestSet | null {
  if (!recordId) {
    return null
  }

  try {
    const storedQuestSets = JSON.parse(
      localStorage.getItem('request-review-quests') ?? '[]',
    )

    if (!Array.isArray(storedQuestSets)) {
      return null
    }

    return (
      storedQuestSets.find(
        (questSet: SavedQuestSet) =>
          String(questSet.recordId) === recordId,
      ) ?? null
    )
  } catch (error) {
    console.error('복습 문제를 불러오지 못했습니다.', error)
    return null
  }
}

function loadRecord(
  recordId: string | undefined,
): SavedStudyRecord | null {
  if (!recordId) {
    return null
  }


  try {
    const storedRecords = JSON.parse(
      localStorage.getItem('request-study-records') ?? '[]',
    )

    if (!Array.isArray(storedRecords)) {
      return null
    }

    return (
      storedRecords.find(
        (record: SavedStudyRecord) =>
          String(record.id) === recordId,
      ) ?? null
    )
  } catch (error) {
    console.error('학습 기록을 불러오지 못했습니다.', error)
    return null
  }
}


function loadWrongNoteAsRecord(
  wrongNoteId: string | undefined,
): SavedStudyRecord | null {
  if (!wrongNoteId) {
    return null
  }

  try {
    const storedWrongNotes = JSON.parse(
      localStorage.getItem('request-wrong-notes') ?? '[]',
    )

    if (!Array.isArray(storedWrongNotes)) {
      return null
    }

    const wrongNote = storedWrongNotes.find(
      (savedWrongNote: SavedWrongNote) =>
        String(savedWrongNote.id) === wrongNoteId,
    ) as SavedWrongNote | undefined

    if (!wrongNote) {
      return null
    }

    return {
      id: wrongNote.id,
      date: wrongNote.date,
      subject: wrongNote.subject,
      unit: wrongNote.unit,
      minutes: '0',
      learned: '',
      difficult: '',
      keywords: '',
      understanding: 0,
      questStatus: wrongNote.questStatus,
    }
  } catch (error) {
    console.error('오답 노트를 불러오지 못했습니다.', error)
    return null
  }
}




function normalizeAnswer(answer: string) {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
}

function gradeAnswer(
  question: ReviewQuestion,
  userAnswer: string,
) {
  const normalizedUserAnswer = normalizeAnswer(userAnswer)
  const normalizedCorrectAnswer = normalizeAnswer(
    question.answer,
  )

  if (!normalizedUserAnswer) {
    return false
  }

  if (question.kind !== 'short-answer') {
    return normalizedUserAnswer === normalizedCorrectAnswer
  }

  if (normalizedUserAnswer === normalizedCorrectAnswer) {
    return true
  }

  const correctKeywords = normalizedCorrectAnswer
    .split(' ')
    .filter((keyword) => keyword.length >= 2)

  if (correctKeywords.length === 0) {
    return false
  }

  const matchedKeywordCount = correctKeywords.filter(
    (keyword) => normalizedUserAnswer.includes(keyword),
  ).length

  return (
    matchedKeywordCount / correctKeywords.length >= 0.6
  )
}

function createRetryQuestions(
  incorrectQuestions: ReviewQuestion[],
  retryRound: number,
) {
  const createdTime = Date.now()

  return incorrectQuestions.map((question, index) => {
    const retryTitle = `[변형 복습 ${retryRound}회차]`

    if (question.kind === 'multiple-choice') {
      return {
        ...question,
        id: createdTime + index,
        kind: 'short-answer' as QuestionKind,
        prompt: `${retryTitle}\n선택지 없이 정답을 직접 입력해 보세요.\n\n${question.prompt}`,
        options: [],
      }
    }

    if (question.kind === 'ox') {
      return {
        ...question,
        id: createdTime + index,
        kind: 'multiple-choice' as QuestionKind,
        prompt: `${retryTitle}\n다음 진술이 맞는지 판단해 보세요.\n\n${question.prompt}`,
        options: ['O', 'X'],
      }
    }

    return {
      ...question,
      id: createdTime + index,
      kind: 'short-answer' as QuestionKind,
      prompt: `${retryTitle}\n같은 개념을 다른 표현으로 다시 설명해 보세요.\n\n${question.prompt}`,
      options: [],
    }
  })
}

function QuizPage() {
  const { recordId, wrongNoteId } = useParams()
  const navigate = useNavigate()

  const isWrongNoteSource = Boolean(wrongNoteId)
  const sourceId = wrongNoteId ?? recordId

  const [questSet] = useState<SavedQuestSet | null>(() =>
    loadQuestSet(sourceId),
  )

  const [record] = useState<SavedStudyRecord | null>(() =>
    isWrongNoteSource
      ? loadWrongNoteAsRecord(wrongNoteId)
      : loadRecord(recordId),
  )
  const [quizQuestions, setQuizQuestions] = useState<
    ReviewQuestion[]
  >(() => questSet?.questions ?? [])

  const [quizMode, setQuizMode] =
    useState<QuizMode>('original')

  const [retryRound, setRetryRound] = useState(0)

  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState(0)

  const [userAnswers, setUserAnswers] = useState<
    Record<number, string>
  >({})

  const [gradedResults, setGradedResults] = useState<
    Record<number, boolean>
  >({})

  const [message, setMessage] = useState('')
  const [isFinished, setIsFinished] = useState(false)

  if (!questSet || quizQuestions.length === 0) {
    return (
      <main className="quiz-page">
        <section className="quiz-empty">
          <BookOpen size={31} />

          <h1>검토 완료된 복습 문제가 없어요.</h1>

          <p>
            먼저 복습 문제를 생성하고 검토해 주세요.
          </p>

          <Link
            to={
              recordId
                ? `/quest-review/${recordId}`
                : '/history'
            }
          >
            문제 검토 페이지로 이동
          </Link>
        </section>
      </main>
    )
  }

  const questions = quizQuestions
  const currentQuestion = questions[currentQuestionIndex]

  const currentAnswer =
    userAnswers[currentQuestion.id] ?? ''

  const isCurrentGraded =
    currentQuestion.id in gradedResults

  const isCurrentCorrect =
    gradedResults[currentQuestion.id] ?? false

  const completedCount = Object.keys(gradedResults).length

  const progressPercentage =
    (completedCount / questions.length) * 100

  const correctCount = Object.values(gradedResults).filter(
    Boolean,
  ).length

  const handleAnswerChange = (answer: string) => {
    if (isCurrentGraded) {
      return
    }

    setUserAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion.id]: answer,
    }))

    setMessage('')
  }

  const handleGrade = () => {
    if (!currentAnswer.trim()) {
      setMessage('답을 선택하거나 입력해 주세요.')
      return
    }

    const isCorrect = gradeAnswer(
      currentQuestion,
      currentAnswer,
    )

    setGradedResults((previousResults) => ({
      ...previousResults,
      [currentQuestion.id]: isCorrect,
    }))

    setMessage('')
  }

  const saveQuizAttempt = () => {
    const answers: QuizAnswerResult[] = questions.map(
      (question) => ({
        questionId: question.id,
        userAnswer: userAnswers[question.id] ?? '',
        correctAnswer: question.answer,
        isCorrect: gradedResults[question.id] ?? false,
      }),
    )

    const finalCorrectCount = answers.filter(
      (answer) => answer.isCorrect,
    ).length

    const attempt: QuizAttempt = {
      id: Date.now(),
      recordId: questSet.recordId,
      sourceType: isWrongNoteSource
        ? 'wrong-note'
        : 'study-record',
      answers,
      correctCount: finalCorrectCount,
      totalCount: questions.length,
      status:
        finalCorrectCount === questions.length
          ? 'completed'
          : 'retry-required',
      mode: quizMode,
      retryRound,
      completedAt: new Date().toISOString(),
    }

    try {
      const storedAttempts = JSON.parse(
        localStorage.getItem('request-quiz-attempts') ?? '[]',
      )

      const previousAttempts = Array.isArray(storedAttempts)
        ? (storedAttempts as QuizAttempt[])
        : []

      localStorage.setItem(
        'request-quiz-attempts',
        JSON.stringify([...previousAttempts, attempt]),
      )

      const sourceStorageKey = isWrongNoteSource
        ? 'request-wrong-notes'
        : 'request-study-records'

      const storedSourceItems = JSON.parse(
        localStorage.getItem(sourceStorageKey) ?? '[]',
      )

if (Array.isArray(storedSourceItems)) {
  const nextSourceItems = storedSourceItems.map(
    (
      savedItem: SavedStudyRecord | SavedWrongNote,
    ) =>
      savedItem.id === questSet.recordId
        ? {
            ...savedItem,
            questStatus: attempt.status,
          }
        : savedItem,
  )

  localStorage.setItem(
    sourceStorageKey,
    JSON.stringify(nextSourceItems),
  )
}

      return true
    } catch (error) {
      console.error('퀴즈 결과를 저장하지 못했습니다.', error)
      setMessage('퀴즈 결과를 저장하지 못했습니다.')
      return false
    }
  }

  const handleNext = () => {
    if (!isCurrentGraded) {
      setMessage('먼저 정답을 확인해 주세요.')
      return
    }

    const isLastQuestion =
      currentQuestionIndex === questions.length - 1

    if (isLastQuestion) {
      if (saveQuizAttempt()) {
        setIsFinished(true)
      }

      return
    }

    setCurrentQuestionIndex(
      (previousIndex) => previousIndex + 1,
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
    setQuizQuestions(questSet.questions)
    setQuizMode('original')
    setRetryRound(0)
    resetQuizState()
  }

  const handleRetryIncorrect = (
    incorrectQuestions: ReviewQuestion[],
  ) => {
    const nextRetryRound = retryRound + 1

    const retryQuestions = createRetryQuestions(
      incorrectQuestions,
      nextRetryRound,
    )

    setQuizQuestions(retryQuestions)
    setQuizMode('retry')
    setRetryRound(nextRetryRound)
    resetQuizState()
  }

  if (isFinished) {
    const incorrectQuestions = questions.filter(
      (question) => !gradedResults[question.id],
    )

    const scorePercentage = Math.round(
      (correctCount / questions.length) * 100,
    )

    const isFullyCompleted =
      correctCount === questions.length

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
                ? quizMode === 'retry'
                  ? '변형 복습까지 통과했어요!'
                  : '모든 개념을 통과했어요!'
                : '틀린 문제를 변형해서 다시 풀어볼까요?'}
            </h1>

            <p>
              총 {questions.length}문제 중 {correctCount}문제를
              맞혔습니다.
            </p>

            <strong className="quiz-result-score">
              {scorePercentage}
              <small>점</small>
            </strong>

            {isFullyCompleted && (
              <div className="quiz-complete-notice">
                <CheckCircle2 size={20} />

                <div>
                  <strong>학습 완료</strong>

                  <span>
                    필요한 모든 개념 문제를 통과했습니다.
                  </span>
                </div>
              </div>
            )}

            {incorrectQuestions.length > 0 && (
              <div className="quiz-incorrect-list">
                <h2>다시 확인할 문제</h2>

                {incorrectQuestions.map(
                  (question, questionIndex) => (
                    <div key={question.id}>
                      <span>{questionIndex + 1}</span>

                      <div>
                        <strong>{question.concept}</strong>

                        <p>{question.prompt}</p>

                        <small>
                          내 답:{' '}
                          {userAnswers[question.id] ||
                            '입력하지 않음'}
                        </small>

                        <small>
                          정답: {question.answer}
                        </small>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            <div className="quiz-result-actions">
              {incorrectQuestions.length > 0 ? (
                <button
                  type="button"
                  className="is-retry"
                  onClick={() =>
                    handleRetryIncorrect(incorrectQuestions)
                  }
                >
                  <Shuffle size={17} />
                  틀린 문제 변형해서 다시 풀기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestartAll}
                >
                  <RotateCcw size={17} />
                  전체 문제 다시 풀기
                </button>
              )}

              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  navigate(
                    isWrongNoteSource
                      ? `/wrong-notes/${questSet.recordId}`
                      : `/history/${questSet.recordId}`,
                  )
                }
              >
                학습 기록으로 돌아가기
                <ArrowRight size={17} />
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
                ? `/quest-review/wrong-note/${questSet.recordId}`
                : `/quest-review/${questSet.recordId}`
            }
          >

            <ArrowLeft size={17} />
            문제 검토로 돌아가기
          </Link>

          <span>
            {quizMode === 'retry'
              ? `변형 복습 ${retryRound}회차`
              : `${currentQuestionIndex + 1} / ${
                  questions.length
                }`}
          </span>
        </div>

        <header className="quiz-heading">
          <span className="quiz-heading-icon">
            {quizMode === 'retry' ? (
              <Shuffle size={25} />
            ) : (
              <Sparkles size={25} />
            )}
          </span>

          <div>
            <span className="quiz-eyebrow">
              {quizMode === 'retry'
                ? `RETRY QUEST · ${retryRound}`
                : 'REVIEW QUEST'}
            </span>

            <h1>{record?.unit || '복습 퀘스트'}</h1>

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
              {completedCount} / {questions.length} 완료
            </strong>
          </div>

          <div className="quiz-progress-track">
            <span
              style={{
                width: `${progressPercentage}%`,
              }}
            />
          </div>
        </section>

        <article className="quiz-question-card">
          <div className="quiz-question-meta">
            <span>
              <FileQuestion size={16} />
              {questionTypeLabels[currentQuestion.kind]}
            </span>

            <strong>{currentQuestion.concept}</strong>
          </div>

          <div className="quiz-question-content">
            <span className="quiz-question-count">
              {quizMode === 'retry'
                ? `변형 문제 ${currentQuestionIndex + 1}`
                : `문제 ${currentQuestionIndex + 1}`}
            </span>

            <h2>{currentQuestion.prompt}</h2>

            {currentQuestion.kind ===
              'multiple-choice' && (
              <div className="quiz-choice-list">
                {currentQuestion.options.map(
                  (option, optionIndex) => (
                    <button
                      type="button"
                      className={
                        currentAnswer === option
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() =>
                        handleAnswerChange(option)
                      }
                      disabled={isCurrentGraded}
                      key={optionIndex}
                    >
                      <span>{optionIndex + 1}</span>
                      {option}
                    </button>
                  ),
                )}
              </div>
            )}

            {currentQuestion.kind === 'ox' && (
              <div className="quiz-ox-list">
                {['O', 'X'].map((option) => (
                  <button
                    type="button"
                    className={
                      currentAnswer === option
                        ? 'is-selected'
                        : ''
                    }
                    onClick={() =>
                      handleAnswerChange(option)
                    }
                    disabled={isCurrentGraded}
                    key={option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.kind === 'short-answer' && (
              <label className="quiz-short-answer">
                <span>답을 입력해 주세요.</span>

                <textarea
                  value={currentAnswer}
                  onChange={(event) =>
                    handleAnswerChange(event.target.value)
                  }
                  disabled={isCurrentGraded}
                  rows={4}
                  placeholder="핵심 개념을 포함해 답을 작성해 보세요."
                />
              </label>
            )}

            {message && (
              <p className="quiz-warning">{message}</p>
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
                  <CheckCircle2 size={22} />
                ) : (
                  <CircleX size={22} />
                )}

                <div>
                  <strong>
                    {isCurrentCorrect
                      ? '정답이에요!'
                      : '아쉬워요. 다시 확인해 보세요.'}
                  </strong>

                  {!isCurrentCorrect && (
                    <span>
                      정답: {currentQuestion.answer}
                    </span>
                  )}

                  <p>{currentQuestion.explanation}</p>
                </div>
              </div>
            )}
          </div>

          <div className="quiz-question-actions">
            {!isCurrentGraded ? (
              <button
                type="button"
                className="quiz-check-button"
                onClick={handleGrade}
              >
                정답 확인
              </button>
            ) : (
              <button
                type="button"
                className="quiz-next-button"
                onClick={handleNext}
              >
                {currentQuestionIndex ===
                questions.length - 1
                  ? '결과 확인'
                  : '다음 문제'}

                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </article>
      </div>
    </main>
  )
}

export default QuizPage