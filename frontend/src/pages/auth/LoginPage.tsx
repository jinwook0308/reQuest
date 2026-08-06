import {
  useState,
  type FormEvent,
} from 'react'
import {
  Link,
  Navigate,
  useNavigate,
} from 'react-router'
import {
  BookOpen,
  Eye,
  EyeOff,
} from 'lucide-react'

import { useAuth } from '../../auth/useAuth'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()

  const {
    user,
    isLoading,
    login,
  } = useAuth()

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await login({
        email,
        password,
      })

      navigate('/', {
        replace: true,
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '로그인에 실패했습니다.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="login-loading">
        <span className="login-loading-indicator" />

        <p>
          로그인 상태를 확인하고 있습니다.
        </p>
      </main>
    )
  }

  if (user) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  return (
    <main className="login-page">
      <section className="login-introduction">
        <div className="login-introduction-inner">
          <Link
            to="/login"
            className="login-brand"
            aria-label="reQuest 로그인"
          >
            <span className="login-brand-icon">
              <BookOpen
                size={25}
                strokeWidth={1.8}
              />

              <span className="login-brand-bookmark" />
            </span>

            <span className="login-brand-name">
              re<span>Q</span>uest
            </span>
          </Link>

          <div className="login-copy">
            <p className="login-copy-eyebrow">
              PERSONAL STUDY ARCHIVE
            </p>

            <h1>
              기록한 공부가
              <br />
              다음 복습을 만듭니다.
            </h1>

            <p className="login-copy-description">
              계획부터{' '}
              <strong className="login-highlight is-record">
                학습 기록
              </strong>
              ,{' '}
              <strong className="login-highlight is-wrong">
                오답 분석
              </strong>
              ,{' '}
              <strong className="login-highlight is-ai">
                AI 복습
              </strong>
              과{' '}
              <strong className="login-highlight is-statistics">
                성장 통계
              </strong>
              까지
              <br className="login-desktop-break" />
              하나의 학습 흐름으로
              관리하세요.
            </p>

            <div className="login-feature-list">
              <span>
                <i className="is-plan" />
                계획과 기록
              </span>

              <span>
                <i className="is-analysis" />
                오답 분석
              </span>

              <span>
                <i className="is-review" />
                AI 복습
              </span>
            </div>
          </div>

          <p className="login-copyright">
            © 2026 reQuest
          </p>
        </div>
      </section>

      <section className="login-form-section">
        <div className="login-form-container">
          <header className="login-form-header">
            <p className="login-form-eyebrow">
              WELCOME BACK
            </p>

            <h2>로그인</h2>

            <p>
              학습 연구실에 오신 것을
              환영합니다.
            </p>
          </header>

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <label className="login-field">
              <span>이메일</span>

              <input
                type="email"
                value={email}
                placeholder="이메일 주소"
                autoComplete="email"
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setEmail(
                    event.target.value,
                  )

                  setErrorMessage('')
                }}
              />
            </label>

            <label className="login-field">
              <span>비밀번호</span>

              <span className="login-password-field">
                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setPassword(
                      event.target.value,
                    )

                    setErrorMessage('')
                  }}
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={
                    showPassword
                      ? '비밀번호 숨기기'
                      : '비밀번호 보기'
                  }
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous,
                    )
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </span>
            </label>

            {errorMessage && (
              <p
                className="login-error"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="login-submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? '로그인 중...'
                : '로그인'}
            </button>
          </form>

          <div className="login-signup">
            <span>
              아직 계정이 없으신가요?
            </span>

            <Link to="/signup">
              회원가입
            </Link>
          </div>

          <p className="login-security-note">
            로그인 정보는 안전한 쿠키를 통해
            보호됩니다.
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
