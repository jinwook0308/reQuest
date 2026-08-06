import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { apiFetch } from '../lib/api'
import {
  AuthContext,
  type AuthUser,
  type LoginInput,
  type SignupInput,
} from './auth-context'

interface AuthResponse {
  success: boolean
  message?: string
  data?: {
    user: AuthUser
  }
}

async function readAuthResponse(
  response: Response,
): Promise<AuthResponse> {
  const result =
    (await response.json()) as AuthResponse

  return result
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] =
    useState<AuthUser | null>(null)

  const [isLoading, setIsLoading] =
    useState(true)

  const refreshUser =
    useCallback(async () => {
      try {
        const response =
          await apiFetch('/auth/me')

        if (response.status === 401) {
          setUser(null)
          return
        }

        const result =
          await readAuthResponse(response)

        if (
          !response.ok ||
          !result.success ||
          !result.data?.user
        ) {
          throw new Error(
            result.message ??
              '사용자 정보를 불러오지 못했습니다.',
          )
        }

        setUser(result.data.user)
      } catch (error) {
        console.error(
          '로그인 상태 확인 실패:',
          error,
        )

        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await apiFetch(
        '/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(input),
        },
      )

      const result =
        await readAuthResponse(response)

      if (
        !response.ok ||
        !result.success ||
        !result.data?.user
      ) {
        throw new Error(
          result.message ??
            '로그인에 실패했습니다.',
        )
      }

      setUser(result.data.user)
    },
    [],
  )

  const signup = useCallback(
    async (input: SignupInput) => {
      const response = await apiFetch(
        '/auth/signup',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(input),
        },
      )

      const result =
        await readAuthResponse(response)

      if (
        !response.ok ||
        !result.success ||
        !result.data?.user
      ) {
        throw new Error(
          result.message ??
            '회원가입에 실패했습니다.',
        )
      }

      setUser(result.data.user)
    },
    [],
  )

  const logout =
    useCallback(async () => {
      const response = await apiFetch(
        '/auth/logout',
        {
          method: 'POST',
        },
      )

      if (!response.ok) {
        throw new Error(
          '로그아웃에 실패했습니다.',
        )
      }

      setUser(null)
    }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [
      user,
      isLoading,
      login,
      signup,
      logout,
      refreshUser,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
