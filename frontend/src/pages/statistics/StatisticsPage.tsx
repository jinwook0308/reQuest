import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  Clock3,
  Flame,
  Star,
} from 'lucide-react'

import './StatisticsPage.css'

import { apiFetch } from '../../lib/api'

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

type DailyStatistics = {
  dateKey: string
  label: string
  fullLabel: string
  minutes: number
  hours: number
  recordCount: number
  averageUnderstanding: number | null
  subjects: string
}

type HeatmapPoint =
  DailyStatistics & {
    level: number
    isFuture: boolean
  }

type SubjectStatistics = {
  subject: string
  recordCount: number
  totalMinutes: number
  averageUnderstanding: number
  percentage: number
}

type GrowthStatistics = {
  date: string
  recordCount: number
  totalMinutes: number
  averageUnderstanding: number
}

type LearningStatistics = {
  days: number
  totalMinutes: number
  subjects: SubjectStatistics[]
  growth: GrowthStatistics[]
  growthSummary: {
    firstUnderstanding: number
    currentUnderstanding: number
    change: number
  }
}

type TooltipEntry<T> = {
  payload: T
  value?: number | string
}

type ChartTooltipProps<T> = {
  active?: boolean
  payload?: TooltipEntry<T>[]
}

function formatNumber(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${formatNumber(
    date.getMonth() + 1,
  )}-${formatNumber(date.getDate())}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] =
    dateKey.split('-').map(Number)

  return new Date(
    year,
    month - 1,
    day,
  )
}

function formatStudyTime(
  totalMinutes: number,
) {
  if (totalMinutes <= 0) {
    return '0분'
  }

  const hours =
    Math.floor(totalMinutes / 60)

  const minutes =
    totalMinutes % 60

  if (hours === 0) {
    return `${minutes}분`
  }

  if (minutes === 0) {
    return `${hours}시간`
  }

  return `${hours}시간 ${minutes}분`
}

function createDailyStatistics(
  date: Date,
  records: SavedStudyRecord[],
): DailyStatistics {
  const dateKey =
    formatDateKey(date)

  const recordsForDate =
    records.filter(
      (record) =>
        record.date === dateKey,
    )

  const minutes =
    recordsForDate.reduce(
      (total, record) =>
        total +
        Number(
          record.minutes || 0,
        ),
      0,
    )

  const understandingTotal =
    recordsForDate.reduce(
      (total, record) =>
        total +
        Number(
          record.understanding || 0,
        ),
      0,
    )

  const averageUnderstanding =
    recordsForDate.length > 0
      ? understandingTotal /
        recordsForDate.length
      : null

  const subjects = [
    ...new Set(
      recordsForDate.map(
        (record) =>
          record.subject,
      ),
    ),
  ].join(', ')

  return {
    dateKey,
    label: `${
      date.getMonth() + 1
    }/${date.getDate()}`,
    fullLabel:
      date.toLocaleDateString(
        'ko-KR',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        },
      ),
    minutes,
    hours: Number(
      (minutes / 60).toFixed(2),
    ),
    recordCount:
      recordsForDate.length,
    averageUnderstanding,
    subjects,
  }
}

function createRecentDailyStatistics(
  records: SavedStudyRecord[],
  dayCount: number,
) {
  const today = new Date()

  today.setHours(0, 0, 0, 0)

  return Array.from(
    { length: dayCount },
    (_, index) => {
      const date =
        new Date(today)

      date.setDate(
        today.getDate() -
          (dayCount - 1 - index),
      )

      return createDailyStatistics(
        date,
        records,
      )
    },
  )
}

