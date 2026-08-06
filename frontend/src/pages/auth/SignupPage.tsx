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
import './SignupPage.css'

function SignupPage() {
  const navigate = useNavigate()

  const {
    user,
    isLoading,
    signup,
  } = useAuth()

  const [nickname, setNickname] =
    useState('')

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    passwordConfirmation,
    setPasswordConfirmation,
  ] = useState('')

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

    if (nickname.trim().length < 2) {
      setErrorMessage(
        '이름은 2자 이상 입력해 주세요.',
      )
      return
    }

    if (password.length < 8) {
      setErrorMessage(
        '비밀번호는 8자 이상 입력해 주세요.',
      )
      return
    }

    if (
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setErrorMessage(
        '비밀번호에는 영문과 숫자가 모두 포함되어야 합니다.',
      )
      return
    }

    if (
      password !==
      passwordConfirmation
    ) {
      setErrorMessage(
        '비밀번호가 일치하지 않습니다.',
      )
      return
    }

    setIsSubmitting(true)

    try {
      await signup({
        nickname: nickname.trim(),
        email: email.trim(),
        password,
      })

      navigate('/', {
        replace: true,
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '회원가입에 실패했습니다.',
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
    <main className="login-page signup-page">
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
              BEGIN YOUR ARCHIVE
            </p>

            <h1>
              오늘의 기록이
              <br />
              나만의 학습 지도가 됩니다.
            </h1>

            <p className="login-copy-description signup-copy-description">
              학습한 내용과 어려웠던 지점을
              차곡차곡 남기면
            </p>

            <p className="signup-key-message">
              reQuest가{' '}
              <strong>
                다음 복습의 출발점
              </strong>
              을 찾아드립니다.
            </p>

            <div className="login-feature-list">
              <span>
                <i className="is-plan" />
                학습 기록
              </span>

              <span>
                <i className="is-analysis" />
                오답 관리
              </span>

              <span>
                <i className="is-review" />
                맞춤 복습
              </span>
            </div>
          </div>

          <p className="login-copyright">
            © 2026 reQuest
          </p>
        </div>
      </section>

      <section className="login-form-section signup-form-section">
        <div className="login-form-container signup-form-container">
          <header className="login-form-header signup-form-header">
            <p className="login-form-eyebrow">
              CREATE ACCOUNT
            </p>

            <h2>회원가입</h2>

            <p>
              나만의 학습 서재를 만들어 보세요.
            </p>
          </header>

          <form
            className="login-form signup-form"
            onSubmit={handleSubmit}
          >
            <label className="login-field">
              <span>이름</span>

              <input
                type="text"
                value={nickname}
                placeholder="사용할 이름"
                autoComplete="name"
                minLength={2}
                maxLength={50}
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setNickname(
                    event.target.value,
                  )
                  setErrorMessage('')
                }}
              />
            </label>

            <label className="login-field">
              <span>이메일</span>

              <input
                type="email"
                value={email}
                placeholder="이메일 주소"
                autoComplete="email"
                maxLength={255}
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
                  placeholder="영문과 숫자를 포함한 8자 이상"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
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

            <label className="login-field">
              <span>비밀번호 확인</span>

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={
                  passwordConfirmation
                }
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setPasswordConfirmation(
                    event.target.value,
                  )
                  setErrorMessage('')
                }}
              />
            </label>

            <p className="signup-password-guide">
              영문과 숫자를 포함하여 8자 이상
              입력해 주세요.
            </p>

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
                ? '계정을 만드는 중...'
                : '회원가입'}
            </button>
          </form>

          <div className="login-signup">
            <span>
              이미 계정이 있으신가요?
            </span>

            <Link to="/login">
              로그인
            </Link>
          </div>

          <p className="login-security-note">
            비밀번호는 암호화되어 안전하게
            저장됩니다.
          </p>
        </div>
      </section>
    </main>
  )
}

export default SignupPage
