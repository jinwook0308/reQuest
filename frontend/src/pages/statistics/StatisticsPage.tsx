import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Maximize2,
  Minimize2,
  Star,
} from 'lucide-react'

import { apiFetch } from '../../lib/api'
import type { StudySession } from '../../types/studySession'
import './StatisticsPage.css'

type RecordType = 'general' | 'certification'
type StatisticsView = 'all' | 'general' | 'certification' | 'focus'

interface SavedStudyRecord {
  id: number
  date: string
  subject: string
  unit: string
  minutes: string
  learned: string
  difficult: string
  keywords: string
  understanding: number
  recordType?: RecordType
  createdAt?: string
}

interface DailyStatistics {
  date: string
  dateLabel: string
  axisLabel: string
  totalMinutes: number
  totalHours: number
  averageUnderstanding: number | null
  recordCount: number
}

interface HeatmapPoint extends DailyStatistics {
  level: 0 | 1 | 2 | 3 | 4
}

interface SubjectStatistics {
  subject: string
  recordCount: number
  totalMinutes: number
  averageUnderstanding: number
  percentage: number
  color: string
}

interface ApiStudyRecord
  extends Omit<SavedStudyRecord, 'id' | 'minutes' | 'understanding'> {
  id: number | string
  minutes: number | string
  understanding: number | string
}

interface ChartTooltipProps<T> {
  active?: boolean
  payload?: ReadonlyArray<{ payload: T }>
}

const STATISTICS_VIEW_ORDER: StatisticsView[] = [
  'all',
  'general',
  'certification',
  'focus',
]

const STATISTICS_VIEW_LABELS: Record<StatisticsView, string> = {
  all: '전체',
  general: '일반 학습',
  certification: '자격증 공부',
  focus: '순공 시간',
}

const STATISTICS_VIEW_COLORS: Record<StatisticsView, string> = {
  all: '#2d2d2a',
  general: '#d58a24',
  certification: '#3f7d55',
  focus: '#3978bd',
}

const STATISTICS_HEATMAP_COLORS: Record<
  StatisticsView,
  [string, string, string, string]
> = {
  all: ['#d7d5cf', '#aaa79f', '#6c6a64', '#2d2d2a'],
  general: ['#f8dfb8', '#edbb70', '#d58a24', '#9f5c0a'],
  certification: ['#d8eadc', '#9fcca9', '#65a477', '#346c48'],
  focus: ['#d8e7f6', '#9ec2e7', '#639bd2', '#2e6da9'],
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatKoreaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatStudyTime(totalMinutes: number) {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (hours === 0) return `${minutes}분`
  if (minutes === 0) return `${hours}시간`
  return `${hours}시간 ${minutes}분`
}

function formatAxisMinutes(value: number) {
  if (value === 0) return '0분'
  if (value < 60) return `${Math.round(value)}분`

  const hours = Math.floor(value / 60)
  const minutes = Math.round(value % 60)
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

function getViewLabel(view: StatisticsView) {
  return STATISTICS_VIEW_LABELS[view]
}

function getViewColor(view: StatisticsView) {
  return STATISTICS_VIEW_COLORS[view]
}

function getViewStyle(view: StatisticsView) {
  const colors = STATISTICS_HEATMAP_COLORS[view]

  return {
    '--statistics-accent': getViewColor(view),
    '--statistics-heatmap-1': colors[0],
    '--statistics-heatmap-2': colors[1],
    '--statistics-heatmap-3': colors[2],
    '--statistics-heatmap-4': colors[3],
  } as CSSProperties
}

function createSubjectColorMap(records: SavedStudyRecord[]) {
  const subjects = [
    ...new Set(records.map((record) => record.subject.trim() || '과목 없음')),
  ].sort((left, right) => left.localeCompare(right, 'ko-KR'))

  return new Map(
    subjects.map((subject, index) => [
      subject,
      `hsl(${(32 + index * 137.508) % 360} 48% 44%)`,
    ]),
  )
}

function getNextView(view: StatisticsView, direction: -1 | 1) {
  const currentIndex = STATISTICS_VIEW_ORDER.indexOf(view)
  const nextIndex =
    (currentIndex + direction + STATISTICS_VIEW_ORDER.length) %
    STATISTICS_VIEW_ORDER.length
  return STATISTICS_VIEW_ORDER[nextIndex]
}

function isCertificationRecord(record: SavedStudyRecord) {
  return record.recordType === 'certification'
}

function getRecordsForView(
  records: SavedStudyRecord[],
  focusRecords: SavedStudyRecord[],
  view: StatisticsView,
) {
  if (view === 'focus') return focusRecords
  if (view === 'certification') return records.filter(isCertificationRecord)
  if (view === 'general')
    return records.filter((record) => !isCertificationRecord(record))
  return records
}

function getRecentRecords(records: SavedStudyRecord[], days: number) {
  const lastDate = parseDateKey(formatKoreaDateKey(new Date()))
  lastDate.setHours(23, 59, 59, 999)
  const firstDate = new Date(lastDate)
  firstDate.setDate(firstDate.getDate() - (days - 1))
  firstDate.setHours(0, 0, 0, 0)

  return records.filter((record) => {
    const date = parseDateKey(record.date)
    return date >= firstDate && date <= lastDate
  })
}

function createDailyStatistics(date: Date, records: SavedStudyRecord[]): DailyStatistics {
  const dateKey = formatDateKey(date)
  const recordsOnDate = records.filter((record) => record.date === dateKey)
  const totalMinutes = recordsOnDate.reduce(
    (sum, record) => sum + Number(record.minutes || 0),
    0,
  )
  const understandings = recordsOnDate
    .map((record) => Number(record.understanding))
    .filter((value) => Number.isFinite(value) && value > 0)
  const averageUnderstanding = understandings.length
    ? understandings.reduce((sum, value) => sum + value, 0) / understandings.length
    : null

  return {
    date: dateKey,
    dateLabel: date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }),
    axisLabel: `${date.getMonth() + 1}/${date.getDate()}`,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    averageUnderstanding,
    recordCount: recordsOnDate.length,
  }
}

