import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Clock3,
  Expand,
  ImageOff,
  KeyRound,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import './HistoryDetailPage.css'

import { apiFetch } from '../../lib/api'

type SavedStudyRecord = {
  id: number
  date: string
  subject: string
  recordType?: 'general' | 'certification'
  certificationName?: string | null
  examType?: 'written' | 'practical' | null
  examDate?: string | null
  unit: string
  minutes: number
  learned: string
  difficult: string
  keywords: string
  understanding: number
  createdAt?: string
  mistakeQuestion?: string | null
  wrongAnswer?: string | null
  correctAnswer?: string | null
  mistakeReason?: string | null
  wrongImage?: string | null
  wrongImageName?: string | null
  questStatus?: string | null
}

type StudyRecordApiItem = Omit<
  SavedStudyRecord,
  'id' | 'minutes' | 'understanding'
> & {
  id: string | number
  minutes: string | number
  understanding: string | number
}

type StudyRecordApiResponse = {
  success: boolean
  message?: string
  data?: StudyRecordApiItem
}

type DeleteRecordApiResponse = {
  success: boolean
  message?: string
}

type StudyRecommendation = {
  concept: string
  reason: string
  action: string
  examArea?: string
  questionType?: string
}

type StudyRecommendationsResponse = {
  success: boolean
  message?: string
  data?: {
    generator:
      | 'openai'
      | 'rule-based'
      | 'rule-based-fallback'
    recommendations: StudyRecommendation[]
    updatedAt?: string
  } | null
}

const understandingLabels: Record<
  number,
  string
> = {
  1: '어려워요',
  2: '조금 어려워요',
  3: '보통이에요',
  4: '이해했어요',
  5: '완벽해요',
}

function formatRecordDate(date: string) {
  const recordDate = new Date(
    `${date}T00:00:00`,
  )

  return recordDate.toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    },
  )
}

function formatStudyTime(
  minutes: number | string,
) {
  const totalMinutes = Number(minutes)

  if (
    !Number.isFinite(totalMinutes) ||
    totalMinutes <= 0
  ) {
    return '0분'
  }

  const hours = Math.floor(
    totalMinutes / 60,
  )

  const remainingMinutes =
    totalMinutes % 60

  if (hours === 0) {
    return `${remainingMinutes}분`
  }

  if (remainingMinutes === 0) {
    return `${hours}시간`
  }

  return `${hours}시간 ${remainingMinutes}분`
}

