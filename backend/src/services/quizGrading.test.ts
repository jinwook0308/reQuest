import assert from 'node:assert/strict'
import test from 'node:test'

import {
  gradeAnswer,
  gradeSubmittedAnswers,
  type GradableQuestion,
} from './quizGrading'

const questions: GradableQuestion[] = [
  {
    id: 1,
    kind: 'multiple-choice',
    answer: '정답',
    explanation: '객관식 해설',
  },
  {
    id: 2,
    kind: 'short-answer',
    answer: '이차함수 평행이동 꼭짓점',
    explanation: '단답형 해설',
  },
]

test('객관식 답안의 공백과 대소문자를 정규화한다', () => {
  assert.equal(
    gradeAnswer(questions[0], '  정답  '),
    true,
  )
})

test('단답형은 핵심 키워드가 60% 이상 포함되면 정답이다', () => {
  assert.equal(
    gradeAnswer(
      questions[1],
      '이차함수의 평행이동을 설명했습니다',
    ),
    true,
  )
})

test('서버가 저장된 정답을 기준으로 제출 답안을 채점한다', () => {
  const results = gradeSubmittedAnswers(
    questions,
    [
      {
        questionId: 1,
        userAnswer: '오답',
      },
    ],
  )

  assert.equal(results[0].isCorrect, false)
  assert.equal(
    results[0].correctAnswer,
    '정답',
  )
})

test('존재하지 않는 문제 ID를 거부한다', () => {
  assert.throws(() =>
    gradeSubmittedAnswers(
      questions,
      [
        {
          questionId: 999,
          userAnswer: '정답',
        },
      ],
    ),
  )
})