function createHeatmapWeeks(
  records: SavedStudyRecord[],
) {
  const today = new Date()

  today.setHours(0, 0, 0, 0)

  const currentWeekStart =
    new Date(today)

  currentWeekStart.setDate(
    today.getDate() -
      today.getDay(),
  )

  const firstWeekStart =
    new Date(currentWeekStart)

  firstWeekStart.setDate(
    currentWeekStart.getDate() -
      14 * 7,
  )

  return Array.from(
    { length: 15 },
    (_, weekIndex) =>
      Array.from(
        { length: 7 },
        (_, dayIndex) => {
          const date =
            new Date(
              firstWeekStart,
            )

          date.setDate(
            firstWeekStart.getDate() +
              weekIndex * 7 +
              dayIndex,
          )

          const statistics =
            createDailyStatistics(
              date,
              records,
            )

          const isFuture =
            date.getTime() >
            today.getTime()

          let level = 0

          if (
            !isFuture &&
            statistics.recordCount > 0
          ) {
            if (
              statistics.minutes <= 30
            ) {
              level = 1
            } else if (
              statistics.minutes <= 90
            ) {
              level = 2
            } else if (
              statistics.minutes <= 180
            ) {
              level = 3
            } else {
              level = 4
            }
          }

          return {
            ...statistics,
            level,
            isFuture,
          } satisfies HeatmapPoint
        },
      ),
  )
}

function calculateBestStreak(
  records: SavedStudyRecord[],
) {
  const uniqueDates = [
    ...new Set(
      records.map(
        (record) =>
          record.date,
      ),
    ),
  ].sort()

  if (uniqueDates.length === 0) {
    return 0
  }

  const getDayNumber = (
    dateKey: string,
  ) => {
    const [year, month, day] =
      dateKey
        .split('-')
        .map(Number)

    return Math.floor(
      Date.UTC(
        year,
        month - 1,
        day,
      ) / 86_400_000,
    )
  }

  let currentStreak = 1
  let bestStreak = 1

  for (
    let index = 1;
    index < uniqueDates.length;
    index += 1
  ) {
    const previousDay =
      getDayNumber(
        uniqueDates[index - 1],
      )

    const currentDay =
      getDayNumber(
        uniqueDates[index],
      )

    if (
      currentDay -
        previousDay ===
      1
    ) {
      currentStreak += 1

      bestStreak = Math.max(
        bestStreak,
        currentStreak,
      )
    } else {
      currentStreak = 1
    }
  }

  return bestStreak
}

function createSubjectStatistics(
  records: SavedStudyRecord[],
): SubjectStatistics[] {
  const subjectMap =
    new Map<
      string,
      {
        recordCount: number
        totalMinutes: number
        understandingTotal: number
      }
    >()

  records.forEach(
    (record) => {
      const current =
        subjectMap.get(
          record.subject,
        ) ?? {
          recordCount: 0,
          totalMinutes: 0,
          understandingTotal: 0,
        }

      current.recordCount += 1

      current.totalMinutes +=
        Number(
          record.minutes || 0,
        )

      current.understandingTotal +=
        Number(
          record.understanding || 0,
        )

      subjectMap.set(
        record.subject,
        current,
      )
    },
  )

  const totalMinutes =
    records.reduce(
      (total, record) =>
        total +
        Number(
          record.minutes || 0,
        ),
      0,
    )

  return [
    ...subjectMap.entries(),
  ]
    .map(
      ([
        subject,
        statistics,
      ]) => ({
        subject,
        recordCount:
          statistics.recordCount,
        totalMinutes:
          statistics.totalMinutes,
        averageUnderstanding:
          statistics.recordCount > 0
            ? statistics.understandingTotal /
              statistics.recordCount
            : 0,
        percentage:
          totalMinutes > 0
            ? Number(
                (
                  (statistics.totalMinutes /
                    totalMinutes) *
                  100
                ).toFixed(1),
              )
            : 0,
      }),
    )
    .sort(
      (
        firstSubject,
        secondSubject,
      ) =>
        secondSubject.totalMinutes -
        firstSubject.totalMinutes,
    )
}

function formatSubjectAxisLabel(
  value: string,
) {
  const characters =
    Array.from(value)

  if (characters.length <= 11) {
    return value
  }

  return `${characters
    .slice(0, 10)
    .join('')}…`
}

function StudyTimeTooltip({
  active,
  payload,
}: ChartTooltipProps<DailyStatistics>) {
  if (
    !active ||
    !payload?.length
  ) {
    return null
  }

  const statistics =
    payload[0].payload

  return (
    <div className="statistics-chart-tooltip">
      <strong>
        {statistics.fullLabel}
      </strong>

      <span>
        학습시간{' '}
        {formatStudyTime(
          statistics.minutes,
        )}
      </span>

      <span>
        학습 기록{' '}
        {statistics.recordCount}개
      </span>

      {statistics.subjects && (
        <span>
          과목 {statistics.subjects}
        </span>
      )}
    </div>
  )
}

