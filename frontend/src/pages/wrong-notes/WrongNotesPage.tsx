import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileQuestion,
  Link2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import './WrongNotesPage.css'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'

type WrongNoteStatus =
  | 'not-generated'
  | 'ready'
  | 'retry-required'
  | 'completed'

type WrongNoteApiItem = {
  id: number | string
  studyRecordId: number | string | null
  date: string
  subject: string
  unit: string
  mistakeQuestion: string
  wrongAnswer: string
  correctAnswer: string
  mistakeReason: string
  concepts: string
  wrongImage: string | null
  wrongImageName: string | null
  questStatus: string | null
  createdAt: string
}

type SavedWrongNote = {
  id: number
  studyRecordId: number | null
  date: string
  subject: string
  unit: string
  mistakeQuestion: string
  wrongAnswer: string
  correctAnswer: string
  mistakeReason: string
  concepts: string
  wrongImage: string
  wrongImageName: string
  questStatus: WrongNoteStatus
  createdAt: string
}

type WrongNotesApiResponse = {
  success: boolean
  message?: string
  data?: WrongNoteApiItem[]
}

type DeleteWrongNoteApiResponse = {
  success: boolean
  message?: string
  data?: {
    id: number | string
  }
}

const statusLabels: Record<
  WrongNoteStatus,
  string
> = {
  'not-generated': '문제 생성 전',
  ready: '복습 대기',
  'retry-required': '재도전 필요',
  completed: '마스터',
}

function normalizeWrongNoteStatus(
  status: string | null,
): WrongNoteStatus {
  if (
    status === 'ready' ||
    status === 'retry-required' ||
    status === 'completed'
  ) {
    return status
  }

  return 'not-generated'
}

async function loadWrongNotesFromApi(
  signal?: AbortSignal,
): Promise<SavedWrongNote[]> {
  const response = await fetch(
    `${API_BASE_URL}/wrong-notes`,
    {
      signal,
    },
  )

  const result =
    (await response.json()) as WrongNotesApiResponse

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '오답노트를 불러오지 못했습니다.',
    )
  }

  return result.data.map((wrongNote) => ({
    id: Number(wrongNote.id),

    studyRecordId:
      wrongNote.studyRecordId === null
        ? null
        : Number(wrongNote.studyRecordId),

    date: wrongNote.date,
    subject: wrongNote.subject,
    unit: wrongNote.unit,
    mistakeQuestion:
      wrongNote.mistakeQuestion,
    wrongAnswer: wrongNote.wrongAnswer,
    correctAnswer:
      wrongNote.correctAnswer,
    mistakeReason:
      wrongNote.mistakeReason,
    concepts: wrongNote.concepts ?? '',
    wrongImage:
      wrongNote.wrongImage ?? '',
    wrongImageName:
      wrongNote.wrongImageName ?? '',
    questStatus:
      normalizeWrongNoteStatus(
        wrongNote.questStatus,
      ),
    createdAt: wrongNote.createdAt,
  }))
}

function formatWrongNoteDate(date: string) {
  const wrongNoteDate = new Date(
    `${date}T00:00:00`,
  )

  return wrongNoteDate.toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    },
  )
}

