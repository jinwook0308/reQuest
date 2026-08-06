import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Lightbulb,
  Save,
} from 'lucide-react'

import './RecordsPage.css'
import { apiFetch } from '../../lib/api'

type Subject = {
  id: string
  name: string
}

type SubjectsResponse = {
  success: boolean
  message?: string
  data?: Array<{
    id: string | number
    name: string
  }>
}

type SaveStudyRecordResponse = {
  success: boolean
  message?: string
  data?: {
    id: string | number
  }
}

const understandingLevels = [
  { value: 1, label: '어려워요' },
  { value: 2, label: '조금 어려워요' },
  { value: 3, label: '보통이에요' },
  { value: 4, label: '이해했어요' },
  { value: 5, label: '완벽해요' },
]

function getToday() {
  const today = new Date()
  const timezoneOffset =
    today.getTimezoneOffset() * 60_000

  return new Date(today.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10)
}

function RecordsPage() {
  const [record, setRecord] = useState({
    date: getToday(),
    subject: '',
    unit: '',
    minutes: '60',
    learned: '',
    difficult: '',
    keywords: '',
  })

  const [understanding, setUnderstanding] =
    useState(3)

  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saved' | 'error'
  >('idle')

  const [savedRecordId, setSavedRecordId] =
    useState<number | null>(null)

  const [subjects, setSubjects] = useState<
    Subject[]
  >([])
  const [isLoadingSubjects, setIsLoadingSubjects] =
    useState(true)
  const [subjectLoadError, setSubjectLoadError] =
    useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadSubjects() {
      try {
        setIsLoadingSubjects(true)
        setSubjectLoadError('')

        const response = await apiFetch('/subjects', {
          signal: controller.signal,
        })
        const result =
          (await response.json()) as SubjectsResponse

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              '과목을 불러오지 못했습니다.',
          )
        }

        const loadedSubjects = (result.data ?? []).map(
          (subject) => ({
            id: String(subject.id),
            name: subject.name,
          }),
        )

        setSubjects(loadedSubjects)
        setRecord((previousRecord) => ({
          ...previousRecord,
          subject:
            loadedSubjects.some(
              (subject) =>
                subject.name === previousRecord.subject,
            )
              ? previousRecord.subject
              : (loadedSubjects[0]?.name ?? ''),
        }))
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setSubjectLoadError(
          error instanceof Error
            ? error.message
            : '과목을 불러오지 못했습니다.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSubjects(false)
        }
      }
    }

    void loadSubjects()

    return () => controller.abort()
  }, [])

  const handleChange = (
    event: ChangeEvent<
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target

    setRecord((previousRecord) => ({
      ...previousRecord,
      [name]: value,
    }))

    setSaveStatus('idle')
    setSavedRecordId(null)
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setSaveStatus('idle')
    setSavedRecordId(null)

    try {
      const response = await apiFetch(
        '/study-records',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...record,
            minutes: Number(record.minutes),
            understanding,
          }),
        },
      )

      const result =
        (await response.json()) as SaveStudyRecordResponse

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            '학습 기록 저장에 실패했습니다.',
        )
      }

      setSavedRecordId(Number(result.data.id))
      setSaveStatus('saved')
    } catch (error) {
      console.error('학습 기록 저장 실패:', error)

      setSavedRecordId(null)
      setSaveStatus('error')
    }
  }

  return (
    <main className="records-page">
      <div className="records-container">
        <div className="records-topbar">
          <Link
            className="records-back-link"
            to="/history"
          >
            <ArrowLeft size={17} />
            학습 기록으로 돌아가기
          </Link>

          <span className="records-step">
            학습 여정 3 · 기록
          </span>
        </div>

        <header className="records-heading">
          <span className="records-heading-icon">
            <BookOpen size={25} />
          </span>

          <div>
            <span className="records-eyebrow">
              STUDY RECORD
            </span>

            <h1>오늘 무엇을 공부했나요?</h1>

            <p>
              오늘 배운 내용과 어려웠던 부분을
              기록해 보세요.
              <br />
              작은 기록이 나만의 복습 여정을
              만듭니다.
            </p>
          </div>
        </header>

        <form
          className="records-form"
          onSubmit={handleSubmit}
        >
          <section className="record-card">
            <div className="record-card-heading">
              <span className="record-card-icon">
                <CalendarDays size={19} />
              </span>

              <div>
                <h2>기본 학습 정보</h2>

                <p>
                  오늘 공부한 과목과 시간을
                  알려주세요.
                </p>
              </div>
            </div>

            <div className="record-fields">
              <label className="record-field">
                <span>학습 날짜</span>

                <input
                  type="date"
                  name="date"
                  value={record.date}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="record-field">
                <span>과목</span>

                <select
                  name="subject"
                  value={record.subject}
                  onChange={handleChange}
                  disabled={
                    isLoadingSubjects ||
                    subjects.length === 0
                  }
                  required
                >
                  {isLoadingSubjects ? (
                    <option value="">
                      과목을 불러오는 중입니다
                    </option>
                  ) : subjects.length === 0 ? (
                    <option value="">
                      먼저 과목을 추가해 주세요
                    </option>
                  ) : (
                    subjects.map((subject) => (
                      <option
                        value={subject.name}
                        key={subject.id}
                      >
                        {subject.name}
                      </option>
                    ))
                  )}
                </select>

                {subjectLoadError ? (
                  <small>{subjectLoadError}</small>
                ) : null}
              </label>

              <label className="record-field record-field-wide">
                <span>학습 단원</span>

                <input
                  type="text"
                  name="unit"
                  value={record.unit}
                  onChange={handleChange}
                  placeholder="예: 이차함수의 그래프 이동"
                  required
                />
              </label>

              <label className="record-field record-field-wide">
                <span>학습 시간</span>

                <div className="record-input-with-unit">
                  <Clock3 size={18} />

                  <input
                    type="number"
                    name="minutes"
                    value={record.minutes}
                    onChange={handleChange}
                    min="1"
                    max="1440"
                    required
                  />

                  <strong>분</strong>
                </div>
              </label>
            </div>
          </section>

          <section className="record-card">
            <div className="record-card-heading">
              <span className="record-card-icon">
                <Lightbulb size={19} />
              </span>

              <div>
                <h2>학습 내용 정리</h2>

                <p>
                  완벽한 문장보다 나중에 알아볼
                  수 있는 기록이 중요해요.
                </p>
              </div>
            </div>

            <div className="record-writing-fields">
              <label className="record-field">
                <span>오늘 이해한 내용</span>

                <textarea
                  name="learned"
                  value={record.learned}
                  onChange={handleChange}
                  placeholder="예: 이차함수 그래프에서 x축 방향 이동은 식의 부호와 반대로 움직인다."
                  rows={5}
                  required
                />
              </label>

              <label className="record-field">
                <span>
                  어려웠거나 다시 보고 싶은 부분
                </span>

                <textarea
                  name="difficult"
                  value={record.difficult}
                  onChange={handleChange}
                  placeholder="예: 그래프의 평행이동과 축 이동을 구분하는 것이 어려웠다."
                  rows={5}
                  required
                />
              </label>

              <label className="record-field">
                <span>핵심 키워드</span>

                <input
                  type="text"
                  name="keywords"
                  value={record.keywords}
                  onChange={handleChange}
                  placeholder="예: 이차함수, 그래프 이동, 평행이동"
                />

                <small>
                  키워드는 쉼표로 구분해서 작성해
                  주세요.
                </small>
              </label>
            </div>
          </section>

          <section className="record-card">
            <div className="record-card-heading">
              <span className="record-card-icon">
                <CheckCircle2 size={19} />
              </span>

              <div>
                <h2>오늘의 이해도</h2>

                <p>
                  공부를 마친 지금의 느낌을
                  선택해 주세요.
                </p>
              </div>
            </div>

            <div className="understanding-levels">
              {understandingLevels.map(
                (level) => (
                  <button
                    type="button"
                    className={`understanding-button ${
                      understanding === level.value
                        ? 'is-selected'
                        : ''
                    }`}
                    key={level.value}
                    onClick={() => {
                      setUnderstanding(level.value)
                      setSaveStatus('idle')
                      setSavedRecordId(null)
                    }}
                    aria-pressed={
                      understanding === level.value
                    }
                  >
                    <strong>
                      {level.value}
                    </strong>

                    <span>{level.label}</span>
                  </button>
                ),
              )}
            </div>
          </section>

          {saveStatus === 'saved' && (
            <div className="record-message is-success">
              <CheckCircle2 size={19} />

              <div>
                <strong>
                  학습 기록이 저장되었습니다.
                </strong>

                <span>
                  틀린 문제가 있었다면 오답
                  노트도 이어서 작성할 수 있어요.
                </span>
              </div>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="record-message is-error">
              기록을 저장하지 못했습니다. 다시
              시도해 주세요.
            </div>
          )}

          <div className="record-actions">
            {saveStatus === 'saved' &&
            savedRecordId ? (
              <>
                <Link
                  className="record-cancel-button"
                  to="/"
                >
                  이번 주로 돌아가기
                </Link>

                <Link
                  className="record-save-button"
                  to={`/wrong-notes/new?studyRecordId=${savedRecordId}`}
                >
                  <FileQuestion size={18} />
                  이번 학습의 오답 등록하기
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="record-cancel-button"
                  to="/history"
                >
                  취소
                </Link>

                <button
                  className="record-save-button"
                  type="submit"
                >
                  <Save size={18} />
                  학습 기록 저장하기
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}

export default RecordsPage
