import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import './SubjectBookshelf.css'

export type SubjectBookVariant =
  | 'study'
  | 'wrong-note'
  | 'ai-review'

export interface SubjectBookItem {
  id: string
  subject: string
  eyebrow: string
  meta: string
  badge?: string
}

interface SubjectBookshelfProps {
  items: SubjectBookItem[]
  variant: SubjectBookVariant
  onOpen: (item: SubjectBookItem) => void
  selectedSubject?: string
  hoverLabel?: string
  emptyMessage?: string
  children?: ReactNode
}

const COVER_TONE_COUNT = 6
const OPEN_ANIMATION_TIME = 560

function getSubjectBookTone(
  subjectName: string,
) {
  const value = [...subjectName].reduce(
    (total, character) =>
      total + (character.codePointAt(0) ?? 0),
    0,
  )

  return (value % COVER_TONE_COUNT) + 1
}

function SubjectBookshelf({
  items,
  variant,
  onOpen,
  selectedSubject,
  hoverLabel = '노트 열어보기',
  emptyMessage = '표시할 과목이 없습니다.',
  children,
}: SubjectBookshelfProps) {
  const [openingBookId, setOpeningBookId] =
    useState<string | null>(null)

  const timerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleOpenBook = (
    item: SubjectBookItem,
  ) => {
    if (openingBookId) {
      return
    }

    const prefersReducedMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

    setOpeningBookId(item.id)

    timerRef.current = setTimeout(
      () => {
        onOpen(item)
        setOpeningBookId(null)
        timerRef.current = null
      },
      prefersReducedMotion
        ? 0
        : OPEN_ANIMATION_TIME,
    )
  }

  if (items.length === 0 && !children) {
    return (
      <div className="subject-bookshelf-empty">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={`subject-bookshelf subject-bookshelf--${variant}`}
    >
      {items.map((item) => {
        const isOpening =
          openingBookId === item.id

        const isSelected =
          selectedSubject === item.subject

        return (
          <button
            type="button"
            className={[
              'subject-book',
              `subject-book--tone-${getSubjectBookTone(
                item.subject,
              )}`,
              isOpening ? 'is-opening' : '',
              isSelected ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={item.id}
            onClick={() =>
              handleOpenBook(item)
            }
            aria-label={`${item.subject} ${hoverLabel}`}
            aria-pressed={isSelected}
            title={item.subject}
          >
            <span className="subject-book__pages" />

            <span className="subject-book__cover">
              <span className="subject-book__spine" />

              <span className="subject-book__band" />

              {item.badge ? (
                <span className="subject-book__badge">
                  {item.badge}
                </span>
              ) : null}

              <span className="subject-book__label">
                <small>{item.eyebrow}</small>

                <strong>{item.subject}</strong>

                <span>{item.meta}</span>
              </span>

              <span className="subject-book__hover">
                <strong>{item.subject}</strong>
                <small>{hoverLabel}</small>
              </span>
            </span>
          </button>
        )
      })}

      {children}
    </div>
  )
}

export default SubjectBookshelf
