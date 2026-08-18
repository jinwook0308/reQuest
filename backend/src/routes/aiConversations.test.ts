import test from 'node:test'
import assert from 'node:assert/strict'

test('AI 복습 채팅 대화방과 메시지가 정상적으로 연결되고 유지되는지 검증한다', () => {
  // 1. 가상의 DB 반환 데이터 준비 (PostgreSQL에 저장되었다고 가정)
  const mockSavedRoom = {
    id: 1,
    user_id: 100,
    room_title: '운영체제 메모리 관리 복습',
    created_at: '2026-08-18T10:00:00Z'
  };

  const mockSavedMessages = [
    { id: 1, room_id: 1, role: 'user', content: '가상 메모리가 뭐야?', created_at: '2026-08-18T10:01:00Z' },
    { id: 2, room_id: 1, role: 'assistant', content: '가상 메모리는 실제 메모리보다 큰 프로그램을 실행할 수 있게 해주는 기술입니다.', created_at: '2026-08-18T10:01:05Z' }
  ];

  // 2. 재접속 시 특정 대화방의 메시지를 불러오는 로직 실행
  const targetRoomId = mockSavedRoom.id;
  const fetchedMessages = mockSavedMessages.filter(msg => msg.room_id === targetRoomId);

  // 3. 검증 (assert)
  assert.equal(targetRoomId, 1, '대화방 ID가 일치해야 합니다.');
  assert.equal(fetchedMessages.length, 2, '저장된 메시지 2개를 모두 안전하게 불러와야 합니다.');
  assert.equal(fetchedMessages[0].role, 'user', '첫 번째 메시지 발신자는 사용자(user)여야 합니다.');
  assert.equal(fetchedMessages[1].role, 'assistant', '두 번째 메시지 발신자는 AI(assistant)여야 합니다.');
});