function UnderstandingTooltip({
  active,
  payload,
}: ChartTooltipProps<DailyStatistics>) {
  if (
    !active ||
    !payload?.length
  ) {
    return null
  }

  const statistics =
    payload[0].payload

  if (
    statistics.averageUnderstanding ===
    null
  ) {
    return null
  }

  return (
    <div className="statistics-chart-tooltip">
      <strong>
        {statistics.fullLabel}
      </strong>

      <span>
        평균 이해도{' '}
        {statistics.averageUnderstanding.toFixed(
          1,
        )}{' '}
        / 5
      </span>

      <span>
        학습 기록{' '}
        {statistics.recordCount}개
      </span>
    </div>
  )
}

function SubjectTimeTooltip({
  active,
  payload,
}: ChartTooltipProps<SubjectStatistics>) {
  if (
    !active ||
    !payload?.length
  ) {
    return null
  }

  const subject =
    payload[0].payload

  return (
    <div className="statistics-chart-tooltip">
      <strong>
        {subject.subject}
      </strong>

      <span>
        학습시간{' '}
        {formatStudyTime(
          subject.totalMinutes,
        )}
      </span>

      <span>
        전체 학습의{' '}
        {subject.percentage}%
      </span>

      <span>
        평균 이해도{' '}
        {subject.averageUnderstanding.toFixed(
          1,
        )}{' '}
        / 5
      </span>
    </div>
  )
}

