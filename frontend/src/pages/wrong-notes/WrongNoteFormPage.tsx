import {
  useEffect,
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

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'

type StudyRecordApiItem = {
  id: number | string
  date: string
  subject: string
  unit: string
  minutes: number | string
  learned: string
  difficult: string
  keywords: string
  understanding: number | string
  createdAt?: string
}

type StudyRecordsApiResponse = {
  success: boolean
  message?: string
  data?: StudyRecordApiItem[]
}

type SaveWrongNoteApiResponse = {
  success: boolean
  message?: string
  data?: {
    id: number | string
  }
}

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

function getToday() {
  const today = new Date()
  const timezoneOffset =
    today.getTimezoneOffset() * 60_000

  return new Date(
    today.getTime() - timezoneOffset,
  )
    .toISOString()
    .slice(0, 10)
}

async function loadStudyRecordsFromApi(): Promise<
  SavedStudyRecord[]
> {
  const response = await fetch(
    `${API_BASE_URL}/study-records`,
  )

  const result =
    (await response.json()) as StudyRecordsApiResponse

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        '학습 기록을 불러오지 못했습니다.',
    )
  }

  return result.data.map((record) => ({
    id: Number(record.id),
    date: record.date,
    subject: record.subject,
    unit: record.unit,
    minutes: String(record.minutes),
    learned: record.learned,
    difficult: record.difficult,
    keywords: record.keywords,
    understanding: Number(record.understanding),
    createdAt: record.createdAt,
  }))
}

function createInitialForm(
  studyRecords: SavedStudyRecord[],
  requestedRecordId: string | null,
): WrongNoteForm {
  const linkedRecord = studyRecords.find(
    (record) =>
      String(record.id) === requestedRecordId,
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

function formatRecordOption(
  record: SavedStudyRecord,
) {
  const date = new Date(
    `${record.date}T00:00:00`,
  )

  const formattedDate =
    date.toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    })

  return `${formattedDate} · ${record.subject} · ${
    record.unit || '단원 미입력'
  }`
}

function convertDataUrlToFile(
  dataUrl: string,
  fileName: string,
) {
  try {
    const [information, encodedData] =
      dataUrl.split(',')

    if (!information || !encodedData) {
      return null
    }

    const mimeType =
      information.match(
        /data:(.*?);base64/,
      )?.[1] ?? 'image/png'

    const decodedData = window.atob(encodedData)
    const bytes = new Uint8Array(
      decodedData.length,
    )

    for (
      let index = 0;
      index < decodedData.length;
      index += 1
    ) {
      bytes[index] =
        decodedData.charCodeAt(index)
    }

    return new File([bytes], fileName, {
      type: mimeType,
    })
  } catch (error) {
    console.error(
      '전달된 이미지를 파일로 변환하지 못했습니다.',
      error,
    )

    return null
  }
}

function WrongNoteFormPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const requestedStudyRecordId =
    searchParams.get('studyRecordId')

  const navigationState =
    location.state as WrongNoteNavigationState | null

  const [studyRecords, setStudyRecords] =
    useState<SavedStudyRecord[]>([])

  const [form, setForm] =
    useState<WrongNoteForm>(() =>
      createInitialForm(
        [],
        requestedStudyRecordId,
      ),
    )

  const imageInputRef =
    useRef<HTMLInputElement>(null)

  const [wrongImage, setWrongImage] =
    useState(
      navigationState?.wrongImage ?? '',
    )

  const [wrongImageName, setWrongImageName] =
    useState(
      navigationState?.wrongImageName ?? '',
    )

  const [
    wrongImageFile,
    setWrongImageFile,
  ] = useState<File | null>(() => {
    if (
      !navigationState?.wrongImage ||
      !navigationState.wrongImageName
    ) {
      return null
    }

    return convertDataUrlToFile(
      navigationState.wrongImage,
      navigationState.wrongImageName,
    )
  })

  const [imageError, setImageError] =
    useState('')

  const [recordLoadError, setRecordLoadError] =
    useState('')

  const [saveMessage, setSaveMessage] =
    useState('')

  const [saveStatus, setSaveStatus] =
    useState<
      'idle' | 'saving' | 'saved' | 'error'
    >('idle')

  useEffect(() => {
    let cancelled = false

    const loadRecords = async () => {
      try {
        setRecordLoadError('')

        const records =
          await loadStudyRecordsFromApi()

        if (cancelled) {
          return
        }

        setStudyRecords(records)

        if (requestedStudyRecordId) {
          const linkedRecord = records.find(
            (record) =>
              String(record.id) ===
              requestedStudyRecordId,
          )

          if (linkedRecord) {
            setForm(
              createInitialForm(
                records,
                requestedStudyRecordId,
              ),
            )
          }
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error(
          '학습 기록 불러오기 실패:',
          error,
        )

        setRecordLoadError(
          error instanceof Error
            ? error.message
            : '학습 기록을 불러오지 못했습니다.',
        )
      }
    }

    void loadRecords()

    return () => {
      cancelled = true
    }
  }, [requestedStudyRecordId])

  const handleChange = (
    event: ChangeEvent<
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }))

    setSaveStatus('idle')
    setSaveMessage('')
  }

  const handleStudyRecordChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const studyRecordId =
      event.target.value

    if (!studyRecordId) {
      setForm((previousForm) => ({
        ...previousForm,
        studyRecordId: '',
      }))

      setSaveStatus('idle')
      setSaveMessage('')
      return
    }

    const selectedRecord =
      studyRecords.find(
        (record) =>
          String(record.id) ===
          studyRecordId,
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
        previousForm.concepts ||
        selectedRecord.keywords,
    }))

    setSaveStatus('idle')
    setSaveMessage('')
  }

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
    ]

    if (!allowedTypes.includes(file.type)) {
      setImageError(
        'JPG 또는 PNG 이미지만 등록할 수 있습니다.',
      )

      setWrongImageFile(null)
      event.target.value = ''
      return
    }

    const maximumFileSize =
      10 * 1024 * 1024

    if (file.size > maximumFileSize) {
      setImageError(
        '이미지 크기는 10MB 이하여야 합니다.',
      )

      setWrongImageFile(null)
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (
        typeof reader.result !== 'string'
      ) {
        setImageError(
          '이미지를 불러오지 못했습니다.',
        )
        return
      }

      setWrongImage(reader.result)
      setWrongImageName(file.name)
      setWrongImageFile(file)
      setImageError('')
      setSaveStatus('idle')
      setSaveMessage('')
    }

    reader.onerror = () => {
      setWrongImageFile(null)

      setImageError(
        '이미지를 불러오지 못했습니다.',
      )
    }

    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setWrongImage('')
    setWrongImageName('')
    setWrongImageFile(null)
    setImageError('')
    setSaveStatus('idle')
    setSaveMessage('')

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!wrongImageFile) {
      setImageError(
        '오답 문제 이미지를 한 장 등록해 주세요.',
      )

      setSaveStatus('error')
      setSaveMessage(
        '저장할 오답 이미지를 선택해 주세요.',
      )

      imageInputRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      return
    }

    setImageError('')
    setSaveMessage('')
    setSaveStatus('saving')

    const requestBody = new FormData()

    requestBody.append(
      'studyRecordId',
      form.studyRecordId,
    )

    requestBody.append(
      'date',
      form.date,
    )

    requestBody.append(
      'subject',
      form.subject,
    )

    requestBody.append(
      'unit',
      form.unit.trim(),
    )

    requestBody.append(
      'mistakeQuestion',
      form.mistakeQuestion.trim(),
    )

    requestBody.append(
      'wrongAnswer',
      form.wrongAnswer.trim(),
    )

    requestBody.append(
      'correctAnswer',
      form.correctAnswer.trim(),
    )

    requestBody.append(
      'mistakeReason',
      form.mistakeReason.trim(),
    )

    requestBody.append(
      'concepts',
      form.concepts.trim(),
    )

    requestBody.append(
      'wrongImage',
      wrongImageFile,
    )

    try {
      const response = await fetch(
        `${API_BASE_URL}/wrong-notes`,
        {
          method: 'POST',
          body: requestBody,
        },
      )

      const result =
        (await response.json()) as SaveWrongNoteApiResponse

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            '오답노트를 저장하지 못했습니다.',
        )
      }

      setSaveStatus('saved')

      setSaveMessage(
        result.message ??
          '오답노트가 저장되었습니다.',
      )
    } catch (error) {
      console.error(
        '오답노트 저장 실패:',
        error,
      )

      setSaveStatus('error')

      setSaveMessage(
        error instanceof Error
          ? error.message
          : '오답노트를 저장하지 못했습니다.',
      )
    }
  }

  return (
    <main className="wrong-note-form-page">
      <div className="wrong-note-form-container">
        <div className="wrong-note-form-topbar">
          <Link to="/wrong-notes">
            <ArrowLeft size={17} />
            오답노트로 돌아가기
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

            <h1>
              어떤 문제에서 막혔나요?
            </h1>

            <p>
              틀린 답과 이유를 기록하면
              취약한 개념을 찾고,
              <br />
              나에게 필요한 복습 문제를
              만들 수 있어요.
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
                  기존 학습 기록을 선택하면
                  날짜와 단원이 자동으로
                  입력됩니다.
                </p>
              </div>
            </div>

            <label className="wrong-note-field">
              <span>연결할 학습 기록</span>

              <select
                value={form.studyRecordId}
                onChange={
                  handleStudyRecordChange
                }
              >
                <option value="">
                  연결하지 않고 직접 입력
                </option>

                {studyRecords.map(
                  (record) => (
                    <option
                      value={record.id}
                      key={record.id}
                    >
                      {formatRecordOption(
                        record,
                      )}
                    </option>
                  ),
                )}
              </select>

              {recordLoadError ? (
                <small>
                  {recordLoadError}
                </small>
              ) : (
                <small>
                  학습 기록 연결은 선택
                  사항입니다.
                </small>
              )}
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
                  <option value="수학">
                    수학
                  </option>

                  <option value="국어">
                    국어
                  </option>

                  <option value="영어">
                    영어
                  </option>

                  <option value="과학">
                    과학
                  </option>

                  <option value="사회">
                    사회
                  </option>

                  <option value="프로그래밍">
                    프로그래밍
                  </option>

                  <option value="기타">
                    기타
                  </option>
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
                  문제 이미지와 내가 틀린
                  내용을 함께 기록해 주세요.
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
                  onChange={
                    handleImageChange
                  }
                  hidden
                />

                {wrongImage ? (
                  <div className="wrong-note-preview">
                    <img
                      src={wrongImage}
                      alt={`${wrongImageName} 미리보기`}
                    />

                    <div>
                      <span>
                        {wrongImageName}
                      </span>

                      <button
                        type="button"
                        onClick={
                          handleRemoveImage
                        }
                      >
                        <Trash2
                          size={17}
                        />
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

                    <strong>
                      오답 이미지 선택하기
                    </strong>

                    <span>
                      JPG 또는 PNG · 최대
                      10MB
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
                    value={
                      form.mistakeQuestion
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="문제 내용을 입력해 주세요."
                    rows={4}
                    required
                  />
                </label>

                <div className="wrong-note-answer-fields">
                  <label className="wrong-note-field">
                    <span>
                      내가 작성한 오답
                    </span>

                    <input
                      type="text"
                      name="wrongAnswer"
                      value={
                        form.wrongAnswer
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="내가 작성한 답"
                      required
                    />
                  </label>

                  <label className="wrong-note-field">
                    <span>실제 정답</span>

                    <input
                      type="text"
                      name="correctAnswer"
                      value={
                        form.correctAnswer
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="문제의 실제 정답"
                      required
                    />
                  </label>
                </div>

                <label className="wrong-note-field">
                  <span>틀린 이유</span>

                  <textarea
                    name="mistakeReason"
                    value={
                      form.mistakeReason
                    }
                    onChange={
                      handleChange
                    }
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
                    required
                  />

                  <small>
                    여러 개념은 쉼표로
                    구분해 주세요.
                  </small>
                </label>
              </div>
            </div>
          </section>

          {saveStatus === 'saved' && (
            <div className="wrong-note-message is-success">
              <CheckCircle2 size={19} />
              {saveMessage ||
                '오답노트가 저장되었습니다.'}
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="wrong-note-message is-error">
              {saveMessage ||
                '오답노트를 저장하지 못했습니다. 다시 시도해 주세요.'}
            </div>
          )}

          <div className="wrong-note-form-actions">
            <Link to="/wrong-notes">
              취소
            </Link>

            <button
              type="submit"
              disabled={
                saveStatus === 'saving' ||
                saveStatus === 'saved'
              }
            >
              {saveStatus ===
              'saved' ? (
                <>
                  <CheckCircle2
                    size={18}
                  />
                  저장 완료
                </>
              ) : saveStatus ===
                'saving' ? (
                <>
                  <Save size={18} />
                  저장 중...
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