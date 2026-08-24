import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  JWT_EXPIRES_IN,
  JWT_SECRET,
} from '../config/auth'
import { pool } from '../config/db'
import { requireAuth } from '../middleware/requireAuth'

const router = Router()

const signupSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, '이름은 2자 이상 입력해 주세요.')
    .max(50, '이름은 50자 이하로 입력해 주세요.'),

  email: z
    .string()
    .trim()
    .email('올바른 이메일 주소를 입력해 주세요.')
    .max(255, '이메일은 255자 이하로 입력해 주세요.')
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8, '비밀번호는 8자 이상 입력해 주세요.')
    .max(72, '비밀번호는 72자 이하로 입력해 주세요.')
    .regex(/[A-Za-z]/, '비밀번호에 영문을 포함해 주세요.')
    .regex(/[0-9]/, '비밀번호에 숫자를 포함해 주세요.'),
})

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('올바른 이메일 주소를 입력해 주세요.')
    .transform((value) => value.toLowerCase()),

  password: z.string().min(1, '비밀번호를 입력해 주세요.').max(72),
})

const profileUpdateSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, '닉네임은 2자 이상 입력해 주세요.')
    .max(50, '닉네임은 50자 이하로 입력해 주세요.'),
  email: z
    .string()
    .trim()
    .email('올바른 이메일 주소를 입력해 주세요.')
    .max(255, '이메일은 255자 이하로 입력해 주세요.')
    .transform((value) => value.toLowerCase()),
})

const emailAvailabilitySchema = z.object({
  email: z
    .string()
    .trim()
    .email('올바른 이메일 주소를 입력해 주세요.')
    .max(255, '이메일은 255자 이하로 입력해 주세요.')
    .transform((value) => value.toLowerCase()),
})

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해 주세요.').max(72),
  newPassword: z
    .string()
    .min(8, '새 비밀번호는 8자 이상 입력해 주세요.')
    .max(72, '새 비밀번호는 72자 이하로 입력해 주세요.')
    .regex(/[A-Za-z]/, '새 비밀번호에 영문을 포함해 주세요.')
    .regex(/[0-9]/, '새 비밀번호에 숫자를 포함해 주세요.'),
})

interface UserRow {
  id: string
  nickname: string
  email: string
  password_hash: string | null
  created_at: Date
}

function createSessionToken(user: UserRow) {
  return jwt.sign(
    {
      email: user.email,
      nickname: user.nickname,
    },
    JWT_SECRET,
    {
      subject: String(user.id),
      expiresIn: JWT_EXPIRES_IN,
    },
  )
}

function setSessionCookie(response: Response, token: string) {
  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  })
}

function sendValidationError(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({
    success: false,
    message: issues[0]?.message ?? '입력값을 확인해 주세요.',
    data: {
      issues: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  })
}

router.post('/signup', async (request: Request, response: Response) => {
  const parsed = signupSchema.safeParse(request.body)

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  const { nickname, email, password } = parsed.data

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const existingUser = await client.query(
      `
            SELECT id
            FROM users
            WHERE LOWER(email) =
              LOWER($1)
            LIMIT 1
          `,
      [email],
    )

    if (existingUser.rowCount && existingUser.rowCount > 0) {
      await client.query('ROLLBACK')

      response.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.',
      })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const insertedUser = await client.query<UserRow>(
      `
            INSERT INTO users (
              nickname,
              email,
              password_hash
            )
            VALUES ($1, $2, $3)
            RETURNING
              id,
              nickname,
              email,
              password_hash,
              created_at
          `,
      [nickname, email, passwordHash],
    )

    const user = insertedUser.rows[0]

    if (!user) {
      throw new Error('사용자 저장 결과가 없습니다.')
    }

    await client.query('COMMIT')

    const token = createSessionToken(user)

    setSessionCookie(response, token)

    response.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        user: {
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')

    const databaseError = error as {
      code?: string
    }

    if (databaseError.code === '23505') {
      response.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.',
      })
      return
    }

    console.error('회원가입 처리 실패:', error)

    response.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.',
    })
  } finally {
    client.release()
  }
})

