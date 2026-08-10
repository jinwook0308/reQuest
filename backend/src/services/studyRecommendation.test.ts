import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createRuleBasedStudyRecommendations,
} from './studyRecommendation'

test('전체 학습 기록을 바탕으로 복습 추천을 만든다', () => {
  const recommendations =
    createRuleBasedStudyRecommendations({
      recordType: 'general',
      subject: '프로그래밍',
      certificationName: null,
      examType: null,
      examDate: null,
      unit: '자바 기본 문법',
      learned:
        '기본 자료형과 참조 자료형의 차이를 학습했다.',
      difficult:
        '문자열 비교에서 ==와 equals를 구분하는 부분이 어렵다.',
      keywords:
        '자바, 자료형, equals',
      understanding: 3,
    })

  assert.ok(
    recommendations.length >= 1 &&
      recommendations.length <= 3,
  )
  assert.equal(
    recommendations[0]?.concept,
    '자바',
  )
  assert.match(
    recommendations[0]?.reason ?? '',
    /equals/,
  )
  assert.ok(
    recommendations.every(
      (recommendation) =>
        recommendation.concept.length > 0 &&
        recommendation.reason.length > 0 &&
        recommendation.action.length > 0,
    ),
  )
})

test('이해도가 낮으면 기본 개념 점검을 포함한다', () => {
  const recommendations =
    createRuleBasedStudyRecommendations({
      recordType: 'general',
      subject: '수학',
      certificationName: null,
      examType: null,
      examDate: null,
      unit: '이차함수',
      learned:
        '꼭짓점 형태를 학습했다.',
      difficult:
        '그래프 이동 방향이 헷갈린다.',
      keywords: '이차함수',
      understanding: 2,
    })

  assert.ok(
    recommendations.some(
      (recommendation) =>
        recommendation.concept.includes(
          '기본 개념 점검',
        ),
    ),
  )
})

test('자격증 학습은 시험 영역과 대비 유형을 포함한다', () => {
  const recommendations =
    createRuleBasedStudyRecommendations({
      recordType: 'certification',
      subject: '자격증',
      certificationName: '정보처리기사',
      examType: 'written',
      examDate: '2026-09-01',
      unit: '데이터베이스 정규화',
      learned:
        '제1정규형부터 제3정규형까지의 목적을 학습했다.',
      difficult:
        '부분 함수 종속과 이행 함수 종속을 구분하기 어려웠다.',
      keywords: '정규화, 함수 종속, 이상 현상',
      understanding: 2,
    })

  assert.ok(recommendations.length >= 1)
  assert.ok(
    recommendations.every(
      (recommendation) =>
        Boolean(recommendation.examArea) &&
        Boolean(recommendation.questionType),
    ),
  )
  assert.match(
    recommendations[0]?.examArea ?? '',
    /정보처리기사 필기/,
  )
})
