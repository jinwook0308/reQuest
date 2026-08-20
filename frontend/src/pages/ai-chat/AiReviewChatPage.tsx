import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  PanelLeft as _PanelLeft,
  PanelLeftClose,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { apiFetch } from '../../lib/api'
import './AiReviewChatPage.css'
import { PanelRightClose } from 'lucide-react';

type StudyMode = 'general' | 'certification'

type StudyRecord = {
  id: string | number
  date: string
  subject: string
  recordType?: StudyMode | null
  certificationName?: string | null
  examType?: string | null
  examDate?: string | null
  unit: string
  minutes: number
  learned: string
  difficult: string
  keywords: string
  understanding: number
  questStatus?: string | null
}

type Conversation = {
  id: string
  collectionName: string
  studyMode: StudyMode
  title: string
  createdAt: string
  updatedAt: string
  lastMessage?: string | null
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  sources: StudyRecord[]
}

type ConversationDetail = {
  conversation: Conversation
  messages: ChatMessage[]
}

type SendMessageResult = {
  conversation: Conversation
  messages: ChatMessage[]
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

async function readResponse<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.message || '요청을 처리하지 못했습니다.')
  }

  return body.data
}

function getRecordCollectionName(record: StudyRecord) {
  if (record.recordType === 'certification') {
    return record.certificationName?.trim() || '자격증'
  }

  return record.subject
}

function formatRecordDate(date: string) {
  const parsed = new Date(date + 'T00:00:00')

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
}

function formatConversationDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

