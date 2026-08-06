import { createContext } from 'react'

export interface AuthUser {
  id: string
  nickname: string
  email: string
  createdAt: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput {
  nickname: string
  email: string
  password: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (input: LoginInput) => Promise<void>
  signup: (input: SignupInput) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext =
  createContext<AuthContextValue | null>(null)
