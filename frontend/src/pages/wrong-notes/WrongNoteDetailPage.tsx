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
  CalendarDays,
  Expand,
  FileQuestion,
  ImageOff,
  Link2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import './WrongNoteDetailPage.css'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'

type WrongNoteStatus =
  | 'not-generated'
  | 'ready'
  | 'retry-required'
  | 'completed'

type WrongNoteApiItem = {
  id: number | string
  studyRecordId: number | string | null
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
  questStatus: string | null
  createdAt: string
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
  questStatus: WrongNoteStatus
  createdAt: string
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
  createdAt?: string
}

type WrongNoteDetailApiResponse = {
  success: boolean
  message?: string
  data?: WrongNoteApiItem
}

type StudyRecordDetailApiResponse = {
  success: boolean
  message?: string
  data?: StudyRecordApiItem
}

type DeleteWrongNoteApiResponse = {
  success: boolean
  message?: string
}

const statusLabels: Record<
  WrongNoteStatus,
  string
> = {
  'not-generated': '문제 생성 전',
  ready: '복습 대기',
  'retry-required': '재도전 필요',
  completed: '마스터',
}

function normalizeStatus(
  status: string | null,
): WrongNoteStatus {
  if (
    status === 'ready' ||
    status === 'retry-required' ||
    status === 'completed'
  ) {
    return status
  }

  return 'not-generated'
}

async function loadWrongNoteFromApi(
  wrongNoteId: string,
  signal?: AbortSignal,
): Promise<SavedWrongNote> {
  const response = await fetch(
    `${API_BASE_URL}/wrong-notes/${wrongNoteId}`,
    {
      signal,
    },
  )

  const result =
    (await response.json()) as WrongNoteDetailApiResponse

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '오답노트를 찾지 못했습니다.',
    )
  }

  const wrongNote = result.data

  return {
    id: Number(wrongNote.id),

    studyRecordId:
      wrongNote.studyRecordId === null
        ? null
        : Number(wrongNote.studyRecordId),

    date: wrongNote.date,
    subject: wrongNote.subject,
    unit: wrongNote.unit,
    mistakeQuestion:
      wrongNote.mistakeQuestion,
    wrongAnswer:
      wrongNote.wrongAnswer,
    correctAnswer:
      wrongNote.correctAnswer,
    mistakeReason:
      wrongNote.mistakeReason,
    concepts: wrongNote.concepts ?? '',
    wrongImage:
      wrongNote.wrongImage ?? '',
    wrongImageName:
      wrongNote.wrongImageName ?? '',
    questStatus:
      normalizeStatus(
        wrongNote.questStatus,
      ),
    createdAt: wrongNote.createdAt,
  }
}

async function loadStudyRecordFromApi(
  studyRecordId: number,
  signal?: AbortSignal,
): Promise<SavedStudyRecord> {
  const response = await fetch(
    `${API_BASE_URL}/study-records/${studyRecordId}`,
    {
      signal,
    },
  )

  const result =
    (await response.json()) as StudyRecordDetailApiResponse

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '연결된 학습 기록을 찾지 못했습니다.',
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
  }
}

function formatDate(date: string) {
  const targetDate = new Date(
    `${date}T00:00:00`,
  )

  return targetDate.toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    },
  )
}

