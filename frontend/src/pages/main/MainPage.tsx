import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowRight,
  Bookmark,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Leaf,
  Link2,
  Pencil,
  PieChart,
  Play,
  Plus,
  Save,
  Sparkles,
  Star,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { apiFetch } from '../../lib/api'
import './MainPage.css'

type DailyGoal = {
  id: string
  date: string
  content: string
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

type StreakDay = {
  date: string
  dayLabel: string
  active: boolean
  isToday: boolean
}

type StudyStreak = {
  currentStreak: number
  bestStreak: number
  recentDays: StreakDay[]
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

const journeySteps = [
  { number: 1, label: '계획', completed: true },
  { number: 2, label: '학습', completed: true },
  { number: 3, label: '기록', current: true },
  { number: 4, label: 'AI 분석' },
  { number: 5, label: '복습 퀘스트' },
  { number: 6, label: '마스터' },
]

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function formatNumber(value: number) {
  return String(value).padStart(2, '0')
}

function getKoreaDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${formatNumber(
    date.getMonth() + 1,
  )}-${formatNumber(date.getDate())}`
}

function getWeekStart(todayKey: string, weekOffset: number) {
  const weekStart = parseDateKey(todayKey)

  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7)

  return weekStart
}

function formatWeekRange(startDate: Date, endDate: Date) {
  const startText = `${startDate.getFullYear()}.${formatNumber(
    startDate.getMonth() + 1,
  )}.${formatNumber(startDate.getDate())}`
  const endText =
    startDate.getFullYear() === endDate.getFullYear()
      ? `${formatNumber(endDate.getMonth() + 1)}.${formatNumber(endDate.getDate())}`
      : `${endDate.getFullYear()}.${formatNumber(
          endDate.getMonth() + 1,
        )}.${formatNumber(endDate.getDate())}`

  return `${startText} — ${endText}`
}

function formatDayDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function getDayStatus(goals: DailyGoal[]) {
  const completedCount = goals.filter((goal) => goal.isCompleted).length

  if (goals.length === 0) {
    return { label: '목표 없음', className: 'planned' }
  }
  if (completedCount === goals.length) {
    return { label: '완료', className: 'complete' }
  }
  if (completedCount > 0) {
    return { label: '부분 완료', className: 'partial' }
  }
  return { label: '예정', className: 'progress' }
}

function MainPage() {
  const navigate = useNavigate()
  const todayKey = getKoreaDateKey()

  const [activeDay, setActiveDay] = useState(parseDateKey(todayKey).getDay())
  const [weekOffset, setWeekOffset] = useState(0)
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [goalInput, setGoalInput] = useState('')
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null)
  const [isCreatingGoal, setIsCreatingGoal] = useState(false)
  const [goalsLoading, setGoalsLoading] = useState(true)
  const [goalError, setGoalError] = useState('')
  const [streak, setStreak] = useState<StudyStreak>({
    currentStreak: 0,
    bestStreak: 0,
    recentDays: [],
  })
  const [streakLoading, setStreakLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [questRequested, setQuestRequested] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const weekStart = useMemo(
    () => getWeekStart(todayKey, weekOffset),
    [todayKey, weekOffset],
  )
  const displayedDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + dayIndex)
        return date
      }),
    [weekStart],
  )
  const weekEnd = displayedDates[6] ?? weekStart
  const weekRangeText = formatWeekRange(weekStart, weekEnd)
  const selectedDate = displayedDates[activeDay] ?? displayedDates[0]
  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : todayKey

  const loadDailyGoals = useCallback(
    async (signal?: AbortSignal) => {
      const startDate = formatDateKey(weekStart)
      const endDate = formatDateKey(weekEnd)
      setGoalsLoading(true)
      setGoalError('')

      try {
        const response = await apiFetch(
          `/daily-goals?startDate=${encodeURIComponent(
            startDate,
          )}&endDate=${encodeURIComponent(endDate)}`,
          { signal },
        )
        const result = (await response.json()) as ApiResponse<DailyGoal[]>

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? '하루 목표를 불러오지 못했습니다.')
        }

        setDailyGoals(result.data ?? [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setDailyGoals([])
        setGoalError(
          error instanceof Error ? error.message : '하루 목표를 불러오지 못했습니다.',
        )
      } finally {
        if (!signal?.aborted) {
          setGoalsLoading(false)
        }
      }
    },
    [weekEnd, weekStart],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadDailyGoals(controller.signal)
    return () => controller.abort()
  }, [loadDailyGoals])

  useEffect(() => {
    const controller = new AbortController()

    async function loadStreak() {
      setStreakLoading(true)

      try {
        const response = await apiFetch('/statistics/streak', {
          signal: controller.signal,
        })
        const result = (await response.json()) as ApiResponse<StudyStreak>

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? '연속 학습 기록을 불러오지 못했습니다.')
        }

        setStreak(result.data)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.error('연속 학습 기록 조회 실패:', error)
      } finally {
        if (!controller.signal.aborted) {
          setStreakLoading(false)
        }
      }
    }

    void loadStreak()
    return () => controller.abort()
  }, [])

  const updateGoal = async (
    goalId: string,
    changes: { content?: string; isCompleted?: boolean },
  ) => {
    setBusyGoalId(goalId)
    setGoalError('')

    try {
      const response = await apiFetch(`/daily-goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const result = (await response.json()) as ApiResponse<{
        goal: DailyGoal
      }>

      if (!response.ok || !result.success || !result.data?.goal) {
        throw new Error(result.message ?? '하루 목표를 수정하지 못했습니다.')
      }

      const updatedGoal = result.data.goal
      setDailyGoals((previous) =>
        previous.map((goal) => (goal.id === goalId ? updatedGoal : goal)),
      )
      return true
    } catch (error) {
      setGoalError(
        error instanceof Error ? error.message : '하루 목표를 수정하지 못했습니다.',
      )
      return false
    } finally {
      setBusyGoalId(null)
    }
  }

  const handleAddGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = goalInput.trim()

    if (!content || isCreatingGoal) return

    setIsCreatingGoal(true)
    setGoalError('')

    try {
      const response = await apiFetch('/daily-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDateKey, content }),
      })
      const result = (await response.json()) as ApiResponse<{
        goal: DailyGoal
      }>

      if (!response.ok || !result.success || !result.data?.goal) {
        throw new Error(result.message ?? '하루 목표를 추가하지 못했습니다.')
      }

      const createdGoal = result.data.goal
      setDailyGoals((previous) => [...previous, createdGoal])
      setGoalInput('')
    } catch (error) {
      setGoalError(
        error instanceof Error ? error.message : '하루 목표를 추가하지 못했습니다.',
      )
    } finally {
      setIsCreatingGoal(false)
    }
  }

  const handleSaveEdit = async (goalId: string) => {
    const content = editingContent.trim()

    if (!content) {
      setGoalError('하루 목표 내용을 입력해 주세요.')
      return
    }

    const updated = await updateGoal(goalId, { content })
    if (updated) {
      setEditingGoalId(null)
      setEditingContent('')
    }
  }

  const handleDeleteGoal = async (goal: DailyGoal) => {
    if (!window.confirm(`“${goal.content}” 목표를 삭제할까요?`)) return

    setBusyGoalId(goal.id)
    setGoalError('')

    try {
      const response = await apiFetch(`/daily-goals/${goal.id}`, {
        method: 'DELETE',
      })
      const result = (await response.json()) as ApiResponse<{ id: string }>

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? '하루 목표를 삭제하지 못했습니다.')
      }

      setDailyGoals((previous) => previous.filter((item) => item.id !== goal.id))
      if (editingGoalId === goal.id) setEditingGoalId(null)
    } catch (error) {
      setGoalError(
        error instanceof Error ? error.message : '하루 목표를 삭제하지 못했습니다.',
      )
    } finally {
      setBusyGoalId(null)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null)
  }

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleCreateWrongNote = () => {
    if (!selectedFile) {
      fileInputRef.current?.click()
      return
    }
    if (!selectedFile.type.startsWith('image/')) {
      window.alert('현재 MVP에서는 JPG 또는 PNG 이미지만 사용할 수 있습니다.')
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      window.alert('10MB 이하 이미지를 선택해 주세요.')
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
    reader.onerror = () => window.alert('이미지를 불러오지 못했습니다.')
    reader.readAsDataURL(selectedFile)
  }

  return (
    <div className="main-page">
      <main className="dashboard-container">
        <section className="week-toolbar">
          <div className="week-navigation">
            <button
              type="button"
              className="week-move-button"
              onClick={() => setWeekOffset((offset) => offset - 1)}
            >
              <ChevronLeft size={17} /> 이전 주
            </button>
            <strong className="week-range">{weekRangeText}</strong>
            <button
              type="button"
              className="week-move-button"
              onClick={() => setWeekOffset((offset) => offset + 1)}
            >
              다음 주 <ChevronRight size={17} />
            </button>
            <button
              type="button"
              className="today-button"
              onClick={() => {
                setWeekOffset(0)
                setActiveDay(parseDateKey(todayKey).getDay())
              }}
            >
              오늘
            </button>
          </div>

          <div className="week-toolbar-actions">
            <button
              type="button"
              className="focus-study-button"
              onClick={() => navigate('/focus')}
            >
              <Play size={17} fill="currentColor" /> 공부 시작
            </button>
            <button
              type="button"
              className="start-study-button"
              onClick={() => navigate('/records')}
            >
              <Plus size={18} /> 오늘의 학습 기록 시작
            </button>
          </div>
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
                    날짜별 하루 목표를 직접 정하고,
                    <br />
                    작은 할 일부터 차근차근 완료해 보세요.
                  </p>
                </div>
                <div className="weekly-goal-note">
                  <span className="note-tape" />
                  <span className="goal-label">DAILY GOALS</span>
                  <p>
                    학습 기록과 별도로
                    <br />
                    나만의 계획을 관리하기
                  </p>
                  <Target className="goal-target-icon" size={48} strokeWidth={1.2} />
                </div>
                <div className="journey-section">
                  <span className="journey-title">나의 학습 여정</span>
                  <ol className="journey-steps">
                    {journeySteps.map((step) => (
                      <li
                        className={`journey-step ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}
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
                  {displayedDates.map((displayedDate, dayIndex) => {
                    const dateKey = formatDateKey(displayedDate)
                    const goalsForDay = dailyGoals.filter((goal) => goal.date === dateKey)
                    const completedCount = goalsForDay.filter(
                      (goal) => goal.isCompleted,
                    ).length
                    const progress = goalsForDay.length
                      ? (completedCount / goalsForDay.length) * 100
                      : 0
                    const status = getDayStatus(goalsForDay)

                    return (
                      <article
                        className={`study-day ${activeDay === dayIndex ? 'is-selected' : ''}`}
                        key={dateKey}
                      >
                        <button
                          type="button"
                          className="day-header"
                          onClick={() => setActiveDay(dayIndex)}
                        >
                          <span className="day-name">
                            {DAY_LABELS[dayIndex]}
                            {dateKey === todayKey && (
                              <span className="today-badge">오늘</span>
                            )}
                          </span>
                          <span className="day-date">{formatDayDate(displayedDate)}</span>
                        </button>
                        <div className={`day-status ${status.className}`}>
                          <span className="status-dot" />
                          {status.label}
                        </div>
                        <h2>하루 목표 {goalsForDay.length}개</h2>

                        <div className="task-list daily-goal-list">
                          {goalsLoading ? (
                            <p className="daily-goal-empty">불러오는 중...</p>
                          ) : goalsForDay.length === 0 ? (
                            <p className="daily-goal-empty">등록한 목표가 없습니다.</p>
                          ) : (
                            goalsForDay.map((goal) => (
                              <div className="task-item daily-goal-item" key={goal.id}>
                                <button
                                  type="button"
                                  className={`task-checkbox ${goal.isCompleted ? 'is-checked' : ''}`}
                                  aria-label={`${goal.content} ${goal.isCompleted ? '완료 취소' : '완료'}`}
                                  aria-pressed={goal.isCompleted}
                                  disabled={busyGoalId === goal.id}
                                  onClick={() =>
                                    void updateGoal(goal.id, {
                                      isCompleted: !goal.isCompleted,
                                    })
                                  }
                                >
                                  {goal.isCompleted && (
                                    <Check size={11} strokeWidth={2.8} />
                                  )}
                                </button>

                                {editingGoalId === goal.id ? (
                                  <div className="daily-goal-edit-row">
                                    <input
                                      value={editingContent}
                                      maxLength={300}
                                      aria-label="하루 목표 내용 수정"
                                      autoFocus
                                      onChange={(event) =>
                                        setEditingContent(event.target.value)
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault()
                                          void handleSaveEdit(goal.id)
                                        }
                                        if (event.key === 'Escape') setEditingGoalId(null)
                                      }}
                                    />
                                    <button
                                      type="button"
                                      aria-label="수정 저장"
                                      disabled={busyGoalId === goal.id}
                                      onClick={() => void handleSaveEdit(goal.id)}
                                    >
                                      <Save size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="수정 취소"
                                      onClick={() => setEditingGoalId(null)}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      className={`daily-goal-content ${goal.isCompleted ? 'is-completed' : ''}`}
                                      title={goal.content}
                                    >
                                      {goal.content}
                                    </span>
                                    <span className="daily-goal-actions">
                                      <button
                                        type="button"
                                        aria-label={`${goal.content} 수정`}
                                        onClick={() => {
                                          setEditingGoalId(goal.id)
                                          setEditingContent(goal.content)
                                        }}
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`${goal.content} 삭제`}
                                        disabled={busyGoalId === goal.id}
                                        onClick={() => void handleDeleteGoal(goal)}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </span>
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        <div className="day-progress">
                          <span>
                            {completedCount} / {goalsForDay.length} 완료
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

              <form className="daily-goal-form" onSubmit={handleAddGoal}>
                <label htmlFor="daily-goal-input">
                  <strong>{formatDayDate(selectedDate)}</strong>
                  <span>{DAY_LABELS[activeDay]}요일 목표</span>
                </label>
                <input
                  id="daily-goal-input"
                  value={goalInput}
                  maxLength={300}
                  placeholder="완료하고 싶은 할 일을 입력하세요"
                  onChange={(event) => setGoalInput(event.target.value)}
                />
                <button type="submit" disabled={!goalInput.trim() || isCreatingGoal}>
                  <Plus size={17} />
                  {isCreatingGoal ? '추가 중...' : '목표 추가'}
                </button>
              </form>
              {goalError && (
                <p className="daily-goal-error" role="alert">
                  {goalError}
                </p>
              )}
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
                className={`upload-zone ${selectedFile ? 'has-file' : ''}`}
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
                className={`generate-quest-button ${questRequested ? 'is-requested' : ''}`}
                onClick={handleCreateWrongNote}
              >
                {questRequested ? '퀘스트 생성 준비 완료' : 'AI 복습 퀘스트 생성하기'}
                {questRequested ? <Check size={18} /> : <ArrowRight size={18} />}
              </button>
            </section>

            <section className="streak-card">
              <div className="streak-title">
                <Flame size={18} />
                <strong>연속 학습 중!</strong>
              </div>
              <div className="streak-number">
                {streakLoading ? '—' : streak.currentStreak}
              </div>
              <span className="streak-unit">일 연속</span>
              <div className="streak-week">
                {streak.recentDays.map((day) => (
                  <div className="streak-day" key={day.date} title={day.date}>
                    <span>{day.dayLabel}</span>
                    <span
                      className={`streak-check ${day.active ? 'is-complete' : ''} ${day.isToday ? 'is-today' : ''}`}
                      aria-label={`${day.date} ${day.active ? '학습함' : '학습 없음'}`}
                    >
                      {day.active && <Check size={11} strokeWidth={3} />}
                    </span>
                  </div>
                ))}
              </div>
              <div className="streak-best">
                최고 기록 <strong>{streak.bestStreak}일</strong>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default MainPage