function createRecentDailyStatistics(records: SavedStudyRecord[], days: number) {
  const today = parseDateKey(formatKoreaDateKey(new Date()))
  today.setHours(12, 0, 0, 0)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - index - 1))
    return createDailyStatistics(date, records)
  })
}

function getHeatmapLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0
  if (minutes <= 30) return 1
  if (minutes <= 60) return 2
  if (minutes <= 120) return 3
  return 4
}

function createHeatmapWeeks(records: SavedStudyRecord[], weekCount = 15) {
  const days = createRecentDailyStatistics(records, weekCount * 7)
  const points: HeatmapPoint[] = days.map((day) => ({
    ...day,
    level: getHeatmapLevel(day.totalMinutes),
  }))

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    points.slice(weekIndex * 7, weekIndex * 7 + 7),
  )
}

function calculateBestStreak(records: SavedStudyRecord[]) {
  const dates = [...new Set(records.map((record) => record.date))]
    .map(parseDateKey)
    .sort((left, right) => left.getTime() - right.getTime())

  let best = 0
  let current = 0
  let previous: Date | null = null

  dates.forEach((date) => {
    if (!previous) {
      current = 1
    } else {
      const nextDate = new Date(previous)
      nextDate.setDate(previous.getDate() + 1)
      current = formatDateKey(nextDate) === formatDateKey(date) ? current + 1 : 1
    }

    best = Math.max(best, current)
    previous = date
  })

  return best
}

function createSubjectStatistics(
  records: SavedStudyRecord[],
  subjectColorMap: Map<string, string>,
) {
  const grouped = new Map<
    string,
    {
      recordCount: number
      totalMinutes: number
      understandingTotal: number
      understandingCount: number
    }
  >()

  records.forEach((record) => {
    const subject = record.subject.trim() || '과목 없음'
    const previous = grouped.get(subject) ?? {
      recordCount: 0,
      totalMinutes: 0,
      understandingTotal: 0,
      understandingCount: 0,
    }
    const understanding = Number(record.understanding)

    previous.recordCount += 1
    previous.totalMinutes += Number(record.minutes || 0)
    if (Number.isFinite(understanding) && understanding > 0) {
      previous.understandingTotal += understanding
      previous.understandingCount += 1
    }
    grouped.set(subject, previous)
  })

  const totalMinutes = [...grouped.values()].reduce(
    (sum, subject) => sum + subject.totalMinutes,
    0,
  )

  return [...grouped.entries()]
    .map(
      ([subject, value]): SubjectStatistics => ({
        subject,
        recordCount: value.recordCount,
        totalMinutes: value.totalMinutes,
        averageUnderstanding: value.understandingCount
          ? value.understandingTotal / value.understandingCount
          : 0,
        percentage: totalMinutes ? (value.totalMinutes / totalMinutes) * 100 : 0,
        color: subjectColorMap.get(subject) ?? '#6f6c65',
      }),
    )
    .sort((left, right) => right.totalMinutes - left.totalMinutes)
}