function WrongNoteDetailPage() {
  const { wrongNoteId } = useParams()
  const navigate = useNavigate()

  const [wrongNote, setWrongNote] =
    useState<SavedWrongNote | null>(null)

  const [
    linkedStudyRecord,
    setLinkedStudyRecord,
  ] = useState<SavedStudyRecord | null>(
    null,
  )

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState('')

  const [isDeleting, setIsDeleting] =
    useState(false)

  const [isImageOpen, setIsImageOpen] =
    useState(false)

  useEffect(() => {
    const controller =
      new AbortController()

    const loadDetail = async () => {
      if (!wrongNoteId) {
        setLoadError(
          '오답노트 주소가 올바르지 않습니다.',
        )
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setLoadError('')

        const loadedWrongNote =
          await loadWrongNoteFromApi(
            wrongNoteId,
            controller.signal,
          )

        if (controller.signal.aborted) {
          return
        }

        setWrongNote(loadedWrongNote)

        if (
          loadedWrongNote.studyRecordId
        ) {
          try {
            const loadedStudyRecord =
              await loadStudyRecordFromApi(
                loadedWrongNote.studyRecordId,
                controller.signal,
              )

            if (
              !controller.signal.aborted
            ) {
              setLinkedStudyRecord(
                loadedStudyRecord,
              )
            }
          } catch (error) {
            if (
              error instanceof DOMException &&
              error.name === 'AbortError'
            ) {
              return
            }

            console.error(
              '연결된 학습 기록 조회 실패:',
              error,
            )

            setLinkedStudyRecord(null)
          }
        } else {
          setLinkedStudyRecord(null)
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        console.error(
          '오답노트 상세 조회 실패:',
          error,
        )

        setLoadError(
          error instanceof Error
            ? error.message
            : '오답노트를 불러오지 못했습니다.',
        )

        setWrongNote(null)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      controller.abort()
    }
  }, [wrongNoteId])

  useEffect(() => {
    if (!isImageOpen) {
      return
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setIsImageOpen(false)
      }
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [isImageOpen])

  const handleDelete = async () => {
    if (!wrongNote) {
      return
    }

    const shouldDelete =
      window.confirm(
        '이 오답노트를 삭제할까요?',
      )

    if (!shouldDelete) {
      return
    }

    try {
      setIsDeleting(true)

      const response = await fetch(
        `${API_BASE_URL}/wrong-notes/${wrongNote.id}`,
        {
          method: 'DELETE',
        },
      )

      const result =
        (await response.json()) as DeleteWrongNoteApiResponse

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            '오답노트를 삭제하지 못했습니다.',
        )
      }

      navigate('/wrong-notes')
    } catch (error) {
      console.error(
        '오답노트 삭제 실패:',
        error,
      )

      window.alert(
        error instanceof Error
          ? error.message
          : '오답노트를 삭제하지 못했습니다.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="wrong-note-detail-page">
        <section className="wrong-note-detail-empty">
          <BookOpen size={31} />

          <h1>
            오답노트를 불러오는 중이에요.
          </h1>

          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    )
  }

  if (loadError || !wrongNote) {
    return (
      <main className="wrong-note-detail-page">
        <section className="wrong-note-detail-empty">
          <BookOpen size={31} />

          <h1>
            오답노트를 찾을 수 없어요.
          </h1>

          <p>
            {loadError ||
              '삭제되었거나 존재하지 않는 오답노트입니다.'}
          </p>

          <Link to="/wrong-notes">
            오답노트로 돌아가기
          </Link>
        </section>
      </main>
    )
  }

  const concepts =
    wrongNote.concepts
      .split(',')
      .map((concept) => concept.trim())
      .filter(Boolean)

  const status =
    wrongNote.questStatus

  const questButtonTarget =
    status === 'not-generated'
      ? `/quest-review/wrong-note/${wrongNote.id}`
      : `/quiz/wrong-note/${wrongNote.id}`

  const questButtonLabel =
    status === 'not-generated'
      ? 'AI 복습 문제 생성하기'
      : status === 'ready'
        ? '복습 퀴즈 시작하기'
        : status === 'retry-required'
          ? '다시 도전하기'
          : '복습 퀴즈 다시 풀기'

  return (
    <main className="wrong-note-detail-page">
      <div className="wrong-note-detail-container">
        <div className="wrong-note-detail-topbar">
          <Link to="/wrong-notes">
            <ArrowLeft size={17} />
            오답노트로 돌아가기
          </Link>

          <button
            type="button"
            onClick={() =>
              void handleDelete()
            }
            disabled={isDeleting}
          >
            <Trash2 size={17} />

            {isDeleting
              ? '삭제 중...'
              : '오답 삭제'}
          </button>
        </div>

        <header className="wrong-note-detail-heading">
          <span className="wrong-note-detail-heading-icon">
            <BookOpen size={26} />
          </span>

          <div>
            <span className="wrong-note-detail-eyebrow">
              WRONG ANSWER NOTE
            </span>

            <h1>
              {wrongNote.unit ||
                `${wrongNote.subject} 오답`}
            </h1>

            <div className="wrong-note-detail-heading-meta">
              <span>
                {wrongNote.subject}
              </span>

              <span>
                {formatDate(
                  wrongNote.date,
                )}
              </span>

              <span
                className={`is-status-${status}`}
              >
                {statusLabels[status]}
              </span>
            </div>
          </div>
        </header>

        <section className="wrong-note-detail-summary">
          <div>
            <CalendarDays size={20} />

            <span>
              오답 날짜

              <strong>
                {formatDate(
                  wrongNote.date,
                )}
              </strong>
            </span>
          </div>

          <div>
            <FileQuestion size={20} />

            <span>
              복습 상태

              <strong>
                {statusLabels[status]}
              </strong>
            </span>
          </div>

          <div>
            {linkedStudyRecord ? (
              <Link2 size={20} />
            ) : (
              <ImageOff size={20} />
            )}

            <span>
              학습 기록

              <strong>
                {linkedStudyRecord
                  ? '연결됨'
                  : '독립 오답'}
              </strong>
            </span>
          </div>
        </section>

        <section className="wrong-note-detail-card">
          <div className="wrong-note-detail-card-heading">
            <FileQuestion size={20} />

            <div>
              <h2>오답 문제</h2>

              <p>
                문제와 답을 비교하며
                틀린 지점을 다시 확인해
                보세요.
              </p>
            </div>
          </div>

          <div className="wrong-note-detail-main">
            <div className="wrong-note-detail-image-area">
              {wrongNote.wrongImage ? (
                <button
                  type="button"
                  onClick={() =>
                    setIsImageOpen(true)
                  }
                >
                  <img
                    src={
                      wrongNote.wrongImage
                    }
                    alt={`${wrongNote.wrongImageName} 오답 이미지`}
                  />

                  <span>
                    <Expand size={16} />
                    크게 보기
                  </span>
                </button>
              ) : (
                <div>
                  <ImageOff size={30} />
                  등록된 이미지가
                  없습니다.
                </div>
              )}
            </div>

            <div className="wrong-note-detail-content">
              <div className="wrong-note-detail-question">
                <strong>
                  문제 내용
                </strong>

                <p>
                  {
                    wrongNote.mistakeQuestion
                  }
                </p>
              </div>

              <div className="wrong-note-detail-answer-grid">
                <div className="is-wrong">
                  <strong>
                    내가 작성한 오답
                  </strong>

                  <p>
                    {
                      wrongNote.wrongAnswer
                    }
                  </p>
                </div>

                <div className="is-correct">
                  <strong>
                    실제 정답
                  </strong>

                  <p>
                    {
                      wrongNote.correctAnswer
                    }
                  </p>
                </div>
              </div>

              <div className="wrong-note-detail-reason">
                <strong>
                  틀린 이유
                </strong>

                <p>
                  {
                    wrongNote.mistakeReason
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="wrong-note-detail-concepts">
            <span>핵심 개념</span>

            <div>
              {concepts.length > 0 ? (
                concepts.map(
                  (concept) => (
                    <strong
                      key={concept}
                    >
                      {concept}
                    </strong>
                  ),
                )
              ) : (
                <strong>
                  등록된 개념이
                  없습니다.
                </strong>
              )}
            </div>
          </div>
        </section>

        {linkedStudyRecord && (
          <section className="wrong-note-linked-record">
            <div>
              <Link2 size={19} />

              <span>
                연결된 학습 기록

                <strong>
                  {
                    linkedStudyRecord.subject
                  }{' '}
                  ·{' '}
                  {
                    linkedStudyRecord.unit
                  }
                </strong>
              </span>
            </div>

            <Link
              to={`/history/${linkedStudyRecord.id}`}
            >
              학습 기록 보기
              <ArrowRight size={15} />
            </Link>
          </section>
        )}

        <div className="wrong-note-detail-actions">
          <Link
            className="wrong-note-detail-list-button"
            to="/wrong-notes"
          >
            목록으로 돌아가기
          </Link>

          <Link
            className="wrong-note-detail-quest-button"
            to={questButtonTarget}
          >
            <Sparkles size={18} />
            {questButtonLabel}
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>

      {isImageOpen &&
        wrongNote.wrongImage && (
          <div
            className="wrong-note-image-modal"
            role="dialog"
            aria-modal="true"
            aria-label="오답 이미지 크게 보기"
            onClick={() =>
              setIsImageOpen(false)
            }
          >
            <div
              className="wrong-note-image-modal-content"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                onClick={() =>
                  setIsImageOpen(false)
                }
                aria-label="이미지 닫기"
              >
                <X size={22} />
              </button>

              <img
                src={wrongNote.wrongImage}
                alt={`${wrongNote.wrongImageName} 크게 보기`}
              />
            </div>
          </div>
        )}
    </main>
  )
}

export default WrongNoteDetailPage