router.post('/login', async (request: Request, response: Response) => {
  const parsed = loginSchema.safeParse(request.body)

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  const { email, password } = parsed.data

  try {
    const result = await pool.query<UserRow>(
      `
            SELECT
              id,
              nickname,
              email,
              password_hash,
              created_at
            FROM users
            WHERE LOWER(email) =
              LOWER($1)
            LIMIT 1
          `,
      [email],
    )

    const user = result.rows[0]

    if (!user || !user.password_hash) {
      response.status(401).json({
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatches) {
      response.status(401).json({
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    const token = createSessionToken(user)

    setSessionCookie(response, token)

    response.status(200).json({
      success: true,
      message: '로그인되었습니다.',
      data: {
        user: {
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    })
  } catch (error) {
    console.error('로그인 처리 실패:', error)

    response.status(500).json({
      success: false,
      message: '로그인 중 오류가 발생했습니다.',
    })
  }
})

router.get('/me', requireAuth, async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  try {
    const result = await pool.query<UserRow>(
      `
            SELECT
              id,
              nickname,
              email,
              password_hash,
              created_at
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
      [userId],
    )

    const user = result.rows[0]

    if (!user) {
      response.status(401).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.',
      })
      return
    }

    response.status(200).json({
      success: true,
      message: '로그인한 사용자 정보입니다.',
      data: {
        user: {
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    })
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error)

    response.status(500).json({
      success: false,
      message: '사용자 정보를 불러오지 못했습니다.',
    })
  }
})

router.get(
  '/email-availability',
  requireAuth,
  async (request: Request, response: Response) => {
    const userId = request.authUser?.id

    if (!userId) {
      response.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      })
      return
    }

    const parsed = emailAvailabilitySchema.safeParse(request.query)

    if (!parsed.success) {
      sendValidationError(response, parsed.error.issues)
      return
    }

    try {
      const result = await pool.query(
        `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER($1) AND id <> $2
          LIMIT 1
        `,
        [parsed.data.email, userId],
      )
      const available = result.rowCount === 0

      response.status(200).json({
        success: true,
        message: available
          ? '사용할 수 있는 이메일입니다.'
          : '이미 사용 중인 이메일입니다.',
        data: {
          email: parsed.data.email,
          available,
        },
      })
    } catch (error) {
      console.error('이메일 중복 확인 실패:', error)

      response.status(500).json({
        success: false,
        message: '이메일 중복 확인에 실패했습니다.',
      })
    }
  },
)

router.patch('/profile', requireAuth, async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const parsed = profileUpdateSchema.safeParse(request.body)

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  try {
    const duplicate = await pool.query(
      `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER($1) AND id <> $2
          LIMIT 1
        `,
      [parsed.data.email, userId],
    )

    if (duplicate.rowCount && duplicate.rowCount > 0) {
      response.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.',
      })
      return
    }

    const result = await pool.query<UserRow>(
      `
          UPDATE users
          SET
            nickname = $2,
            email = $3,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            nickname,
            email,
            password_hash,
            created_at
        `,
      [userId, parsed.data.nickname, parsed.data.email],
    )
    const user = result.rows[0]

    if (!user) {
      response.status(404).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.',
      })
      return
    }

    setSessionCookie(response, createSessionToken(user))

    response.status(200).json({
      success: true,
      message: '개인정보를 수정했습니다.',
      data: {
        user: {
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    })
  } catch (error) {
    const databaseError = error as { code?: string }

    if (databaseError.code === '23505') {
      response.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.',
      })
      return
    }

    console.error('개인정보 수정 실패:', error)

    response.status(500).json({
      success: false,
      message: '개인정보를 수정하지 못했습니다.',
    })
  }
})

router.patch('/password', requireAuth, async (request: Request, response: Response) => {
  const userId = request.authUser?.id

  if (!userId) {
    response.status(401).json({
      success: false,
      message: '로그인이 필요합니다.',
    })
    return
  }

  const parsed = passwordChangeSchema.safeParse(request.body)

  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  try {
    const result = await pool.query<UserRow>(
      `
          SELECT
            id,
            nickname,
            email,
            password_hash,
            created_at
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
      [userId],
    )
    const user = result.rows[0]

    if (!user || !user.password_hash) {
      response.status(400).json({
        success: false,
        message: '현재 계정의 비밀번호를 변경할 수 없습니다.',
      })
      return
    }

    const passwordMatches = await bcrypt.compare(
      parsed.data.currentPassword,
      user.password_hash,
    )

    if (!passwordMatches) {
      response.status(400).json({
        success: false,
        message: '현재 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)

    await pool.query(
      `
          UPDATE users
          SET password_hash = $2, updated_at = NOW()
          WHERE id = $1
        `,
      [userId, passwordHash],
    )

    response.status(200).json({
      success: true,
      message: '비밀번호를 변경했습니다.',
      data: {
        passwordChanged: true,
      },
    })
  } catch (error) {
    console.error('비밀번호 변경 실패:', error)

    response.status(500).json({
      success: false,
      message: '비밀번호를 변경하지 못했습니다.',
    })
  }
})

router.post('/logout', (_request: Request, response: Response) => {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  response.status(200).json({
    success: true,
    message: '로그아웃되었습니다.',
  })
})

export default router
