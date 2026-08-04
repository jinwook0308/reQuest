export type ReviewQuestionKind =
  | 'multiple-choice'
  | 'ox'
  | 'short-answer'

export interface ReviewQuestionDraft {
  id: number
  kind: ReviewQuestionKind
  concept: string
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

export interface ReviewQuestSource {
  subject: string
  unit: string
  learned: string
  difficult: string
  keywords: string
  mistakeQuestion: string
  wrongAnswer: string
  correctAnswer: string
  mistakeReason: string
  concepts: string
  wrongImagePath?: string | null
}

function firstNonEmpty(
  values: string[],
  fallback: string,
) {
  return (
    values
      .map((value) => value.trim())
      .find(Boolean) ?? fallback
  )
}

function getFirstKeyword(
  source: ReviewQuestSource,
) {
  const keywordText = firstNonEmpty(
    [source.concepts, source.keywords],
    '',
  )

  return firstNonEmpty(
    [
      ...keywordText.split(','),
      source.unit,
      source.subject,
    ],
    '핵심 개념',
  )
}

function createOptions(
  correctAnswer: string,
  wrongAnswer: string,
) {
  const candidates = [
    wrongAnswer,
    '주어진 조건만으로 판단할 수 없다',
    correctAnswer,
    '문제의 조건이 부족하다',
  ]

  const options = [
    ...new Set(
      candidates
        .map((candidate) => candidate.trim())
        .filter(Boolean),
    ),
  ]

  while (options.length < 4) {
    options.push(
      `선택지 ${options.length + 1}`,
    )
  }

  return options.slice(0, 4)
}

export function createRuleBasedReviewQuestions(
  source: ReviewQuestSource,
): ReviewQuestionDraft[] {
  const concept = getFirstKeyword(source)

  const correctAnswer = firstNonEmpty(
    [source.correctAnswer, source.learned],
    `${concept}의 핵심 내용`,
  )

  const wrongAnswer = firstNonEmpty(
    [source.wrongAnswer, source.difficult],
    `${concept}과 관련 없는 설명`,
  )

  const explanation = firstNonEmpty(
    [
      source.mistakeReason,
      source.difficult,
      source.learned,
    ],
    `${concept} 개념을 다시 확인해야 합니다.`,
  )

  const originalQuestion = firstNonEmpty(
    [source.mistakeQuestion],
    `${source.unit}에서 학습한 내용으로 가장 알맞은 것을 고르세요.`,
  )

  const hasWrongNote = Boolean(
    source.mistakeQuestion.trim(),
  )

  return [
    {
      id: 1,
      kind: 'multiple-choice',
      concept,
      prompt: `다음 문제의 올바른 답을 고르세요.\n\n${originalQuestion}`,
      options: createOptions(
        correctAnswer,
        wrongAnswer,
      ),
      answer: correctAnswer,
      explanation,
    },
    {
      id: 2,
      kind: 'ox',
      concept,
      prompt: hasWrongNote
        ? `"${wrongAnswer}"은(는) 등록한 문제의 올바른 답이다.`
        : `"${correctAnswer}"은(는) ${concept}에 관해 학습한 내용이다.`,
      options: [],
      answer: hasWrongNote ? 'X' : 'O',
      explanation: hasWrongNote
        ? `등록된 실제 정답은 "${correctAnswer}"입니다. ${explanation}`
        : explanation,
    },
    {
      id: 3,
      kind: 'short-answer',
      concept,
      prompt: `${concept}의 핵심 내용을 한 문장으로 설명하세요.`,
      options: [],
      answer: correctAnswer,
      explanation: `핵심은 다음 내용을 이해하는 것입니다. ${explanation}`,
    },
  ]
}
