import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeUploadedFileName } from './upload'

test('한글 업로드 파일명의 인코딩을 복원한다', () => {
  assert.equal(
    normalizeUploadedFileName(
      'ì¤í¬ë¦°ì·.png',
    ),
    '스크린샷.png',
  )
})

test('정상적인 파일명은 그대로 유지한다', () => {
  assert.equal(
    normalizeUploadedFileName(
      '스크린샷.png',
    ),
    '스크린샷.png',
  )
  assert.equal(
    normalizeUploadedFileName(
      'wrong-answer.png',
    ),
    'wrong-answer.png',
  )
})
