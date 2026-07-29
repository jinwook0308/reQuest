import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CirclePlus,
  FileQuestion,
  ImageIcon,
  Save,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react'

import './QuestReviewPage.css'

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
  createdAt?: string
  mistakeQuestion?: string
  wrongAnswer?: string
  correctAnswer?: string
  mistakeReason?: string
  wrongImage?: string
  wrongImageName?: string
  questStatus?: string
}



type SavedWrongNote = {
  id: number
  studyRecordId: number | null
  date: string
  subject: string
  unit: string
  mistakeQuestion: string
  wrongAnswer: string
  correctAnswer: string
  mistakeReason: string
  concepts: string
  wrongImage: string
  wrongImageName: string
  questStatus: string
  createdAt: string
}


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

const questionTypeLabels: Record<QuestionKind, string> = {
  'multiple-choice': '객관식',
  ox: 'OX',
  'short-answer': '단답형',
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
      difficult: wrongNote.mistakeReason,
      keywords: wrongNote.concepts,
      understanding: 0,
      createdAt: wrongNote.createdAt,
      mistakeQuestion: wrongNote.mistakeQuestion,
      wrongAnswer: wrongNote.wrongAnswer,
      correctAnswer: wrongNote.correctAnswer,
      mistakeReason: wrongNote.mistakeReason,
      wrongImage: wrongNote.wrongImage,
      wrongImageName: wrongNote.wrongImageName,
      questStatus: wrongNote.questStatus,
    }
  } catch (error) {
    console.error('오답 노트를 불러오지 못했습니다.', error)
    return null
  }
}

function createMultipleChoiceOptions(
  record: SavedStudyRecord,
) {
  const correctAnswer =
    record.correctAnswer?.trim() || '등록된 실제 정답'

  const wrongAnswer =
    record.wrongAnswer?.trim() || '등록된 오답'

  const optionCandidates = [
    wrongAnswer,
    '주어진 조건만으로 판단할 수 없다',
    correctAnswer,
    '문제의 조건이 부족하다',
  ]

  const uniqueOptions = [...new Set(optionCandidates)]

  while (uniqueOptions.length < 4) {
    uniqueOptions.push(`선택지 ${uniqueOptions.length + 1}`)
  }

  return uniqueOptions.slice(0, 4)
}

function createMockQuestions(
  record: SavedStudyRecord,
): ReviewQuestion[] {
  const firstKeyword =
    record.keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .find(Boolean) ||
    record.unit ||
    record.subject

  const correctAnswer =
    record.correctAnswer?.trim() || '등록된 실제 정답'

  const wrongAnswer =
    record.wrongAnswer?.trim() || '등록된 오답'

  const explanation =
    record.mistakeReason?.trim() ||
    `${firstKeyword} 개념을 다시 확인해야 합니다.`

  const createdTime = Date.now()

  return [
    {
      id: createdTime,
      kind: 'multiple-choice',
      concept: firstKeyword,
      prompt: `다음 문제의 올바른 답을 고르세요.\n\n${
        record.mistakeQuestion ||
        record.difficult ||
        `${record.unit} 관련 문제`
      }`,
      options: createMultipleChoiceOptions(record),
      answer: correctAnswer,
      explanation,
    },
    {
      id: createdTime + 1,
      kind: 'ox',
      concept: firstKeyword,
      prompt: `"${wrongAnswer}"은(는) 등록한 문제의 올바른 답이다.`,
      options: [],
      answer: 'X',
      explanation: `등록된 실제 정답은 "${correctAnswer}"입니다. ${explanation}`,
    },
    {
      id: createdTime + 2,
      kind: 'short-answer',
      concept: firstKeyword,
      prompt: `${firstKeyword} 개념에서 이 문제를 틀린 이유를 한 문장으로 설명하세요.`,
      options: [],
      answer: explanation,
      explanation: `핵심은 다음 내용을 이해하는 것입니다. ${explanation}`,
    },
  ]
}

function loadInitialQuestions(
  record: SavedStudyRecord,
): ReviewQuestion[] {
  try {
    const storedQuestSets = JSON.parse(
      localStorage.getItem('request-review-quests') ?? '[]',
    )

    if (Array.isArray(storedQuestSets)) {
      const savedQuestSet = storedQuestSets.find(
        (questSet: SavedQuestSet) =>
          questSet.recordId === record.id,
      )

      if (
        savedQuestSet &&
        Array.isArray(savedQuestSet.questions)
      ) {
        return savedQuestSet.questions
      }
    }
  } catch (error) {
    console.error('검토 중인 문제를 불러오지 못했습니다.', error)
  }

  return createMockQuestions(record)
}

