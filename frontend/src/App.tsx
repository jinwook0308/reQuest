import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'

const MainPage = lazy(
  () => import('./pages/main/MainPage'),
)
const RecordsPage = lazy(
  () => import('./pages/records/RecordsPage'),
)
const HistoryPage = lazy(
  () => import('./pages/history/HistoryPage'),
)
const HistoryDetailPage = lazy(
  () => import('./pages/history-detail/HistoryDetailPage'),
)
const QuestReviewPage = lazy(
  () => import('./pages/quest-review/QuestReviewPage'),
)
const QuizPage = lazy(
  () => import('./pages/quiz/QuizPage'),
)
const StatisticsPage = lazy(
  () => import('./pages/statistics/StatisticsPage'),
)
const WrongNotesPage = lazy(
  () => import('./pages/wrong-notes/WrongNotesPage'),
)
const WrongNoteFormPage = lazy(
  () => import('./pages/wrong-notes/WrongNoteFormPage'),
)
const WrongNoteDetailPage = lazy(
  () => import('./pages/wrong-notes/WrongNoteDetailPage'),
)

function App() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite">
          페이지를 불러오는 중입니다.
        </div>
      }
    >
      <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/records" element={<RecordsPage />} />

      <Route
        path="/wrong-notes"
        element={<WrongNotesPage />}
      />

      <Route
        path="/wrong-notes/new"
        element={<WrongNoteFormPage />}
      />

      <Route
        path="/wrong-notes/:wrongNoteId"
        element={<WrongNoteDetailPage />}
      />

      <Route path="/history" element={<HistoryPage />} />

      <Route
        path="/quest-review/wrong-note/:wrongNoteId"
        element={<QuestReviewPage />}
      />

      <Route
        path="/history/:recordId"
        element={<HistoryDetailPage />}
      />

      <Route
        path="/quest-review/:recordId"
        element={<QuestReviewPage />}
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
        element={<StatisticsPage />}
      />
      </Routes>
    </Suspense>
  )
}

export default App
