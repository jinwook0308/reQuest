import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Expand,
  Focus,
  Pause,
  Play,
  Square,
  TimerReset,
  Wrench,
} from 'lucide-react'

import { apiFetch } from '../../lib/api'
import type {
  StudySession,
  StudySessionResponse,
} from '../../types/studySession'
import './StudyTimerPage.css'

type WakeLockSentinel = {
  release: () => Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>
  }
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function StudyTimerPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<StudySession | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const mutatingRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const applySession = useCallback((nextSession: StudySession) => {
    setSession(nextSession)
    setElapsedSeconds(Number(nextSession.elapsedSeconds) || 0)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSession() {
      try {
        const response = await apiFetch(`/study-sessions/${sessionId}`, {
          signal: controller.signal,
        })
        const result = (await response.json()) as StudySessionResponse

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? '공부 세션을 불러오지 못했습니다.')
        }

        applySession(result.data)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : '공부 세션을 불러오지 못했습니다.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadSession()
    return () => controller.abort()
  }, [applySession, sessionId])

  useEffect(() => {
    if (session?.status !== 'running') {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((previous) => previous + 1)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [session?.status])

  useEffect(() => {
    if (session?.status !== 'running') {
      void wakeLockRef.current?.release()
      wakeLockRef.current = null
      return undefined
    }

    let cancelled = false
    const wakeLockNavigator = navigator as WakeLockNavigator

    async function requestWakeLock() {
      try {
        const sentinel = await wakeLockNavigator.wakeLock?.request('screen')
        if (cancelled) {
          await sentinel?.release()
          return
        }
        wakeLockRef.current = sentinel ?? null
      } catch {
        wakeLockRef.current = null
      }
    }

    void requestWakeLock()

    return () => {
      cancelled = true
      void wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }, [session?.status])

  const updateSession = useCallback(
    async (
      action: 'pause' | 'resume' | 'finish',
      body?: Record<string, boolean>,
    ) => {
      if (!sessionId || mutatingRef.current) {
        return null
      }

      mutatingRef.current = true
      setIsMutating(true)
      setErrorMessage('')

      try {
        const response = await apiFetch(
          `/study-sessions/${sessionId}/${action}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
          },
        )
        const result = (await response.json()) as StudySessionResponse

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? '공부 세션 상태를 변경하지 못했습니다.')
        }

        applySession(result.data)
        return result.data
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '공부 세션 상태를 변경하지 못했습니다.',
        )
        return null
      } finally {
        mutatingRef.current = false
        setIsMutating(false)
      }
    },
    [applySession, sessionId],
  )

  useEffect(() => {
    if (session?.mode !== 'focus' || session.status !== 'running') {
      return undefined
    }

    const pauseWhenHidden = () => {
      if (!document.hidden || mutatingRef.current) {
        return
      }

      setNotice('화면 이탈이 감지되어 집중 시간이 자동으로 일시정지되었습니다.')
      void updateSession('pause', { interruption: true })
    }

    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [session?.mode, session?.status, updateSession])

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (session?.status !== 'running') {
        return
      }
      event.preventDefault()
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [session?.status])

  const handleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      setNotice('이 브라우저에서는 전체 화면을 사용할 수 없습니다.')
    }
  }

  const handleFinish = async () => {
    if (!session) {
      return
    }

    if (session.status !== 'completed') {
      const shouldFinish = window.confirm(
        '공부를 종료하고 측정한 시간을 학습 기록으로 옮길까요?',
      )
      if (!shouldFinish) {
        return
      }
    }

    const finishedSession = session.status === 'completed'
      ? session
      : await updateSession('finish')
    if (!finishedSession) {
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
    }

    const minutes = Math.max(
      1,
      Math.round(Number(finishedSession.elapsedSeconds) / 60),
    )
    const query = new URLSearchParams({
      focusMinutes: String(minutes),
      focusUnit: finishedSession.unit,
    })

    if (finishedSession.recordType === 'certification') {
      query.set('type', 'certification')
      query.set('certificationName', finishedSession.subject)
    } else {
      query.set('subject', finishedSession.subject)
    }

    navigate(`/records?${query.toString()}`)
  }

  if (isLoading) {
    return (
      <main className="study-timer-page study-timer-center">
        <TimerReset className="study-timer-loading-icon" size={34} />
        <p>집중 화면을 준비하고 있습니다.</p>
      </main>
    )
  }

  if (!session || errorMessage && !session) {
    return (
      <main className="study-timer-page study-timer-center">
        <p>{errorMessage || '공부 세션을 찾을 수 없습니다.'}</p>
        <button type="button" onClick={() => navigate('/focus')}>
          공부 설정으로 돌아가기
        </button>
      </main>
    )
  }

  const targetSeconds = Math.max(60, Number(session.targetMinutes) * 60)
  const progress = Math.min(100, (elapsedSeconds / targetSeconds) * 100)
  const isRunning = session.status === 'running'
  const isFinished = session.status === 'completed'

  return (
    <main className={`study-timer-page is-${session.mode}`}>
      <div className="study-timer-glow" aria-hidden="true" />

      <header className="study-timer-toolbar">
        <span className="study-timer-brand">reQuest</span>
        <button type="button" onClick={handleFullscreen}>
          <Expand size={17} />
          전체 화면
        </button>
      </header>

      <section className="study-timer-content">
        <div className="study-mode-badge">
          {session.mode === 'focus' ? <Focus size={17} /> : <Wrench size={17} />}
          {session.mode === 'focus' ? '집중 학습' : '실습 학습'}
        </div>

        <p className="study-timer-subject">{session.subject}</p>
        <h1>{session.unit}</h1>

        <div className="study-clock" aria-label={`공부 시간 ${formatTime(elapsedSeconds)}`}>
          {formatTime(elapsedSeconds)}
        </div>

        <div className="study-progress-wrap">
          <div className="study-progress-copy">
            <span>현재 집중 시간</span>
            <span>목표 {session.targetMinutes}분</span>
          </div>
          <div className="study-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{Math.round(progress)}%</strong>
        </div>

        <p className="study-timer-guide">
          {session.mode === 'focus'
            ? '집중 모드에서는 이 페이지를 벗어나면 시간이 자동으로 일시정지됩니다.'
            : '실습 모드에서는 코딩 도구나 학습 자료를 함께 사용해도 시간이 계속 측정됩니다.'}
        </p>

        {notice ? <p className="study-timer-notice">{notice}</p> : null}
        {errorMessage ? <p className="study-timer-error">{errorMessage}</p> : null}

        <div className="study-timer-actions">
          {!isFinished ? (
            <button
              type="button"
              className="study-pause-button"
              disabled={isMutating}
              onClick={() => {
                setNotice('')
                void updateSession(isRunning ? 'pause' : 'resume')
              }}
            >
              {isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              {isRunning ? '일시정지' : '다시 시작'}
            </button>
          ) : null}

          <button
            type="button"
            className="study-finish-button"
            disabled={isMutating}
            onClick={() => void handleFinish()}
          >
            <Square size={18} fill="currentColor" />
            {isFinished ? '학습 기록 작성하기' : '공부 종료'}
          </button>
        </div>
      </section>
    </main>
  )
}

export default StudyTimerPage