function createFocusRecords(sessions: StudySession[]): SavedStudyRecord[] {
  return sessions
    .filter((session) => session.status === 'completed')
    .map((session, index) => {
      const elapsedSeconds = Math.max(0, Number(session.elapsedSeconds || 0))
      const targetSeconds = Math.max(1, Number(session.targetMinutes || 0) * 60)
      const completionRate = Math.min(
        100,
        Math.round((elapsedSeconds / targetSeconds) * 100),
      )
      const completedAt = new Date(session.endedAt ?? session.startedAt)

      return {
        id: -(index + 1),
        date: formatKoreaDateKey(completedAt),
        subject: session.subject,
        unit: session.unit,
        minutes: String(Math.round(elapsedSeconds / 60)),
        learned: '',
        difficult: '',
        keywords: '',
        understanding: completionRate / 20,
        recordType: session.recordType,
        createdAt: session.endedAt ?? session.startedAt,
      }
    })
}

function formatSubjectAxisLabel(value: string) {
  return value.length > 16 ? `${value.slice(0, 16)}…` : value
}

function StatisticsViewBadge({ view }: { view: StatisticsView }) {
  return (
    <span
      className="statistics-view-badge"
      style={{ color: getViewColor(view), borderColor: getViewColor(view) }}
    >
      <i style={{ backgroundColor: getViewColor(view) }} />
      {getViewLabel(view)}
    </span>
  )
}

function StatisticsViewControls({
  view,
  onChange,
}: {
  view: StatisticsView
  onChange: (view: StatisticsView) => void
}) {
  return (
    <div className="statistics-view-controls" aria-label="통계 분류 전환">
      <button
        type="button"
        className="statistics-view-arrow statistics-view-arrow-left"
        onClick={() => onChange(getNextView(view, -1))}
        aria-label="이전 통계 분류 보기"
        title={`이전: ${getViewLabel(getNextView(view, -1))}`}
      >
        <ChevronLeft size={24} />
      </button>
      <button
        type="button"
        className="statistics-view-arrow statistics-view-arrow-right"
        onClick={() => onChange(getNextView(view, 1))}
        aria-label="다음 통계 분류 보기"
        title={`다음: ${getViewLabel(getNextView(view, 1))}`}
      >
        <ChevronRight size={24} />
      </button>
    </div>
  )
}

function StudyTimeTooltip({
  active,
  payload,
  focus,
}: ChartTooltipProps<DailyStatistics> & { focus: boolean }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="statistics-chart-tooltip">
      <strong>{point.dateLabel}</strong>
      <span>
        {focus ? '순공 시간' : '학습시간'} {formatStudyTime(point.totalMinutes)}
      </span>
      <span>
        {focus ? '완료 세션' : '학습 기록'} {point.recordCount}개
      </span>
    </div>
  )
}

function UnderstandingTooltip({
  active,
  payload,
  focus,
}: ChartTooltipProps<DailyStatistics> & { focus: boolean }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="statistics-chart-tooltip">
      <strong>{point.dateLabel}</strong>
      <span>
        {focus ? '순공 시간' : '학습시간'} {formatStudyTime(point.totalMinutes)}
      </span>
      <span>
        {focus ? '완료 세션' : '학습 기록'} {point.recordCount}개
      </span>
      <span>
        {focus ? '평균 목표 달성률' : '평균 이해도'}{' '}
        {point.averageUnderstanding === null
          ? '-'
          : focus
            ? `${Math.round(point.averageUnderstanding * 20)}%`
            : `${point.averageUnderstanding.toFixed(1)} / 5`}
      </span>
    </div>
  )
}

function SubjectTimeTooltip({
  active,
  payload,
  focus,
}: ChartTooltipProps<SubjectStatistics> & { focus: boolean }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="statistics-chart-tooltip">
      <strong>{point.subject}</strong>
      <span>
        {focus ? '순공 시간' : '학습시간'} {formatStudyTime(point.totalMinutes)}
      </span>
      <span>
        {focus ? '목표 달성률' : '평균 이해도'}{' '}
        {focus
          ? `${Math.round(point.averageUnderstanding * 20)}%`
          : `${point.averageUnderstanding.toFixed(1)} / 5`}
      </span>
    </div>
  )
}

