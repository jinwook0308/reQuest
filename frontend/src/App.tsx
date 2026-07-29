import { Route, Routes } from 'react-router'

import MainPage from './pages/main/MainPage'
import RecordsPage from './pages/records/RecordsPage'
import HistoryPage from './pages/history/HistoryPage'
import HistoryDetailPage from './pages/history-detail/HistoryDetailPage'
import QuestReviewPage from './pages/quest-review/QuestReviewPage'
import QuizPage from './pages/quiz/QuizPage'
import StatisticsPage from './pages/statistics/StatisticsPage'
import WrongNotesPage from './pages/wrong-notes/WrongNotesPage'
import WrongNoteFormPage from './pages/wrong-notes/WrongNoteFormPage'
import WrongNoteDetailPage from './pages/wrong-notes/WrongNoteDetailPage'

function App() {
  return (
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
  )
}

export default App