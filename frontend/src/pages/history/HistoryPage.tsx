import {
  useEffect,
  useMemo,
  useState,
} from 'react'
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
  Calendar,
  CheckCircle2,
  X,
} from 'lucide-react'

import './HistoryPage.css'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'

type SavedStudyRecord = {
  id: number
  date: string
  subject: string
  unit: string
  minutes: number
  learned: string
  difficult: string
  keywords: string
  understanding: number
  createdAt?: string
}

type StudyRecordApiItem = {
  id: string | number
  date: string
  subject: string
  unit: string
  minutes: string | number
  learned: string
  difficult: string
  keywords: string
  understanding: string | number
  createdAt?: string
}

type StudyRecordsApiResponse = {
  success: boolean
  message?: string
  data?: StudyRecordApiItem[]
}

type DeleteStudyRecordApiResponse = {
  success: boolean
  message?: string
}

const understandingLabels: Record<number, string> = {
  1: '어려워요',
  2: '조금 어려워요',
  3: '보통이에요',
  4: '이해했어요',
  5: '완벽해요',
}

// --- 날짜 계산 및 동기화 유틸리티 ---
function formatNumber(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${formatNumber(
    date.getMonth() + 1,
  )}-${formatNumber(date.getDate())}`
}

function isSameDate(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  )
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

function formatStudyTime(
  minutes: number | string,
) {
  const totalMinutes = Number(minutes)

  if (
    !Number.isFinite(totalMinutes) ||
    totalMinutes <= 0
  ) {
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
  const [records, setRecords] = useState<
    SavedStudyRecord[]
  >([])

  const [loadStatus, setLoadStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')

  const [searchText, setSearchText] =
    useState('')

  const [subjectFilter, setSubjectFilter] =
    useState('전체')

  // --- 날짜 기본값 설정 (디폴트는 오늘 날짜) ---
  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => formatDateKey(today), [today])
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  // 선택된 날짜 (디폴트: 오늘 날짜)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  const monthDays = useMemo(() => {
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    return Array.from({ length: totalDaysInMonth }, (_, index) => {
      const dayNumber = index + 1
      const dateObj = new Date(currentYear, currentMonth, dayNumber)
      const dateKey = formatDateKey(dateObj)

      const hasRecord = records.some((record) => record.date === dateKey)

      return {
        dateKey,
        dayName: dayNames[dateObj.getDay()],
        date: String(dayNumber),
        active: hasRecord,
        today: isSameDate(dateObj, today),
        selected: selectedDate === dateKey,
      }
    })
  }, [currentYear, currentMonth, records, today, selectedDate])

  useEffect(() => {
    let ignoreResult = false

    const loadRecords = async () => {
      setLoadStatus('loading')

      try {
        const response = await fetch(
          `${API_BASE_URL}/study-records`,
        )

        const result =
          (await response.json()) as StudyRecordsApiResponse

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              '학습 기록 조회에 실패했습니다.',
          )
        }

        const normalizedRecords =
          result.data.map((record) => ({
            ...record,
            id: Number(record.id),
            minutes: Number(record.minutes),
            understanding: Number(
              record.understanding,
            ),
          }))

        if (!ignoreResult) {
          setRecords(normalizedRecords)
          setLoadStatus('success')
        }
      } catch (error) {
        console.error(
          '학습 기록을 불러오지 못했습니다.',
          error,
        )

        if (!ignoreResult) {
          setRecords([])
          setLoadStatus('error')
        }
      }
    }

    void loadRecords()

    return () => {
      ignoreResult = true
    }
  }, [])

  const subjects = useMemo(() => {
    const savedSubjects = records.map(
      (record) => record.subject,
    )

    return [
      '전체',
      ...new Set(savedSubjects),
    ]
  }, [records])

  const filteredRecords = useMemo(() => {
    const normalizedSearchText =
      searchText.trim().toLowerCase()

    return records
      .filter((record) => {
        // 과목 필터
        const matchesSubject =
          subjectFilter === '전체' ||
          record.subject === subjectFilter

        // 날짜 필터 (기본값 오늘, 특정 날짜 선택 시 해당 날짜만)
        const matchesDate =
          !selectedDate || record.date === selectedDate

        // 검색어 필터
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
          searchableText.includes(
            normalizedSearchText,
          )

        return matchesSubject && matchesDate && matchesSearch
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
  }, [records, searchText, subjectFilter, selectedDate])

  const totalMinutes = records.reduce(
    (total, record) =>
      total + Number(record.minutes || 0),
    0,
  )

  const averageUnderstanding =
    records.length > 0
      ? (
          records.reduce(
            (total, record) =>
              total +
              Number(record.understanding || 0),
            0,
          ) / records.length
        ).toFixed(1)
      : '0'

  const handleDelete = async (
    recordId: number,
  ) => {
    const shouldDelete = window.confirm(
      '이 학습 기록을 삭제할까요?',
    )

    if (!shouldDelete) {
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/study-records/${recordId}`,
        {
          method: 'DELETE',
        },
      )

      const result =
        (await response.json()) as DeleteStudyRecordApiResponse

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            '학습 기록 삭제에 실패했습니다.',
        )
      }

      setRecords((previousRecords) =>
        previousRecords.filter(
          (record) => record.id !== recordId,
        ),
      )
    } catch (error) {
      console.error(
        '학습 기록을 삭제하지 못했습니다.',
        error,
      )

      window.alert(
        '학습 기록을 삭제하지 못했습니다. 다시 시도해 주세요.',
      )
    }
  }

  // 날짜 클릭 토글
  const handleDateClick = (dateKey: string) => {
    if (selectedDate === dateKey) {
      setSelectedDate(null) // 이미 선택한 날짜 재클릭 시 전체 보기
    } else {
      setSelectedDate(dateKey)
    }
  }

  return (
    <main className="history-page">
      <div className="history-container layout-3col">
        {/* 👈 [좌측 사이드바]*/}
        <aside className="history-sidebar left-sidebar"
        style={{ position: 'sticky', top: '24px', height: 'fit-content' }}>
          <div className="sidebar-card ai-summary-card">
            <span className="postit-tape"></span>
            <h4>💡 학습 팁</h4>
            <p>
              달력의 특정 날짜를 누르면 해당 날짜의 기록을 한눈에 모아볼 수 있어요!
            </p>
          </div>
        </aside>

        {/* 📄 [중앙 본문] */}
        <div className="history-main-content">
          <div className="history-topbar">
            <Link
              className="history-back-link"
              to="/"
            >
              <ArrowLeft size={17} />
              이번 주로 돌아가기
            </Link>

            <Link
              className="history-create-button"
              to="/records"
            >
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
                매일 남긴 학습 기록을 다시
                확인하고,
                <br />
                내가 어떻게 성장했는지
                살펴보세요.
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

                <strong>
                  {formatStudyTime(totalMinutes)}
                </strong>
              </div>
            </div>

            <div className="history-summary-item">
              <Star size={20} />

              <div>
                <span>평균 이해도</span>

                <strong>
                  {averageUnderstanding} / 5
                </strong>
              </div>
            </div>
          </section>

          {/* 🔍 검색 및 과목 필터바 */}
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
                setSubjectFilter(
                  event.target.value,
                )
              }
              aria-label="과목 선택"
            >
              {subjects.map((subject) => (
                <option
                  value={subject}
                  key={subject}
                >
                  {subject}
                </option>
              ))}
            </select>
          </section>

          {/* 선택된 날짜 필터 표시 뱃지 */}
          {selectedDate ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                padding: '8px 14px',
                backgroundColor: 'var(--primary-light, #eef2ff)',
                borderRadius: '8px',
                width: 'fit-content',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              <span>
                📅 {selectedDate === todayKey ? '오늘' : formatRecordDate(selectedDate)} 학습 기록
              </span>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
                title="전체 날짜 보기"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              style={{
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#666',
              }}
            >
              📋 전체 날짜의 학습 기록을 보는 중입니다.
            </div>
          )}

          {loadStatus === 'loading' ? (
            <section className="history-empty">
              <span className="history-empty-icon">
                <BookOpen size={29} />
              </span>

              <h2>
                학습 기록을 불러오는 중이에요.
              </h2>

              <p>잠시만 기다려 주세요.</p>
            </section>
          ) : loadStatus === 'error' ? (
            <section className="history-empty">
              <span className="history-empty-icon">
                <BookOpen size={29} />
              </span>

              <h2>
                학습 기록을 불러오지 못했어요.
              </h2>

              <p>
                백엔드 서버가 실행 중인지 확인한
                뒤 새로고침해 주세요.
              </p>
            </section>
          ) : filteredRecords.length === 0 ? (
            <section className="history-empty">
              <span className="history-empty-icon">
                <BookOpen size={29} />
              </span>

              <h2>
                {selectedDate === todayKey
                  ? '오늘 작성한 학습 기록이 없어요.'
                  : '선택한 조건에 해당하는 기록이 없어요.'}
              </h2>

              <p>
                {selectedDate === todayKey
                  ? '오늘 공부한 내용을 남겨 첫 번째 기록을 쌓아보세요!'
                  : '검색어나 과목, 날짜 선택 조건을 변경해 보세요.'}
              </p>

              {selectedDate && (
                <button
                  type="button"
                  className="history-empty-button"
                  onClick={() => setSelectedDate(null)}
                >
                  전체 날짜 기록 보기
                </button>
              )}
            </section>
          ) : (
            <section className="history-list">
              {filteredRecords.map((record) => {
                const keywords = record.keywords
                  .split(',')
                  .map((keyword) =>
                    keyword.trim(),
                  )
                  .filter(Boolean)

                return (
                  <article
                    className="history-record-card"
                    key={record.id}
                  >
                    <div className="history-record-header">
                      <div className="history-record-identity">
                        <span className="history-record-date">
                          <CalendarDays
                            size={15}
                          />

                          {formatRecordDate(
                            record.date,
                          )}
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
                          onClick={() =>
                            handleDelete(record.id)
                          }
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
                        {formatStudyTime(
                          record.minutes,
                        )}
                      </span>

                      <span>
                        <Star size={16} />
                        이해도{' '}
                        {record.understanding} ·{' '}
                        {understandingLabels[
                          record.understanding
                        ] ?? '미선택'}
                      </span>
                    </div>

                    <div className="history-record-content">
                      <div>
                        <strong>
                          이해한 내용
                        </strong>

                        <p>{record.learned}</p>
                      </div>

                      <div>
                        <strong>
                          다시 볼 내용
                        </strong>

                        <p>
                          {record.difficult}
                        </p>
                      </div>
                    </div>

                    {keywords.length > 0 && (
                      <div className="history-keywords">
                        {keywords.map(
                          (keyword) => (
                            <span key={keyword}>
                              {keyword}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </section>
          )}
        </div>

        {/* 📅 [우측 사이드바] marginTop 제거 및 상단 고정 적용 */}
        <aside
          className="history-sidebar right-sidebar"
          style={{ position: 'sticky', top: '24px', height: 'fit-content' }}
        >
          <div className="sidebar-card memo-card">
            <div className="card-header">
              <Calendar size={16} />
              <h3>{currentMonth + 1}월 학습기록</h3>
            </div>
            <div
              className="mini-calendar"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
              }}
            >
              {monthDays.map((item) => (
                <button
                  key={`${item.date}-${item.dayName}`}
                  type="button"
                  onClick={() => handleDateClick(item.dateKey)}
                  className={`calendar-day ${item.today ? 'today' : ''} ${
                    item.active ? 'completed' : ''
                  }`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 2px',
                    minHeight: '42px',
                    cursor: 'pointer',
                    outline: item.selected
                      ? '2px solid var(--primary, #4f46e5)'
                      : 'none',
                    borderRadius: '6px',
                    border: 'none',
                    background: item.selected ? '#e0e7ff' : undefined,
                  }}
                  title={`${item.date}일 학습 기록 필터링`}
                >
                  <span className="day-name" style={{ fontSize: '10px' }}>
                    {item.dayName}
                  </span>
                  <span className="day-date" style={{ fontSize: '12px' }}>
                    {item.date}
                  </span>
                  {item.active && (
                    <CheckCircle2 size={11} className="check-icon" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default HistoryPage