function StatisticsPage() {
  const [
    records,
    setRecords,
  ] = useState<
    SavedStudyRecord[]
  >([])

  const [
    learningStatistics,
    setLearningStatistics,
  ] =
    useState<LearningStatistics | null>(
      null,
    )

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadSavedRecords() {
      try {
        const response =
          await apiFetch(
            '/study-records',
            {
              signal:
                controller.signal,
            },
          )

        const result =
          (await response.json()) as {
            success: boolean
            message?: string
            data?: Array<
              Omit<
                SavedStudyRecord,
                | 'id'
                | 'minutes'
                | 'understanding'
              > & {
                id:
                  | number
                  | string
                minutes:
                  | number
                  | string
                understanding:
                  | number
                  | string
              }
            >
          }

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              '통계 데이터를 불러오지 못했습니다.',
          )
        }

        setRecords(
          (
            result.data ?? []
          ).map(
            (record) => ({
              ...record,
              id: Number(
                record.id,
              ),
              minutes: String(
                record.minutes,
              ),
              understanding:
                Number(
                  record.understanding,
                ),
            }),
          ),
        )
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        console.error(
          '통계 데이터를 불러오지 못했습니다.',
          error,
        )

        setRecords([])
      }
    }

    void loadSavedRecords()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadLearningStatistics() {
      try {
        const response =
          await apiFetch(
            '/statistics/learning?days=30',
            {
              signal:
                controller.signal,
            },
          )

        const result =
          (await response.json()) as {
            success: boolean
            message?: string
            data?: LearningStatistics
          }

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              '학습 통계를 불러오지 못했습니다.',
          )
        }

        setLearningStatistics(
          result.data,
        )
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        console.error(
          '과목별 통계 조회 실패:',
          error,
        )

        setLearningStatistics(
          null,
        )
      }
    }

    void loadLearningStatistics()

    return () => {
      controller.abort()
    }
  }, [])

  const recentStatistics =
    useMemo(
      () =>
        createRecentDailyStatistics(
          records,
          14,
        ),
      [records],
    )

  const heatmapWeeks =
    useMemo(
      () =>
        createHeatmapWeeks(
          records,
        ),
      [records],
    )

  const localSubjectStatistics =
    useMemo(
      () =>
        createSubjectStatistics(
          records,
        ),
      [records],
    )

  const subjectStatistics =
    learningStatistics?.subjects ??
    localSubjectStatistics

  const subjectAxisWidth =
    Math.min(
      190,
      Math.max(
        140,
        subjectStatistics.reduce(
          (longest, statistics) =>
            Math.max(
              longest,
              Array.from(
                formatSubjectAxisLabel(
                  statistics.subject,
                ),
              ).length,
            ),
          0,
        ) *
          13 +
          28,
      ),
    )

  const growthStatistics =
    useMemo(() => {
      if (
        !learningStatistics?.growth
          .length
      ) {
        return recentStatistics
      }

      return learningStatistics.growth.map(
        (growth) => {
          const date =
            parseDateKey(
              growth.date,
            )

          return {
            dateKey: growth.date,
            label: `${
              date.getMonth() + 1
            }/${date.getDate()}`,
            fullLabel:
              date.toLocaleDateString(
                'ko-KR',
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday:
                    'short',
                },
              ),
            minutes:
              growth.totalMinutes,
            hours: Number(
              (
                growth.totalMinutes /
                60
              ).toFixed(2),
            ),
            recordCount:
              growth.recordCount,
            averageUnderstanding:
              growth.averageUnderstanding,
            subjects: '',
          } satisfies DailyStatistics
        },
      )
    }, [
      learningStatistics,
      recentStatistics,
    ])

  const totalMinutes =
    records.reduce(
      (total, record) =>
        total +
        Number(
          record.minutes || 0,
        ),
      0,
    )

  const recentTotalMinutes =
    recentStatistics.reduce(
      (total, day) =>
        total + day.minutes,
      0,
    )

  const activeDays =
    new Set(
      records.map(
        (record) =>
          record.date,
      ),
    ).size

  const averageUnderstanding =
    records.length > 0
      ? records.reduce(
          (total, record) =>
            total +
            Number(
              record.understanding ||
                0,
            ),
          0,
        ) / records.length
      : 0

  const currentGrowthUnderstanding =
    learningStatistics
      ?.growthSummary
      .currentUnderstanding ??
    averageUnderstanding

  const growthChange =
    learningStatistics
      ?.growthSummary.change ?? 0

  const bestStreak =
    calculateBestStreak(
      records,
    )

  return (
    <main className="statistics-page">
      <div className="statistics-container">
        <div className="statistics-topbar">
          <Link
            className="statistics-back-link"
            to="/"
          >
            <ArrowLeft size={17} />
            이번 주로 돌아가기
          </Link>

          <Link
            className="statistics-history-link"
            to="/history"
          >
            <BookOpen size={17} />
            학습 기록 보기
          </Link>
        </div>

        <header className="statistics-heading">
          <span className="statistics-heading-icon">
            <BarChart3 size={26} />
          </span>

          <div>
            <span className="statistics-eyebrow">
              LEARNING INSIGHT
            </span>

            <h1>나의 학습 통계</h1>

            <p>
              저장한 학습 기록을 바탕으로
              공부 흐름과
              <br />
              이해도 변화를 확인해 보세요.
            </p>
          </div>
        </header>

        <section className="statistics-summary">
          <div className="statistics-summary-card">
            <Clock3 size={21} />

            <div>
              <span>
                총 학습시간
              </span>

              <strong>
                {formatStudyTime(
                  totalMinutes,
                )}
              </strong>
            </div>
          </div>

          <div className="statistics-summary-card">
            <CalendarDays
              size={21}
            />

            <div>
              <span>
                활동한 날짜
              </span>

              <strong>
                {activeDays}일
              </strong>
            </div>
          </div>

          <div className="statistics-summary-card">
            <Star size={21} />

            <div>
              <span>
                평균 이해도
              </span>

              <strong>
                {averageUnderstanding.toFixed(
                  1,
                )}{' '}
                / 5
              </strong>
            </div>
          </div>

          <div className="statistics-summary-card">
            <Flame size={21} />

            <div>
              <span>
                최고 연속 기록
              </span>

              <strong>
                {bestStreak}일
              </strong>
            </div>
          </div>
        </section>

        <section className="statistics-chart-grid">
          <article className="statistics-card">
            <div className="statistics-card-heading">
              <div>
                <h2>
                  최근 14일 학습시간
                </h2>

                <p>
                  날짜별로 저장된 총
                  학습시간입니다.
                </p>
              </div>

              <strong>
                {formatStudyTime(
                  recentTotalMinutes,
                )}
              </strong>
            </div>

            <div className="statistics-chart">
              <ResponsiveContainer
                width="100%"
                height={245}
              >
                <BarChart
                  data={
                    recentStatistics
                  }
                  barCategoryGap="32%"
                >
                  <CartesianGrid
                    stroke="#e8e3da"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                    tick={{
                      fontSize: 11,
                      fill: '#99958d',
                    }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={37}
                    tick={{
                      fontSize: 10,
                      fill: '#99958d',
                    }}
                    tickFormatter={(
                      value,
                    ) =>
                      value === 0
                        ? '0'
                        : `${value}h`
                    }
                  />

                  <Tooltip
                    content={
                      <StudyTimeTooltip />
                    }
                    cursor={{
                      fill: '#faf5e9',
                    }}
                  />

                  <Bar
                    dataKey="hours"
                    fill="#1c1c1a"
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="statistics-card">
            <div className="statistics-card-heading">
              <div>
                <h2>
                  나의 성장 추이
                </h2>

                <p>
                  최근 30일의 개인 평균
                  이해도입니다.
                  {growthChange > 0 &&
                    ` 이전보다 ${growthChange.toFixed(
                      1,
                    )}점 상승했어요.`}
                  {growthChange < 0 &&
                    ` 이전보다 ${Math.abs(
                      growthChange,
                    ).toFixed(
                      1,
                    )}점 낮아졌어요.`}
                </p>
              </div>

              <strong>
                {currentGrowthUnderstanding.toFixed(
                  1,
                )}
              </strong>
            </div>

            <div className="statistics-chart">
              <ResponsiveContainer
                width="100%"
                height={245}
              >
                <AreaChart
                  data={
                    growthStatistics
                  }
                >
                  <defs>
                    <linearGradient
                      id="understandingFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#d9942b"
                        stopOpacity={
                          0.24
                        }
                      />

                      <stop
                        offset="100%"
                        stopColor="#d9942b"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#e8e3da"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: '#99958d',
                    }}
                  />

                  <YAxis
                    domain={[1, 5]}
                    allowDecimals={
                      false
                    }
                    axisLine={false}
                    tickLine={false}
                    width={25}
                    tick={{
                      fontSize: 10,
                      fill: '#99958d',
                    }}
                  />

                  <Tooltip
                    content={
                      <UnderstandingTooltip />
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="averageUnderstanding"
                    stroke="#d9942b"
                    strokeWidth={2}
                    fill="url(#understandingFill)"
                    connectNulls
                    dot={{
                      fill: '#d9942b',
                      strokeWidth: 0,
                      r: 4,
                    }}
                    activeDot={{
                      fill: '#1c1c1a',
                      stroke:
                        '#ffffff',
                      strokeWidth: 2,
                      r: 5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="statistics-card statistics-heatmap-card">
          <div className="statistics-card-heading">
            <div>
              <h2>
                학습 히트맵
              </h2>

              <p>
                최근 15주의 날짜별
                학습 활동입니다.
              </p>
            </div>

            <div className="statistics-heatmap-legend">
              <span>적음</span>

              {[
                0,
                1,
                2,
                3,
                4,
              ].map(
                (level) => (
                  <i
                    data-level={
                      level
                    }
                    key={level}
                  />
                ),
              )}

              <span>많음</span>
            </div>
          </div>

          <div className="statistics-heatmap-scroll">
            <div className="statistics-heatmap-grid">
              {heatmapWeeks.map(
                (
                  week,
                  weekIndex,
                ) => (
                  <div
                    className="statistics-heatmap-week"
                    key={
                      weekIndex
                    }
                  >
                    {week.map(
                      (point) => (
                        <button
                          type="button"
                          className="statistics-heatmap-cell"
                          data-level={
                            point.level
                          }
                          data-future={
                            point.isFuture
                          }
                          key={
                            point.dateKey
                          }
                          title={`${point.fullLabel} · ${formatStudyTime(
                            point.minutes,
                          )} · 기록 ${point.recordCount}개`}
                          aria-label={`${point.fullLabel}, 학습시간 ${formatStudyTime(
                            point.minutes,
                          )}, 기록 ${point.recordCount}개`}
                        >
                          {!point.isFuture && (
                            <span className="statistics-heatmap-tooltip">
                              <strong>
                                {
                                  point.fullLabel
                                }
                              </strong>

                              <span>
                                학습시간{' '}
                                {formatStudyTime(
                                  point.minutes,
                                )}
                              </span>

                              <span>
                                학습 기록{' '}
                                {
                                  point.recordCount
                                }
                                개
                              </span>

                              {point.averageUnderstanding !==
                                null && (
                                <span>
                                  평균
                                  이해도{' '}
                                  {point.averageUnderstanding.toFixed(
                                    1,
                                  )}{' '}
                                  / 5
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="statistics-heatmap-summary">
            <div>
              <strong>
                {activeDays}
              </strong>
              <span>
                활동한 날짜
              </span>
            </div>

            <div>
              <strong>
                {bestStreak}일
              </strong>
              <span>
                최고 연속 기록
              </span>
            </div>

            <div>
              <strong>
                {records.length}개
              </strong>
              <span>
                전체 학습 기록
              </span>
            </div>

            <div>
              <strong>
                {formatStudyTime(
                  totalMinutes,
                )}
              </strong>
              <span>
                총 학습시간
              </span>
            </div>
          </div>
        </section>

        <section className="statistics-card statistics-subject-card">
          <div className="statistics-card-heading">
            <div>
              <h2>
                과목별 공부시간
              </h2>

              <p>
                최근 30일 동안 어떤 과목을
                얼마나 공부했는지 비교합니다.
              </p>
            </div>

            <strong>
              {formatStudyTime(
                learningStatistics
                  ?.totalMinutes ??
                  totalMinutes,
              )}
            </strong>
          </div>

          {subjectStatistics.length ===
          0 ? (
            <div className="statistics-empty">
              아직 통계로 표시할 학습
              기록이 없습니다.
            </div>
          ) : (
            <>
              <div className="statistics-chart">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(
                    230,
                    subjectStatistics.length *
                      58,
                  )}
                >
                  <BarChart
                    data={
                      subjectStatistics
                    }
                    layout="vertical"
                    margin={{
                      top: 10,
                      right: 25,
                      bottom: 10,
                      left: 12,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e8e3da"
                      horizontal={
                        false
                      }
                    />

                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fill: '#99958d',
                      }}
                      tickFormatter={(
                        value,
                      ) =>
                        formatStudyTime(
                          Number(
                            value,
                          ),
                        )
                      }
                    />

                    <YAxis
                      type="category"
                      dataKey="subject"
                      axisLine={false}
                      tickLine={false}
                      width={
                        subjectAxisWidth
                      }
                      tick={{
                        fontSize: 12,
                        fill: '#57544d',
                      }}
                      tickFormatter={
                        formatSubjectAxisLabel
                      }
                    />

                    <Tooltip
                      content={
                        <SubjectTimeTooltip />
                      }
                      cursor={{
                        fill: '#faf5e9',
                      }}
                    />

                    <Bar
                      dataKey="totalMinutes"
                      fill="#1c1c1a"
                      radius={[
                        0,
                        5,
                        5,
                        0,
                      ]}
                      barSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="statistics-table-scroll">
                <table className="statistics-subject-table">
                  <thead>
                    <tr>
                      <th>과목</th>
                      <th>기록 수</th>
                      <th>
                        학습시간
                      </th>
                      <th>
                        학습 비율
                      </th>
                      <th>
                        평균 이해도
                      </th>
                      <th>
                        이해도 분포
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {subjectStatistics.map(
                      (subject) => (
                        <tr
                          key={
                            subject.subject
                          }
                        >
                          <td>
                            <strong>
                              {
                                subject.subject
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              subject.recordCount
                            }
                            개
                          </td>

                          <td>
                            {formatStudyTime(
                              subject.totalMinutes,
                            )}
                          </td>

                          <td>
                            {
                              subject.percentage
                            }
                            %
                          </td>

                          <td>
                            {subject.averageUnderstanding.toFixed(
                              1,
                            )}{' '}
                            / 5
                          </td>

                          <td>
                            <div className="statistics-subject-progress">
                              <span
                                style={{
                                  width: `${
                                    subject.averageUnderstanding *
                                    20
                                  }%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default StatisticsPage
