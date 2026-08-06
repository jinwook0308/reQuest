import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CirclePlus,
  FileQuestion,
  ImageIcon,
  Play,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'

import './QuestReviewPage.css'
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
  answer: string
  explanation: string
}

type SourceRecord = {
  id: number
  date: string
  subject: string
  unit: string
  minutes: string
  learned: string
  difficult: string
  keywords: string
  understanding: number
  createdAt?: string
  mistakeQuestion?: string
  wrongAnswer?: string
  correctAnswer?: string
  mistakeReason?: string
  wrongImage?: string
  wrongImageName?: string
  questStatus?: string
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type StudyRecordApiItem = {
  id: number | string
  date: string
  subject: string
  unit: string
  minutes: number | string
  learned: string
  difficult: string
  keywords: string
  understanding: number | string
  createdAt?: string
  mistakeQuestion?: string | null
  wrongAnswer?: string | null
  correctAnswer?: string | null
  mistakeReason?: string | null
  wrongImage?: string | null
  wrongImageName?: string | null
  questStatus?: string | null
}

type WrongNoteApiItem = {
  id: number | string
  date: string
  subject: string
  unit: string
  mistakeQuestion: string
  wrongAnswer: string
  correctAnswer: string
  mistakeReason: string
  concepts: string
  wrongImage: string | null
  wrongImageName: string | null
  questStatus: string
  createdAt: string
}

type QuestSetApiItem = {
  id: number | string
  sourceType: SourceType
  sourceId: number | string
  status: 'reviewed'
  questions: ReviewQuestion[]
  updatedAt: string
}

type ReviewQuestionGenerator =
  | 'openai'
  | 'rule-based'
  | 'rule-based-fallback'

type QuestDraftApiItem = {
  sourceType: SourceType
  sourceId: number | string
  generator: ReviewQuestionGenerator
  questions: ReviewQuestion[]
}

const questionTypeLabels: Record<
  QuestionKind,
  string
> = {
  'multiple-choice': '객관식',
  ox: 'OX',
  'short-answer': '단답형',
}

async function loadSourceRecord(
  sourceType: SourceType,
  sourceId: string,
  signal: AbortSignal,
): Promise<SourceRecord> {
  if (sourceType === 'wrong-note') {
    const response = await apiFetch(
      `/wrong-notes/${sourceId}`,
      { signal },
    )

    const result =
      (await response.json()) as ApiResponse<WrongNoteApiItem>

    if (
      !response.ok ||
      !result.success ||
      !result.data
    ) {
      throw new Error(
        result.message ??
          '오답노트를 불러오지 못했습니다.',
      )
    }

    const wrongNote = result.data

    return {
      id: Number(wrongNote.id),
      date: wrongNote.date,
      subject: wrongNote.subject,
      unit: wrongNote.unit,
      minutes: '0',
      learned: '',
      difficult:
        wrongNote.mistakeReason,
      keywords:
        wrongNote.concepts,
      understanding: 0,
      createdAt:
        wrongNote.createdAt,
      mistakeQuestion:
        wrongNote.mistakeQuestion,
      wrongAnswer:
        wrongNote.wrongAnswer,
      correctAnswer:
        wrongNote.correctAnswer,
      mistakeReason:
        wrongNote.mistakeReason,
      wrongImage:
        wrongNote.wrongImage ?? '',
      wrongImageName:
        wrongNote.wrongImageName ?? '',
      questStatus:
        wrongNote.questStatus,
    }
  }

  const response = await apiFetch(
    `/study-records/${sourceId}`,
    { signal },
  )

  const result =
    (await response.json()) as ApiResponse<StudyRecordApiItem>

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '학습 기록을 불러오지 못했습니다.',
    )
  }

  const record = result.data

  return {
    id: Number(record.id),
    date: record.date,
    subject: record.subject,
    unit: record.unit,
    minutes: String(record.minutes),
    learned: record.learned,
    difficult: record.difficult,
    keywords: record.keywords,
    understanding:
      Number(record.understanding),
    createdAt: record.createdAt,
    mistakeQuestion:
      record.mistakeQuestion ?? undefined,
    wrongAnswer:
      record.wrongAnswer ?? undefined,
    correctAnswer:
      record.correctAnswer ?? undefined,
    mistakeReason:
      record.mistakeReason ?? undefined,
    wrongImage: record.wrongImage ?? '',
    wrongImageName:
      record.wrongImageName ?? '',
    questStatus:
      record.questStatus ?? undefined,
  }
}

