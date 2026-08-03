import dotenv from 'dotenv'

dotenv.config()

export const APP_USER_EMAIL =
  process.env.APP_USER_EMAIL ??
  'dev@request.local'

export const CORS_ORIGIN =
  process.env.CORS_ORIGIN ??
  'http://localhost:5173'