export default function AiReviewChatPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode: StudyMode =
    searchParams.get('type') === 'certification'
      ? 'certification'
      : 'general'
  const collectionName =
    searchParams.get('subject')?.trim() ||
    (mode === 'certification' ? '자격증' : '학습')

  const [records, setRecords] = useState<StudyRecord[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  )
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const [question, setQuestion] = useState('')
  const [isRecordsOpen, setIsRecordsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const activeConversationStorageKey = useMemo(
    () => `request:ai-chat:${mode}:${collectionName}`,
    [collectionName, mode],
  )

  const subjectRecords = useMemo(
    () =>
      records.filter((record) => {
        const isModeMatch =
          mode === 'certification'
            ? record.recordType === 'certification'
            : record.recordType !== 'certification'

        return (
          isModeMatch &&
          getRecordCollectionName(record) === collectionName
        )
      }),
    [collectionName, mode, records],
  )

  const selectedRecords = useMemo(
    () =>
      selectedRecordIds
        .map((recordId) =>
          subjectRecords.find((record) => String(record.id) === recordId),
        )
        .filter((record): record is StudyRecord => Boolean(record)),
    [selectedRecordIds, subjectRecords],
  )

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [activeConversationId, conversations],
  )

  const refreshConversations = useCallback(
    async (preferredConversationId?: string) => {
      const query =
        '?mode=' +
        encodeURIComponent(mode) +
        '&collectionName=' +
        encodeURIComponent(collectionName)
      const response = await apiFetch('/ai-conversations' + query)
      const result = await readResponse<Conversation[]>(response)

      setConversations(result)

      if (preferredConversationId) {
        setActiveConversationId(preferredConversationId)
      } else if (activeConversationId) {
        const stillExists = result.some(
          (conversation) => conversation.id === activeConversationId,
        )

        if (!stillExists) {
          setActiveConversationId(result[0]?.id ?? null)
        }
      } else {
        setActiveConversationId(result[0]?.id ?? null)
      }

      return result
    },
    [activeConversationId, collectionName, mode],
  )

  useEffect(() => {
    let isCancelled = false

    const loadPage = async () => {
      setIsLoading(true)
      setError('')

      try {
        const [recordResponse, conversationResponse] = await Promise.all([
          apiFetch('/study-records'),
          apiFetch(
            '/ai-conversations?mode=' +
              encodeURIComponent(mode) +
              '&collectionName=' +
              encodeURIComponent(collectionName),
          ),
        ])
        const loadedRecords = await readResponse<StudyRecord[]>(recordResponse)
        const loadedConversations =
          await readResponse<Conversation[]>(conversationResponse)

        if (isCancelled) {
          return
        }

        const savedConversationId = window.localStorage.getItem(
          activeConversationStorageKey,
        )
        const initialConversationId = loadedConversations.some(
          (conversation) => conversation.id === savedConversationId,
        )
          ? savedConversationId
          : (loadedConversations[0]?.id ?? null)

        setRecords(loadedRecords)
        setConversations(loadedConversations)
        setActiveConversationId(initialConversationId)
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'AI 복습 화면을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      isCancelled = true
    }
  }, [activeConversationStorageKey, collectionName, mode])

  useEffect(() => {
    if (!activeConversationId) {
      return
    }

    window.localStorage.setItem(
      activeConversationStorageKey,
      activeConversationId,
    )
  }, [activeConversationId, activeConversationStorageKey])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    let isCancelled = false

    const loadConversation = async () => {
      setIsConversationLoading(true)
      setError('')
      setMessages([])

      try {
        const response = await apiFetch(
          '/ai-conversations/' + activeConversationId,
        )
        const detail = await readResponse<ConversationDetail>(response)

        if (!isCancelled) {
          setMessages(detail.messages)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : '대화 내용을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsConversationLoading(false)
        }
      }
    }

    void loadConversation()

    return () => {
      isCancelled = true
    }
  }, [activeConversationId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isSending, messages])

  const handleNewConversation = () => {
    setActiveConversationId(null)
    setMessages([])
    setSelectedRecordIds([])
    setQuestion('')
    setError('')
  }

  const handleToggleRecord = (recordId: string | number) => {
    const normalizedId = String(recordId)

    setSelectedRecordIds((currentIds) =>
      currentIds.includes(normalizedId)
        ? currentIds.filter((id) => id !== normalizedId)
        : [...currentIds, normalizedId],
    )
  }

  const handleDeleteConversation = async (
    event: MouseEvent<HTMLButtonElement>,
    conversationId: string,
  ) => {
    event.stopPropagation()

    if (!window.confirm('이 대화 기록을 삭제할까요?')) {
      return
    }

    try {
      const response = await apiFetch(
        '/ai-conversations/' + conversationId,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | ApiResponse<never>
          | null
        throw new Error(body?.message || '대화를 삭제하지 못했습니다.')
      }

      const remaining = conversations.filter(
        (conversation) => conversation.id !== conversationId,
      )
      setConversations(remaining)

      if (activeConversationId === conversationId) {
        setActiveConversationId(remaining[0]?.id ?? null)
        setMessages([])
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : '대화를 삭제하지 못했습니다.',
      )
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuestion = question.trim()

    if (!trimmedQuestion || isSending) {
      return
    }

    setIsSending(true)
    setError('')

    try {
      let conversationId = activeConversationId

      if (!conversationId) {
        const createResponse = await apiFetch('/ai-conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studyMode: mode,
            collectionName,
          }),
        })
        const createdConversation =
          await readResponse<Conversation>(createResponse)
        conversationId = createdConversation.id
      }

      const messageResponse = await apiFetch(
        '/ai-conversations/' + conversationId + '/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: trimmedQuestion,
            studyRecordIds: selectedRecordIds.map(Number),
          }),
        },
      )
      const result = await readResponse<SendMessageResult>(messageResponse)

      setQuestion('')
      setSelectedRecordIds([])
      setMessages((currentMessages) => [
        ...currentMessages,
        ...result.messages,
      ])
      await refreshConversations(conversationId)
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'AI 답변을 생성하지 못했습니다.',
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="ai-chat-page">
      <aside className={`ai-chat-sidebar ${isSidebarOpen ? 'is-open' : 'is-closed'}`}>
        <div className="ai-chat-sidebar-top-bar">
    <button
      type="button"
      className="ai-chat-back"
      onClick={() => navigate('/ai-review?type=' + mode)}
    >
      <ArrowLeft size={18} />
      복습 노트로
    </button>

    {/* 사이드바 닫기 버튼 */}
    <button
      type="button"
      className="ai-chat-sidebar-toggle"
      onClick={() => setIsSidebarOpen(false)}
      aria-label="사이드바 접기"
    >
      <PanelLeftClose size={20} />
    </button>
  </div>

  <div className="ai-chat-sidebar-heading">
    <span>
      {mode === 'certification' ? 'CERTIFICATE CHAT' : 'SUBJECT CHAT'}
    </span>
    <h1>{collectionName}</h1>
    <p>기록을 연결하거나 자유롭게 질문해 보세요.</p>
  </div>

        <button
          type="button"
          className="ai-chat-new-button"
          onClick={handleNewConversation}
        >
          <MessageSquarePlus size={19} />
          새 대화
        </button>

        <div className="ai-chat-conversation-list">
          <p className="ai-chat-list-label">대화 기록</p>

          {conversations.length === 0 ? (
            <p className="ai-chat-list-empty">아직 저장된 대화가 없어요.</p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={
                  'ai-chat-conversation-item' +
                  (conversation.id === activeConversationId
                    ? ' is-active'
                    : '')
                }
              >
                <button
                  type="button"
                  className="ai-chat-conversation-open"
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <strong>{conversation.title}</strong>
                  <small>{formatConversationDate(conversation.updatedAt)}</small>
                </button>
                <button
                  type="button"
                  className="ai-chat-conversation-delete"
                  aria-label={conversation.title + ' 대화 삭제'}
                  onClick={(event) =>
                    void handleDeleteConversation(event, conversation.id)
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="ai-chat-workspace">
        <header className="ai-chat-toolbar">
  <div className="ai-chat-toolbar-left">
    {!isSidebarOpen && (
      <button
        type="button"
        className="ai-chat-sidebar-open-button"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="사이드바 열기"
      >
        <PanelRightClose size={20} />
      </button>
    )}
    
    <div>
      <p>{mode === 'certification' ? '자격증 AI 복습' : 'AI 복습'}</p>
      <h2>{activeConversation?.title || '새 대화'}</h2>
    </div>
  </div>
  
  <span className="ai-chat-mode-badge">
    {mode === 'certification' ? '자격증 공부' : '일반 학습'}
  </span>
</header>

        <div className="ai-chat-scroll-area">
          {isLoading || isConversationLoading ? (
            <div className="ai-chat-state">
              <Sparkles className="ai-chat-state-icon" />
              <p>학습 기록과 대화를 불러오고 있어요.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="ai-chat-hero">
              <span className="ai-chat-hero-icon">
                <Sparkles size={28} />
              </span>
              <p>REVIEW WITH REQUEST</p>
              <h2>{collectionName}에서 무엇이 궁금한가요?</h2>
              <span>
                기록을 선택하면 그 내용을 바탕으로 답하고,
                선택하지 않아도 자유롭게 질문할 수 있어요.
              </span>
            </div>
          ) : (
            <div className="ai-chat-messages" aria-live="polite">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={'ai-chat-message is-' + message.role}
                >
                  <div className="ai-chat-message-label">
                    {message.role === 'assistant' ? (
                      <>
                        <Sparkles size={16} />
                        reQuest AI
                      </>
                    ) : (
                      '나'
                    )}
                  </div>

                  {message.sources.length > 0 ? (
                    <div className="ai-chat-message-sources">
                      {message.sources.map((source) => (
                        <span key={source.id}>
                          <FileText size={14} />
                          {source.unit}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="ai-chat-message-content">
                    {message.content}
                  </div>
                </article>
              ))}

              {isSending ? (
                <article className="ai-chat-message is-assistant">
                  <div className="ai-chat-message-label">
                    <Sparkles size={16} />
                    reQuest AI
                  </div>
                  <div className="ai-chat-typing" aria-label="답변 생성 중">
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              ) : null}
              <div ref={messageEndRef} />
            </div>
          )}
        </div>

        <section className="ai-chat-record-panel">
          <button
            type="button"
            className="ai-chat-record-toggle"
            onClick={() => setIsRecordsOpen((current) => !current)}
            aria-expanded={isRecordsOpen}
          >
            <span>
              <BookOpen size={18} />
              내 {collectionName}  기록
              <small>{subjectRecords.length}개</small>
            </span>
            <ChevronDown
              size={18}
              className={isRecordsOpen ? 'is-open' : ''}
            />
          </button>

          {isRecordsOpen ? (
            <div className="ai-chat-record-scroller">
              {subjectRecords.length === 0 ? (
                <div className="ai-chat-no-records">
                  이 노트에 연결할 학습 기록이 아직 없어요. 기록 없이도
                  질문할 수 있습니다.
                </div>
              ) : (
                subjectRecords.map((record) => {
                  const isSelected = selectedRecordIds.includes(
                    String(record.id),
                  )

                  return (
                    <article
                      key={record.id}
                      className={
                        'ai-chat-record-card' +
                        (isSelected ? ' is-selected' : '')
                      }
                    >
                      <button
                        type="button"
                        className="ai-chat-record-select"
                        onClick={() => handleToggleRecord(record.id)}
                        aria-pressed={isSelected}
                      >
                        <span className="ai-chat-record-check">
                          {isSelected ? <Check size={15} /> : null}
                        </span>
                        <span className="ai-chat-record-copy">
                          <small>{formatRecordDate(record.date)}</small>
                          <strong>{record.unit}</strong>
                          <span>{record.difficult || record.learned}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ai-chat-quiz-link"
                        onClick={() => navigate('/quest-review/' + record.id)}
                      >
                        <Sparkles size={14} />
                        AI 문제
                      </button>
                    </article>
                  )
                })
              )}
            </div>
          ) : null}
        </section>

        <form className="ai-chat-composer" onSubmit={handleSubmit}>
          {selectedRecords.length > 0 ? (
            <div
              className="ai-chat-selected-records"
              aria-label="선택한 학습 기록"
            >
              <span
                className="ai-chat-selected-summary"
                title={selectedRecords.map((record) => record.unit).join(', ')}
              >
                <FileText size={15} aria-hidden="true" />
                <span className="ai-chat-selected-summary-text">
                  {selectedRecords[0].unit}
                  {selectedRecords.length > 1
                    ? ` 외 ${selectedRecords.length - 1}개`
                    : ''}
                </span>
              </span>
              <button
                type="button"
                className="ai-chat-clear-selected"
                onClick={() => setSelectedRecordIds([])}
                aria-label="선택한 학습 기록 모두 해제"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}

          {error ? <p className="ai-chat-error">{error}</p> : null}

          <div className="ai-chat-composer-row">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={collectionName + '에 대해 무엇이든 물어보세요'}
              rows={1}
              maxLength={4000}
              disabled={isSending}
            />
            <button
              type="submit"
              className="ai-chat-send-button"
              disabled={!question.trim() || isSending}
              aria-label="질문 보내기"
            >
              <Send size={19} />
            </button>
          </div>
          <p className="ai-chat-composer-help">
            Enter로 전송 · Shift + Enter로 줄바꿈 · 기록 선택은 선택사항
          </p>
        </form>
      </section>
    </main>
  )
}