function QuestReviewPage() {
  const { recordId, wrongNoteId } = useParams()
  const isWrongNoteSource = Boolean(wrongNoteId)

  const [record] = useState<SavedStudyRecord | null>(() =>
    isWrongNoteSource
      ? loadWrongNoteAsRecord(wrongNoteId)
      : loadRecord(recordId),
  )

  const [questions, setQuestions] = useState<ReviewQuestion[]>(
    () => (record ? loadInitialQuestions(record) : []),
  )

  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saved' | 'error'
  >('idle')

  const [message, setMessage] = useState('')

  if (!record) {
    return (
      <main className="quest-review-page">
        <section className="quest-review-empty">
          <BookOpen size={31} />

          <h1>학습 기록을 찾을 수 없어요.</h1>

          <p>
            먼저 저장된 학습 기록을 선택해 주세요.
          </p>

          <Link to="/history">학습 기록으로 돌아가기</Link>
        </section>
      </main>
    )
  }

  const updateQuestion = (
    questionId: number,
    field: 'concept' | 'prompt' | 'answer' | 'explanation',
    value: string,
  ) => {
    setQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
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
    setQuestions((previousQuestions) =>
      previousQuestions.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        if (kind === 'multiple-choice') {
          return {
            ...question,
            kind,
            options:
              question.options.length === 4
                ? question.options
                : ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
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
      }),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const updateOption = (
    questionId: number,
    optionIndex: number,
    value: string,
  ) => {
    setQuestions((previousQuestions) =>
      previousQuestions.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        return {
          ...question,
          options: question.options.map(
            (option, currentIndex) =>
              currentIndex === optionIndex ? value : option,
          ),
        }
      }),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const handleAddQuestion = () => {
    if (questions.length >= 5) {
      setSaveStatus('error')
      setMessage('복습 문제는 최대 5개까지 만들 수 있습니다.')
      return
    }

    const firstKeyword =
      record.keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .find(Boolean) ||
      record.unit ||
      record.subject

    const newQuestion: ReviewQuestion = {
      id: Date.now(),
      kind: 'short-answer',
      concept: firstKeyword,
      prompt: '',
      options: [],
      answer: '',
      explanation: '',
    }

    setQuestions((previousQuestions) => [
      ...previousQuestions,
      newQuestion,
    ])

    setSaveStatus('idle')
    setMessage('')
  }

  const handleDeleteQuestion = (questionId: number) => {
    if (questions.length <= 3) {
      setSaveStatus('error')
      setMessage('복습 문제는 최소 3개가 필요합니다.')
      return
    }

    setQuestions((previousQuestions) =>
      previousQuestions.filter(
        (question) => question.id !== questionId,
      ),
    )

    setSaveStatus('idle')
    setMessage('')
  }

  const handleSave = () => {
    const hasEmptyField = questions.some(
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

    const invalidMultipleChoice = questions.some(
      (question) =>
        question.kind === 'multiple-choice' &&
        (question.options.some((option) => !option.trim()) ||
          !question.options
            .map((option) => option.trim())
            .includes(question.answer.trim())),
    )

    if (invalidMultipleChoice) {
      setSaveStatus('error')
      setMessage(
        '객관식 정답은 네 개의 선택지 중 하나여야 합니다.',
      )
      return
    }

    try {
      const storedQuestSets = JSON.parse(
        localStorage.getItem('request-review-quests') ?? '[]',
      )

      const previousQuestSets = Array.isArray(storedQuestSets)
        ? (storedQuestSets as SavedQuestSet[])
        : []

      const nextQuestSet: SavedQuestSet = {
        recordId: record.id,
        status: 'reviewed',
        questions,
        updatedAt: new Date().toISOString(),
      }

      const nextQuestSets = [
        ...previousQuestSets.filter(
          (questSet) => questSet.recordId !== record.id,
        ),
        nextQuestSet,
      ]

      localStorage.setItem(
        'request-review-quests',
        JSON.stringify(nextQuestSets),
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
          savedItem.id === record.id
            ? {
                ...savedItem,
                questStatus: 'ready',
              }
            : savedItem,
      )

      localStorage.setItem(
        sourceStorageKey,
        JSON.stringify(nextSourceItems),
      )
    }

      setSaveStatus('saved')
      setMessage('복습 문제가 검토 완료 상태로 저장되었습니다.')
    } catch (error) {
      console.error('복습 문제를 저장하지 못했습니다.', error)

      setSaveStatus('error')
      setMessage('복습 문제를 저장하지 못했습니다.')
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
                ? '오답 노트 상세보기로 돌아가기'
                : '학습 기록 상세보기로 돌아가기'}
          </Link>
          <span>학습 여정 4 · AI 분석</span>
        </div>

        <header className="quest-review-heading">
          <span className="quest-review-heading-icon">
            <Sparkles size={26} />
          </span>

          <div>
            <span className="quest-review-eyebrow">
              REVIEW QUEST
            </span>

            <h1>복습 문제를 확인해 주세요.</h1>

            <p>
              생성된 문제와 정답을 직접 검토하고 수정할 수
              있어요.
              <br />
              확인된 문제만 실제 복습 퀘스트에 사용됩니다.
            </p>
          </div>
        </header>

        <section className="quest-source-card">
          <div className="quest-source-content">
            <span>{record.subject}</span>

            <div>
              <strong>{record.unit}</strong>

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
              규칙 기반 모의 생성기가 {questions.length}개의
              문제를 준비했습니다.
            </strong>

            <span>
              현재는 프론트 기능 검증 단계이며, 이후 동일한
              구조에 실제 AI 생성기를 연결합니다.
            </span>
          </div>
        </section>

        <section className="quest-question-list">
          {questions.map((question, questionIndex) => (
            <article
              className="quest-question-card"
              key={question.id}
            >
              <div className="quest-question-header">
                <div>
                  <span className="quest-question-number">
                    {questionIndex + 1}
                  </span>

                  <FileQuestion size={18} />

                  <strong>
                    {questionTypeLabels[question.kind]}
                  </strong>
                </div>

                <div className="quest-question-header-actions">
                  <select
                    value={question.kind}
                    onChange={(event) =>
                      updateQuestionType(
                        question.id,
                        event.target.value as QuestionKind,
                      )
                    }
                    aria-label={`${questionIndex + 1}번 문제 유형`}
                  >
                    <option value="multiple-choice">
                      객관식
                    </option>
                    <option value="ox">OX</option>
                    <option value="short-answer">
                      단답형
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteQuestion(question.id)
                    }
                    aria-label={`${questionIndex + 1}번 문제 삭제`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              <div className="quest-question-fields">
                <label className="quest-review-field">
                  <span>확인할 개념</span>

                  <input
                    type="text"
                    value={question.concept}
                    onChange={(event) =>
                      updateQuestion(
                        question.id,
                        'concept',
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="quest-review-field">
                  <span>문제</span>

                  <textarea
                    value={question.prompt}
                    onChange={(event) =>
                      updateQuestion(
                        question.id,
                        'prompt',
                        event.target.value,
                      )
                    }
                    rows={4}
                  />
                </label>

                {question.kind === 'multiple-choice' && (
                  <div className="quest-options-editor">
                    <span>객관식 선택지</span>

                    <div>
                      {question.options.map(
                        (option, optionIndex) => (
                          <label key={optionIndex}>
                            <strong>{optionIndex + 1}</strong>

                            <input
                              type="text"
                              value={option}
                              onChange={(event) =>
                                updateOption(
                                  question.id,
                                  optionIndex,
                                  event.target.value,
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

                  {question.kind === 'multiple-choice' ? (
                    <select
                      value={question.answer}
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          'answer',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">정답 선택</option>

                      {question.options.map(
                        (option, optionIndex) => (
                          <option
                            value={option}
                            key={optionIndex}
                          >
                            {optionIndex + 1}.{' '}
                            {option || '빈 선택지'}
                          </option>
                        ),
                      )}
                    </select>
                  ) : question.kind === 'ox' ? (
                    <select
                      value={question.answer}
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          'answer',
                          event.target.value,
                        )
                      }
                    >
                      <option value="O">O</option>
                      <option value="X">X</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={question.answer}
                      onChange={(event) =>
                        updateQuestion(
                          question.id,
                          'answer',
                          event.target.value,
                        )
                      }
                    />
                  )}
                </label>

                <label className="quest-review-field">
                  <span>정답 해설</span>

                  <textarea
                    value={question.explanation}
                    onChange={(event) =>
                      updateQuestion(
                        question.id,
                        'explanation',
                        event.target.value,
                      )
                    }
                    rows={3}
                  />
                </label>
              </div>
            </article>
          ))}
        </section>

        <button
          type="button"
          className="quest-add-button"
          onClick={handleAddQuestion}
          disabled={questions.length >= 5}
        >
          <CirclePlus size={18} />
          새 문제 추가
          <span>{questions.length} / 5</span>
        </button>

        {message && (
          <div
            className={`quest-review-message ${
              saveStatus === 'saved'
                ? 'is-success'
                : 'is-error'
            }`}
          >
            {saveStatus === 'saved' && (
              <CheckCircle2 size={18} />
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

          <button type="button" onClick={handleSave}>
            <Save size={18} />
            검토 완료하고 저장하기
          </button>

          {saveStatus === 'saved' && (
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