import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Code2,
  Focus,
  Play,
} from 'lucide-react'

import { apiFetch } from '../../lib/api'
import type {
  StudySession,
  StudySessionMode,
  StudySessionResponse,
} from '../../types/studySession'
import './StudyFocusSetupPage.css'

type Subject = {
  id: string | number
  name: string
}

type SubjectsResponse = {
  success: boolean
  message?: string
  data?: Subject[]
}

type StudyRecordSummary = {
  recordType?: 'general' | 'certification'
  certificationName?: string | null
}

type StudyRecordsResponse = {
  success: boolean
  message?: string
  data?: StudyRecordSummary[]
}

const timeOptions = [25, 50, 60, 90]
const customCertificationValue = '__custom-certification__'

function StudyFocusSetupPage() {
  const navigate = useNavigate()
  const [recordType, setRecordType] = useState<
    'general' | 'certification'
  >('general')
  const [mode, setMode] = useState<StudySessionMode>('focus')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [certificationNames, setCertificationNames] = useState<string[]>([])
  const [isCustomCertification, setIsCustomCertification] = useState(false)
  const [subject, setSubject] = useState('')
  const [unit, setUnit] = useState('')
  const [targetMinutes, setTargetMinutes] = useState(50)
  const [activeSession, setActiveSession] = useState<StudySession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const generalSubjects = useMemo(
    () => subjects.filter((item) => item.name !== '자격증'),
    [subjects],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadSetupData() {
      try {
        const [subjectsResponse, activeResponse, recordsResponse] = await Promise.all([
          apiFetch('/subjects', { signal: controller.signal }),
          apiFetch('/study-sessions/active', { signal: controller.signal }),
          apiFetch('/study-records', { signal: controller.signal }),
        ])
        const subjectsResult = (await subjectsResponse.json()) as SubjectsResponse
        const activeResult = (await activeResponse.json()) as StudySessionResponse
        const recordsResult = (await recordsResponse.json()) as StudyRecordsResponse

        if (!subjectsResponse.ok || !subjectsResult.success) {
          throw new Error(subjectsResult.message ?? '과목을 불러오지 못했습니다.')
        }

        const loadedSubjects = subjectsResult.data ?? []
        setSubjects(loadedSubjects)
        setSubject(
          loadedSubjects.find((item) => item.name !== '자격증')?.name ?? '',
        )

        if (recordsResponse.ok && recordsResult.success) {
          const loadedCertificationNames = Array.from(
            new Set(
              (recordsResult.data ?? [])
                .filter((record) => record.recordType === 'certification')
                .map((record) => record.certificationName?.trim() ?? '')
                .filter((name) => name.length > 0),
            ),
          )

          setCertificationNames(loadedCertificationNames)
        }

        if (activeResponse.ok && activeResult.success) {
          setActiveSession(activeResult.data ?? null)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setErrorMessage(
          error instanceof Error ? error.message : '공부 설정을 불러오지 못했습니다.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadSetupData()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (recordType === 'general') {
      setIsCustomCertification(false)
      setSubject(generalSubjects[0]?.name ?? '')
    } else if (certificationNames.length > 0) {
      setIsCustomCertification(false)
      setSubject(certificationNames[0])
    } else {
      setIsCustomCertification(true)
      setSubject('')
    }
  }, [certificationNames, generalSubjects, recordType])

  const handleStart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsStarting(true)

    try {
      const response = await apiFetch('/study-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordType,
          mode,
          subject,
          unit,
          targetMinutes,
        }),
      })
      const result = (await response.json()) as StudySessionResponse

      if (response.status === 409 && result.data) {
        navigate(`/focus/session/${result.data.id}`)
        return
      }

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? '공부를 시작하지 못했습니다.')
      }

      navigate(`/focus/session/${result.data.id}`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '공부를 시작하지 못했습니다.',
      )
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading) {
    return <main className="focus-setup-page is-loading">공부 설정을 불러오는 중입니다.</main>
  }

  return (
    <main className="focus-setup-page">
      <div className="focus-setup-shell">
        <button
          type="button"
          className="focus-setup-back"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={18} />
          이번 주로 돌아가기
        </button>

        <header className="focus-setup-heading">
          <span className="focus-setup-eyebrow">STUDY SESSION</span>
          <h1>지금부터 무엇에 집중할까요?</h1>
          <p>공부 종류와 시간을 정하면 방해를 줄인 전용 타이머가 시작됩니다.</p>
        </header>

        {activeSession ? (
          <section className="active-session-card">
            <div>
              <span>진행 중인 공부</span>
              <strong>{activeSession.subject} · {activeSession.unit}</strong>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/focus/session/${activeSession.id}`)}
            >
              이어서 공부하기
              <Play size={16} fill="currentColor" />
            </button>
          </section>
        ) : null}

        <form className="focus-setup-form" onSubmit={handleStart}>
          <section className="focus-option-section">
            <div className="focus-option-heading">
              <span>01</span>
              <div>
                <h2>학습 방식</h2>
                <p>현재 공부에 맞는 화면 이탈 규칙을 선택하세요.</p>
              </div>
            </div>

            <div className="focus-mode-grid">
              <button
                type="button"
                className={mode === 'focus' ? 'is-selected' : ''}
                onClick={() => setMode('focus')}
              >
                <Focus size={25} />
                <strong>집중 학습</strong>
                <span>다른 탭이나 창으로 이동하면 자동으로 일시정지돼요.</span>
              </button>

              <button
                type="button"
                className={mode === 'practice' ? 'is-selected' : ''}
                onClick={() => setMode('practice')}
              >
                <Code2 size={25} />
                <strong>실습 학습</strong>
                <span>코딩·자료 검색처럼 다른 프로그램을 함께 사용할 수 있어요.</span>
              </button>
            </div>
          </section>

          <section className="focus-option-section">
            <div className="focus-option-heading">
              <span>02</span>
              <div>
                <h2>공부 내용</h2>
                <p>타이머와 이후 학습 기록에 표시할 내용을 입력하세요.</p>
              </div>
            </div>

            <div className="focus-record-type">
              <button
                type="button"
                className={recordType === 'general' ? 'is-selected' : ''}
                onClick={() => setRecordType('general')}
              >
                일반 학습
              </button>
              <button
                type="button"
                className={recordType === 'certification' ? 'is-selected' : ''}
                onClick={() => setRecordType('certification')}
              >
                자격증 공부
              </button>
            </div>

            <div className="focus-fields">
              <label>
                <span>{recordType === 'certification' ? '자격증명' : '과목'}</span>
                {recordType === 'general' ? (
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    required
                  >
                    {generalSubjects.length === 0 ? (
                      <option value="">먼저 학습 기록에서 과목을 추가해 주세요</option>
                    ) : generalSubjects.map((item) => (
                      <option value={item.name} key={item.id}>{item.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="focus-certification-picker">
                    {certificationNames.length > 0 && (
                      <select
                        value={
                          isCustomCertification
                            ? customCertificationValue
                            : subject
                        }
                        onChange={(event) => {
                          if (event.target.value === customCertificationValue) {
                            setIsCustomCertification(true)
                            setSubject('')
                            return
                          }

                          setIsCustomCertification(false)
                          setSubject(event.target.value)
                        }}
                        required
                      >
                        {certificationNames.map((name) => (
                          <option value={name} key={name}>{name}</option>
                        ))}
                        <option value={customCertificationValue}>
                          + 새 자격증 직접 입력
                        </option>
                      </select>
                    )}

                    {(certificationNames.length === 0 || isCustomCertification) && (
                      <input
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        placeholder="예: 정보처리기사"
                        maxLength={120}
                        autoFocus={isCustomCertification}
                        required
                      />
                    )}

                    {certificationNames.length === 0 && (
                      <small>
                        공부를 마친 뒤 학습 기록을 저장하면 다음부터 목록에서 선택할 수 있어요.
                      </small>
                    )}
                  </div>
                )}
              </label>

              <label>
                <span>공부할 단원 또는 목표</span>
                <input
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="예: 데이터베이스 정규화 복습"
                  maxLength={150}
                  required
                />
              </label>
            </div>
          </section>

          <section className="focus-option-section">
            <div className="focus-option-heading">
              <span>03</span>
              <div>
                <h2>목표 시간</h2>
                <p>집중할 시간을 선택하거나 직접 입력하세요.</p>
              </div>
            </div>

            <div className="focus-time-options">
              {timeOptions.map((minutes) => (
                <button
                  type="button"
                  className={targetMinutes === minutes ? 'is-selected' : ''}
                  onClick={() => setTargetMinutes(minutes)}
                  key={minutes}
                >
                  <strong>{minutes}</strong>
                  <span>분</span>
                </button>
              ))}

              <label>
                <Clock3 size={18} />
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={targetMinutes}
                  onChange={(event) => setTargetMinutes(Number(event.target.value))}
                  aria-label="목표 시간 직접 입력"
                  required
                />
                <span>분</span>
              </label>
            </div>
          </section>

          {errorMessage ? <p className="focus-setup-error">{errorMessage}</p> : null}

          <button className="focus-start-submit" type="submit" disabled={isStarting}>
            <BookOpen size={19} />
            {isStarting ? '공부 화면을 준비하는 중...' : '공부 시작하기'}
            <Play size={17} fill="currentColor" />
          </button>
        </form>
      </div>
    </main>
  )
}

export default StudyFocusSetupPage
