import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Clock,
  FileText,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'

import './AireviewPage.css'

import { apiFetch } from '../../lib/api'



type Subject = {
  id: string
  name: string
}

type StudyRecord = {
  id: number
  date: string
  subject: string
  unit: string
  learned: string
  difficult: string
  keywords: string
  understanding: number
  questStatus?: string | null
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

const coverToneCount = 6

function getCoverTone(subjectName: string) {
  const value = [...subjectName].reduce(
    (total, character) =>
      total + character.charCodeAt(0),
    0,
  )

  return (value % coverToneCount) + 1
}

function formatRecordDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`)

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function AiReviewPage() {
  const navigate = useNavigate()

  const [subjects, setSubjects] = useState<
    Subject[]
  >([])
  const [records, setRecords] = useState<
    StudyRecord[]
  >([])
  const [selectedSubject, setSelectedSubject] =
    useState<Subject | null>(null)
  const [
    openingSubjectId,
    setOpeningSubjectId,
  ] = useState<string | null>(null)
  const [
    newlyCreatedSubjectId,
    setNewlyCreatedSubjectId,
  ] = useState<string | null>(null)

  const [isLoading, setIsLoading] =
    useState(true)
  const [loadError, setLoadError] =
    useState('')

  const [isModalOpen, setIsModalOpen] =
    useState(false)
  const [subjectName, setSubjectName] =
    useState('')
  const [createError, setCreateError] =
    useState('')
  const [isCreating, setIsCreating] =
    useState(false)

  const openTimerRef =
    useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadReviewData() {
      try {
        setIsLoading(true)
        setLoadError('')

        const [
          subjectsResponse,
          recordsResponse,
        ] = await Promise.all([
          apiFetch('/subjects', {
            signal: controller.signal,
          }),
          apiFetch('/study-records', {
            signal: controller.signal,
          }),
        ])

        const subjectsResult =
          (await subjectsResponse.json()) as
            ApiResponse<
              Array<{
                id: string | number
                name: string
              }>
            >

        const recordsResult =
          (await recordsResponse.json()) as
            ApiResponse<
              Array<
                Omit<
                  StudyRecord,
                  'id' | 'understanding'
                > & {
                  id: string | number
                  understanding: string | number
                }
              >
            >

        if (
          !subjectsResponse.ok ||
          !subjectsResult.success
        ) {
          throw new Error(
            subjectsResult.message ??
              '과목을 불러오지 못했습니다.',
          )
        }

        if (
          !recordsResponse.ok ||
          !recordsResult.success
        ) {
          throw new Error(
            recordsResult.message ??
              '학습 기록을 불러오지 못했습니다.',
          )
        }

        setSubjects(
          (subjectsResult.data ?? []).map(
            (subject) => ({
              id: String(subject.id),
              name: subject.name,
            }),
          ),
        )

        setRecords(
          (recordsResult.data ?? []).map(
            (record) => ({
              ...record,
              id: Number(record.id),
              understanding: Number(
                record.understanding,
              ),
            }),
          ),
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : '복습 노트를 불러오지 못했습니다.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadReviewData()

    return () => {
      controller.abort()

      if (openTimerRef.current !== null) {
        window.clearTimeout(
          openTimerRef.current,
        )
      }
    }
  }, [])

  const visibleSubjects = useMemo(
    () =>
      subjects.filter(
        (subject) => subject.name !== '기타',
      ),
    [subjects],
  )

  const selectedRecords = useMemo(() => {
    if (!selectedSubject) {
      return []
    }

    return records.filter(
      (record) =>
        record.subject ===
        selectedSubject.name,
    )
  }, [records, selectedSubject])

  const averageUnderstanding =
    selectedRecords.length === 0
      ? 0
      : selectedRecords.reduce(
          (total, record) =>
            total + record.understanding,
          0,
        ) / selectedRecords.length

  const handleOpenBook = (
    subject: Subject,
  ) => {
    if (openingSubjectId) {
      return
    }

    setOpeningSubjectId(subject.id)

    openTimerRef.current =
      window.setTimeout(() => {
        setSelectedSubject(subject)
        setOpeningSubjectId(null)
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }, 560)
  }

  const handleOpenCreateModal = () => {
    setSubjectName('')
    setCreateError('')
    setIsModalOpen(true)
  }

  const handleCloseCreateModal = () => {
    if (isCreating) {
      return
    }

    setIsModalOpen(false)
    setSubjectName('')
    setCreateError('')
  }

  const handleCreateSubject = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const trimmedName = subjectName.trim()

    if (!trimmedName) {
      setCreateError(
        '새 과목명을 입력해 주세요.',
      )
      return
    }

    try {
      setIsCreating(true)
      setCreateError('')

      const response = await apiFetch(
        '/subjects',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        },
      )

      const result =
        (await response.json()) as
          ApiResponse<{
            id: string | number
            name: string
          }>

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            '새 과목을 만들지 못했습니다.',
        )
      }

      const createdSubject: Subject = {
        id: String(result.data.id),
        name: result.data.name,
      }

      setSubjects((previousSubjects) => [
        ...previousSubjects,
        createdSubject,
      ])
      setNewlyCreatedSubjectId(
        createdSubject.id,
      )
      setIsModalOpen(false)
      setSubjectName('')

      window.setTimeout(() => {
        setNewlyCreatedSubjectId(null)
      }, 1200)
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : '새 과목을 만들지 못했습니다.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  if (selectedSubject) {
    return (
      <main className="ai-review-page">
        <div className="review-note-toolbar">
          <button
            type="button"
            className="review-back-button"
            onClick={() =>
              setSelectedSubject(null)
            }
          >
            <ArrowLeft size={18} />
            과목 노트 목록
          </button>
        </div>

        <section className="opened-review-note">
          <div className="opened-note-heading">
            <span className="opened-note-icon">
              <BookOpen size={26} />
            </span>

            <div>
              <span className="opened-note-label">
                REVIEW NOTE
              </span>

              <h1>
                {selectedSubject.name} 복습 노트
              </h1>

              <p>
                학습 기록을 바탕으로 취약
                개념과 복습 문제를
                확인해보세요.
              </p>
            </div>
          </div>

          <div className="review-note-summary">
            <div>
              <FileText size={20} />

              <span>학습 기록</span>

              <strong>
                {selectedRecords.length}개
              </strong>
            </div>

            <div>
              <Brain size={20} />

              <span>평균 이해도</span>

              <strong>
                {averageUnderstanding.toFixed(
                  1,
                )}{' '}
                / 5
              </strong>
            </div>

            <div>
              <Sparkles size={20} />

              <span>복습 준비</span>

              <strong>
                {
                  selectedRecords.filter(
                    (record) =>
                      record.questStatus !==
                      'completed',
                  ).length
                }
                개
              </strong>
            </div>
          </div>

          <div className="review-note-content">
            <div className="review-note-section-heading">
              <div>
                <span>SUBJECT ARCHIVE</span>
                <h2>학습 기록과 복습 문제</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/records')
                }
              >
                <Plus size={17} />
                학습 기록 추가
              </button>
            </div>

            {selectedRecords.length === 0 ? (
              <div className="empty-review-note">
                <BookOpen size={42} />

                <h3>
                  아직 등록된 복습 자료가
                  없어요.
                </h3>

                <p>
                  먼저{' '}
                  {selectedSubject.name} 학습
                  기록을 남겨주세요.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/records')
                  }
                >
                  학습 기록 작성하기
                </button>
              </div>
            ) : (
              <div className="review-record-list">
                {selectedRecords.map(
                  (record) => {
                    const isQuestCreated =
                      record.questStatus &&
                      record.questStatus !==
                        'not-generated'

                    return (
                      <article
                        className="review-record-card"
                        key={record.id}
                      >
                        <div className="record-date">
                          <Clock size={16} />
                          {formatRecordDate(
                            record.date,
                          )}
                        </div>

                        <h3>{record.unit}</h3>

                        <p>
                          {record.difficult ||
                            record.learned ||
                            '등록된 학습 내용을 복습해 보세요.'}
                        </p>

                        <div className="record-card-footer">
                          <span>
                            이해도{' '}
                            {record.understanding} / 5
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                isQuestCreated
                                  ? `/quiz/${record.id}`
                                  : `/quest-review/${record.id}`,
                              )
                            }
                          >
                            <Sparkles size={16} />

                            {isQuestCreated
                              ? '복습 시작하기'
                              : 'AI 문제 만들기'}
                          </button>
                        </div>
                      </article>
                    )
                  },
                )}
              </div>
            )}

            <div className="review-point-box">
              <span>REVIEW POINT</span>

              <p>
                학습 기록과 오답이 쌓이면 AI가
                자주 어려워하는 개념을 분석하고
                맞춤 복습 문제를 추천해 줍니다.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="ai-review-page">
      <section className="ai-review-hero">
        <span className="ai-review-eyebrow">
          AI REVIEW LIBRARY
        </span>

        <h1>나의 AI 복습 노트</h1>

        <p>
          과목별 복습 노트를 열어 학습 기록,
          취약 개념과 AI 추천 문제를 확인해
          보세요.
        </p>
      </section>

      {isLoading ? (
        <div className="review-page-message">
          복습 노트를 불러오고 있습니다.
        </div>
      ) : loadError ? (
        <div className="review-page-message is-error">
          <strong>
            복습 노트를 불러오지
            못했습니다.
          </strong>

          <span>{loadError}</span>
        </div>
      ) : (
        <section className="review-library">
          <div className="review-library-heading">
            <div>
              <span>MY SUBJECTS</span>
              <h2>과목별 복습 노트</h2>
            </div>

            <p>
              노트를 선택하면 표지가 열리면서
              해당 과목의 복습 내용이
              나타납니다.
            </p>
          </div>

          <div className="review-book-grid">
            {visibleSubjects.map(
              (subject) => {
                const recordCount =
                  records.filter(
                    (record) =>
                      record.subject ===
                      subject.name,
                  ).length

                const isOpening =
                  openingSubjectId ===
                  subject.id

                const isNew =
                  newlyCreatedSubjectId ===
                  subject.id

                return (
                  <button
                    type="button"
                    className={`review-book tone-${getCoverTone(
                      subject.name,
                    )} ${
                      isOpening
                        ? 'is-opening'
                        : ''
                    } ${
                      isNew ? 'is-new' : ''
                    }`}
                    key={subject.id}
                    onClick={() =>
                      handleOpenBook(subject)
                    }
                    title={subject.name}
                  >
                    <span className="review-book-pages" />

                    <span className="review-book-cover">
                      <span className="review-book-spine" />

                      <span className="review-book-band" />

                      <span className="review-book-label">
                        <small>REVIEW NOTE</small>

                        <strong>
                          {subject.name}
                        </strong>

                        <span>
                          {recordCount}개의 기록
                        </span>
                      </span>

                      <span className="review-book-hover">
                        <strong>{subject.name}</strong>
                        <small>노트 열어보기</small>
                      </span>
                    </span>
                  </button>
                )
              },
            )}

            <button
              type="button"
              className="review-book add-subject-book"
              onClick={
                handleOpenCreateModal
              }
            >
              <span className="review-book-pages" />

              <span className="review-book-cover">
                <span className="review-book-spine" />

                <span className="add-subject-icon">
                  <Plus size={31} />
                </span>

                <span className="review-book-label">
                  <small>NEW SUBJECT</small>

                  <strong>기타</strong>

                  <span>
                    새 과목 노트 만들기
                  </span>
                </span>
              </span>
            </button>
          </div>
        </section>
      )}

      {isModalOpen && (
        <div
          className="subject-modal-backdrop"
          role="presentation"
          onMouseDown={
            handleCloseCreateModal
          }
        >
          <section
            className="subject-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-modal-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="subject-modal-close"
              aria-label="닫기"
              onClick={
                handleCloseCreateModal
              }
            >
              <X size={20} />
            </button>

            <span className="subject-modal-icon">
              <BookOpen size={27} />
            </span>

            <h2 id="subject-modal-title">
              새 복습 노트 만들기
            </h2>

            <p>
              공부할 과목명을 입력하면 새로운
              복습 노트가 만들어집니다.
            </p>

            <form
              onSubmit={
                handleCreateSubject
              }
            >
              <label htmlFor="subject-name">
                과목명
              </label>

              <input
                id="subject-name"
                type="text"
                value={subjectName}
                maxLength={50}
                autoFocus
                placeholder="예: 한국사, 회계학, 자격증 공부"
                onChange={(event) => {
                  setSubjectName(
                    event.target.value,
                  )
                  setCreateError('')
                }}
              />

              {createError && (
                <span className="subject-create-error">
                  {createError}
                </span>
              )}

              <div className="subject-modal-actions">
                <button
                  type="button"
                  className="modal-cancel-button"
                  disabled={isCreating}
                  onClick={
                    handleCloseCreateModal
                  }
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="modal-create-button"
                  disabled={isCreating}
                >
                  {isCreating
                    ? '만드는 중...'
                    : '과목 노트 만들기'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default AiReviewPage
