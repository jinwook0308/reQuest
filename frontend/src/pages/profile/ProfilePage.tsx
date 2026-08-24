import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Check,
  KeyRound,
  LogOut,
  MailCheck,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { useAuth } from '../../auth/useAuth'
import { apiFetch } from '../../lib/api'
import './ProfilePage.css'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type EmailStatus = 'idle' | 'checking' | 'available' | 'unavailable'

function ProfilePage() {
  const navigate = useNavigate()
  const { user, refreshUser, logout } = useAuth()
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('available')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!user) return
    setNickname(user.nickname)
    setEmail(user.email)
    setEmailStatus('available')
  }, [user])

  const normalizedEmail = email.trim().toLowerCase()
  const emailChanged = normalizedEmail !== user?.email.toLowerCase()

  const checkEmailAvailability = async () => {
    if (!normalizedEmail) {
      setProfileError('이메일을 입력해 주세요.')
      return
    }

    setEmailStatus('checking')
    setProfileError('')
    setProfileMessage('')

    try {
      const response = await apiFetch(
        `/auth/email-availability?email=${encodeURIComponent(normalizedEmail)}`,
      )
      const result = (await response.json()) as ApiResponse<{
        email: string
        available: boolean
      }>

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? '이메일 중복 확인에 실패했습니다.')
      }

      setEmailStatus(result.data.available ? 'available' : 'unavailable')
      setProfileMessage(result.message ?? '')
    } catch (error) {
      setEmailStatus('idle')
      setProfileError(
        error instanceof Error ? error.message : '이메일 중복 확인에 실패했습니다.',
      )
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedNickname = nickname.trim()

    if (trimmedNickname.length < 2) {
      setProfileError('닉네임은 2자 이상 입력해 주세요.')
      return
    }
    if (emailChanged && emailStatus !== 'available') {
      setProfileError('변경할 이메일의 중복 확인을 완료해 주세요.')
      return
    }

    setSavingProfile(true)
    setProfileError('')
    setProfileMessage('')

    try {
      const response = await apiFetch('/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: trimmedNickname,
          email: normalizedEmail,
        }),
      })
      const result = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? '개인정보를 수정하지 못했습니다.')
      }

      await refreshUser()
      setEmailStatus('available')
      setProfileMessage(result.message ?? '개인정보를 수정했습니다.')
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : '개인정보를 수정하지 못했습니다.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (newPassword !== passwordConfirmation) {
      setPasswordError('새 비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setSavingPassword(true)
    setPasswordError('')
    setPasswordMessage('')

    try {
      const response = await apiFetch('/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const result = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? '비밀번호를 변경하지 못했습니다.')
      }

      setCurrentPassword('')
      setNewPassword('')
      setPasswordConfirmation('')
      setPasswordMessage(result.message ?? '비밀번호를 변경했습니다.')
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.',
      )
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '로그아웃에 실패했습니다.')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <main className="profile-page">
      <div className="profile-container">
        <button
          type="button"
          className="profile-back-button"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} /> 이전 화면
        </button>

        <header className="profile-heading">
          <span className="profile-heading-icon">
            <UserRound size={28} />
          </span>
          <div>
            <span className="profile-eyebrow">MY ACCOUNT</span>
            <h1>개인정보 수정</h1>
            <p>로그인한 계정의 닉네임, 이메일, 비밀번호를 안전하게 관리합니다.</p>
          </div>
        </header>

        <div className="profile-grid">
          <section className="profile-card">
            <div className="profile-card-heading">
              <MailCheck size={21} />
              <div>
                <h2>기본 정보</h2>
                <p>닉네임과 로그인 이메일을 확인하고 수정할 수 있습니다.</p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <label className="profile-field">
                <span>닉네임</span>
                <input
                  value={nickname}
                  minLength={2}
                  maxLength={50}
                  autoComplete="nickname"
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>

              <label className="profile-field">
                <span>이메일</span>
                <div className="profile-email-row">
                  <input
                    type="email"
                    value={email}
                    maxLength={255}
                    autoComplete="email"
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setEmailStatus(
                        event.target.value.trim().toLowerCase() ===
                          user?.email.toLowerCase()
                          ? 'available'
                          : 'idle',
                      )
                      setProfileMessage('')
                    }}
                  />
                  <button
                    type="button"
                    className="profile-check-button"
                    disabled={!emailChanged || emailStatus === 'checking'}
                    onClick={() => void checkEmailAvailability()}
                  >
                    {emailStatus === 'checking' ? '확인 중...' : '중복 확인'}
                  </button>
                </div>
                {emailChanged && emailStatus === 'available' && (
                  <small className="is-success">
                    <Check size={13} /> 사용할 수 있는 이메일입니다.
                  </small>
                )}
                {emailStatus === 'unavailable' && (
                  <small className="is-error">이미 사용 중인 이메일입니다.</small>
                )}
              </label>

              {profileMessage && (
                <p className="profile-form-message is-success">{profileMessage}</p>
              )}
              {profileError && (
                <p className="profile-form-message is-error" role="alert">
                  {profileError}
                </p>
              )}

              <button
                type="submit"
                className="profile-submit-button"
                disabled={savingProfile}
              >
                <Save size={17} /> {savingProfile ? '저장 중...' : '기본 정보 저장'}
              </button>
            </form>
          </section>

          <section className="profile-card">
            <div className="profile-card-heading">
              <KeyRound size={21} />
              <div>
                <h2>비밀번호 변경</h2>
                <p>현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <label className="profile-field">
                <span>현재 비밀번호</span>
                <input
                  type="password"
                  value={currentPassword}
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>새 비밀번호</span>
                <input
                  type="password"
                  value={newPassword}
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <small>영문과 숫자를 포함해 8자 이상 입력해 주세요.</small>
              </label>
              <label className="profile-field">
                <span>새 비밀번호 확인</span>
                <input
                  type="password"
                  value={passwordConfirmation}
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                />
              </label>

              {passwordMessage && (
                <p className="profile-form-message is-success">{passwordMessage}</p>
              )}
              {passwordError && (
                <p className="profile-form-message is-error" role="alert">
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                className="profile-submit-button"
                disabled={
                  savingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !passwordConfirmation
                }
              >
                <ShieldCheck size={17} />{' '}
                {savingPassword ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </section>
        </div>

        <section className="profile-session-card">
          <div>
            <strong>{user?.nickname}님으로 로그인 중</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" disabled={loggingOut} onClick={() => void handleLogout()}>
            <LogOut size={17} />
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </section>
      </div>
    </main>
  )
}

export default ProfilePage
