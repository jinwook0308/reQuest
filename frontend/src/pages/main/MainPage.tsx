import {
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type DragEvent,
} from 'react'

import { useNavigate } from 'react-router'


import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Leaf,
  Link2,
  PieChart,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  Upload,
  UserRound,
} from 'lucide-react'

import './MainPage.css'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'

type StudyTask = {
  id: number
  label: string
  done: boolean
}

type StudyDay = {
  id: number
  day: string
  date: string
  title: string
  tasks: StudyTask[]
}

type SavedStudyRecord = {
  id?: number
  date: string
  subject: string
  unit: string
  minutes: string
  learned: string
  difficult: string
  keywords: string
  understanding: number
}

const navigationItems = [
  '이번 주',
  '학습 기록',
  '오답 노트',
  'AI 복습',
  '통계',
  '가이드',
]

const journeySteps = [
  { number: 1, label: '계획', completed: true },
  { number: 2, label: '학습', completed: true },
  { number: 3, label: '기록', current: true },
  { number: 4, label: 'AI 분석' },
  { number: 5, label: '복습 퀘스트' },
  { number: 6, label: '마스터' },
]

const initialDays: StudyDay[] = [
  {
    id: 1,
    day: '일',
    date: '7/20',
    title: '지수와 로그 개념 정리',
    tasks: [
      { id: 1, label: '개념 정리', done: true },
      { id: 2, label: '예제 풀이', done: true },
      { id: 3, label: '오답 기록', done: true },
      { id: 4, label: '복습 퀘스트', done: true },
    ],
  },
  {
    id: 2,
    day: '월',
    date: '7/21',
    title: '삼각함수의 기본 정리',
    tasks: [
      { id: 1, label: '개념 정리', done: true },
      { id: 2, label: '예제 풀이', done: true },
      { id: 3, label: '오답 기록', done: true },
      { id: 4, label: '복습 퀘스트', done: true },
    ],
  },
  {
    id: 3,
    day: '화',
    date: '7/22',
    title: '이차함수 기본 개념',
    tasks: [
      { id: 1, label: '개념 정리', done: true },
      { id: 2, label: '예제 풀이', done: true },
      { id: 3, label: '오답 기록', done: true },
      { id: 4, label: '복습 퀘스트', done: false },
    ],
  },
  {
    id: 4,
    day: '수',
    date: '7/23',
    title: '이차함수 그래프 이동',
    tasks: [
      { id: 1, label: '개념 정리', done: true },
      { id: 2, label: '예제 풀이', done: false },
      { id: 3, label: '오답 기록', done: false },
      { id: 4, label: '복습 퀘스트', done: false },
    ],
  },
  {
    id: 5,
    day: '목',
    date: '7/24',
    title: '이차함수의 최대·최소',
    tasks: [
      { id: 1, label: '개념 정리', done: false },
      { id: 2, label: '예제 풀이', done: false },
      { id: 3, label: '오답 기록', done: false },
      { id: 4, label: '복습 퀘스트', done: false },
    ],
  },
  {
    id: 6,
    day: '금',
    date: '7/25',
    title: '이차함수와 실생활 문제',
    tasks: [
      { id: 1, label: '개념 정리', done: false },
      { id: 2, label: '예제 풀이', done: false },
      { id: 3, label: '오답 기록', done: false },
      { id: 4, label: '복습 퀘스트', done: false },
    ],
  },
  {
    id: 7,
    day: '토',
    date: '7/26',
    title: '주간 복습 및 취약 개념 정리',
    tasks: [
      { id: 1, label: '개념 정리', done: false },
      { id: 2, label: '예제 풀이', done: false },
      { id: 3, label: '오답 기록', done: false },
      { id: 4, label: '복습 퀘스트', done: false },
    ],
  },
]

const streakDays = ['목', '금', '토', '일', '월', '화', '수']


