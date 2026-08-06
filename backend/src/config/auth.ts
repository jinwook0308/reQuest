import dotenv from 'dotenv'
import type {
  SignOptions,
} from 'jsonwebtoken'

dotenv.config()

const jwtSecret =
  process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET 환경변수가 설정되지 않았습니다.',
  )
}

export const JWT_SECRET =
  jwtSecret

export const JWT_EXPIRES_IN =
  (
    process.env.JWT_EXPIRES_IN ??
    '7d'
  ) as SignOptions['expiresIn']

export const AUTH_COOKIE_NAME =
  'request_session'

export const AUTH_COOKIE_MAX_AGE =
  7 * 24 * 60 * 60 * 1000