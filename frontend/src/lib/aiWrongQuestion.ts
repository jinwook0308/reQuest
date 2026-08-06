import { apiFetch } from './api'

type QuestionKind =
  | 'multiple-choice'
  | 'ox'
  | 'short-answer'

type AiWrongQuestion = {
  id: number
  kind: QuestionKind
  concept: string
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type AiWrongQuestionDraft = {
  sourceType: 'wrong-note'
  sourceId: number | string
  questions: AiWrongQuestion[]
}

type SavedAiWrongQuestionSet = {
  id: number | string
}

/**
 * 오답노트 기반 AI 문제를 만들고 바로 출제 가능한 상태로 저장합니다.
 * 정답과 해설은 이 과정에서 화면에 노출하지 않습니다.
 */
export async function createAiWrongQuestionSet(
  wrongNoteId: number | string,
) {
  const draftResponse = await apiFetch(
    `/review-quest-drafts/wrong-note/${wrongNoteId}`,
    {
      method: 'POST',
    },
  )

  const draftResult =
    (await draftResponse.json()) as ApiResponse<AiWrongQuestionDraft>

  if (
    !draftResponse.ok ||
    !draftResult.success ||
    !draftResult.data?.questions.length
  ) {
    throw new Error(
      draftResult.message ??
        'AI 오답 문제를 생성하지 못했습니다.',
    )
  }

  const saveResponse = await apiFetch(
    `/review-quests/wrong-note/${wrongNoteId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questions:
          draftResult.data.questions,
      }),
    },
  )

  const saveResult =
    (await saveResponse.json()) as ApiResponse<SavedAiWrongQuestionSet>

  if (
    !saveResponse.ok ||
    !saveResult.success
  ) {
    throw new Error(
      saveResult.message ??
        'AI 오답 문제를 저장하지 못했습니다.',
    )
  }

  return saveResult.data
}
