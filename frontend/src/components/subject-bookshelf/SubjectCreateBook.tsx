import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  BookPlus,
  Plus,
  X,
} from 'lucide-react'

import { apiFetch } from '../../lib/api'
import './SubjectCreateBook.css'

export interface CreatedSubject {
  id: string
  name: string
}

interface SubjectCreateBookProps {
  onCreated: (
    subject: CreatedSubject,
  ) => void
}

interface CreateSubjectResponse {
  success: boolean
  message?: string
  data?: {
    id: string | number
    name: string
  }
}

function SubjectCreateBook({
  onCreated,
}: SubjectCreateBookProps) {
  const [
    isModalOpen,
    setIsModalOpen,
  ] = useState(false)

  const [
    subjectName,
    setSubjectName,
  ] = useState('')

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const inputRef =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    inputRef.current?.focus()

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === 'Escape' &&
        !isSubmitting
      ) {
        setIsModalOpen(false)
        setSubjectName('')
        setErrorMessage('')
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [
    isModalOpen,
    isSubmitting,
  ])

  const openModal = () => {
    setSubjectName('')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) {
      return
    }

    setIsModalOpen(false)
    setSubjectName('')
    setErrorMessage('')
  }

  const handleBackdropClick = (
    event: MouseEvent<HTMLDivElement>,
  ) => {
    if (
      event.target ===
      event.currentTarget
    ) {
      closeModal()
    }
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const trimmedName =
      subjectName.trim()

    if (!trimmedName) {
      setErrorMessage(
        '과목명을 입력해 주세요.',
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
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
          CreateSubjectResponse

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            '과목을 추가하지 못했습니다.',
        )
      }

      onCreated({
        id: String(result.data.id),
        name: result.data.name,
      })

      setIsModalOpen(false)
      setSubjectName('')
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '과목을 추가하지 못했습니다.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="subject-book subject-create-book"
        onClick={openModal}
        aria-label="새 과목 추가"
      >
        <span className="subject-book__pages subject-create-book__pages" />

        <span className="subject-book__cover subject-create-book__cover">
          <span className="subject-book__spine subject-create-book__spine" />

          <span className="subject-create-book__content">
            <span className="subject-create-book__icon">
              <Plus
                size={30}
                strokeWidth={1.6}
              />
            </span>

            <strong>과목 추가</strong>

            <small>
              새 학습 노트 만들기
            </small>
          </span>
        </span>
      </button>

      {isModalOpen && (
        <div
          className="subject-create-backdrop"
          role="presentation"
          onMouseDown={
            handleBackdropClick
          }
        >
          <section
            className="subject-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-create-title"
          >
            <button
              type="button"
              className="subject-create-close"
              aria-label="과목 추가 창 닫기"
              disabled={isSubmitting}
              onClick={closeModal}
            >
              <X size={20} />
            </button>

            <span className="subject-create-modal-icon">
              <BookPlus
                size={28}
                strokeWidth={1.7}
              />
            </span>

            <h2 id="subject-create-title">
              새 과목 추가
            </h2>

            <p>
              공부할 과목명을 입력하면 새로운
              학습 노트가 책장에 추가됩니다.
            </p>

            <form
              onSubmit={handleSubmit}
            >
              <label htmlFor="new-subject-name">
                과목명
              </label>

              <input
                ref={inputRef}
                id="new-subject-name"
                type="text"
                value={subjectName}
                placeholder="예: 한국사, 자격증, 경제"
                minLength={1}
                maxLength={50}
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setSubjectName(
                    event.target.value,
                  )
                  setErrorMessage('')
                }}
              />

              {errorMessage && (
                <p
                  className="subject-create-error"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <div className="subject-create-actions">
                <button
                  type="button"
                  className="subject-create-cancel"
                  disabled={isSubmitting}
                  onClick={closeModal}
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="subject-create-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? '추가하는 중...'
                    : '과목 추가'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default SubjectCreateBook