function WrongNotesPage() {
  const [wrongNotes, setWrongNotes] =
    useState<SavedWrongNote[]>([])

  const [searchText, setSearchText] =
    useState('')

  const [
    subjectFilter,
    setSubjectFilter,
  ] = useState('전체')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('전체')

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState('')

  const [
    deletingWrongNoteId,
    setDeletingWrongNoteId,
  ] = useState<number | null>(null)

  useEffect(() => {
    const controller =
      new AbortController()

    const loadWrongNotes = async () => {
      try {
        setIsLoading(true)
        setLoadError('')

        const loadedWrongNotes =
          await loadWrongNotesFromApi(
            controller.signal,
          )

        setWrongNotes(loadedWrongNotes)
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        console.error(
          '오답노트 목록 조회 실패:',
          error,
        )

        setLoadError(
          error instanceof Error
            ? error.message
            : '오답노트를 불러오지 못했습니다.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadWrongNotes()

    return () => {
      controller.abort()
    }
  }, [])

  const subjects = useMemo(() => {
    const savedSubjects =
      wrongNotes.map(
        (wrongNote) =>
          wrongNote.subject,
      )

    return [
      '전체',
      ...new Set(savedSubjects),
    ]
  }, [wrongNotes])

  const filteredWrongNotes =
    useMemo(() => {
      const normalizedSearchText =
        searchText.trim().toLowerCase()

      return wrongNotes
        .filter((wrongNote) => {
          const matchesSubject =
            subjectFilter === '전체' ||
            wrongNote.subject ===
              subjectFilter

          const matchesStatus =
            statusFilter === '전체' ||
            wrongNote.questStatus ===
              statusFilter

          const searchableText = [
            wrongNote.subject,
            wrongNote.unit,
            wrongNote.mistakeQuestion,
            wrongNote.wrongAnswer,
            wrongNote.correctAnswer,
            wrongNote.mistakeReason,
            wrongNote.concepts,
          ]
            .join(' ')
            .toLowerCase()

          const matchesSearch =
            !normalizedSearchText ||
            searchableText.includes(
              normalizedSearchText,
            )

          return (
            matchesSubject &&
            matchesStatus &&
            matchesSearch
          )
        })
        .sort(
          (
            firstWrongNote,
            secondWrongNote,
          ) =>
            new Date(
              secondWrongNote.createdAt,
            ).getTime() -
            new Date(
              firstWrongNote.createdAt,
            ).getTime(),
        )
    }, [
      wrongNotes,
      searchText,
      subjectFilter,
      statusFilter,
    ])

  const retryRequiredCount =
    wrongNotes.filter(
      (wrongNote) =>
        wrongNote.questStatus ===
        'retry-required',
    ).length

  const completedCount =
    wrongNotes.filter(
      (wrongNote) =>
        wrongNote.questStatus ===
        'completed',
    ).length

  const handleDelete = async (
    wrongNoteId: number,
  ) => {
    const shouldDelete =
      window.confirm(
        '이 오답노트를 삭제할까요?',
      )

    if (!shouldDelete) {
      return
    }

    try {
      setDeletingWrongNoteId(
        wrongNoteId,
      )

      const response = await fetch(
        `${API_BASE_URL}/wrong-notes/${wrongNoteId}`,
        {
          method: 'DELETE',
        },
      )

      const result =
        (await response.json()) as DeleteWrongNoteApiResponse

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            '오답노트를 삭제하지 못했습니다.',
        )
      }

      setWrongNotes(
        (previousWrongNotes) =>
          previousWrongNotes.filter(
            (wrongNote) =>
              wrongNote.id !==
              wrongNoteId,
          ),
      )
    } catch (error) {
      console.error(
        '오답노트 삭제 실패:',
        error,
      )

      window.alert(
        error instanceof Error
          ? error.message
          : '오답노트를 삭제하지 못했습니다.',
      )
    } finally {
      setDeletingWrongNoteId(null)
    }
  }

  return (
    <main className="wrong-notes-page">
      <div className="wrong-notes-container">
        <div className="wrong-notes-topbar">
          <Link
            className="wrong-notes-back-link"
            to="/"
          >
            <ArrowLeft size={17} />
            이번 주로 돌아가기
          </Link>

          <Link
            className="wrong-notes-create-button"
            to="/wrong-notes/new"
          >
            <Plus size={18} />
            새 오답 등록
          </Link>
        </div>

        <header className="wrong-notes-heading">
          <span className="wrong-notes-heading-icon">
            <BookOpen size={26} />
          </span>

          <div>
            <span className="wrong-notes-eyebrow">
              WRONG ANSWER ARCHIVE
            </span>

            <h1>나의 오답 노트</h1>

            <p>
              틀린 문제와 이유를 다시
              확인하고,
              <br />
              아직 이해하지 못한 개념을
              끝까지 복습해 보세요.
            </p>
          </div>
        </header>

        <section className="wrong-notes-summary">
          <div>
            <FileQuestion size={21} />

            <span>
              전체 오답
              <strong>
                {wrongNotes.length}개
              </strong>
            </span>
          </div>

          <div>
            <AlertCircle size={21} />

            <span>
              재도전 필요
              <strong>
                {retryRequiredCount}개
              </strong>
            </span>
          </div>

          <div>
            <CheckCircle2 size={21} />

            <span>
              마스터
              <strong>
                {completedCount}개
              </strong>
            </span>
          </div>
        </section>

        <section className="wrong-notes-toolbar">
          <label className="wrong-notes-search">
            <Search size={18} />

            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
              placeholder="단원, 문제, 개념 검색"
            />
          </label>

          <select
            value={subjectFilter}
            onChange={(event) =>
              setSubjectFilter(
                event.target.value,
              )
            }
            aria-label="과목 필터"
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

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            aria-label="복습 상태 필터"
          >
            <option value="전체">
              전체 상태
            </option>

            <option value="not-generated">
              문제 생성 전
            </option>

            <option value="ready">
              복습 대기
            </option>

            <option value="retry-required">
              재도전 필요
            </option>

            <option value="completed">
              마스터
            </option>
          </select>
        </section>

        {isLoading ? (
          <section className="wrong-notes-empty">
            <span>
              <BookOpen size={29} />
            </span>

            <h2>
              오답노트를 불러오는
              중이에요.
            </h2>

            <p>잠시만 기다려 주세요.</p>
          </section>
        ) : loadError ? (
          <section className="wrong-notes-empty">
            <span>
              <AlertCircle size={29} />
            </span>

            <h2>
              오답노트를 불러오지
              못했어요.
            </h2>

            <p>{loadError}</p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
            >
              다시 불러오기
            </button>
          </section>
        ) : filteredWrongNotes.length ===
          0 ? (
          <section className="wrong-notes-empty">
            <span>
              <BookOpen size={29} />
            </span>

            <h2>
              {wrongNotes.length === 0
                ? '아직 등록한 오답이 없어요.'
                : '검색 결과가 없어요.'}
            </h2>

            <p>
              {wrongNotes.length === 0
                ? '틀린 문제를 기록하고 나만의 복습 퀘스트를 시작해 보세요.'
                : '검색어 또는 필터 조건을 변경해 보세요.'}
            </p>

            {wrongNotes.length === 0 && (
              <Link to="/wrong-notes/new">
                <Plus size={17} />
                첫 오답 등록하기
              </Link>
            )}
          </section>
        ) : (
          <section className="wrong-notes-list">
            {filteredWrongNotes.map(
              (wrongNote) => {
                const concepts =
                  wrongNote.concepts
                    .split(',')
                    .map((concept) =>
                      concept.trim(),
                    )
                    .filter(Boolean)

                const status =
                  wrongNote.questStatus

                return (
                  <article
                    className="wrong-note-card"
                    key={wrongNote.id}
                  >
                    <div className="wrong-note-thumbnail">
                      {wrongNote.wrongImage ? (
                        <img
                          src={
                            wrongNote.wrongImage
                          }
                          alt={`${wrongNote.unit} 오답`}
                        />
                      ) : (
                        <BookOpen
                          size={28}
                        />
                      )}
                    </div>

                    <div className="wrong-note-card-content">
                      <div className="wrong-note-card-header">
                        <div>
                          <span className="wrong-note-date">
                            <CalendarDays
                              size={15}
                            />

                            {formatWrongNoteDate(
                              wrongNote.date,
                            )}
                          </span>

                          <span className="wrong-note-subject">
                            {
                              wrongNote.subject
                            }
                          </span>

                          {wrongNote.studyRecordId && (
                            <span className="wrong-note-linked">
                              <Link2
                                size={12}
                              />
                              학습 기록 연결됨
                            </span>
                          )}
                        </div>

                        <span
                          className={`wrong-note-status is-${status}`}
                        >
                          {
                            statusLabels[
                              status
                            ]
                          }
                        </span>
                      </div>

                      <h2>
                        {wrongNote.unit ||
                          `${wrongNote.subject} 오답`}
                      </h2>

                      <p className="wrong-note-question">
                        {
                          wrongNote.mistakeQuestion
                        }
                      </p>

                      <div className="wrong-note-answer-preview">
                        <div className="is-wrong">
                          <strong>
                            내 답
                          </strong>

                          <span>
                            {
                              wrongNote.wrongAnswer
                            }
                          </span>
                        </div>

                        <div className="is-correct">
                          <strong>
                            정답
                          </strong>

                          <span>
                            {
                              wrongNote.correctAnswer
                            }
                          </span>
                        </div>
                      </div>

                      <div className="wrong-note-card-footer">
                        <div className="wrong-note-concepts">
                          {concepts.length >
                          0 ? (
                            concepts.map(
                              (concept) => (
                                <span
                                  key={
                                    concept
                                  }
                                >
                                  {
                                    concept
                                  }
                                </span>
                              ),
                            )
                          ) : (
                            <span>
                              개념 미입력
                            </span>
                          )}
                        </div>

                        <div className="wrong-note-card-actions">
                          <Link
                            to={`/wrong-notes/${wrongNote.id}`}
                          >
                            상세보기
                            <ArrowRight
                              size={15}
                            />
                          </Link>

                          <button
                            type="button"
                            disabled={
                              deletingWrongNoteId ===
                              wrongNote.id
                            }
                            onClick={() =>
                              void handleDelete(
                                wrongNote.id,
                              )
                            }
                            aria-label={`${wrongNote.unit} 오답 삭제`}
                          >
                            <Trash2
                              size={17}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              },
            )}
          </section>
        )}
      </div>
    </main>
  )
}

export default WrongNotesPage