async function loadQuestSet(
  sourceType: SourceType,
  sourceId: string,
  signal: AbortSignal,
) {
  const response = await apiFetch(
    `/review-quests/${sourceType}/${sourceId}`,
    { signal },
  )

  if (response.status === 404) {
    return null
  }

  const result =
    (await response.json()) as ApiResponse<QuestSetApiItem>

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '복습 문제를 불러오지 못했습니다.',
    )
  }

  return result.data
}

async function generateQuestDraft(
  sourceType: SourceType,
  sourceId: string,
): Promise<QuestDraftApiItem> {
  const response = await apiFetch(
    `/review-quest-drafts/${sourceType}/${sourceId}`,
    { method: 'POST' },
  )

  const result =
    (await response.json()) as ApiResponse<QuestDraftApiItem>

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        'AI 복습 문제를 생성하지 못했습니다.',
    )
  }

  return result.data
}

function QuestReviewPage() {
  const {
    recordId,
    wrongNoteId,
  } = useParams()

  const isWrongNoteSource =
    Boolean(wrongNoteId)

  const sourceType: SourceType =
    isWrongNoteSource
      ? 'wrong-note'
      : 'study-record'

  const sourceId =
    wrongNoteId ?? recordId

  const [record, setRecord] =
    useState<SourceRecord | null>(
      null,
    )

  const [questions, setQuestions] =
    useState<ReviewQuestion[]>([])

  const [generator, setGenerator] =
    useState<
      ReviewQuestionGenerator | 'saved' | null
    >(null)

  const [isGenerating, setIsGenerating] =
    useState(false)

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState('')

  const [saveStatus, setSaveStatus] =
    useState<
      'idle' | 'saving' | 'saved' | 'error'
    >('idle')

  const [message, setMessage] =
    useState('')

  useEffect(() => {
    const controller =
      new AbortController()

    const loadPage = async () => {
      if (!sourceId) {
        setLoadError(
          '학습 자료 주소가 올바르지 않습니다.',
        )
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setLoadError('')

        const loadedRecord =
          await loadSourceRecord(
            sourceType,
            sourceId,
            controller.signal,
          )

        const savedQuestSet =
          await loadQuestSet(
            sourceType,
            sourceId,
            controller.signal,
          )

        if (
          controller.signal.aborted
        ) {
          return
        }

        setRecord(loadedRecord)

        setQuestions(
          savedQuestSet?.questions ?? [],
        )

        setGenerator(
          savedQuestSet ? 'saved' : null,
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        console.error(
          '문제 검토 페이지 조회 실패:',
          error,
        )

        setLoadError(
          error instanceof Error
            ? error.message
            : '학습 자료를 불러오지 못했습니다.',
        )
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setIsLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      controller.abort()
    }
  }, [sourceId, sourceType])

  if (isLoading) {
    return (
      <main className="quest-review-page">
        <section className="quest-review-empty">
          <BookOpen size={31} />

          <h1>
            복습 문제를 준비하고 있어요.
          </h1>

          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    )
  }

  if (
    loadError ||
    !record ||
    !sourceId
  ) {
    return (
      <main className="quest-review-page">
        <section className="quest-review-empty">
          <BookOpen size={31} />

          <h1>
            학습 자료를 찾을 수 없어요.
          </h1>

          <p>
            {loadError ||
              '먼저 저장된 학습 자료를 선택해 주세요.'}
          </p>

          <Link
            to={
              isWrongNoteSource
                ? '/wrong-notes'
                : '/history'
            }
          >
            목록으로 돌아가기
          </Link>
        </section>
      </main>
    )
  }

  const updateQuestion = (
    questionId: number,
    field:
      | 'concept'
      | 'prompt'
      | 'answer'
      | 'explanation',
    value: string,
  ) => {
    setQuestions(
      (previousQuestions) =>
        previousQuestions.map(
          (question) =>
            question.id === questionId
              ? {
                  ...question,
                  [field]: value,
                }
              : question,
        ),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const updateQuestionType = (
    questionId: number,
    kind: QuestionKind,
  ) => {
    setQuestions(
      (previousQuestions) =>
        previousQuestions.map(
          (question) => {
            if (
              question.id !==
              questionId
            ) {
              return question
            }

            if (
              kind ===
              'multiple-choice'
            ) {
              return {
                ...question,
                kind,
                options:
                  question.options
                    .length === 4
                    ? question.options
                    : [
                        '선택지 1',
                        '선택지 2',
                        '선택지 3',
                        '선택지 4',
                      ],
                answer: '',
              }
            }

            if (kind === 'ox') {
              return {
                ...question,
                kind,
                options: [],
                answer: 'O',
              }
            }

            return {
              ...question,
              kind,
              options: [],
              answer: '',
            }
          },
        ),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const updateOption = (
    questionId: number,
    optionIndex: number,
    value: string,
  ) => {
    setQuestions(
      (previousQuestions) =>
        previousQuestions.map(
          (question) => {
            if (
              question.id !==
              questionId
            ) {
              return question
            }

            return {
              ...question,
              options:
                question.options.map(
                  (
                    option,
                    currentIndex,
                  ) =>
                    currentIndex ===
                    optionIndex
                      ? value
                      : option,
                ),
            }
          },
        ),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const handleAddQuestion = () => {
    if (questions.length >= 5) {
      setSaveStatus('error')

      setMessage(
        '복습 문제는 최대 5개까지 만들 수 있습니다.',
      )

      return
    }

    const firstKeyword =
      record.keywords
        .split(',')
        .map((keyword) =>
          keyword.trim(),
        )
        .find(Boolean) ||
      record.unit ||
      record.subject

    const newQuestion: ReviewQuestion =
      {
        id: Date.now(),
        kind: 'short-answer',
        concept: firstKeyword,
        prompt: '',
        options: [],
        answer: '',
        explanation: '',
      }

    setQuestions(
      (previousQuestions) => [
        ...previousQuestions,
        newQuestion,
      ],
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const handleDeleteQuestion = (
    questionId: number,
  ) => {
    if (questions.length <= 3) {
      setSaveStatus('error')

      setMessage(
        '복습 문제는 최소 3개가 필요합니다.',
      )

      return
    }

    setQuestions(
      (previousQuestions) =>
        previousQuestions.filter(
          (question) =>
            question.id !==
            questionId,
        ),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const handleGenerateDraft = async () => {
    if (!sourceId) {
      return
    }

    if (
      questions.length > 0 &&
      !window.confirm(
        '현재 문제를 버리고 AI 변형 문제를 새로 만들까요?',
      )
    ) {
      return
    }

    try {
      setIsGenerating(true)
      setSaveStatus('idle')
      setMessage('')

      const draft =
        await generateQuestDraft(
          sourceType,
          sourceId,
        )

      setQuestions(draft.questions)
      setGenerator(draft.generator)
    } catch (error) {
      console.error(
        'AI 복습 문제 생성 실패:',
        error,
      )

      setSaveStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'AI 복습 문제를 생성하지 못했습니다.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    const hasEmptyField =
      questions.some(
        (question) =>
          !question.concept.trim() ||
          !question.prompt.trim() ||
          !question.answer.trim() ||
          !question.explanation.trim(),
      )

    if (hasEmptyField) {
      setSaveStatus('error')

      setMessage(
        '모든 문제의 개념, 문제, 정답, 해설을 입력해 주세요.',
      )

      return
    }

    const invalidMultipleChoice =
      questions.some(
        (question) =>
          question.kind ===
            'multiple-choice' &&
          (question.options.length !== 4 ||
            question.options.some(
              (option) =>
                !option.trim(),
            ) ||
            !question.options.includes(
              question.answer,
            )),
      )

    if (invalidMultipleChoice) {
      setSaveStatus('error')

      setMessage(
        '객관식 정답은 네 개의 선택지 중 하나여야 합니다.',
      )

      return
    }

    try {
      setSaveStatus('saving')
      setMessage('')

      const response = await apiFetch(
        `/review-quests/${sourceType}/${sourceId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            questions,
          }),
        },
      )

      const result =
        (await response.json()) as ApiResponse<QuestSetApiItem>

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            '복습 문제를 저장하지 못했습니다.',
        )
      }

      setSaveStatus('saved')

      setGenerator('saved')

      setMessage(
        result.message ??
          '복습 문제가 저장되었습니다.',
      )
    } catch (error) {
      console.error(
        '복습 문제 저장 실패:',
        error,
      )

      setSaveStatus('error')

      setMessage(
        error instanceof Error
          ? error.message
          : '복습 문제를 저장하지 못했습니다.',
      )
    }
  }

  return (
    <main className="quest-review-page">
      <div className="quest-review-container">
        <div className="quest-review-topbar">
          <Link
            to={
              isWrongNoteSource
                ? `/wrong-notes/${record.id}`
                : `/history/${record.id}`
            }
          >
            <ArrowLeft size={17} />

            {isWrongNoteSource
              ? '오답노트 상세보기로 돌아가기'
              : '학습 기록 상세보기로 돌아가기'}
          </Link>

          <span>
            학습 여정 4 · AI 분석
          </span>
        </div>

        <header className="quest-review-heading">
          <span className="quest-review-heading-icon">
            <Sparkles size={26} />
          </span>

          <div>
            <span className="quest-review-eyebrow">
              REVIEW QUEST
            </span>

            <h1>
              복습 문제를 확인해 주세요.
            </h1>

            <p>
              생성된 문제와 정답을 직접
              검토하고 수정할 수 있어요.
              <br />
              확인된 문제만 실제 복습
              퀘스트에 사용됩니다.
            </p>
          </div>
        </header>

        <section className="quest-source-card">
          <div className="quest-source-content">
            <span>{record.subject}</span>

            <div>
              <strong>
                {record.unit}
              </strong>

              <p>
                {record.mistakeReason ||
                  record.difficult ||
                  '등록된 취약 개념을 기준으로 문제를 만들었습니다.'}
              </p>
            </div>
          </div>

          {record.wrongImage ? (
            <img
              src={record.wrongImage}
              alt="복습 문제 생성에 사용한 오답"
            />
          ) : (
            <span className="quest-source-no-image">
              <ImageIcon size={22} />
            </span>
          )}
        </section>

        <section className="quest-generator-notice">
          <Sparkles size={18} />

          <div>
            <strong>
              {isGenerating
                ? 'AI가 변형 문제를 만들고 있어요.'
                : generator === 'openai'
                  ? `AI가 변형 문제 ${questions.length}개를 만들었습니다.`
                  : generator === 'saved'
                    ? `저장된 복습 문제 ${questions.length}개를 불러왔습니다.`
                    : generator === 'rule-based-fallback'
                      ? 'AI 연결 실패로 기본 문제를 불러왔습니다.'
                      : generator === 'rule-based'
                        ? 'AI가 설정되지 않아 기본 문제를 불러왔습니다.'
                        : 'AI로 새로운 변형 문제를 만들어 보세요.'}
            </strong>

            <span>
              생성된 문제와 정답, 해설을
              검토한 뒤 저장해 주세요.
            </span>
          </div>

          <button
            type="button"
            className="quest-generate-button"
            onClick={() =>
              void handleGenerateDraft()
            }
            disabled={isGenerating}
          >
            <Sparkles size={15} />
            {isGenerating
              ? '생성 중...'
              : questions.length > 0
                ? 'AI로 다시 생성'
                : 'AI 문제 생성하기'}
          </button>
        </section>

        <section className="quest-question-list">
          {questions.map(
            (
              question,
              questionIndex,
            ) => (
              <article
                className="quest-question-card"
                key={question.id}
              >
                <div className="quest-question-header">
                  <div>
                    <span className="quest-question-number">
                      {questionIndex + 1}
                    </span>

                    <FileQuestion
                      size={18}
                    />

                    <strong>
                      {
                        questionTypeLabels[
                          question.kind
                        ]
                      }
                    </strong>
                  </div>

                  <div className="quest-question-header-actions">
                    <select
                      value={
                        question.kind
                      }
                      onChange={(event) =>
                        updateQuestionType(
                          question.id,
                          event.target
                            .value as QuestionKind,
                        )
                      }
                    >
                      <option value="multiple-choice">
                        객관식
                      </option>

                      <option value="ox">
                        OX
                      </option>

                      <option value="short-answer">
                        단답형
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteQuestion(
                          question.id,
                        )
                      }
                    >
                      <Trash2
                        size={17}
                      />
                    </button>
                  </div>
                </div>

                <div className="quest-question-fields">
                  <label className="quest-review-field">
                    <span>
                      확인할 개념
                    </span>

                    <input
                      type="text"
                      value={
                        question.concept
                      }
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          'concept',
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label className="quest-review-field">
                    <span>문제</span>

                    <textarea
                      value={
                        question.prompt
                      }
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          'prompt',
                          event.target
                            .value,
                        )
                      }
                      rows={8}
                    />
                  </label>

                  {question.kind ===
                    'multiple-choice' && (
                    <div className="quest-options-editor">
                      <span>
                        객관식 선택지
                      </span>

                      <div>
                        {question.options.map(
                          (
                            option,
                            optionIndex,
                          ) => (
                            <label
                              key={
                                optionIndex
                              }
                            >
                              <strong>
                                {optionIndex +
                                  1}
                              </strong>

                              <input
                                type="text"
                                value={
                                  option
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateOption(
                                    question.id,
                                    optionIndex,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <label className="quest-review-field">
                    <span>정답</span>

                    {question.kind ===
                    'multiple-choice' ? (
                      <select
                        value={
                          question.answer
                        }
                        onChange={(event) =>
                          updateQuestion(
                            question.id,
                            'answer',
                            event.target
                              .value,
                          )
                        }
                      >
                        <option value="">
                          정답 선택
                        </option>

                        {question.options.map(
                          (
                            option,
                            optionIndex,
                          ) => (
                            <option
                              value={
                                option
                              }
                              key={
                                optionIndex
                              }
                            >
                              {optionIndex +
                                1}
                              .{' '}
                              {option ||
                                '빈 선택지'}
                            </option>
                          ),
                        )}
                      </select>
                    ) : question.kind ===
                      'ox' ? (
                      <select
                        value={
                          question.answer
                        }
                        onChange={(event) =>
                          updateQuestion(
                            question.id,
                            'answer',
                            event.target
                              .value,
                          )
                        }
                      >
                        <option value="O">
                          O
                        </option>

                        <option value="X">
                          X
                        </option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={
                          question.answer
                        }
                        onChange={(event) =>
                          updateQuestion(
                            question.id,
                            'answer',
                            event.target
                              .value,
                          )
                        }
                      />
                    )}
                  </label>

                  <label className="quest-review-field">
                    <span>
                      정답 해설
                    </span>

                    <textarea
                      value={
                        question.explanation
                      }
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          'explanation',
                          event.target
                            .value,
                        )
                      }
                      rows={3}
                    />
                  </label>
                </div>
              </article>
            ),
          )}
        </section>

        <button
          type="button"
          className="quest-add-button"
          onClick={handleAddQuestion}
          disabled={
            questions.length >= 5
          }
        >
          <CirclePlus size={18} />
          새 문제 추가

          <span>
            {questions.length} / 5
          </span>
        </button>

        {message && (
          <div
            className={`quest-review-message ${
              saveStatus === 'saved'
                ? 'is-success'
                : 'is-error'
            }`}
          >
            {saveStatus ===
              'saved' && (
              <CheckCircle2
                size={18}
              />
            )}

            {message}
          </div>
        )}

        <div className="quest-review-actions">
          <Link
            to={
              isWrongNoteSource
                ? `/wrong-notes/${record.id}`
                : `/history/${record.id}`
            }
          >
            취소
          </Link>

          <button
            type="button"
            onClick={() =>
              void handleSave()
            }
            disabled={
              saveStatus === 'saving' ||
              isGenerating ||
              questions.length < 3
            }
          >
            <Save size={18} />

            {saveStatus === 'saving'
              ? '저장 중...'
              : '검토 완료하고 저장하기'}
          </button>

          {saveStatus ===
            'saved' && (
            <Link
              className="quest-start-button"
              to={
                isWrongNoteSource
                  ? `/quiz/wrong-note/${record.id}`
                  : `/quiz/${record.id}`
              }
            >
              <Play size={18} />
              퀴즈 시작하기
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

export default QuestReviewPage
