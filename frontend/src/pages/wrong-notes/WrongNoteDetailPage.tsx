import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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

type WrongNoteStatus =
  | 'not-generated'
  | 'ready'
  | 'retry-required'
  | 'completed'

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

const statusLabels: Record<WrongNoteStatus, string> = {
  'not-generated': '문제 생성 전',
  ready: '복습 대기',
  'retry-required': '재도전 필요',
  completed: '마스터',
}

function loadWrongNote(
  wrongNoteId: string | undefined,
): SavedWrongNote | null {
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

    return (
      storedWrongNotes.find(
        (wrongNote: SavedWrongNote) =>
          String(wrongNote.id) === wrongNoteId,
      ) ?? null
    )
  } catch (error) {
    console.error('오답 노트를 불러오지 못했습니다.', error)
    return null
  }
}

function loadLinkedStudyRecord(
  studyRecordId: number | null | undefined,
): SavedStudyRecord | null {
  if (!studyRecordId) {
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
          record.id === studyRecordId,
      ) ?? null
    )
  } catch (error) {
    console.error('연결된 학습 기록을 불러오지 못했습니다.', error)
    return null
  }
}

function formatDate(date: string) {
  const targetDate = new Date(`${date}T00:00:00`)

  return targetDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function WrongNoteDetailPage() {
  const { wrongNoteId } = useParams()
  const navigate = useNavigate()

  const [wrongNote] = useState<SavedWrongNote | null>(() =>
    loadWrongNote(wrongNoteId),
  )

  const [linkedStudyRecord] =
    useState<SavedStudyRecord | null>(() =>
      loadLinkedStudyRecord(wrongNote?.studyRecordId),
    )

  const [isImageOpen, setIsImageOpen] = useState(false)

  useEffect(() => {
    if (!isImageOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImageOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isImageOpen])

  if (!wrongNote) {
    return (
      <main className="wrong-note-detail-page">
        <section className="wrong-note-detail-empty">
          <BookOpen size={31} />

          <h1>오답 노트를 찾을 수 없어요.</h1>

          <p>
            삭제되었거나 존재하지 않는 오답 노트입니다.
          </p>

          <Link to="/wrong-notes">
            오답 노트로 돌아가기
          </Link>
        </section>
      </main>
    )
  }

  const concepts = wrongNote.concepts
    .split(',')
    .map((concept) => concept.trim())
    .filter(Boolean)

  const status =
    wrongNote.questStatus || 'not-generated'

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


  const handleDelete = () => {
    const shouldDelete = window.confirm(
      '이 오답 노트를 삭제할까요?',
    )

    if (!shouldDelete) {
      return
    }

    try {
      const storedWrongNotes = JSON.parse(
        localStorage.getItem('request-wrong-notes') ?? '[]',
      )

      const previousWrongNotes = Array.isArray(
        storedWrongNotes,
      )
        ? (storedWrongNotes as SavedWrongNote[])
        : []

      const nextWrongNotes = previousWrongNotes.filter(
        (savedWrongNote) =>
          savedWrongNote.id !== wrongNote.id,
      )

      localStorage.setItem(
        'request-wrong-notes',
        JSON.stringify(nextWrongNotes),
      )

      navigate('/wrong-notes')
    } catch (error) {
      console.error('오답 노트를 삭제하지 못했습니다.', error)
      window.alert('오답 노트를 삭제하지 못했습니다.')
    }
  }

  return (
    <main className="wrong-note-detail-page">
      <div className="wrong-note-detail-container">
        <div className="wrong-note-detail-topbar">
          <Link to="/wrong-notes">
            <ArrowLeft size={17} />
            오답 노트로 돌아가기
          </Link>

          <button type="button" onClick={handleDelete}>
            <Trash2 size={17} />
            오답 삭제
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
              <span>{wrongNote.subject}</span>

              <span>{formatDate(wrongNote.date)}</span>

              <span
                className={`is-status-${status}`}
              >
                {statusLabels[status] ?? '문제 생성 전'}
              </span>
            </div>
          </div>
        </header>

        <section className="wrong-note-detail-summary">
          <div>
            <CalendarDays size={20} />

            <span>
              오답 날짜
              <strong>{formatDate(wrongNote.date)}</strong>
            </span>
          </div>

          <div>
            <FileQuestion size={20} />

            <span>
              복습 상태
              <strong>
                {statusLabels[status] ?? '문제 생성 전'}
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
                문제와 답을 비교하며 틀린 지점을 다시
                확인해 보세요.
              </p>
            </div>
          </div>

          <div className="wrong-note-detail-main">
            <div className="wrong-note-detail-image-area">
              {wrongNote.wrongImage ? (
                <button
                  type="button"
                  onClick={() => setIsImageOpen(true)}
                >
                  <img
                    src={wrongNote.wrongImage}
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
                  등록된 이미지가 없습니다.
                </div>
              )}
            </div>

            <div className="wrong-note-detail-content">
              <div className="wrong-note-detail-question">
                <strong>문제 내용</strong>

                <p>{wrongNote.mistakeQuestion}</p>
              </div>

              <div className="wrong-note-detail-answer-grid">
                <div className="is-wrong">
                  <strong>내가 작성한 오답</strong>

                  <p>{wrongNote.wrongAnswer}</p>
                </div>

                <div className="is-correct">
                  <strong>실제 정답</strong>

                  <p>{wrongNote.correctAnswer}</p>
                </div>
              </div>

              <div className="wrong-note-detail-reason">
                <strong>틀린 이유</strong>

                <p>{wrongNote.mistakeReason}</p>
              </div>
            </div>
          </div>

          <div className="wrong-note-detail-concepts">
            <span>핵심 개념</span>

            <div>
              {concepts.length > 0 ? (
                concepts.map((concept) => (
                  <strong key={concept}>{concept}</strong>
                ))
              ) : (
                <strong>등록된 개념이 없습니다.</strong>
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
                  {linkedStudyRecord.subject} ·{' '}
                  {linkedStudyRecord.unit}
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

      {isImageOpen && wrongNote.wrongImage && (
        <div
          className="wrong-note-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="오답 이미지 크게 보기"
          onClick={() => setIsImageOpen(false)}
        >
          <div
            className="wrong-note-image-modal-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
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