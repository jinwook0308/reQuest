import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  Expand,
  ImageOff,
  KeyRound,
  Lightbulb,
  Star,
  Trash2,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

import './HistoryDetailPage.css'

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

const understandingLabels: Record<number, string> = {
  1: '어려워요',
  2: '조금 어려워요',
  3: '보통이에요',
  4: '이해했어요',
  5: '완벽해요',
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

function formatRecordDate(date: string) {
  const recordDate = new Date(`${date}T00:00:00`)

  return recordDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatStudyTime(minutes: string) {
  const totalMinutes = Number(minutes)

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '0분'
  }

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  if (hours === 0) {
    return `${remainingMinutes}분`
  }

  if (remainingMinutes === 0) {
    return `${hours}시간`
  }

  return `${hours}시간 ${remainingMinutes}분`
}

function HistoryDetailPage() {
  const { recordId } = useParams()
  const navigate = useNavigate()

  const [record] = useState<SavedStudyRecord | null>(() =>
    loadRecord(recordId),
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

  if (!record) {
    return (
      <main className="history-detail-page">
        <section className="history-detail-empty">
          <BookOpen size={31} />

          <h1>학습 기록을 찾을 수 없어요.</h1>

          <p>
            삭제되었거나 존재하지 않는 학습 기록입니다.
          </p>

          <Link to="/history">학습 기록으로 돌아가기</Link>
        </section>
      </main>
    )
  }

  const keywords = record.keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)

  const handleDelete = () => {
    const shouldDelete = window.confirm(
      '이 학습 기록을 삭제할까요?',
    )

    if (!shouldDelete) {
      return
    }

    try {
      const storedRecords = JSON.parse(
        localStorage.getItem('request-study-records') ?? '[]',
      )

      const previousRecords = Array.isArray(storedRecords)
        ? (storedRecords as SavedStudyRecord[])
        : []

      const nextRecords = previousRecords.filter(
        (savedRecord) => savedRecord.id !== record.id,
      )

      localStorage.setItem(
        'request-study-records',
        JSON.stringify(nextRecords),
      )

      navigate('/history')
    } catch (error) {
      console.error('학습 기록을 삭제하지 못했습니다.', error)
      window.alert('학습 기록을 삭제하지 못했습니다.')
    }
  }

  return (
    <main className="history-detail-page">
      <div className="history-detail-container">
        <div className="history-detail-topbar">
          <Link to="/history">
            <ArrowLeft size={17} />
            학습 기록으로 돌아가기
          </Link>

          <button type="button" onClick={handleDelete}>
            <Trash2 size={17} />
            기록 삭제
          </button>
        </div>

        <header className="history-detail-heading">
          <span className="history-detail-heading-icon">
            <BookOpen size={26} />
          </span>

          <div>
            <span className="history-detail-eyebrow">
              LEARNING RECORD
            </span>

            <h1>
              {record.unit.trim() ||
                `${record.subject} 학습 기록`}
            </h1>

            <div className="history-detail-heading-meta">
              <span>{record.subject}</span>
              <span>{formatRecordDate(record.date)}</span>
            </div>
          </div>
        </header>

        <section className="history-detail-summary">
          <div>
            <CalendarDays size={20} />

            <span>
              학습 날짜
              <strong>{formatRecordDate(record.date)}</strong>
            </span>
          </div>

          <div>
            <Clock3 size={20} />

            <span>
              학습 시간
              <strong>{formatStudyTime(record.minutes)}</strong>
            </span>
          </div>

          <div>
            <Star size={20} />

            <span>
              이해도
              <strong>
                {record.understanding} / 5 ·{' '}
                {understandingLabels[record.understanding] ??
                  '미선택'}
              </strong>
            </span>
          </div>
        </section>

        <section className="history-detail-card">
          <div className="history-detail-card-heading">
            <Lightbulb size={20} />

            <div>
              <h2>학습 내용</h2>
              <p>작성한 학습 내용을 다시 확인해 보세요.</p>
            </div>
          </div>

          <div className="history-detail-learning-grid">
            <div>
              <strong>이해한 내용</strong>
              <p>{record.learned || '등록된 내용이 없습니다.'}</p>
            </div>

            <div>
              <strong>다시 볼 내용</strong>
              <p>
                {record.difficult ||
                  '등록된 내용이 없습니다.'}
              </p>
            </div>
          </div>

          {keywords.length > 0 && (
            <div className="history-detail-keywords">
              <span>
                <KeyRound size={15} />
                핵심 키워드
              </span>

              <div>
                {keywords.map((keyword) => (
                  <strong key={keyword}>{keyword}</strong>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="history-detail-card">
          <div className="history-detail-card-heading">
            <ImageOff size={20} />

            <div>
              <h2>등록한 오답</h2>
              <p>
                오답 이미지와 틀린 이유를 함께 확인할 수
                있어요.
              </p>
            </div>
          </div>

          <div className="history-detail-mistake-layout">
            <div className="history-detail-image-area">
              {record.wrongImage ? (
                <button
                  type="button"
                  className="history-detail-image-button"
                  onClick={() => setIsImageOpen(true)}
                >
                  <img
                    src={record.wrongImage}
                    alt={
                      record.wrongImageName
                        ? `${record.wrongImageName} 오답 이미지`
                        : '등록한 오답 이미지'
                    }
                  />

                  <span>
                    <Expand size={16} />
                    크게 보기
                  </span>
                </button>
              ) : (
                <div className="history-detail-no-image">
                  <ImageOff size={30} />

                  <strong>등록된 오답 이미지가 없어요.</strong>

                  <span>
                    이미지 기능 추가 전에 작성한 기록일 수
                    있습니다.
                  </span>
                </div>
              )}
            </div>

            <div className="history-detail-mistake-info">
              <div className="history-detail-question">
                <strong>문제 내용</strong>

                <p>
                  {record.mistakeQuestion ||
                    '등록된 문제 내용이 없습니다.'}
                </p>
              </div>

              <div className="history-detail-answer-grid">
                <div className="is-wrong">
                  <strong>내가 작성한 오답</strong>

                  <p>
                    {record.wrongAnswer ||
                      '등록된 오답이 없습니다.'}
                  </p>
                </div>

                <div className="is-correct">
                  <strong>실제 정답</strong>

                  <p>
                    {record.correctAnswer ||
                      '등록된 정답이 없습니다.'}
                  </p>
                </div>
              </div>

              <div className="history-detail-reason">
                <strong>틀린 이유</strong>

                <p>
                  {record.mistakeReason ||
                    '등록된 이유가 없습니다.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="history-detail-actions">
  <Link
    className="history-detail-list-button"
    to="/history"
  >
    목록으로 돌아가기
  </Link>

  <Link
    className="history-detail-quest-button"
    to={`/quest-review/${record.id}`}
  >
    <Sparkles size={18} />
    복습 문제 생성하기
    <ArrowRight size={17} />
  </Link>
</div>
      </div>

      {isImageOpen && record.wrongImage && (
        <div
          className="history-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="오답 이미지 크게 보기"
          onClick={() => setIsImageOpen(false)}
        >
          <div
            className="history-image-modal-content"
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
              src={record.wrongImage}
              alt={
                record.wrongImageName
                  ? `${record.wrongImageName} 크게 보기`
                  : '오답 이미지 크게 보기'
              }
            />
          </div>
        </div>
      )}
    </main>
  )
}

export default HistoryDetailPage