function getWeekStart(baseDate: Date, weekOffset: number) {
  const weekStart = new Date(baseDate)

  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(
    weekStart.getDate() -
      weekStart.getDay() +
      weekOffset * 7,
  )

  return weekStart
}

function formatNumber(value: number) {
  return String(value).padStart(2, '0')
}

function formatWeekRange(startDate: Date, endDate: Date) {
  const startText = `${startDate.getFullYear()}.${formatNumber(
    startDate.getMonth() + 1,
  )}.${formatNumber(startDate.getDate())}`

  const endText =
    startDate.getFullYear() === endDate.getFullYear()
      ? `${formatNumber(
          endDate.getMonth() + 1,
        )}.${formatNumber(endDate.getDate())}`
      : `${endDate.getFullYear()}.${formatNumber(
          endDate.getMonth() + 1,
        )}.${formatNumber(endDate.getDate())}`

  return `${startText} — ${endText}`
}

function formatDayDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
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


function MainPage() {
  const navigate = useNavigate()

  const [days, setDays] = useState(initialDays)
  const [activeDay, setActiveDay] = useState(
    new Date().getDay(),
  )
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)
  const [questRequested, setQuestRequested] = useState(false)

  const [savedRecords, setSavedRecords] = useState<
  SavedStudyRecord[]
