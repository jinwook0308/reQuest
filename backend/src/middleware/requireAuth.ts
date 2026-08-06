import type {
  NextFunction,
  Request,
  Response,
} from 'express'
import jwt from 'jsonwebtoken'

import {
  AUTH_COOKIE_NAME,
  JWT_SECRET,
} from '../config/auth'

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token =
    request.cookies?.[
      AUTH_COOKIE_NAME
    ]

  if (!token) {
    response.status(401).json({
      success: false,
      message:
        '로그인이 필요합니다.',
    })
    return
  }

  try {
    const payload = jwt.verify(
      token,
      JWT_SECRET,
    )

    if (
      typeof payload === 'string' ||
      !payload.sub
    ) {
      response.status(401).json({
        success: false,
        message:
          '유효하지 않은 로그인 정보입니다.',
      })
      return
    }

    request.authUser = {
      id: String(payload.sub),
      email:
        typeof payload.email ===
        'string'
          ? payload.email
          : '',
      nickname:
        typeof payload.nickname ===
        'string'
          ? payload.nickname
          : '',
    }

    next()
  } catch {
    response.status(401).json({
      success: false,
      message:
        '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    })
  }
}