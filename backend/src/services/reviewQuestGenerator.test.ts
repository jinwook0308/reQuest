import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createRuleBasedReviewQuestions,
  type ReviewQuestSource,
} from './reviewQuestGenerator'

const wrongNoteSource: ReviewQuestSource = {
  subject: '수학',
  unit: '이차함수',
  learned: '',
  difficult: '',
  keywords: '',
  mistakeQuestion:
    '이차함수의 꼭짓점을 구하세요.',
  wrongAnswer: '(1, 2)',
  correctAnswer: '(2, 1)',
  mistakeReason:
    'x좌표와 y좌표를 반대로 적었다.',
  concepts: '꼭짓점, 이차함수',
}

test('오답노트로 객관식, OX, 단답형 초안을 만든다', () => {
  const questions =
    createRuleBasedReviewQuestions(
      wrongNoteSource,
    )

  assert.equal(questions.length, 3)
  assert.deepEqual(
    questions.map(
      (question) => question.kind,
    ),
    [
      'multiple-choice',
      'ox',
      'short-answer',
    ],
  )
  assert.equal(
    questions[0].options.length,
    4,
  )
  assert.ok(
    questions[0].options.includes(
      '(2, 1)',
    ),
  )
  assert.equal(questions[1].answer, 'X')
})

test('학습 기록만 있어도 안전한 기본값으로 초안을 만든다', () => {
  const questions =
    createRuleBasedReviewQuestions({
      subject: '프로그래밍',
      unit: '객체지향',
      learned: '상속과 다형성을 학습했다.',
      difficult: '다형성의 활용이 어려웠다.',
      keywords: '상속, 다형성',
      mistakeQuestion: '',
      wrongAnswer: '',
      correctAnswer: '',
      mistakeReason: '',
      concepts: '',
    })

  assert.equal(
    questions[0].concept,
    '상속',
  )
  assert.equal(
    questions[0].answer,
    '상속과 다형성을 학습했다.',
  )
  assert.equal(questions[1].answer, 'O')
})
