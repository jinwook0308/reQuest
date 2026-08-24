import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  Bell,
  BookOpen,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react'

import { useAuth } from '../../auth/useAuth'
import './AppHeader.css'

type NavigationItem = {
  label: string
  path?: string
  activePaths: string[]
}

const navigationItems: NavigationItem[] = [
  {
    label: '이번 주',
    path: '/',
    activePaths: ['/'],
  },
  {
    label: '학습 기록',
    path: '/history',
    activePaths: ['/history', '/records'],
  },
  {
    label: '오답 노트',
    path: '/wrong-notes',
    activePaths: ['/wrong-notes'],
  },
  {
    label: 'AI 복습',
    path: '/ai-review',
    activePaths: ['/ai-review', '/quest-review', '/quiz'],
  },
  {
    label: '통계',
    path: '/statistics',
    activePaths: ['/statistics'],
  },
]

function isNavigationItemActive(item: NavigationItem, pathname: string) {
  if (item.path === '/') {
    return pathname === '/'
  }

  return item.activePaths.some((activePath) => pathname.startsWith(activePath))
}

function showPreparingMessage(featureName: string) {
  window.alert(`${featureName} 기능은 준비 중입니다.`)
}

function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const profileAreaRef = useRef<HTMLDivElement>(null)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    setIsMenuOpen(false)
    setIsProfileOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!isProfileOpen) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        isProfileOpen &&
        profileAreaRef.current &&
        !profileAreaRef.current.contains(target)
      ) {
        setIsProfileOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isProfileOpen])

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '로그아웃에 실패했습니다.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const profileName = user?.nickname ? `${user.nickname}님` : '학습자님'

  return (
    <header className="app-header">
      <Link
        className="app-header-brand"
        to="/"
        aria-label="reQuest 홈"
        onClick={() => {
          setIsMenuOpen(false)
          setIsProfileOpen(false)
        }}
      >
        <span className="app-header-brand-icon">
          <BookOpen size={29} strokeWidth={1.7} />
          <span className="app-header-bookmark" />
        </span>
        <span className="app-header-brand-name">reQuest</span>
      </Link>

      <button
        type="button"
        className="app-header-menu-button"
        aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={isMenuOpen}
        aria-controls="app-navigation"
        onClick={() => {
          setIsMenuOpen((previous) => !previous)
          setIsProfileOpen(false)
        }}
      >
        {isMenuOpen ? <X size={23} /> : <Menu size={23} />}
      </button>

      <nav
        id="app-navigation"
        className={`app-header-navigation ${isMenuOpen ? 'is-open' : ''}`}
        aria-label="주요 메뉴"
      >
        {navigationItems.map((item) => {
          const isActive = isNavigationItemActive(item, location.pathname)
          const className = `app-header-navigation-item ${isActive ? 'is-active' : ''}`

          if (item.path) {
            return (
              <Link
                className={className}
                to={item.path}
                key={item.label}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            )
          }

          return (
            <button
              type="button"
              className={`${className} is-preparing`}
              key={item.label}
              onClick={() => {
                setIsMenuOpen(false)
                showPreparingMessage(item.label)
              }}
            >
              {item.label}
              <span className="app-header-sr-only">준비 중</span>
            </button>
          )
        })}
      </nav>

      <div className="app-header-actions">
        <button
          type="button"
          className="app-header-icon-button"
          aria-label="검색"
          onClick={() => showPreparingMessage('검색')}
        >
          <Search size={21} />
        </button>

        <button
          type="button"
          className="app-header-icon-button app-header-notification-button"
          aria-label="알림"
          onClick={() => showPreparingMessage('알림')}
        >
          <Bell size={20} />
          <span className="app-header-notification-dot" />
        </button>

        <div className="app-header-profile-area" ref={profileAreaRef}>
          <button
            type="button"
            className="app-header-profile-button"
            aria-expanded={isProfileOpen}
            aria-controls="app-header-profile-menu"
            onClick={() => {
              setIsProfileOpen((previous) => !previous)
            }}
          >
            <span className="app-header-profile-image">
              <UserRound size={22} />
            </span>
            <span className="app-header-profile-name">{profileName}</span>
            <ChevronDown className={isProfileOpen ? 'is-open' : ''} size={15} />
          </button>

          {isProfileOpen && (
            <div id="app-header-profile-menu" className="app-header-profile-menu">
              <div className="app-header-profile-information">
                <strong>{profileName}</strong>
                <span>{user?.email}</span>
              </div>

              <Link className="app-header-profile-link" to="/profile">
                <Settings size={17} />
                <span>개인정보 수정</span>
              </Link>

              <button
                type="button"
                className="app-header-logout-button"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
              >
                <LogOut size={17} />
                <span>{isLoggingOut ? '로그아웃 중...' : '로그아웃'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