>([])

  const today = new Date()
  const weekStart = getWeekStart(today, weekOffset)
  const weekEnd = new Date(weekStart)

  weekEnd.setDate(weekStart.getDate() + 6)

  const weekRangeText = formatWeekRange(weekStart, weekEnd)

  const displayedDates = days.map((_, dayIndex) => {
    const date = new Date(weekStart)

    date.setDate(weekStart.getDate() + dayIndex)

    return date
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudyRecords() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/study-records`,
          { signal: controller.signal },
        )
        const result = (await response.json()) as {
          success: boolean
          message?: string
          data?: Array<
            Omit<SavedStudyRecord, 'minutes'> & {
              id: number | string
              minutes: number | string
              understanding: number | string
            }
          >
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              '학습 기록을 불러오지 못했습니다.',
          )
        }

        setSavedRecords(
          (result.data ?? []).map((record) => ({
            ...record,
            id: Number(record.id),
            minutes: String(record.minutes),
            understanding: Number(
              record.understanding,
            ),
          })),
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        console.error(
          '학습 기록을 불러오지 못했습니다.',
          error,
        )
        setSavedRecords([])
      }
    }

    void loadStudyRecords()

    return () => controller.abort()
  }, [])


  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleTask = (dayIndex: number, taskIndex: number) => {
    setDays((previousDays) =>
      previousDays.map((day, currentDayIndex) => {
        if (currentDayIndex !== dayIndex) {
          return day
        }

        return {
          ...day,
          tasks: day.tasks.map((task, currentTaskIndex) =>
            currentTaskIndex === taskIndex
              ? { ...task, done: !task.done }
              : task,
          ),
        }
      }),
    )
  }

  const getDayStatus = (day: StudyDay) => {
    const completedCount = day.tasks.filter((task) => task.done).length

    if (completedCount === day.tasks.length) {
      return {
        label: '완료',
        className: 'complete',
      }
    }

    if (completedCount >= 2) {
      return {
        label: '부분 완료',
        className: 'partial',
      }
    }

    if (completedCount === 1) {
      return {
        label: '진행 중',
        className: 'progress',
      }
    }

    return {
      label: '예정',
      className: 'planned',
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()

    const file = event.dataTransfer.files?.[0]

    if (file) {
      setSelectedFile(file)
    }
  }

  const handleCreateWrongNote = () => {
  if (!selectedFile) {
    fileInputRef.current?.click()
    return
  }

  if (!selectedFile.type.startsWith('image/')) {
    window.alert(
      '현재 MVP에서는 JPG 또는 PNG 이미지만 사용할 수 있습니다.',
    )
    return
  }

  if (selectedFile.size > 1024 * 1024) {
    window.alert(
      '현재 MVP에서는 1MB 이하 이미지를 선택해 주세요.',
    )
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      window.alert('이미지를 불러오지 못했습니다.')
      return
    }

    setQuestRequested(true)

    navigate('/wrong-notes/new', {
      state: {
        wrongImage: reader.result,
        wrongImageName: selectedFile.name,
      },
    })
  }

  reader.onerror = () => {
    window.alert('이미지를 불러오지 못했습니다.')
  }

  reader.readAsDataURL(selectedFile)
}


  return (
    <div className="main-page">
      <header className="top-header">
        <a className="brand" href="/" aria-label="reQuest 홈">
          <span className="brand-icon">
            <BookOpen size={29} strokeWidth={1.7} />
            <span className="brand-bookmark" />
          </span>

          <span className="brand-name">reQuest</span>
        </a>

        <nav className="main-navigation" aria-label="주요 메뉴">
          {navigationItems.map((item, index) => (
           <button
                type="button"
                className={`navigation-item ${
                    index === 0 ? 'is-active' : ''
                }`}
                key={item}
                onClick={() => {
                    if (item === '이번 주') {
                    navigate('/')
                    }

                    if (item === '학습 기록') {
                    navigate('/history')
                    }

                    if (item === '통계') {
                        navigate('/statistics')
                    }

                    if (item === '오답 노트') {
                        navigate('/wrong-notes')
                    }
                }}
                >
                {item}
                </button>
          ))}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="header-icon-button"
            aria-label="검색"
          >
            <Search size={21} />
          </button>

          <button
            type="button"
            className="header-icon-button notification-button"
            aria-label="알림"
          >
            <Bell size={20} />

            <span className="notification-dot" />
          </button>

          <button type="button" className="profile-button">
            <span className="profile-image">
              <UserRound size={22} />
            </span>

            <span className="profile-name">학습자님</span>

            <ChevronDown size={15} />
          </button>
        </div>
      </header>

      <main className="dashboard-container">
        <section className="week-toolbar">
          <div className="week-navigation">
            <button
                type="button"
                className="week-move-button"
                onClick={() =>
                    setWeekOffset((previousOffset) => previousOffset - 1)
                }
                >
                <ChevronLeft size={17} />
                이전 주
                </button>

                <strong className="week-range">
                {weekRangeText}
                </strong>

                <button
                type="button"
                className="week-move-button"
                onClick={() =>
                    setWeekOffset((previousOffset) => previousOffset + 1)
                }
                >
                다음 주
                <ChevronRight size={17} />
                </button>

                <button
                type="button"
                className="today-button"
                onClick={() => {
                    setWeekOffset(0)
                    setActiveDay(new Date().getDay())
                }}
                >
                오늘
            </button>
          </div>

          <button
            type="button"
            className="start-study-button"
            onClick={() => navigate('/records')}
          >
            <Plus size={18} />
            오늘의 학습 기록 시작
          </button>
        </section>

        <div className="dashboard-grid">
          <div className="dashboard-primary">
            <section className="planner-card">
              <div className="planner-intro">
                <span className="paperclip" aria-hidden="true" />

                <div className="intro-copy">
                  <h1>
                    이번 주, 무엇을
                    <br />
                    이해하고 싶은가요?
                  </h1>

                  <p>
                    수학의 이차함수 개념을 정확히 이해하고,
                    <br />
                    오답 원인을 스스로 설명할 수 있도록 학습합니다.
                  </p>
                </div>

                <div className="weekly-goal-note">
                  <span className="note-tape" />

                  <span className="goal-label">WEEKLY GOAL</span>

                  <p>
                    이차함수의 그래프 이동과
                    <br />
                    성질을 완벽히 이해하기
                  </p>

                  <Target
                    className="goal-target-icon"
                    size={48}
                    strokeWidth={1.2}
                  />
                </div>

                <div className="journey-section">
                  <span className="journey-title">나의 학습 여정</span>

                  <ol className="journey-steps">
                    {journeySteps.map((step) => (
                      <li
                        className={`journey-step ${
                          step.completed ? 'completed' : ''
                        } ${step.current ? 'current' : ''}`}
                        key={step.number}
                      >
                        <span className="journey-circle">
                          {step.completed ? (
                            <Check size={13} strokeWidth={2.5} />
                          ) : (
                            step.number
                          )}
                        </span>

                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="week-table-scroll">
                <div className="week-table">
                 {days.map((day, dayIndex) => {
                        const displayedDate = displayedDates[dayIndex]
                        const dateKey = formatDateKey(displayedDate)

                        const recordsForDay = savedRecords.filter(
                            (record) => record.date === dateKey,
                        )

                        const latestRecord =
                            recordsForDay[recordsForDay.length - 1]

                        const isCurrentWeek = weekOffset === 0

                        const baseTasks = isCurrentWeek
                            ? day.tasks
                            : day.tasks.map((task) => ({
                                ...task,
                                done: false,
                            }))

                        const displayTasks = baseTasks.map((task) =>
                            task.id === 3 && recordsForDay.length > 0
                            ? {
                                ...task,
                                done: true,
                                }
                            : task,
                        )

                        let displayTitle = isCurrentWeek
                            ? day.title
                            : '학습 계획 없음'

                        if (latestRecord) {
                            const recordTitle =
                            latestRecord.unit.trim() ||
                            `${latestRecord.subject} 학습`

                            displayTitle =
                            recordsForDay.length > 1
                                ? `${recordTitle} 외 ${recordsForDay.length - 1}개`
                                : recordTitle
                        }

                        const displayDay: StudyDay = {
                            ...day,
                            title: displayTitle,
                            tasks: displayTasks,
                        }

                        const completedCount = displayTasks.filter(
                            (task) => task.done,
                        ).length

                        const progress =
                            (completedCount / displayTasks.length) * 100

                        const status = getDayStatus(displayDay)

    return (
        <article
        className={`study-day ${
            activeDay === dayIndex ? 'is-selected' : ''
        }`}
        key={`${day.id}-${dateKey}`}
        >
        <button
            type="button"
            className="day-header"
            onClick={() => setActiveDay(dayIndex)}
        >
            <span className="day-name">
            {day.day}

            {isSameDate(displayedDate, today) && (
                <span className="today-badge">오늘</span>
            )}
            </span>

            <span className="day-date">
            {formatDayDate(displayedDate)}
            </span>
        </button>

        <div className={`day-status ${status.className}`}>
            <span className="status-dot" />
            {status.label}
        </div>

        <h2>{displayTitle}</h2>

        <div className="task-list">
            {displayTasks.map((task, taskIndex) => (
            <div className="task-item" key={task.id}>
                <button
                type="button"
                className={`task-checkbox ${
                    task.done ? 'is-checked' : ''
                }`}
                aria-label={`${task.label} ${
                    task.done ? '완료 취소' : '완료'
                }`}
                aria-pressed={task.done}
                disabled={!isCurrentWeek}
                onClick={() =>
                    toggleTask(dayIndex, taskIndex)
                }
                >
                {task.done && (
                    <Check size={11} strokeWidth={2.8} />
                )}
                </button>

                <span>{task.label}</span>
            </div>
            ))}
      </div>

      <div className="day-progress">
        <span>
          {completedCount} / {displayTasks.length} 완료
        </span>

        <div className="progress-track">
          <span
            className={`progress-value ${status.className}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </article>
  )
})}
                </div>
              </div>

             <button
                type="button"
                className="add-study-button"
                onClick={() => navigate('/records')}
              >
                <Plus size={17} />
                학습 항목 추가
              </button>
            </section>

            <section className="weekly-summary">
              <div className="encouragement">
                <span className="encouragement-icon">
                  <Leaf size={27} />
                </span>

                <div>
                  <strong>오늘도 꾸준한 한 걸음!</strong>

                  <p>
                    이해는 하루아침에 완성되지 않아요.
                    <br />
                    작은 복습이 큰 성장을 만듭니다.
                  </p>
                </div>
              </div>

              <div className="summary-item">
                <Clock size={21} />

                <div>
                  <span>이번 주 학습 시간</span>
                  <strong>12h 30m</strong>
                </div>
              </div>

              <div className="summary-item">
                <Bookmark size={21} />

                <div>
                  <span>완료한 퀘스트</span>
                  <strong>5개</strong>
                </div>
              </div>

              <div className="summary-item">
                <PieChart size={21} />

                <div>
                  <span>평균 정답률</span>
                  <strong>78%</strong>
                </div>
              </div>

              <div className="summary-item">
                <Star size={21} />

                <div>
                  <span>획득 XP</span>
                  <strong>850 XP</strong>
                </div>
              </div>
            </section>
          </div>

          <aside className="dashboard-sidebar">
            <section className="lab-card">
              <div className="card-heading">
                <Sparkles size={19} />

                <h2>reQuest Lab</h2>
              </div>

              <p className="lab-description">
                AI가 당신의 학습을 분석하고 맞춤형 복습을 제안해요.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleFileChange}
                hidden
              />

              <button
                type="button"
                className={`upload-zone ${
                  selectedFile ? 'has-file' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <span className="upload-icon">
                  <Upload size={27} />
                </span>

                {selectedFile ? (
                  <>
                    <strong>{selectedFile.name}</strong>
                    <span>파일이 선택되었습니다.</span>
                  </>
                ) : (
                  <>
                    <strong>
                      오답 문제 이미지를 끌어다 놓거나
                      <br />
                      클릭하여 업로드하세요
                    </strong>

                    <span>JPG, PNG 최대 10MB</span>
                  </>
                )}
              </button>

              <div className="analysis-heading">
                <strong>오늘의 AI 분석 상태</strong>

                <span>업데이트: 방금 전</span>
              </div>

              <div className="analysis-list">
                <div className="analysis-item">
                  <span className="analysis-icon">
                    <Link2 size={16} />
                  </span>

                  <span>분석된 개념</span>

                  <strong>이차함수, 그래프 이동</strong>
                </div>

                <div className="analysis-item">
                  <span className="analysis-icon">
                    <Brain size={16} />
                  </span>

                  <span>취약한 개념</span>

                  <strong>그래프 평행이동, 축 이동</strong>
                </div>

                <div className="analysis-item">
                  <span className="analysis-icon">
                    <Sparkles size={16} />
                  </span>

                  <span>추천 복습 퀘스트</span>

                  <strong>3개 생성 가능</strong>
                </div>
              </div>

              <button
                type="button"
                className={`generate-quest-button ${
                  questRequested ? 'is-requested' : ''
                }`}
                onClick={handleCreateWrongNote}
              >
                {questRequested
                  ? '퀘스트 생성 준비 완료'
                  : 'AI 복습 퀘스트 생성하기'}

                {questRequested ? (
                  <Check size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            </section>

            <section className="streak-card">
              <div className="streak-title">
                <Flame size={18} />

                <strong>연속 학습 중!</strong>
              </div>

              <div className="streak-number">7</div>

              <span className="streak-unit">일 연속</span>

              <div className="streak-week">
                {streakDays.map((day, index) => (
                  <div className="streak-day" key={`${day}-${index}`}>
                    <span>{day}</span>

                    <span
                      className={`streak-check ${
                        index === streakDays.length - 1
                          ? 'is-today'
                          : 'is-complete'
                      }`}
                    >
                      {index < streakDays.length - 1 && (
                        <Check size={11} strokeWidth={3} />
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="streak-best">
                최고 기록 <strong>12일</strong>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default MainPage
