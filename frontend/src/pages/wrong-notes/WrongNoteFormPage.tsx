import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  Link,
  useLocation,
  useSearchParams,
} from 'react-router'

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ImagePlus,
  Link2,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'

import './WrongNoteFormPage.css'

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

type WrongNoteForm = {
  studyRecordId: string
  date: string
  subject: string
  unit: string
  mistakeQuestion: string
  wrongAnswer: string
  correctAnswer: string
  mistakeReason: string
  concepts: string
}

type WrongNoteNavigationState = {
  wrongImage?: string
  wrongImageName?: string
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
  questStatus: 'not-generated'
  createdAt: string
}

function getToday() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60_000

  return new Date(today.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10)
}

function loadStudyRecords() {
  try {
    const storedRecords = JSON.parse(
      localStorage.getItem('request-study-records') ?? '[]',
    )

    if (!Array.isArray(storedRecords)) {
      return []
    }

    return (storedRecords as SavedStudyRecord[]).sort(
      (firstRecord, secondRecord) => {
        const firstTime = new Date(
          firstRecord.createdAt ??
            `${firstRecord.date}T00:00:00`,
        ).getTime()

        const secondTime = new Date(
          secondRecord.createdAt ??
            `${secondRecord.date}T00:00:00`,
        ).getTime()

        return secondTime - firstTime
      },
    )
  } catch (error) {
    console.error('학습 기록을 불러오지 못했습니다.', error)
    return []
  }
}

function createInitialForm(
  studyRecords: SavedStudyRecord[],
  requestedRecordId: string | null,
): WrongNoteForm {
  const linkedRecord = studyRecords.find(
    (record) => String(record.id) === requestedRecordId,
  )

  if (linkedRecord) {
    return {
      studyRecordId: String(linkedRecord.id),
      date: linkedRecord.date,
      subject: linkedRecord.subject,
      unit: linkedRecord.unit,
      mistakeQuestion: '',
      wrongAnswer: '',
      correctAnswer: '',
      mistakeReason: '',
      concepts: linkedRecord.keywords,
    }
  }

  return {
    studyRecordId: '',
    date: getToday(),
    subject: '수학',
    unit: '',
    mistakeQuestion: '',
    wrongAnswer: '',
    correctAnswer: '',
    mistakeReason: '',
    concepts: '',
  }
}

function formatRecordOption(record: SavedStudyRecord) {
  const date = new Date(`${record.date}T00:00:00`)

  const formattedDate = date.toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  })

  return `${formattedDate} · ${record.subject} · ${
    record.unit || '단원 미입력'
  }`
}

function WrongNoteFormPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const navigationState =
    location.state as WrongNoteNavigationState | null

  const [studyRecords] = useState<SavedStudyRecord[]>(
    loadStudyRecords,
  )

  const [form, setForm] = useState<WrongNoteForm>(() =>
    createInitialForm(
      studyRecords,
      searchParams.get('studyRecordId'),
    ),
  )

  const imageInputRef = useRef<HTMLInputElement>(null)

  const [wrongImage, setWrongImage] = useState(
    navigationState?.wrongImage ?? '',
  )

  const [wrongImageName, setWrongImageName] = useState(
    navigationState?.wrongImageName ?? '',
  )
  
  const [imageError, setImageError] = useState('')

  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saved' | 'error'
  >('idle')

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }))

    setSaveStatus('idle')
  }

  const handleStudyRecordChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const studyRecordId = event.target.value

    if (!studyRecordId) {
      setForm((previousForm) => ({
        ...previousForm,
        studyRecordId: '',
      }))

      setSaveStatus('idle')
      return
    }

    const selectedRecord = studyRecords.find(
      (record) => String(record.id) === studyRecordId,
    )

    if (!selectedRecord) {
      return
    }

    setForm((previousForm) => ({
      ...previousForm,
      studyRecordId,
      date: selectedRecord.date,
      subject: selectedRecord.subject,
      unit: selectedRecord.unit,
      concepts:
        previousForm.concepts || selectedRecord.keywords,
    }))

    setSaveStatus('idle')
  }

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png']

    if (!allowedTypes.includes(file.type)) {
      setImageError('JPG 또는 PNG 이미지만 등록할 수 있습니다.')
      event.target.value = ''
      return
    }

    if (file.size > 1024 * 1024) {
      setImageError(
        '현재 프론트 단계에서는 1MB 이하 이미지를 선택해 주세요.',
      )
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setImageError('이미지를 불러오지 못했습니다.')
        return
      }

      setWrongImage(reader.result)
      setWrongImageName(file.name)
      setImageError('')
      setSaveStatus('idle')
    }

    reader.onerror = () => {
      setImageError('이미지를 불러오지 못했습니다.')
    }

    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setWrongImage('')
    setWrongImageName('')
    setImageError('')
    setSaveStatus('idle')

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!wrongImage) {
      setImageError('오답 문제 이미지를 한 장 등록해 주세요.')

      imageInputRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      return
    }

    const newWrongNote: SavedWrongNote = {
      id: Date.now(),
      studyRecordId: form.studyRecordId
        ? Number(form.studyRecordId)
        : null,
      date: form.date,
      subject: form.subject,
      unit: form.unit.trim(),
      mistakeQuestion: form.mistakeQuestion.trim(),
      wrongAnswer: form.wrongAnswer.trim(),
      correctAnswer: form.correctAnswer.trim(),
      mistakeReason: form.mistakeReason.trim(),
      concepts: form.concepts.trim(),
      wrongImage,
      wrongImageName,
      questStatus: 'not-generated',
      createdAt: new Date().toISOString(),
    }

    try {
      const storedWrongNotes = JSON.parse(
        localStorage.getItem('request-wrong-notes') ?? '[]',
      )

      const previousWrongNotes = Array.isArray(
        storedWrongNotes,
      )
        ? (storedWrongNotes as SavedWrongNote[])
        : []

      localStorage.setItem(
        'request-wrong-notes',
        JSON.stringify([...previousWrongNotes, newWrongNote]),
      )

      setSaveStatus('saved')
    } catch (error) {
      console.error('오답 노트를 저장하지 못했습니다.', error)
      setSaveStatus('error')
    }
  }

  return (
    <main className="wrong-note-form-page">
      <div className="wrong-note-form-container">
        <div className="wrong-note-form-topbar">
          <Link to="/wrong-notes">
            <ArrowLeft size={17} />
            이번 주로 돌아가기
          </Link>

          <span>오답 노트 · 새 기록</span>
        </div>

        <header className="wrong-note-form-heading">
          <span className="wrong-note-form-heading-icon">
            <BookOpen size={26} />
          </span>

          <div>
            <span className="wrong-note-form-eyebrow">
              WRONG ANSWER NOTE
            </span>

            <h1>어떤 문제에서 막혔나요?</h1>

            <p>
              틀린 답과 이유를 기록하면 취약한 개념을
              찾고,
              <br />
              나에게 필요한 복습 문제를 만들 수 있어요.
            </p>
          </div>
        </header>

        <form
          className="wrong-note-form"
          onSubmit={handleSubmit}
        >
          <section className="wrong-note-form-card">
            <div className="wrong-note-card-heading">
              <span>
                <Link2 size={19} />
              </span>

              <div>
                <h2>학습 기록 연결</h2>
                <p>
                  기존 학습 기록을 선택하면 날짜와 단원이
                  자동으로 입력됩니다.
                </p>
              </div>
            </div>

            <label className="wrong-note-field">
              <span>연결할 학습 기록</span>

              <select
                value={form.studyRecordId}
                onChange={handleStudyRecordChange}
              >
                <option value="">
                  연결하지 않고 직접 입력
                </option>

                {studyRecords.map((record) => (
                  <option
                    value={record.id}
                    key={record.id}
                  >
                    {formatRecordOption(record)}
                  </option>
                ))}
              </select>

              <small>
                학습 기록 연결은 선택 사항입니다.
              </small>
            </label>

            <div className="wrong-note-basic-fields">
              <label className="wrong-note-field">
                <span>오답 날짜</span>

                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="wrong-note-field">
                <span>과목</span>

                <select
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                >
                  <option value="수학">수학</option>
                  <option value="국어">국어</option>
                  <option value="영어">영어</option>
                  <option value="과학">과학</option>
                  <option value="사회">사회</option>
                  <option value="기타">기타</option>
                </select>
              </label>

              <label className="wrong-note-field">
                <span>단원</span>

                <input
                  type="text"
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  placeholder="예: 이차함수의 그래프 이동"
                  required
                />
              </label>
            </div>
          </section>

          <section className="wrong-note-form-card">
            <div className="wrong-note-card-heading">
              <span>
                <ImagePlus size={19} />
              </span>

              <div>
                <h2>오답 문제 등록</h2>
                <p>
                  문제 이미지와 내가 틀린 내용을 함께
                  기록해 주세요.
                </p>
              </div>
            </div>

            <div className="wrong-note-editor">
              <div className="wrong-note-upload-section">
                <span className="wrong-note-section-label">
                  오답 이미지
                </span>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={handleImageChange}
                  hidden
                />

                {wrongImage ? (
                  <div className="wrong-note-preview">
                    <img
                      src={wrongImage}
                      alt={`${wrongImageName} 미리보기`}
                    />

                    <div>
                      <span>{wrongImageName}</span>

                      <button
                        type="button"
                        onClick={handleRemoveImage}
                      >
                        <Trash2 size={17} />
                        삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="wrong-note-upload-button"
                    onClick={() =>
                      imageInputRef.current?.click()
                    }
                  >
                    <Upload size={28} />

                    <strong>오답 이미지 선택하기</strong>

                    <span>
                      JPG 또는 PNG · 현재 최대 1MB
                    </span>
                  </button>
                )}

                {imageError && (
                  <p
                    className="wrong-note-image-error"
                    role="alert"
                  >
                    {imageError}
                  </p>
                )}
              </div>

              <div className="wrong-note-writing-fields">
                <label className="wrong-note-field">
                  <span>문제 내용</span>

                  <textarea
                    name="mistakeQuestion"
                    value={form.mistakeQuestion}
                    onChange={handleChange}
                    placeholder="문제 내용을 입력해 주세요."
                    rows={4}
                    required
                  />
                </label>

                <div className="wrong-note-answer-fields">
                  <label className="wrong-note-field">
                    <span>내가 작성한 오답</span>

                    <input
                      type="text"
                      name="wrongAnswer"
                      value={form.wrongAnswer}
                      onChange={handleChange}
                      placeholder="내가 작성한 답"
                      required
                    />
                  </label>

                  <label className="wrong-note-field">
                    <span>실제 정답</span>

                    <input
                      type="text"
                      name="correctAnswer"
                      value={form.correctAnswer}
                      onChange={handleChange}
                      placeholder="문제의 실제 정답"
                      required
                    />
                  </label>
                </div>

                <label className="wrong-note-field">
                  <span>틀린 이유</span>

                  <textarea
                    name="mistakeReason"
                    value={form.mistakeReason}
                    onChange={handleChange}
                    placeholder="어떤 부분을 잘못 생각했는지 적어 주세요."
                    rows={4}
                    required
                  />
                </label>

                <label className="wrong-note-field">
                  <span>핵심 개념</span>

                  <input
                    type="text"
                    name="concepts"
                    value={form.concepts}
                    onChange={handleChange}
                    placeholder="예: 이차함수, 평행이동, 꼭짓점"
                  />

                  <small>
                    여러 개념은 쉼표로 구분해 주세요.
                  </small>
                </label>
              </div>
            </div>
          </section>

          {saveStatus === 'saved' && (
            <div className="wrong-note-message is-success">
              <CheckCircle2 size={19} />
              오답 노트가 저장되었습니다.
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="wrong-note-message is-error">
              오답 노트를 저장하지 못했습니다. 다시 시도해
              주세요.
            </div>
          )}

          <div className="wrong-note-form-actions">
            <Link to="/wrong-notes">취소</Link>

            <button
              type="submit"
              disabled={saveStatus === 'saved'}
            >
              {saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 size={18} />
                  저장 완료
                </>
              ) : (
                <>
                  <Save size={18} />
                  오답 노트 저장하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default WrongNoteFormPage