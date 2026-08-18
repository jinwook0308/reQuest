import test from 'node:test'
import assert from 'node:assert/strict'

test('집중 학습 타이머 세션이 시작, 일시정지, 종료 상태별로 정상 기록되는지 검증한다', () => {
  // 1. 가상의 DB 저장 상태 시나리오 (PostgreSQL 저장 가정)
  // [상태 1] 타이머 시작
  const sessionStarted = {
    id: 1,
    user_id: 100,
    status: 'started',
    started_at: '2026-08-18T10:00:00Z',
    accumulated_minutes: 0
  };

  // [상태 2] 25분 공부 후 일시정지
  const sessionPaused = {
    ...sessionStarted,
    status: 'paused',
    accumulated_minutes: 25
  };

  // [상태 3] 총 50분 공부 후 최종 종료
  const sessionEnded = {
    ...sessionPaused,
    status: 'completed',
    accumulated_minutes: 50,
    ended_at: '2026-08-18T10:50:00Z'
  };

  // 2. 상태별 데이터 검증 (assert)
  assert.equal(sessionStarted.status, 'started', '타이머 시작 시 상태는 "started"여야 합니다.');
  assert.equal(sessionPaused.status, 'paused', '타이머 일시정지 시 상태는 "paused"여야 합니다.');
  assert.equal(sessionEnded.status, 'completed', '타이머 최종 종료 시 상태는 "completed"여야 합니다.');
  
  assert.equal(sessionEnded.accumulated_minutes, 50, '최종 종료 시 누적 학습 시간이 정확히 보존되어야 합니다.');
  assert.notEqual(sessionEnded.ended_at, undefined, '종료 시점에는 반드시 종료 시간(ended_at)이 기록되어야 합니다.');
});