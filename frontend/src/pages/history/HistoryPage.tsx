import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react'

import './HistoryPage.css'

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

const understandingLabels: Record<number, string> = {
  1: '어려워요',
  2: '조금 어려워요',
  3: '보통이에요',
  4: '이해했어요',
  5: '완벽해요',
}

function loadSavedRecords() {
  try {
    const storedRecords = JSON.parse(
      localStorage.getItem('request-study-records') ?? '[]',
    )

    return Array.isArray(storedRecords)
      ? (storedRecords as SavedStudyRecord[])
      : []
  } catch (error) {
    console.error('학습 기록을 불러오지 못했습니다.', error)
    return []
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

function HistoryPage() {
  const [records, setRecords] = useState<SavedStudyRecord[]>(
    loadSavedRecords,
  )
  const [searchText, setSearchText] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('전체')

  const subjects = useMemo(() => {
    const savedSubjects = records.map((record) => record.subject)

    return ['전체', ...new Set(savedSubjects)]
  }, [records])

  const filteredRecords = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase()

    return records
      .filter((record) => {
        const matchesSubject =
          subjectFilter === '전체' ||
          record.subject === subjectFilter

        const searchableText = [
          record.subject,
          record.unit,
          record.learned,
          record.difficult,
          record.keywords,
        ]
          .join(' ')
          .toLowerCase()

        const matchesSearch =
          normalizedSearchText.length === 0 ||
          searchableText.includes(normalizedSearchText)

        return matchesSubject && matchesSearch
      })
      .sort((firstRecord, secondRecord) => {
        const firstTime = new Date(
          firstRecord.createdAt ??
            `${firstRecord.date}T00:00:00`,
        ).getTime()

        const secondTime = new Date(
          secondRecord.createdAt ??
            `${secondRecord.date}T00:00:00`,
        ).getTime()

        return secondTime - firstTime
      })
  }, [records, searchText, subjectFilter])

  const totalMinutes = records.reduce(
    (total, record) => total + Number(record.minutes || 0),
    0,
  )

  const averageUnderstanding =
    records.length > 0
      ? (
          records.reduce(
            (total, record) =>
              total + Number(record.understanding || 0),
            0,
          ) / records.length
        ).toFixed(1)
      : '0'

  const handleDelete = (recordId: number) => {
    const shouldDelete = window.confirm(
      '이 학습 기록을 삭제할까요?',
    )

    if (!shouldDelete) {
      return
    }

    const nextRecords = records.filter(
      (record) => record.id !== recordId,
    )

    setRecords(nextRecords)

    localStorage.setItem(
      'request-study-records',
      JSON.stringify(nextRecords),
    )
  }

  return (
    <main className="history-page">
      <div className="history-container">
        <div className="history-topbar">
          <Link className="history-back-link" to="/">
            <ArrowLeft size={17} />
            이번 주로 돌아가기
          </Link>

          <Link className="history-create-button" to="/records">
            <Plus size={18} />
            새 학습 기록 작성
          </Link>
        </div>

        <header className="history-heading">
          <span className="history-heading-icon">
            <BookOpen size={26} />
          </span>

          <div>
            <span className="history-eyebrow">
              LEARNING ARCHIVE
            </span>

            <h1>나의 학습 기록</h1>

            <p>
              매일 남긴 학습 기록을 다시 확인하고,
              <br />
              내가 어떻게 성장했는지 살펴보세요.
            </p>
          </div>
        </header>

        <section className="history-summary">
          <div className="history-summary-item">
            <BookOpen size={20} />

            <div>
              <span>전체 기록</span>
              <strong>{records.length}개</strong>
            </div>
          </div>

          <div className="history-summary-item">
            <Clock3 size={20} />

            <div>
              <span>누적 학습시간</span>
              <strong>{formatStudyTime(String(totalMinutes))}</strong>
            </div>
          </div>

          <div className="history-summary-item">
            <Star size={20} />

            <div>
              <span>평균 이해도</span>
              <strong>{averageUnderstanding} / 5</strong>
            </div>
          </div>
        </section>

        <section className="history-toolbar">
          <label className="history-search">
            <Search size={18} />

            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="단원, 학습 내용, 키워드 검색"
            />
          </label>

          <select
            className="history-subject-filter"
            value={subjectFilter}
            onChange={(event) =>
              setSubjectFilter(event.target.value)
            }
            aria-label="과목 선택"
          >
            {subjects.map((subject) => (
              <option value={subject} key={subject}>
                {subject}
              </option>
            ))}
          </select>
        </section>

        {filteredRecords.length === 0 ? (
          <section className="history-empty">
            <span className="history-empty-icon">
              <BookOpen size={29} />
            </span>

            <h2>
              {records.length === 0
                ? '아직 저장된 학습 기록이 없어요.'
                : '검색 결과가 없어요.'}
            </h2>

            <p>
              {records.length === 0
                ? '오늘 공부한 내용을 기록하며 첫 번째 학습 발자국을 남겨보세요.'
                : '검색어나 과목 조건을 변경해 보세요.'}
            </p>

            {records.length === 0 && (
              <Link
                className="history-empty-button"
                to="/records"
              >
                <Plus size={17} />
                첫 기록 작성하기
              </Link>
            )}
          </section>
        ) : (
          <section className="history-list">
            {filteredRecords.map((record) => {
              const keywords = record.keywords
                .split(',')
                .map((keyword) => keyword.trim())
                .filter(Boolean)

              return (
                <article
                  className="history-record-card"
                  key={record.id}
                >
                <div className="history-record-header">
                    <div className="history-record-identity">
                        <span className="history-record-date">
                        <CalendarDays size={15} />
                        {formatRecordDate(record.date)}
                        </span>

                        <span className="history-record-subject">
                        {record.subject}
                        </span>
                    </div>

                    <div className="history-record-actions">
                        <Link
                        className="history-detail-link"
                        to={`/history/${record.id}`}
                        aria-label={`${record.unit} 기록 상세보기`}
                        >
                        상세보기
                        <ArrowRight size={15} />
                        </Link>

                        <button
                        type="button"
                        className="history-delete-button"
                        onClick={() => handleDelete(record.id)}
                        aria-label={`${record.unit} 기록 삭제`}
                        >
                        <Trash2 size={17} />
                        </button>
                        </div>
                    </div>

                  <h2>
                    {record.unit.trim() ||
                      `${record.subject} 학습`}
                  </h2>

                  <div className="history-record-meta">
                    <span>
                      <Clock3 size={16} />
                      {formatStudyTime(record.minutes)}
                    </span>

                    <span>
                      <Star size={16} />
                      이해도 {record.understanding} ·{' '}
                      {understandingLabels[
                        record.understanding
                      ] ?? '미선택'}
                    </span>
                  </div>

                  <div className="history-record-content">
                    <div>
                      <strong>이해한 내용</strong>
                      <p>{record.learned}</p>
                    </div>

                    <div>
                      <strong>다시 볼 내용</strong>
                      <p>{record.difficult}</p>
                    </div>
                  </div>

                  {keywords.length > 0 && (
                    <div className="history-keywords">
                      {keywords.map((keyword) => (
                        <span key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

export default HistoryPage