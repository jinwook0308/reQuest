import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import SubjectBookshelf, {
  type SubjectBookItem,
} from '../../components/subject-bookshelf/SubjectBookshelf'
import { apiFetch } from '../../lib/api'

import SubjectCreateBook, {
  type CreatedSubject,
} from '../../components/subject-bookshelf/SubjectCreateBook'


import './HistoryPage.css'
import '../ai-review/AireviewPage.css'



type SavedStudyRecord = {
  id: number
  date: string
  subject: string
  recordType?: 'general' | 'certification'
  certificationName?: string | null
  examType?: 'written' | 'practical' | null
  examDate?: string | null
  unit: string
  minutes: number
  learned: string
  difficult: string
  keywords: string
  understanding: number
  createdAt?: string
}

type StudyRecordApiItem = Omit<
  SavedStudyRecord,
  'id' | 'minutes' | 'understanding'
> & {
  id: string | number
  minutes: string | number
  understanding: string | number
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

type SubjectApiItem = {
  id: string | number
  name: string
}

type SubjectsApiResponse = {
  success: boolean
  message?: string
  data?: SubjectApiItem[]
}

function isCertificationRecord(record: SavedStudyRecord) {
  return (
    record.recordType === 'certification' ||
    record.subject.trim() === '자격증'
  )
}

function getCertificationBookName(record: SavedStudyRecord) {
  return record.certificationName?.trim() || '자격증'
}

const understandingLabels: Record<number, string> = {
  1: '어려워요',
  2: '조금 어려워요',
  3: '보통이에요',
  4: '이해했어요',
  5: '완벽해요',
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

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
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatStudyTime(minutes: number | string) {
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
  const [searchParams, setSearchParams] = useSearchParams()
  const recordView =
    searchParams.get('type') === 'certification'
      ? 'certification'
      : 'general'
  const isCertificationView = recordView === 'certification'
  const [records, setRecords] = useState<SavedStudyRecord[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [loadStatus, setLoadStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [loadMessage, setLoadMessage] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string | null>(
    () => searchParams.get('subject'),
  )
  const [searchText, setSearchText] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => formatDateKey(today), [today])
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  useEffect(() => {
    setSelectedSubject(searchParams.get('subject'))
  }, [searchParams])

  useEffect(() => {
    const controller = new AbortController()

    async function loadRecords() {
      setLoadStatus('loading')
      setLoadMessage('')

      try {
        const [recordsResponse, subjectsResponse] = await Promise.all([
          apiFetch('/study-records', {
            signal: controller.signal,
          }),
          apiFetch('/subjects', {
            signal: controller.signal,
          }),
        ])
        const recordsResult =
          (await recordsResponse.json()) as StudyRecordsApiResponse
        const subjectsResult =
          (await subjectsResponse.json()) as SubjectsApiResponse

        if (
          !recordsResponse.ok ||
          !recordsResult.success ||
          !recordsResult.data
        ) {
          throw new Error(
            recordsResult.message ?? '학습 기록 조회에 실패했습니다.',
          )
        }

        if (
          !subjectsResponse.ok ||
          !subjectsResult.success ||
          !subjectsResult.data
        ) {
          throw new Error(
            subjectsResult.message ?? '과목 조회에 실패했습니다.',
          )
        }

        setRecords(
          recordsResult.data.map((record) => ({
            ...record,
            id: Number(record.id),
            minutes: Number(record.minutes),
            understanding: Number(record.understanding),
          })),
        )
        setAvailableSubjects(
          subjectsResult.data
            .filter(
              (subject) =>
                subject.name !== '기타' &&
                subject.name !== '자격증',
            )
            .map((subject) => ({
              id: String(subject.id),
              name: subject.name,
            })),
        )
        setLoadStatus('success')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        console.error('학습 기록을 불러오지 못했습니다.', error)
        setRecords([])
        setLoadMessage(
          error instanceof Error
            ? error.message
            : '학습 기록을 불러오지 못했습니다.',
        )
        setLoadStatus('error')
      }
    }

    void loadRecords()

    return () => controller.abort()
  }, [])



const handleSubjectCreated = (
  subject: CreatedSubject,
) => {
  setAvailableSubjects((previousSubjects) => {
    const alreadyExists =
      previousSubjects.some(
        (previousSubject) =>
          previousSubject.id === subject.id ||
          previousSubject.name === subject.name,
      )

    if (alreadyExists) {
      return previousSubjects
    }

    return [
      ...previousSubjects,
      subject,
    ]
  })
}


  const scopedRecords = useMemo(
    () =>
      records.filter((record) =>
        isCertificationView
          ? isCertificationRecord(record)
          : !isCertificationRecord(record),
      ),
    [isCertificationView, records],
  )

  const subjectBookItems = useMemo<SubjectBookItem[]>(() => {
    if (isCertificationView) {
      const certificationNames = Array.from(
        new Set(
          scopedRecords
            .map(getCertificationBookName)
            .filter((name): name is string => Boolean(name)),
        ),
      )

      return certificationNames.map((certificationName) => {
        const certificationRecords = scopedRecords.filter(
          (record) =>
            getCertificationBookName(record) === certificationName,
        )
        const certificationMinutes = certificationRecords.reduce(
          (total, record) => total + Number(record.minutes || 0),
          0,
        )

        return {
          id: `certification-${certificationName}`,
          subject: certificationName,
          eyebrow: 'CERTIFICATION RECORD',
          meta: `${certificationRecords.length}개 기록 · ${formatStudyTime(
            certificationMinutes,
          )}`,
          badge: '자격증',
        }
      })
    }

    return availableSubjects.map((subject) => {
      const subjectRecords = scopedRecords.filter(
        (record) => record.subject === subject.name,
      )
      const subjectMinutes = subjectRecords.reduce(
        (total, record) => total + Number(record.minutes || 0),
        0,
      )

      return {
        id: subject.id,
        subject: subject.name,
        eyebrow: 'LEARNING RECORD',
        meta: `${subjectRecords.length}개 기록 · ${formatStudyTime(
          subjectMinutes,
        )}`,
      }
    })
  }, [availableSubjects, isCertificationView, scopedRecords])

  const selectedSubjectRecords = useMemo(() => {
    if (!selectedSubject) {
      return []
    }

    return scopedRecords.filter((record) =>
      isCertificationView
        ? getCertificationBookName(record) === selectedSubject
        : record.subject === selectedSubject,
    )
  }, [isCertificationView, scopedRecords, selectedSubject])

  const selectedSubjectMinutes = selectedSubjectRecords.reduce(
    (total, record) => total + Number(record.minutes || 0),
    0,
  )

  const selectedSubjectUnderstanding =
    selectedSubjectRecords.length === 0
      ? 0
      : selectedSubjectRecords.reduce(
          (total, record) => total + Number(record.understanding || 0),
          0,
        ) / selectedSubjectRecords.length

  const filteredRecords = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase()

    return selectedSubjectRecords
      .filter((record) => {
        const matchesDate = !selectedDate || record.date === selectedDate
        const searchableText = [
          record.subject,
          record.certificationName ?? '',
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

        return matchesDate && matchesSearch
      })
      .sort((firstRecord, secondRecord) => {
        const firstTime = new Date(
          firstRecord.createdAt ?? `${firstRecord.date}T00:00:00`,
        ).getTime()
        const secondTime = new Date(
          secondRecord.createdAt ?? `${secondRecord.date}T00:00:00`,
        ).getTime()

        return secondTime - firstTime
      })
  }, [searchText, selectedDate, selectedSubjectRecords])

  const monthDays = useMemo(() => {
    const totalDaysInMonth = new Date(
      currentYear,
      currentMonth + 1,
      0,
    ).getDate()

    return Array.from({ length: totalDaysInMonth }, (_, index) => {
      const dateObject = new Date(currentYear, currentMonth, index + 1)
      const dateKey = formatDateKey(dateObject)
      const hasRecord = selectedSubjectRecords.some(
        (record) => record.date === dateKey,
      )

      return {
        dateKey,
        dayName: DAY_NAMES[dateObject.getDay()],
        date: String(index + 1),
        active: hasRecord,
        today: isSameDate(dateObject, today),
        selected: selectedDate === dateKey,
      }
    })
  }, [
    currentMonth,
    currentYear,
    selectedDate,
    selectedSubjectRecords,
    today,
  ])

  const handleOpenSubjectBook = (book: SubjectBookItem) => {
    setSelectedSubject(book.subject)
    setSearchParams({
      type: recordView,
      subject: book.subject,
    })
    setSearchText('')
    setSelectedDate(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCloseSubjectBook = () => {
    setSelectedSubject(null)
    setSearchParams({ type: recordView })
    setSearchText('')
    setSelectedDate(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const createRecordPath = isCertificationView
    ? `/records?type=certification&certificationName=${encodeURIComponent(
        selectedSubject ?? '',
      )}`
    : `/records?type=general&subject=${encodeURIComponent(
        selectedSubject ?? '',
      )}`

  const handleDateClick = (dateKey: string) => {
    setSelectedDate((previousDate) =>
      previousDate === dateKey ? null : dateKey,
    )
  }

  const handleDelete = async (recordId: number) => {
    if (!window.confirm('이 학습 기록을 삭제할까요?')) {
      return
    }

    try {
      const response = await apiFetch(
        `/study-records/${recordId}`,
        { 
          method: 'DELETE' 
        },
      )
      const result =
        (await response.json()) as DeleteStudyRecordApiResponse

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? '학습 기록 삭제에 실패했습니다.',
        )
      }

      setRecords((previousRecords) =>
        previousRecords.filter((record) => record.id !== recordId),
      )
    } catch (error) {
      console.error('학습 기록을 삭제하지 못했습니다.', error)
      window.alert(
        '학습 기록을 삭제하지 못했습니다. 다시 시도해 주세요.',
      )
    }
  }

  if (selectedSubject) {
    return (
      <main className="history-page ai-review-page">
        <div className="review-note-toolbar">
          <button
            type="button"
            className="review-back-button"
            onClick={handleCloseSubjectBook}
          >
            <ArrowLeft size={18} />
            {isCertificationView ? '자격증 노트 목록' : '과목 노트 목록'}
          </button>
        </div>

        <section className="opened-review-note">
          <div className="opened-note-heading">
            <span className="opened-note-icon">
              <BookOpen size={26} />
            </span>

            <div>
              <span className="opened-note-label">
                {isCertificationView
                  ? 'CERTIFICATION RECORD'
                  : 'LEARNING RECORD'}
              </span>
              <h1>
                {selectedSubject}{' '}
                {isCertificationView ? '자격증 노트' : '학습 노트'}
              </h1>
              <p>
                {isCertificationView
                  ? '필기·실기 학습 기록과 시험 준비 과정을 한곳에서 확인해 보세요.'
                  : '매일 남긴 학습 내용을 다시 확인하고 성장 과정을 살펴보세요.'}
              </p>
            </div>
          </div>

          <div className="review-note-summary">
            <div>
              <FileText size={20} />
              <span>학습 기록</span>
              <strong>{selectedSubjectRecords.length}개</strong>
            </div>

            <div>
              <Clock3 size={20} />
              <span>누적 학습시간</span>
              <strong>{formatStudyTime(selectedSubjectMinutes)}</strong>
            </div>

            <div>
              <Brain size={20} />
              <span>평균 이해도</span>
              <strong>
                {selectedSubjectUnderstanding.toFixed(1)} / 5
              </strong>
            </div>
          </div>

          <div className="review-note-content history-opened-note-content">
            <div className="review-note-section-heading">
              <div>
                <span>SUBJECT ARCHIVE</span>
                <h2>학습 기록 모아보기</h2>
              </div>

              <Link
                className="history-note-create-button"
                to={createRecordPath}
              >
                <Plus size={17} />
                학습 기록 추가
              </Link>
            </div>

            <div className="history-note-tools">
              <label className="history-search">
                <Search size={18} />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="단원, 학습 내용, 키워드 검색"
                />
              </label>

              {selectedDate ? (
                <button
                  type="button"
                  className="history-date-filter"
                  onClick={() => setSelectedDate(null)}
                  title="전체 날짜 보기"
                >
                  <CalendarDays size={16} />
                  {selectedDate === todayKey
                    ? '오늘'
                    : formatRecordDate(selectedDate)}
                  <X size={15} />
                </button>
              ) : (
                <span className="history-date-filter is-idle">
                  <CalendarDays size={16} />
                  전체 날짜
                </span>
              )}
            </div>

            <div className="history-opened-layout">
              <div className="history-opened-records">
                {selectedSubjectRecords.length === 0 ? (
                  <div className="empty-review-note">
                    <BookOpen size={42} />
                    <h3>아직 등록된 학습 기록이 없어요.</h3>
                    <p>
                      먼저 {selectedSubject}{' '}
                      {isCertificationView ? '자격증' : '학습'} 기록을
                      남겨주세요.
                    </p>
                    <Link
                      className="history-empty-create-button"
                      to={createRecordPath}
                    >
                      학습 기록 작성하기
                    </Link>
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="empty-review-note">
                    <Search size={42} />
                    <h3>선택한 조건의 기록이 없어요.</h3>
                    <p>검색어나 날짜 선택을 변경해 보세요.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchText('')
                        setSelectedDate(null)
                      }}
                    >
                      전체 기록 보기
                    </button>
                  </div>
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
                                 {isCertificationView
                                   ? getCertificationBookName(record)
                                   : record.subject}
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
                               `${
                                 isCertificationView
                                   ? getCertificationBookName(record)
                                   : record.subject
                               } 학습`}
                          </h2>

                          <div className="history-record-meta">
                            <span>
                              <Clock3 size={16} />
                              {formatStudyTime(record.minutes)}
                            </span>
                            <span>
                              <Star size={16} />
                              이해도 {record.understanding} ·{' '}
                              {understandingLabels[record.understanding] ??
                                '미선택'}
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

                          {keywords.length > 0 ? (
                            <div className="history-keywords">
                              {keywords.map((keyword) => (
                                <span key={keyword}>{keyword}</span>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </section>
                )}
              </div>

              <aside className="history-note-calendar">
                <div className="history-calendar-heading">
                  <Calendar size={17} />
                  <strong>{currentMonth + 1}월 학습 기록</strong>
                </div>

                <div className="mini-calendar history-note-calendar-grid">
                  {monthDays.map((item) => (
                    <button
                      key={item.dateKey}
                      type="button"
                      onClick={() => handleDateClick(item.dateKey)}
                      className={[
                        'calendar-day',
                        item.today ? 'today' : '',
                        item.active ? 'completed' : '',
                        item.selected ? 'is-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={`${item.date}일 학습 기록 필터링`}
                    >
                      <span className="day-name">{item.dayName}</span>
                      <span className="day-date">{item.date}</span>
                      {item.active ? (
                        <CheckCircle2 size={11} className="check-icon" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="history-page ai-review-page">
      <section className="ai-review-hero">
        <span className="ai-review-eyebrow">
          {isCertificationView
            ? 'CERTIFICATION ARCHIVE'
            : 'LEARNING ARCHIVE'}
        </span>
        <h1>
          {isCertificationView
            ? '나의 자격증 공부 기록'
            : '나의 일반 학습 기록'}
        </h1>
        <p>
          {isCertificationView
            ? '자격증별 노트를 열어 필기·실기 공부 기록과 시험 준비 과정을 확인해 보세요.'
            : '과목별 학습 노트를 열어 매일 남긴 기록과 성장 과정을 확인해 보세요.'}
        </p>
      </section>

      {loadStatus === 'loading' ? (
        <div className="review-page-message">
          학습 노트를 불러오고 있습니다.
        </div>
      ) : loadStatus === 'error' ? (
        <div className="review-page-message is-error">
          <strong>학습 노트를 불러오지 못했습니다.</strong>
          <span>{loadMessage}</span>
        </div>
      ) : (
        <section className="review-library">
          <div className="review-library-heading">
            <div>
               <span>
                 {isCertificationView ? 'MY CERTIFICATES' : 'MY SUBJECTS'}
               </span>
               <h2>
                 {isCertificationView
                   ? '자격증별 학습 노트'
                   : '과목별 학습 노트'}
               </h2>
            </div>
            <p>
               노트를 선택하면 표지가 열리면서 해당{' '}
               {isCertificationView ? '자격증' : '과목'}의 학습 기록이
               나타납니다.
            </p>
          </div>

          <SubjectBookshelf
            items={subjectBookItems}
            variant="study"
            hoverLabel="학습 기록 열어보기"
             emptyMessage={
               isCertificationView
                 ? '아직 등록된 자격증이 없습니다.'
                 : '아직 등록된 과목이 없습니다.'
             }
            onOpen={handleOpenSubjectBook}
          >
             {isCertificationView ? (
               <Link
                 className="subject-book subject-create-book"
                 to="/records?type=certification"
                 aria-label="새 자격증 학습 기록 추가"
               >
                 <span className="subject-book__pages subject-create-book__pages" />
                 <span className="subject-book__cover subject-create-book__cover">
                   <span className="subject-book__spine subject-create-book__spine" />
                   <span className="subject-create-book__content">
                     <span className="subject-create-book__icon">
                       <Plus size={30} strokeWidth={1.6} />
                     </span>
                     <strong>자격증 추가</strong>
                     <small>새 자격증 노트 만들기</small>
                   </span>
                 </span>
               </Link>
             ) : (
               <SubjectCreateBook onCreated={handleSubjectCreated} />
             )}
        </SubjectBookshelf>
      </section>
      )}
    </main>
  )
}

export default HistoryPage