function StatisticsPage() {
  const [records, setRecords] = useState<SavedStudyRecord[]>([])
  const [focusSessions, setFocusSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [timeView, setTimeView] = useState<StatisticsView>('all')
  const [growthView, setGrowthView] = useState<StatisticsView>('all')
  const [heatmapView, setHeatmapView] = useState<StatisticsView>('all')
  const [subjectView, setSubjectView] = useState<StatisticsView>('all')
  const [subjectExpanded, setSubjectExpanded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadStatistics() {
      setLoading(true)
      setLoadError('')

      try {
        const [recordResponse, sessionResponse] = await Promise.all([
          apiFetch('/study-records', { signal: controller.signal }),
          apiFetch('/study-sessions?days=120', { signal: controller.signal }),
        ])

        const recordResult = (await recordResponse.json()) as {
          success: boolean
          message?: string
          data?: ApiStudyRecord[]
        }
        const sessionResult = (await sessionResponse.json()) as {
          success: boolean
          message?: string
          data?: StudySession[]
        }

        if (!recordResponse.ok || !recordResult.success) {
          throw new Error(recordResult.message ?? '학습 기록을 불러오지 못했습니다.')
        }
        if (!sessionResponse.ok || !sessionResult.success) {
          throw new Error(sessionResult.message ?? '순공 기록을 불러오지 못했습니다.')
        }

        setRecords(
          (recordResult.data ?? []).map((record) => ({
            ...record,
            id: Number(record.id),
            minutes: String(record.minutes),
            understanding: Number(record.understanding),
            recordType:
              record.recordType === 'certification' ? 'certification' : 'general',
          })),
        )
        setFocusSessions(sessionResult.data ?? [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadError(
          error instanceof Error ? error.message : '통계를 불러오지 못했습니다.',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadStatistics()
    return () => controller.abort()
  }, [])

  const focusRecords = useMemo(() => createFocusRecords(focusSessions), [focusSessions])
  const subjectColorMap = useMemo(
    () => createSubjectColorMap([...records, ...focusRecords]),
    [focusRecords, records],
  )

  const globalSummary = useMemo(() => {
    const totalMinutes = records.reduce(
      (sum, record) => sum + Number(record.minutes || 0),
      0,
    )
    const understandings = records
      .map((record) => Number(record.understanding))
      .filter((value) => Number.isFinite(value) && value > 0)

    return {
      totalMinutes,
      activeDays: new Set(records.map((record) => record.date)).size,
      averageUnderstanding: understandings.length
        ? understandings.reduce((sum, value) => sum + value, 0) / understandings.length
        : 0,
      bestStreak: calculateBestStreak(records),
    }
  }, [records])

  const timeRecords = useMemo(
    () => getRecordsForView(records, focusRecords, timeView),
    [focusRecords, records, timeView],
  )
  const growthRecords = useMemo(
    () => getRecordsForView(records, focusRecords, growthView),
    [focusRecords, growthView, records],
  )
  const heatmapRecords = useMemo(
    () => getRecordsForView(records, focusRecords, heatmapView),
    [focusRecords, heatmapView, records],
  )
  const subjectRecords = useMemo(
    () => getRecordsForView(records, focusRecords, subjectView),
    [focusRecords, records, subjectView],
  )

  const recentStudyTime = useMemo(
    () => createRecentDailyStatistics(timeRecords, 14),
    [timeRecords],
  )
  const growthStatistics = useMemo(
    () => createRecentDailyStatistics(growthRecords, 30),
    [growthRecords],
  )
  const heatmapWeeks = useMemo(
    () => createHeatmapWeeks(heatmapRecords, 15),
    [heatmapRecords],
  )
  const subjectStatistics = useMemo(
    () => createSubjectStatistics(getRecentRecords(subjectRecords, 30), subjectColorMap),
    [subjectColorMap, subjectRecords],
  )

  const totalRecentMinutes = recentStudyTime.reduce(
    (sum, day) => sum + day.totalMinutes,
    0,
  )
  const growthPoints = growthStatistics.filter((day) => day.averageUnderstanding !== null)
  const currentGrowthValue = growthPoints.at(-1)?.averageUnderstanding ?? 0
  const firstGrowthValue = growthPoints[0]?.averageUnderstanding ?? currentGrowthValue
  const growthChange = currentGrowthValue - firstGrowthValue
  const heatmapFlat = heatmapWeeks.flat()
  const heatmapActiveDays = heatmapFlat.filter((day) => day.recordCount > 0).length
  const heatmapTotalRecords = heatmapFlat.reduce((sum, day) => sum + day.recordCount, 0)
  const heatmapTotalMinutes = heatmapFlat.reduce((sum, day) => sum + day.totalMinutes, 0)
  const subjectTotalMinutes = subjectStatistics.reduce(
    (sum, subject) => sum + subject.totalMinutes,
    0,
  )
  const visibleSubjectStatistics = subjectExpanded
    ? subjectStatistics
    : subjectStatistics.slice(0, 6)

  return (
    <main className="statistics-page">
      <div className="statistics-container">
        <div className="statistics-topbar">
          <Link className="statistics-back-link" to="/">
            <ArrowLeft size={16} /> 이번 주로 돌아가기
          </Link>
          <Link className="statistics-history-link" to="/history">
            <BookOpen size={16} /> 학습 기록 보기
          </Link>
        </div>

        <header className="statistics-heading">
          <span className="statistics-heading-icon">
            <BarChart3 size={27} />
          </span>
          <div>
            <span className="statistics-eyebrow">LEARNING INSIGHT</span>
            <h1>나의 학습 통계</h1>
            <p>
              저장한 학습 기록과 순공 세션을 바탕으로 공부 흐름과 성장을 확인해 보세요.
            </p>
          </div>
        </header>

        {loadError && <div className="statistics-error">{loadError}</div>}

        <section className="statistics-summary" aria-label="학습 요약">
          <article className="statistics-summary-card">
            <Clock3 size={23} />
            <div>
              <span>총 학습시간</span>
              <strong>{formatStudyTime(globalSummary.totalMinutes)}</strong>
            </div>
          </article>
          <article className="statistics-summary-card">
            <CalendarDays size={23} />
            <div>
              <span>활동한 날짜</span>
              <strong>{formatNumber(globalSummary.activeDays)}일</strong>
            </div>
          </article>
          <article className="statistics-summary-card">
            <Star size={23} />
            <div>
              <span>평균 이해도</span>
              <strong>{globalSummary.averageUnderstanding.toFixed(1)} / 5</strong>
            </div>
          </article>
          <article className="statistics-summary-card">
            <Flame size={23} />
            <div>
              <span>최고 연속 기록</span>
              <strong>{formatNumber(globalSummary.bestStreak)}일</strong>
            </div>
          </article>
        </section>

        {loading ? (
          <section className="statistics-card statistics-loading">
            통계를 불러오는 중입니다.
          </section>
        ) : (
          <>
            <section className="statistics-chart-grid">
              <article
                className="statistics-card statistics-switchable-card"
                data-view={timeView}
                style={getViewStyle(timeView)}
              >
                <StatisticsViewControls view={timeView} onChange={setTimeView} />
                <div className="statistics-card-heading">
                  <div>
                    <div className="statistics-title-row">
                      <h2>최근 14일 학습시간</h2>
                      <StatisticsViewBadge view={timeView} />
                    </div>
                    <p>
                      {timeView === 'focus'
                        ? '완료한 타이머 세션의 순공시간입니다.'
                        : '날짜별로 저장된 총 학습시간입니다.'}
                    </p>
                  </div>
                  <strong>{formatStudyTime(totalRecentMinutes)}</strong>
                </div>
                <div className="statistics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={recentStudyTime}
                      margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid stroke="#e9e5dd" vertical={false} />
                      <XAxis
                        dataKey="axisLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#99958d', fontSize: 10 }}
                        interval={2}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#99958d', fontSize: 10 }}
                        tickFormatter={formatAxisMinutes}
                        width={55}
                      />
                      <Tooltip
                        cursor={{ fill: '#f7f2e8' }}
                        content={<StudyTimeTooltip focus={timeView === 'focus'} />}
                      />
                      <Bar
                        dataKey="totalMinutes"
                        fill={getViewColor(timeView)}
                        radius={[5, 5, 0, 0]}
                        maxBarSize={25}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article
                className="statistics-card statistics-switchable-card"
                data-view={growthView}
                style={getViewStyle(growthView)}
              >
                <StatisticsViewControls view={growthView} onChange={setGrowthView} />
                <div className="statistics-card-heading">
                  <div>
                    <div className="statistics-title-row">
                      <h2>
                        {growthView === 'focus'
                          ? '순공 목표 달성 추이'
                          : '나의 성장 추이'}
                      </h2>
                      <StatisticsViewBadge view={growthView} />
                    </div>
                    <p>
                      {growthView === 'focus'
                        ? '최근 30일 타이머 목표 달성률입니다.'
                        : `최근 30일의 평균 이해도입니다. ${growthChange > 0 ? `처음보다 ${growthChange.toFixed(1)}점 상승했어요.` : ''}`}
                    </p>
                  </div>
                  <strong>
                    {growthView === 'focus'
                      ? `${Math.round(currentGrowthValue * 20)}%`
                      : currentGrowthValue.toFixed(1)}
                  </strong>
                </div>
                <div className="statistics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={growthStatistics}
                      margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id={`statisticsGrowthFill-${growthView}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={getViewColor(growthView)}
                            stopOpacity={0.24}
                          />
                          <stop
                            offset="100%"
                            stopColor={getViewColor(growthView)}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e9e5dd" vertical={false} />
                      <XAxis
                        dataKey="axisLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#99958d', fontSize: 10 }}
                        interval={6}
                      />
                      <YAxis
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#99958d', fontSize: 10 }}
                        width={28}
                        tickFormatter={(value) =>
                          growthView === 'focus'
                            ? `${Number(value) * 20}%`
                            : String(value)
                        }
                      />
                      <Tooltip
                        content={<UnderstandingTooltip focus={growthView === 'focus'} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="averageUnderstanding"
                        connectNulls
                        stroke={getViewColor(growthView)}
                        strokeWidth={2.5}
                        fill={`url(#statisticsGrowthFill-${growthView})`}
                        activeDot={{ r: 5, fill: getViewColor(growthView) }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section
              className="statistics-card statistics-heatmap-card statistics-switchable-card"
              data-view={heatmapView}
              style={getViewStyle(heatmapView)}
            >
              <StatisticsViewControls view={heatmapView} onChange={setHeatmapView} />
              <div className="statistics-card-heading">
                <div>
                  <div className="statistics-title-row">
                    <h2>학습 히트맵</h2>
                    <StatisticsViewBadge view={heatmapView} />
                  </div>
                  <p>
                    최근 15주의 날짜별{' '}
                    {heatmapView === 'focus' ? '순공 활동' : '학습 활동'}입니다.
                  </p>
                </div>
                <div className="statistics-heatmap-legend">
                  <span>적음</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <i key={level} data-level={level} />
                  ))}
                  <span>많음</span>
                </div>
              </div>
              <div
                className="statistics-heatmap-scroll statistics-view-transition"
                key={heatmapView}
              >
                <div className="statistics-heatmap-grid">
                  {heatmapWeeks.map((week, weekIndex) => (
                    <div className="statistics-heatmap-week" key={`week-${weekIndex}`}>
                      {week.map((day) => (
                        <button
                          type="button"
                          className="statistics-heatmap-cell"
                          data-level={day.level}
                          key={day.date}
                          aria-label={`${day.dateLabel}, ${getViewLabel(heatmapView)}, ${formatStudyTime(day.totalMinutes)}, ${day.recordCount}개`}
                        >
                          <span className="statistics-heatmap-tooltip">
                            <strong>{day.dateLabel}</strong>
                            <span>분류 {getViewLabel(heatmapView)}</span>
                            <span>
                              {heatmapView === 'focus' ? '순공 시간' : '학습시간'}{' '}
                              {formatStudyTime(day.totalMinutes)}
                            </span>
                            <span>
                              {heatmapView === 'focus' ? '완료 세션' : '학습 기록'}{' '}
                              {day.recordCount}개
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="statistics-heatmap-summary">
                <div>
                  <strong>{formatNumber(heatmapActiveDays)}</strong>
                  <span>활동한 날짜</span>
                </div>
                <div>
                  <strong>{formatNumber(calculateBestStreak(heatmapRecords))}일</strong>
                  <span>최고 연속 기록</span>
                </div>
                <div>
                  <strong>{formatNumber(heatmapTotalRecords)}개</strong>
                  <span>{heatmapView === 'focus' ? '완료 세션' : '전체 학습 기록'}</span>
                </div>
                <div>
                  <strong>{formatStudyTime(heatmapTotalMinutes)}</strong>
                  <span>{heatmapView === 'focus' ? '총 순공 시간' : '총 학습시간'}</span>
                </div>
              </div>
            </section>

            <section
              className={`statistics-card statistics-subject-card statistics-switchable-card${subjectExpanded ? ' is-expanded' : ''}`}
              data-view={subjectView}
              style={getViewStyle(subjectView)}
            >
              <StatisticsViewControls
                view={subjectView}
                onChange={(view) => {
                  setSubjectView(view)
                  setSubjectExpanded(false)
                }}
              />
              <div className="statistics-card-heading">
                <div>
                  <div className="statistics-title-row">
                    <h2>과목별 공부시간</h2>
                    <StatisticsViewBadge view={subjectView} />
                  </div>
                  <p>최근 30일 동안 어떤 과목을 얼마나 공부했는지 비교합니다.</p>
                </div>
                <div className="statistics-subject-heading-actions">
                  <strong>{formatStudyTime(subjectTotalMinutes)}</strong>
                  {subjectStatistics.length > 6 && (
                    <button
                      type="button"
                      className="statistics-expand-button"
                      onClick={() => setSubjectExpanded((value) => !value)}
                    >
                      {subjectExpanded ? (
                        <Minimize2 size={15} />
                      ) : (
                        <Maximize2 size={15} />
                      )}
                      {subjectExpanded ? '접기' : '전체보기'}
                    </button>
                  )}
                </div>
              </div>

              {subjectStatistics.length === 0 ? (
                <div className="statistics-empty">
                  이 분류에 표시할 학습 기록이 아직 없습니다.
                </div>
              ) : (
                <div className="statistics-subject-content">
                  <div className="statistics-subject-chart-scroll">
                    <div
                      className="statistics-subject-chart-inner"
                      style={{
                        height: Math.max(235, visibleSubjectStatistics.length * 58),
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visibleSubjectStatistics}
                          layout="vertical"
                          margin={{ top: 8, right: 28, bottom: 8, left: 10 }}
                        >
                          <CartesianGrid stroke="#e9e5dd" horizontal={false} />
                          <XAxis
                            type="number"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#99958d', fontSize: 10 }}
                            tickFormatter={formatAxisMinutes}
                          />
                          <YAxis
                            type="category"
                            dataKey="subject"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6f6c65', fontSize: 11 }}
                            tickFormatter={formatSubjectAxisLabel}
                            width={175}
                          />
                          <Tooltip
                            cursor={{ fill: '#f7f2e8' }}
                            content={
                              <SubjectTimeTooltip focus={subjectView === 'focus'} />
                            }
                          />
                          <Bar
                            dataKey="totalMinutes"
                            radius={[0, 5, 5, 0]}
                            maxBarSize={24}
                          >
                            {visibleSubjectStatistics.map((subject) => (
                              <Cell key={subject.subject} fill={subject.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="statistics-table-scroll statistics-subject-table-scroll">
                    <table className="statistics-subject-table">
                      <thead>
                        <tr>
                          <th>과목</th>
                          <th>기록 수</th>
                          <th>{subjectView === 'focus' ? '순공 시간' : '학습시간'}</th>
                          <th>학습 비율</th>
                          <th>
                            {subjectView === 'focus' ? '목표 달성률' : '평균 이해도'}
                          </th>
                          <th>분포</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSubjectStatistics.map((subject) => (
                          <tr key={subject.subject}>
                            <td>
                              <strong
                                className="statistics-subject-name"
                                title={subject.subject}
                              >
                                <i style={{ backgroundColor: subject.color }} />
                                {subject.subject}
                              </strong>
                            </td>
                            <td>{formatNumber(subject.recordCount)}개</td>
                            <td>{formatStudyTime(subject.totalMinutes)}</td>
                            <td>{subject.percentage.toFixed(1)}%</td>
                            <td>
                              {subjectView === 'focus'
                                ? `${Math.round(subject.averageUnderstanding * 20)}%`
                                : `${subject.averageUnderstanding.toFixed(1)} / 5`}
                            </td>
                            <td>
                              <div className="statistics-subject-progress">
                                <span
                                  style={{
                                    width: `${subject.percentage}%`,
                                    background: subject.color,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default StatisticsPage
