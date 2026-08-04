import {
  useState,
} from 'react'
import {
  Link,
  useLocation,
} from 'react-router'
import {
  Bell,
  BookOpen,
  ChevronDown,
  Menu,
  Search,
  UserRound,
  X,
} from 'lucide-react'

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
    activePaths: [
      '/history',
      '/records',
    ],
  },
  {
    label: '오답 노트',
    path: '/wrong-notes',
    activePaths: [
      '/wrong-notes',
    ],
  },
  {
    label: 'AI 복습',
    activePaths: [
      '/quest-review',
      '/quiz',
    ],
  },
  {
    label: '통계',
    path: '/statistics',
    activePaths: [
      '/statistics',
    ],
  },
  {
    label: '가이드',
    activePaths: [
      '/guide',
    ],
  },
]

function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
) {
  if (item.path === '/') {
    return pathname === '/'
  }

  return item.activePaths.some(
    (activePath) =>
      pathname.startsWith(
        activePath,
      ),
  )
}

function showPreparingMessage(
  featureName: string,
) {
  window.alert(
    `${featureName} 기능은 준비 중입니다.`,
  )
}

function AppHeader() {
  const location =
    useLocation()

  const [
    isMenuOpen,
    setIsMenuOpen,
  ] = useState(false)

  return (
    <header className="app-header">
      <Link
        className="app-header-brand"
        to="/"
        aria-label="reQuest 홈"
        onClick={() =>
          setIsMenuOpen(false)
        }
      >
        <span className="app-header-brand-icon">
          <BookOpen
            size={29}
            strokeWidth={1.7}
          />

          <span className="app-header-bookmark" />
        </span>

        <span className="app-header-brand-name">
          reQuest
        </span>
      </Link>

      <button
        type="button"
        className="app-header-menu-button"
        aria-label={
          isMenuOpen
            ? '메뉴 닫기'
            : '메뉴 열기'
        }
        aria-expanded={
          isMenuOpen
        }
        aria-controls="app-navigation"
        onClick={() =>
          setIsMenuOpen(
            (previous) =>
              !previous,
          )
        }
      >
        {isMenuOpen ? (
          <X size={23} />
        ) : (
          <Menu size={23} />
        )}
      </button>

      <nav
        id="app-navigation"
        className={`app-header-navigation ${
          isMenuOpen
            ? 'is-open'
            : ''
        }`}
        aria-label="주요 메뉴"
      >
        {navigationItems.map(
          (item) => {
            const isActive =
              isNavigationItemActive(
                item,
                location.pathname,
              )

            const className =
              `app-header-navigation-item ${
                isActive
                  ? 'is-active'
                  : ''
              }`

            if (item.path) {
              return (
                <Link
                  className={
                    className
                  }
                  to={item.path}
                  key={item.label}
                  onClick={() =>
                    setIsMenuOpen(
                      false,
                    )
                  }
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
                  setIsMenuOpen(
                    false,
                  )

                  showPreparingMessage(
                    item.label,
                  )
                }}
              >
                {item.label}

                <span className="app-header-sr-only">
                  준비 중
                </span>
              </button>
            )
          },
        )}
      </nav>

      <div className="app-header-actions">
        <button
          type="button"
          className="app-header-icon-button"
          aria-label="검색"
          onClick={() =>
            showPreparingMessage(
              '검색',
            )
          }
        >
          <Search size={21} />
        </button>

        <button
          type="button"
          className="app-header-icon-button app-header-notification-button"
          aria-label="알림"
          onClick={() =>
            showPreparingMessage(
              '알림',
            )
          }
        >
          <Bell size={20} />

          <span className="app-header-notification-dot" />
        </button>

        <button
          type="button"
          className="app-header-profile-button"
          onClick={() =>
            showPreparingMessage(
              '프로필',
            )
          }
        >
          <span className="app-header-profile-image">
            <UserRound
              size={22}
            />
          </span>

          <span className="app-header-profile-name">
            학습자님
          </span>

          <ChevronDown
            size={15}
          />
        </button>
      </div>
    </header>
  )
}

export default AppHeader