import {
  lazy,
  Suspense,
} from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router'

import { useAuth } from './auth/useAuth'
import AppHeader from './components/layout/AppHeader'

const LoginPage = lazy(
  () =>
    import(
      './pages/auth/LoginPage'
    ),
)


const SignupPage = lazy(
  () =>
    import(
      './pages/auth/SignupPage'
    ),
)

const MainPage = lazy(
  () =>
    import(
      './pages/main/MainPage'
    ),
)

const RecordsPage = lazy(
  () =>
    import(
      './pages/records/RecordsPage'
    ),
)

const HistoryPage = lazy(
  () =>
    import(
      './pages/history/HistoryPage'
    ),
)

const HistoryDetailPage = lazy(
  () =>
    import(
      './pages/history-detail/HistoryDetailPage'
    ),
)

const QuestReviewPage = lazy(
  () =>
    import(
      './pages/quest-review/QuestReviewPage'
    ),
)

const QuizPage = lazy(
  () =>
    import(
      './pages/quiz/QuizPage'
    ),
)

const StatisticsPage = lazy(
  () =>
    import(
      './pages/statistics/StatisticsPage'
    ),
)

const AiReviewPage = lazy(
  () =>
    import(
      './pages/ai-review/AiReviewPage'
    ),
)

const AiReviewChatPage = lazy(
  () =>
    import(
      './pages/ai-chat/AiReviewChatPage'
    ),
)

const WrongNotesPage = lazy(
  () =>
    import(
      './pages/wrong-notes/WrongNotesPage'
    ),
)

const WrongNoteFormPage = lazy(
  () =>
    import(
      './pages/wrong-notes/WrongNoteFormPage'
    ),
)

const WrongNoteDetailPage = lazy(
  () =>
    import(
      './pages/wrong-notes/WrongNoteDetailPage'
    ),
)

const StudyFocusSetupPage = lazy(
  () => import('./pages/focus/StudyFocusSetupPage'),
)

const StudyTimerPage = lazy(
  () => import('./pages/focus/StudyTimerPage'),
)

function PageLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        color: '#77756f',
        background: '#f7f5ef',
        fontFamily:
          "'Noto Sans KR', sans-serif",
      }}
    >
      페이지를 불러오는 중입니다.
    </div>
  )
}

function ProtectedLayout() {
  const location = useLocation()

  const {
    user,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <PageLoading />
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    )
  }

  return (
    <>
      {!location.pathname.startsWith('/focus/session/') ? (
        <AppHeader />
      ) : null}
      <Outlet />
    </>
  )
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/signup"
          element={<SignupPage />}
        />

        <Route element={<ProtectedLayout />}>
          <Route
            path="/"
            element={<MainPage />}
          />

          <Route
            path="/records"
            element={<RecordsPage />}
          />

          <Route
            path="/wrong-notes"
            element={<WrongNotesPage />}
          />

          <Route
            path="/wrong-notes/new"
            element={
              <WrongNoteFormPage />
            }
          />

          <Route
            path="/wrong-notes/:wrongNoteId"
            element={
              <WrongNoteDetailPage />
            }
          />

          <Route
            path="/history"
            element={<HistoryPage />}
          />

          <Route
            path="/history/:recordId"
            element={
              <HistoryDetailPage />
            }
          />

          <Route
            path="/ai-review"
            element={<AiReviewPage />}
          />

          <Route
            path="/ai-review/chat"
            element={<AiReviewChatPage />}
          />

          <Route
            path="/quest-review/wrong-note/:wrongNoteId"
            element={
              <QuestReviewPage />
            }
          />

          <Route
            path="/quest-review/:recordId"
            element={
              <QuestReviewPage />
            }
          />

          <Route
            path="/quiz/wrong-note/:wrongNoteId"
            element={<QuizPage />}
          />

          <Route
            path="/quiz/:recordId"
            element={<QuizPage />}
          />

          <Route
            path="/statistics"
            element={
              <StatisticsPage />
            }
          />

          <Route
            path="/focus"
            element={<StudyFocusSetupPage />}
          />

          <Route
            path="/focus/session/:sessionId"
            element={<StudyTimerPage />}
          />
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  )
}

export default App
