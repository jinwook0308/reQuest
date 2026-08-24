import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateStudyStreak } from './studyStreak'

test('오늘 활동한 경우 오늘부터 과거 방향으로 현재 연속 기록을 계산한다', () => {
  const result = calculateStudyStreak(
    ['2026-08-20', '2026-08-21', '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-25'],
    '2026-08-25',
  )

  assert.equal(result.currentStreak, 3)
  assert.equal(result.bestStreak, 3)
  assert.equal(result.recentDays.length, 7)
  assert.equal(result.recentDays.at(-1)?.isToday, true)
  assert.equal(result.recentDays.at(-1)?.active, true)
})

test('오늘 활동이 없고 어제까지 이어졌으면 어제부터 계산한다', () => {
  const result = calculateStudyStreak(
    ['2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24'],
    '2026-08-25',
  )

  assert.equal(result.currentStreak, 4)
  assert.equal(result.bestStreak, 4)
})

test('오늘과 어제 활동이 없으면 현재 연속 기록은 종료된다', () => {
  const result = calculateStudyStreak(
    ['2026-08-10', '2026-08-11', '2026-08-12'],
    '2026-08-25',
  )

  assert.equal(result.currentStreak, 0)
  assert.equal(result.bestStreak, 3)
})

test('학습 기록과 순공 세션이 같은 날짜여도 활동일은 한 번만 센다', () => {
  const result = calculateStudyStreak(
    ['2026-08-24', '2026-08-24', '2026-08-25', '2026-08-25'],
    '2026-08-25',
  )

  assert.equal(result.currentStreak, 2)
  assert.equal(result.bestStreak, 2)
})