function HistoryDetailPage() {
  const { recordId } = useParams()
  const navigate = useNavigate()

  const [record, setRecord] =
    useState<SavedStudyRecord | null>(null)

  const [loadStatus, setLoadStatus] =
    useState<
      'loading' | 'success' | 'error'
    >('loading')

  const [isImageOpen, setIsImageOpen] =
    useState(false)

  const [recommendations, setRecommendations] =
    useState<StudyRecommendation[]>([])

  const [recommendationStatus, setRecommendationStatus] =
    useState<
      'idle' | 'loading' | 'success' | 'error'
    >('idle')

  const [recommendationMessage, setRecommendationMessage] =
    useState('')

  useEffect(() => {
    let ignoreResult = false

    const loadRecord = async () => {
      if (!recordId) {
        setLoadStatus('error')
        return
      }

      setLoadStatus('loading')

      try {
        const response = await apiFetch(
          `/study-records/${recordId}`,
        )

        const result =
          (await response.json()) as StudyRecordApiResponse

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              '학습 기록 상세 조회에 실패했습니다.',
          )
        }

        const normalizedRecord: SavedStudyRecord =
          {
            ...result.data,
            id: Number(result.data.id),
            minutes: Number(
              result.data.minutes,
            ),
            understanding: Number(
              result.data.understanding,
            ),
          }

        if (!ignoreResult) {
          setRecord(normalizedRecord)
          setLoadStatus('success')
          setRecommendations([])
          setRecommendationStatus('idle')
          setRecommendationMessage('')
        }
      } catch (error) {
        console.error(
          '학습 기록을 불러오지 못했습니다.',
          error,
        )

        if (!ignoreResult) {
          setRecord(null)
          setLoadStatus('error')
        }
      }
    }

    void loadRecord()

    return () => {
      ignoreResult = true
    }
  }, [recordId])

  useEffect(() => {
    if (!record) {
      return
    }

    const controller = new AbortController()

    const loadSavedRecommendations = async () => {
      try {
        const response = await apiFetch(
          `/study-recommendations/${record.id}`,
          { signal: controller.signal },
        )
        const result =
          (await response.json()) as StudyRecommendationsResponse

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              '저장된 AI 추천을 불러오지 못했습니다.',
          )
        }

        if (!result.data?.recommendations.length) {
          setRecommendations([])
          setRecommendationStatus('idle')
          setRecommendationMessage('')
          return
        }

        setRecommendations(result.data.recommendations)
        setRecommendationStatus('success')
        setRecommendationMessage(
          result.message ??
            '저장된 AI 맞춤 추천을 불러왔습니다.',
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        console.error(
          '저장된 AI 추천을 불러오지 못했습니다.',
          error,
        )
        setRecommendations([])
        setRecommendationStatus('idle')
        setRecommendationMessage('')
      }
    }

    void loadSavedRecommendations()

    return () => {
      controller.abort()
    }
  }, [record])

  useEffect(() => {
    if (!isImageOpen) {
      return
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setIsImageOpen(false)
      }
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [isImageOpen])

  if (loadStatus === 'loading') {
    return (
      <main className="history-detail-page">
        <section className="history-detail-empty">
          <BookOpen size={31} />

          <h1>
            학습 기록을 불러오는 중이에요.
          </h1>

          <p>잠시만 기다려 주세요.</p>

          <Link to="/history">
            학습 기록으로 돌아가기
          </Link>
        </section>
      </main>
    )
  }

  if (
    loadStatus === 'error' ||
    !record
  ) {
    return (
      <main className="history-detail-page">
        <section className="history-detail-empty">
          <BookOpen size={31} />

          <h1>
            학습 기록을 찾을 수 없어요.
          </h1>

          <p>
            삭제되었거나 존재하지 않는 학습
            기록입니다.
          </p>

          <Link to="/history">
            학습 기록으로 돌아가기
          </Link>
        </section>
      </main>
    )
  }

  const keywords = record.keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)

  const isCertification =
    record.recordType === 'certification' ||
    record.subject.trim() === '자격증'

  const examTypeLabel =
    record.examType === 'practical'
      ? '실기'
      : '필기'

  const handleDelete = async () => {
    const shouldDelete = window.confirm(
      '이 학습 기록을 삭제할까요?',
    )

    if (!shouldDelete) {
      return
    }

    try {
      const response = await apiFetch(
        `/study-records/${record.id}`,
        {
          method: 'DELETE',
        },
      )

      const result =
        (await response.json()) as DeleteRecordApiResponse

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            '학습 기록 삭제에 실패했습니다.',
        )
      }

      const bookName =
        isCertification
          ? record.certificationName || '자격증'
          : record.subject
      const recordType =
        isCertification
          ? 'certification'
          : 'general'

      navigate(
        `/history?type=${recordType}&subject=${encodeURIComponent(bookName)}`,
      )
    } catch (error) {
      console.error(
        '학습 기록을 삭제하지 못했습니다.',
        error,
      )

      window.alert(
        '학습 기록을 삭제하지 못했습니다.',
      )
    }
  }

  const handleRequestRecommendations = async () => {
    setRecommendationStatus('loading')
    setRecommendationMessage('')

    try {
      const response = await apiFetch(
        `/study-recommendations/${record.id}`,
        {
          method: 'POST',
        },
      )

      const result =
        (await response.json()) as StudyRecommendationsResponse

      if (
        !response.ok ||
        !result.success ||
        !result.data?.recommendations.length
      ) {
        throw new Error(
          result.message ??
            'AI 맞춤 추천을 만들지 못했습니다.',
        )
      }

      setRecommendations(
        result.data.recommendations,
      )
      setRecommendationStatus('success')
      setRecommendationMessage(
        result.message ??
          'AI 맞춤 추천을 만들었습니다.',
      )
    } catch (error) {
      setRecommendations([])
      setRecommendationStatus('error')
      setRecommendationMessage(
        error instanceof Error
          ? error.message
          : 'AI 맞춤 추천을 만들지 못했습니다.',
      )
    }
  }

  const subjectNotePath = `/history?type=${
    isCertification ? 'certification' : 'general'
  }&subject=${encodeURIComponent(
    isCertification
      ? record.certificationName || '자격증'
      : record.subject,
  )}`

  return (
    <main className="history-detail-page">
      <div className="history-detail-container">
        <div className="history-detail-topbar">
          <Link to={subjectNotePath}>
            <ArrowLeft size={17} />
            이전으로
          </Link>

          <button
            type="button"
            onClick={handleDelete}
          >
            <Trash2 size={17} />
            기록 삭제
          </button>
        </div>

        <header className="history-detail-heading">
          <span className="history-detail-heading-icon">
            <BookOpen size={26} />
          </span>

          <div>
            <span className="history-detail-eyebrow">
              LEARNING RECORD
            </span>

            <h1>
              {record.unit.trim() ||
                `${record.subject} 학습 기록`}
            </h1>

            <div className="history-detail-heading-meta">
              <span>
                {isCertification
                  ? record.certificationName || '자격증'
                  : record.subject}
              </span>

              {isCertification && (
                <span>{examTypeLabel} 시험 대비</span>
              )}

              <span>
                {formatRecordDate(
                  record.date,
                )}
              </span>
            </div>
          </div>
        </header>

        <section className="history-detail-summary">
          <div>
            <CalendarDays size={20} />

            <span>
              학습 날짜

              <strong>
                {formatRecordDate(
                  record.date,
                )}
              </strong>
            </span>
          </div>

          <div>
            <Clock3 size={20} />

            <span>
              학습 시간

              <strong>
                {formatStudyTime(
                  record.minutes,
                )}
              </strong>
            </span>
          </div>

          <div>
            <Star size={20} />

            <span>
              이해도

              <strong>
                {record.understanding} / 5
                {' · '}
                {understandingLabels[
                  record.understanding
                ] ?? '미선택'}
              </strong>
            </span>
          </div>
        </section>

        <section className="history-detail-card">
          <div className="history-detail-card-heading">
            <Lightbulb size={20} />

            <div>
              <h2>학습 내용</h2>

              <p>
                작성한 학습 내용을 다시
                확인해 보세요.
              </p>
            </div>
          </div>

          <div className="history-detail-learning-grid">
            <div>
              <strong>이해한 내용</strong>

              <p>
                {record.learned ||
                  '등록된 내용이 없습니다.'}
              </p>
            </div>

            <div>
              <strong>다시 볼 내용</strong>

              <p>
                {record.difficult ||
                  '등록된 내용이 없습니다.'}
              </p>
            </div>
          </div>

          {keywords.length > 0 && (
            <div className="history-detail-keywords">
              <span>
                <KeyRound size={15} />
                핵심 키워드
              </span>

              <div>
                {keywords.map(
                  (keyword) => (
                    <strong key={keyword}>
                      {keyword}
                    </strong>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="history-detail-ai">
            <div className="history-detail-ai-heading">
              <span>
                <Sparkles size={18} />
              </span>

              <div>
                <h3>
                  {isCertification
                    ? 'AI 자격증 시험 연계 분석'
                    : 'AI 맞춤 학습 추천'}
                </h3>

                <p>
                  {isCertification
                    ? `${record.certificationName || '자격증'} ${examTypeLabel} 대비 관점에서 학습 기록을 분석합니다.`
                    : '저장된 이해 내용, 다시 볼 내용, 핵심 키워드와 이해도를 함께 분석합니다.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleRequestRecommendations()
                }}
                disabled={
                  recommendationStatus === 'loading'
                }
              >
                {recommendationStatus === 'loading' ? (
                  <>
                    <RefreshCw
                      className="is-spinning"
                      size={15}
                    />
                    분석 중
                  </>
                ) : recommendations.length > 0 ? (
                  <>
                    <RefreshCw size={15} />
                    다시 추천받기
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    AI 추천 받기
                  </>
                )}
              </button>
            </div>

            {isCertification && (
              <div className="history-detail-certification-context">
                <Award size={17} />

                <div>
                  <strong>
                    {record.certificationName || '자격증'} ·{' '}
                    {examTypeLabel}
                    {record.examDate
                      ? ` · ${record.examDate} 예정`
                      : ''}
                  </strong>

                  <p>
                    공식 기출문제 데이터베이스와 직접 대조한 결과가
                    아닙니다. 저장한 내용을 바탕으로 대표적인 시험
                    영역과 대비 유형을 제안하므로, 정확한 출제 범위는
                    공식 출제기준과 시험 공고에서 확인해 주세요.
                  </p>
                </div>
              </div>
            )}

            {recommendationStatus === 'idle' && (
              <p className="history-detail-ai-guide">
                추천이 필요할 때 버튼을 눌러 주세요.
                클릭할 때만 AI 요청이 전송됩니다.
              </p>
            )}

            {recommendationStatus === 'loading' && (
              <div
                className="history-detail-ai-loading"
                role="status"
                aria-live="polite"
              >
                <span />
                <span />
                <span />
              </div>
            )}

            {recommendationStatus === 'error' && (
              <p
                className="history-detail-ai-feedback is-error"
                role="alert"
              >
                {recommendationMessage}
              </p>
            )}

            {recommendationStatus === 'success' && (
              <>
                <p className="history-detail-ai-feedback">
                  {recommendationMessage}
                </p>

                <div className="history-detail-ai-list">
                  {recommendations.map(
                    (recommendation, index) => (
                      <article
                        key={`${recommendation.concept}-${index}`}
                      >
                        <span>
                          {String(index + 1).padStart(
                            2,
                            '0',
                          )}
                        </span>

                        <div>
                          <h4>
                            {recommendation.concept}
                          </h4>

                          {isCertification && (
                            <div className="history-detail-exam-tags">
                              {recommendation.examArea && (
                                <span>
                                  시험 영역 ·{' '}
                                  {recommendation.examArea}
                                </span>
                              )}

                              {recommendation.questionType && (
                                <span>
                                  대비 유형 ·{' '}
                                  {recommendation.questionType}
                                </span>
                              )}
                            </div>
                          )}

                          <dl>
                            <div>
                              <dt>
                                {isCertification
                                  ? '시험 연계 근거'
                                  : '추천 이유'}
                              </dt>
                              <dd>
                                {recommendation.reason}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                {isCertification
                                  ? '추천 시험 대비 행동'
                                  : '다음 학습 행동'}
                              </dt>
                              <dd>
                                {recommendation.action}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="history-detail-card">
          <div className="history-detail-card-heading">
            <ImageOff size={20} />

            <div>
              <h2>등록한 오답</h2>

              <p>
                오답 이미지와 틀린 이유를
                함께 확인할 수 있어요.
              </p>
            </div>
          </div>

          <div className="history-detail-mistake-layout">
            <div className="history-detail-image-area">
              {record.wrongImage ? (
                <button
                  type="button"
                  className="history-detail-image-button"
                  onClick={() =>
                    setIsImageOpen(true)
                  }
                >
                  <img
                    src={record.wrongImage}
                    alt={
                      record.wrongImageName
                        ? `${record.wrongImageName} 오답 이미지`
                        : '등록한 오답 이미지'
                    }
                  />

                  <span>
                    <Expand size={16} />
                    크게 보기
                  </span>
                </button>
              ) : (
                <div className="history-detail-no-image">
                  <ImageOff size={30} />

                  <strong>
                    등록된 오답 이미지가
                    없어요.
                  </strong>

                  <span>
                    아직 연결된 오답노트가
                    없습니다.
                  </span>
                </div>
              )}
            </div>

            <div className="history-detail-mistake-info">
              <div className="history-detail-question">
                <strong>문제 내용</strong>

                <p>
                  {record.mistakeQuestion ||
                    '등록된 문제 내용이 없습니다.'}
                </p>
              </div>

              <div className="history-detail-answer-grid">
                <div className="is-wrong">
                  <strong>
                    내가 작성한 오답
                  </strong>

                  <p>
                    {record.wrongAnswer ||
                      '등록된 오답이 없습니다.'}
                  </p>
                </div>

                <div className="is-correct">
                  <strong>실제 정답</strong>

                  <p>
                    {record.correctAnswer ||
                      '등록된 정답이 없습니다.'}
                  </p>
                </div>
              </div>

              <div className="history-detail-reason">
                <strong>틀린 이유</strong>

                <p>
                  {record.mistakeReason ||
                    '등록된 이유가 없습니다.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="history-detail-actions">
          <Link
            className="history-detail-list-button"
            to="/history"
          >
            목록으로 돌아가기
          </Link>

          <Link
            className="history-detail-quest-button"
            to={`/quest-review/${record.id}`}
          >
            <Sparkles size={18} />
            복습 문제 생성하기
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>

      {isImageOpen &&
        record.wrongImage && (
          <div
            className="history-image-modal"
            role="dialog"
            aria-modal="true"
            aria-label="오답 이미지 크게 보기"
            onClick={() =>
              setIsImageOpen(false)
            }
          >
            <div
              className="history-image-modal-content"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                onClick={() =>
                  setIsImageOpen(false)
                }
                aria-label="이미지 닫기"
              >
                <X size={22} />
              </button>

              <img
                src={record.wrongImage}
                alt={
                  record.wrongImageName
                    ? `${record.wrongImageName} 크게 보기`
                    : '오답 이미지 크게 보기'
                }
              />
            </div>
          </div>
        )}
    </main>
  )
}

export default HistoryDetailPage
