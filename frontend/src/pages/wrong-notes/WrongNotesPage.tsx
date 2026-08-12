import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
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

import { apiFetch } from '../../lib/api'


import SubjectBookshelf, {
  type SubjectBookItem,
} from '../../components/subject-bookshelf/SubjectBookshelf'

import './WrongNotesPage.css'
import '../ai-review/AireviewPage.css'

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
  recordType?: 'general' | 'certification' | null
  certificationName?: string | null
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

type SavedWrongNote = Omit<
  WrongNoteApiItem,
  | 'id'
  | 'studyRecordId'
  | 'wrongImage'
  | 'wrongImageName'
  | 'questStatus'
> & {
  id: number
  studyRecordId: number | null
  wrongImage: string
  wrongImageName: string
  questStatus: WrongNoteStatus
}

type WrongNotesApiResponse = {
  success: boolean
  message?: string
  data?: WrongNoteApiItem[]
}

type SubjectsApiResponse = {
  success: boolean
  message?: string
  data?: Array<{
    id: string | number
    name: string
  }>
}

type DeleteWrongNoteApiResponse = {
  success: boolean
  message?: string
  data?: { id: number | string }
}

const statusLabels: Record<WrongNoteStatus, string> = {
  'not-generated': '문제 생성 전',
  ready: '복습 대기',
  'retry-required': '재도전 필요',
  completed: '마스터',
}

function normalizeWrongNoteStatus(status: string | null): WrongNoteStatus {
  if (
    status === 'ready' ||
    status === 'retry-required' ||
    status === 'completed'
  ) {
    return status
  }

  return 'not-generated'
}

function normalizeWrongNotes(items: WrongNoteApiItem[]): SavedWrongNote[] {
  return items.map((wrongNote) => ({
    ...wrongNote,
    id: Number(wrongNote.id),
    studyRecordId:
      wrongNote.studyRecordId === null
        ? null
        : Number(wrongNote.studyRecordId),
    wrongImage: wrongNote.wrongImage ?? '',
    wrongImageName: wrongNote.wrongImageName ?? '',
    concepts: wrongNote.concepts ?? '',
    questStatus: normalizeWrongNoteStatus(wrongNote.questStatus),
  }))
}

function formatWrongNoteDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

type StudyMode = 'general' | 'certification'

function getWrongNoteMode(wrongNote: SavedWrongNote): StudyMode {
  return wrongNote.recordType === 'certification'
    ? 'certification'
    : 'general'
}

function getWrongNoteCollectionName(wrongNote: SavedWrongNote) {
  if (getWrongNoteMode(wrongNote) === 'certification') {
    return wrongNote.certificationName?.trim() || '자격증'
  }

  return wrongNote.subject
}

function WrongNotesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const studyMode: StudyMode =
    searchParams.get('type') === 'certification'
      ? 'certification'
      : 'general'
  const createWrongNotePath = `/wrong-notes/new?type=${studyMode}`
  const [wrongNotes, setWrongNotes] = useState<SavedWrongNote[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [selectedSubject, setSelectedSubject] = useState<string | null>(
    null,
  )
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deletingWrongNoteId, setDeletingWrongNoteId] = useState<
    number | null
  >(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPageData() {
      try {
        setIsLoading(true)
        setLoadError('')

        const [wrongNotesResponse, subjectsResponse] = await Promise.all([
          apiFetch('/wrong-notes', { signal: controller.signal }),
          apiFetch('/subjects', { signal: controller.signal }),
        ])
        const wrongNotesResult =
          (await wrongNotesResponse.json()) as WrongNotesApiResponse
        const subjectsResult =
          (await subjectsResponse.json()) as SubjectsApiResponse

        if (
          !wrongNotesResponse.ok ||
          !wrongNotesResult.success ||
          !wrongNotesResult.data
        ) {
          throw new Error(
            wrongNotesResult.message ?? '오답노트를 불러오지 못했습니다.',
          )
        }

        if (
          !subjectsResponse.ok ||
          !subjectsResult.success ||
          !subjectsResult.data
        ) {
          throw new Error(
            subjectsResult.message ?? '과목을 불러오지 못했습니다.',
          )
        }

        setWrongNotes(normalizeWrongNotes(wrongNotesResult.data))
        setAvailableSubjects(
          subjectsResult.data
            .filter((subject) => subject.name !== '기타')
            .map((subject) => ({
              id: String(subject.id),
              name: subject.name,
            })),
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        console.error('오답노트 목록 조회 실패:', error)
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

    void loadPageData()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    setSelectedSubject(null)
    setSearchText('')
    setStatusFilter('전체')
  }, [studyMode])

  const modeWrongNotes = useMemo(
    () =>
      wrongNotes.filter(
        (wrongNote) => getWrongNoteMode(wrongNote) === studyMode,
      ),
    [studyMode, wrongNotes],
  )

  const subjectBookItems = useMemo<SubjectBookItem[]>(
    () => {
      const collections =
        studyMode === 'certification'
          ? Array.from(
              new Set(modeWrongNotes.map(getWrongNoteCollectionName)),
            ).map((name, index) => ({
              id: `certification-${index}-${name}`,
              name,
            }))
          : availableSubjects.filter(
              (subject) => subject.name !== '자격증',
            )

      return collections.map((subject) => {
        const subjectWrongNotes = modeWrongNotes.filter(
          (wrongNote) =>
            getWrongNoteCollectionName(wrongNote) === subject.name,
        )
        const retryCount = subjectWrongNotes.filter(
          (wrongNote) => wrongNote.questStatus === 'retry-required',
        ).length

        return {
          id: subject.id,
          subject: subject.name,
          eyebrow:
            studyMode === 'certification'
              ? 'CERTIFICATION WRONG NOTE'
              : 'WRONG NOTE',
          meta: `${subjectWrongNotes.length}개 오답 · 재도전 ${retryCount}개`,
        }
      })
    },
    [availableSubjects, modeWrongNotes, studyMode],
  )

  const selectedSubjectWrongNotes = useMemo(() => {
    if (!selectedSubject) {
      return []
    }

    return modeWrongNotes.filter(
      (wrongNote) =>
        getWrongNoteCollectionName(wrongNote) === selectedSubject,
    )
  }, [selectedSubject, modeWrongNotes])

  const filteredWrongNotes = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase()

    return selectedSubjectWrongNotes
      .filter((wrongNote) => {
        const matchesStatus =
          statusFilter === '전체' ||
          wrongNote.questStatus === statusFilter
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
          searchableText.includes(normalizedSearchText)

        return matchesStatus && matchesSearch
      })
      .sort(
        (firstWrongNote, secondWrongNote) =>
          new Date(secondWrongNote.createdAt).getTime() -
          new Date(firstWrongNote.createdAt).getTime(),
      )
  }, [searchText, selectedSubjectWrongNotes, statusFilter])

  const retryRequiredCount = selectedSubjectWrongNotes.filter(
    (wrongNote) => wrongNote.questStatus === 'retry-required',
  ).length
  const completedCount = selectedSubjectWrongNotes.filter(
    (wrongNote) => wrongNote.questStatus === 'completed',
  ).length

  const handleOpenSubjectBook = (book: SubjectBookItem) => {
    setSelectedSubject(book.subject)
    setSearchText('')
    setStatusFilter('전체')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCloseSubjectBook = () => {
    setSelectedSubject(null)
    setSearchText('')
    setStatusFilter('전체')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (wrongNoteId: number) => {
    if (!window.confirm('이 오답노트를 삭제할까요?')) {
      return
    }

    try {
      setDeletingWrongNoteId(wrongNoteId)

      const response = await apiFetch(
        `/wrong-notes/${wrongNoteId}`,
        { method: 'DELETE' },
      )
      const result =
        (await response.json()) as DeleteWrongNoteApiResponse

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? '오답노트를 삭제하지 못했습니다.',
        )
      }

      setWrongNotes((previousWrongNotes) =>
        previousWrongNotes.filter(
          (wrongNote) => wrongNote.id !== wrongNoteId,
        ),
      )
    } catch (error) {
      console.error('오답노트 삭제 실패:', error)
      window.alert(
        error instanceof Error
          ? error.message
          : '오답노트를 삭제하지 못했습니다.',
      )
    } finally {
      setDeletingWrongNoteId(null)
    }
  }

  if (selectedSubject) {
    return (
      <main className="wrong-notes-page ai-review-page">
        <div className="review-note-toolbar">
          <button
            type="button"
            className="review-back-button"
            onClick={handleCloseSubjectBook}
          >
            <ArrowLeft size={18} />
            {studyMode === 'certification'
              ? '자격증 노트 목록'
              : '과목 노트 목록'}
          </button>
        </div>

        <section className="opened-review-note wrong-notes-opened-note">
          <div className="opened-note-heading">
            <span className="opened-note-icon">
              <BookOpen size={26} />
            </span>

            <div>
              <span className="opened-note-label">WRONG ANSWER NOTE</span>
              <h1>{selectedSubject} 오답 노트</h1>
              <p>
                틀린 문제와 이유를 다시 확인하고 부족한 개념을 끝까지
                복습해 보세요.
              </p>
            </div>
          </div>

          <div className="review-note-summary">
            <div>
              <FileQuestion size={20} />
              <span>등록한 오답</span>
              <strong>{selectedSubjectWrongNotes.length}개</strong>
            </div>

            <div>
              <AlertCircle size={20} />
              <span>재도전 필요</span>
              <strong>{retryRequiredCount}개</strong>
            </div>

            <div>
              <CheckCircle2 size={20} />
              <span>마스터</span>
              <strong>{completedCount}개</strong>
            </div>
          </div>

          <div className="review-note-content wrong-notes-note-content">
            <div className="review-note-section-heading">
              <div>
                <span>WRONG ANSWER ARCHIVE</span>
                <h2>오답과 복습 상태</h2>
              </div>

              <Link
                className="wrong-notes-note-create-button"
                to={createWrongNotePath}
              >
                <Plus size={17} />
                새 오답 등록
              </Link>
            </div>

            <section className="wrong-notes-toolbar wrong-notes-note-toolbar">
              <label className="wrong-notes-search">
                <Search size={18} />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="단원, 문제, 개념 검색"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="복습 상태 필터"
              >
                <option value="전체">전체 상태</option>
                <option value="not-generated">문제 생성 전</option>
                <option value="ready">복습 대기</option>
                <option value="retry-required">재도전 필요</option>
                <option value="completed">마스터</option>
              </select>
            </section>

            {selectedSubjectWrongNotes.length === 0 ? (
              <div className="empty-review-note">
                <BookOpen size={42} />
                <h3>아직 등록된 오답이 없어요.</h3>
                <p>먼저 {selectedSubject} 오답을 기록해 주세요.</p>
                <Link
                  className="wrong-notes-empty-create-button"
                  to={createWrongNotePath}
                >
                  첫 오답 등록하기
                </Link>
              </div>
            ) : filteredWrongNotes.length === 0 ? (
              <div className="empty-review-note">
                <Search size={42} />
                <h3>선택한 조건의 오답이 없어요.</h3>
                <p>검색어나 복습 상태를 변경해 보세요.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchText('')
                    setStatusFilter('전체')
                  }}
                >
                  전체 오답 보기
                </button>
              </div>
            ) : (
              <section className="wrong-notes-list">
                {filteredWrongNotes.map((wrongNote) => {
                  const concepts = wrongNote.concepts
                    .split(',')
                    .map((concept) => concept.trim())
                    .filter(Boolean)
                  const status = wrongNote.questStatus

                  return (
                    <article className="wrong-note-card" key={wrongNote.id}>
                      <div className="wrong-note-thumbnail">
                        {wrongNote.wrongImage ? (
                          <img
                            src={wrongNote.wrongImage}
                            alt={`${wrongNote.unit} 오답`}
                          />
                        ) : (
                          <BookOpen size={28} />
                        )}
                      </div>

                      <div className="wrong-note-card-content">
                        <div className="wrong-note-card-header">
                          <div>
                            <span className="wrong-note-date">
                              <CalendarDays size={15} />
                              {formatWrongNoteDate(wrongNote.date)}
                            </span>
                            <span className="wrong-note-subject">
                              {wrongNote.subject}
                            </span>
                            {wrongNote.studyRecordId ? (
                              <span className="wrong-note-linked">
                                <Link2 size={12} />
                                학습 기록 연결됨
                              </span>
                            ) : null}
                          </div>

                          <span className={`wrong-note-status is-${status}`}>
                            {statusLabels[status]}
                          </span>
                        </div>

                        <h2>
                          {wrongNote.unit || `${wrongNote.subject} 오답`}
                        </h2>
                        <p className="wrong-note-question">
                          {wrongNote.mistakeQuestion}
                        </p>

                        <div className="wrong-note-answer-preview">
                          <div className="is-wrong">
                            <strong>내 답</strong>
                            <span>{wrongNote.wrongAnswer}</span>
                          </div>
                          <div className="is-correct">
                            <strong>정답</strong>
                            <span>{wrongNote.correctAnswer}</span>
                          </div>
                        </div>

                        <div className="wrong-note-card-footer">
                          <div className="wrong-note-concepts">
                            {concepts.length > 0 ? (
                              concepts.map((concept) => (
                                <span key={concept}>{concept}</span>
                              ))
                            ) : (
                              <span>개념 미입력</span>
                            )}
                          </div>

                          <div className="wrong-note-card-actions">
                            <Link to={`/wrong-notes/${wrongNote.id}`}>
                              상세보기
                              <ArrowRight size={15} />
                            </Link>
                            <button
                              type="button"
                              disabled={
                                deletingWrongNoteId === wrongNote.id
                              }
                              onClick={() => void handleDelete(wrongNote.id)}
                              aria-label={`${wrongNote.unit} 오답 삭제`}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="wrong-notes-page ai-review-page">
      <header className="archive-page-heading">
        <span className="archive-page-heading-icon" aria-hidden="true">
          <FileQuestion size={27} />
        </span>
        <div className="archive-page-heading-copy">
          <span className="archive-page-eyebrow">WRONG ANSWER ARCHIVE</span>
          <h1>
            {studyMode === 'certification'
              ? '나의 자격증 오답 노트'
              : '나의 일반 학습 오답 노트'}
          </h1>
          <p>
            {studyMode === 'certification'
              ? '자격증별 오답 노트를 열어 시험에서 놓친 문제와 복습 상태를 확인해 보세요.'
              : '과목별 오답 노트를 열어 틀린 문제와 복습 상태를 한눈에 확인해 보세요.'}
          </p>
        </div>
      </header>

      <nav className="study-type-switcher" aria-label="오답노트 유형">
        <button
          type="button"
          className={studyMode === 'general' ? 'is-active' : ''}
          onClick={() => setSearchParams({ type: 'general' })}
        >
          일반 학습
        </button>
        <button
          type="button"
          className={studyMode === 'certification' ? 'is-active' : ''}
          onClick={() => setSearchParams({ type: 'certification' })}
        >
          자격증 공부
        </button>
      </nav>

      {isLoading ? (
        <div className="review-page-message">
          오답 노트를 불러오고 있습니다.
        </div>
      ) : loadError ? (
        <div className="review-page-message is-error">
          <strong>오답 노트를 불러오지 못했습니다.</strong>
          <span>{loadError}</span>
        </div>
      ) : (
        <section className="review-library">
          <div className="review-library-heading">
            <div>
              <span>
                {studyMode === 'certification'
                  ? 'MY CERTIFICATES'
                  : 'MY SUBJECTS'}
              </span>
              <h2>
                {studyMode === 'certification'
                  ? '자격증별 오답 노트'
                  : '과목별 오답 노트'}
              </h2>
            </div>
            <p>
              노트를 선택하면 표지가 열리면서 해당{' '}
              {studyMode === 'certification' ? '자격증' : '과목'}의
              오답과 복습 상태가 나타납니다.
            </p>
          </div>

          <SubjectBookshelf
            items={subjectBookItems}
            variant="wrong-note"
            hoverLabel="오답 노트 열어보기"
            emptyMessage="아직 등록된 과목이 없습니다."
            onOpen={handleOpenSubjectBook}
          />
        </section>
      )}
    </main>
  )
}

export default WrongNotesPage
