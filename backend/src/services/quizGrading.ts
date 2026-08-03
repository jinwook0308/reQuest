export type QuestionKind =
  | 'multiple-choice'
  | 'ox'
  | 'short-answer'

export type GradableQuestion = {
  id: number
  kind: QuestionKind
  answer: string
  explanation: string
}

export type SubmittedQuizAnswer = {
  questionId: number
  userAnswer: string
}

export type GradedQuizAnswer =
  SubmittedQuizAnswer & {
    correctAnswer: string
    explanation: string
    isCorrect: boolean
  }

export function normalizeAnswer(
  answer: string,
) {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[.,!?\"'()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
}

export function gradeAnswer(
  question: GradableQuestion,
  userAnswer: string,
) {
  const normalizedUserAnswer =
    normalizeAnswer(userAnswer)

  const normalizedCorrectAnswer =
    normalizeAnswer(question.answer)

  if (!normalizedUserAnswer) {
    return false
  }

  if (question.kind !== 'short-answer') {
    return (
      normalizedUserAnswer ===
      normalizedCorrectAnswer
    )
  }

  if (
    normalizedUserAnswer ===
    normalizedCorrectAnswer
  ) {
    return true
  }

  const correctKeywords =
    normalizedCorrectAnswer
      .split(' ')
      .filter(
        (keyword) =>
          keyword.length >= 2,
      )

  if (correctKeywords.length === 0) {
    return false
  }

  const matchedKeywordCount =
    correctKeywords.filter(
      (keyword) =>
        normalizedUserAnswer.includes(
          keyword,
        ),
    ).length

  return (
    matchedKeywordCount /
      correctKeywords.length >=
    0.6
  )
}

export function gradeSubmittedAnswers(
  questions: GradableQuestion[],
  submittedAnswers: SubmittedQuizAnswer[],
) {
  const questionById = new Map(
    questions.map((question) => [
      question.id,
      question,
    ]),
  )

  const seenQuestionIds = new Set<number>()

  return submittedAnswers.map(
    (submittedAnswer): GradedQuizAnswer => {
      if (
        seenQuestionIds.has(
          submittedAnswer.questionId,
        )
      ) {
        throw new Error(
          '동일한 문제의 답안이 중복 제출되었습니다.',
        )
      }

      seenQuestionIds.add(
        submittedAnswer.questionId,
      )

      const question = questionById.get(
        submittedAnswer.questionId,
      )

      if (!question) {
        throw new Error(
          '저장된 복습 문제와 일치하지 않는 답안입니다.',
        )
      }

      return {
        ...submittedAnswer,
        correctAnswer: question.answer,
        explanation:
          question.explanation,
        isCorrect: gradeAnswer(
          question,
          submittedAnswer.userAnswer,
        ),
      }
    },
  )
}
