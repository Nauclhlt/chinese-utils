import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LessonsPage } from './pages/LessonsPage';
import { LessonDetailPage } from './pages/LessonDetailPage';
import { GrammarListPage } from './pages/GrammarListPage';
import { GrammarDetailPage } from './pages/GrammarDetailPage';
import { ComparisonsPage } from './pages/ComparisonsPage';
import { GrammarMapPage } from './pages/GrammarMapPage';
import { PrintGrammarPage } from './pages/PrintGrammarPage';
import { VocabPage } from './pages/VocabPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { PinyinPracticePage } from './pages/PinyinPracticePage';
import { GrammarPracticePage } from './pages/GrammarPracticePage';
import { CompositionPracticePage } from './pages/CompositionPracticePage';
import { ListeningPage } from './pages/ListeningPage';
import { ExamPage } from './pages/ExamPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { GamesHubPage } from './pages/GamesHubPage';
import { NovelGamePage } from './games/novel/NovelGamePage';
import { ToneRhythmGamePage } from './games/rhythm/ToneRhythmGamePage';
import { GrammarCorrectionGamePage } from './games/grammar/GrammarCorrectionGamePage';
import { WordOrderPuzzleGamePage } from './games/puzzle/WordOrderPuzzleGamePage';
import { BookshelfPage } from './reader/pages/BookshelfPage';
import { LiteratureReaderPage } from './reader/pages/LiteratureReaderPage';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            <Route path="/grammar" element={<GrammarListPage />} />
            <Route path="/grammar/:grammarId" element={<GrammarDetailPage />} />
            <Route path="/comparisons" element={<ComparisonsPage />} />
            <Route path="/grammar-map" element={<GrammarMapPage />} />
            <Route path="/print/grammar" element={<PrintGrammarPage />} />
            <Route path="/vocab" element={<VocabPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/pinyin" element={<PinyinPracticePage />} />
            <Route path="/practice/grammar" element={<GrammarPracticePage />} />
            <Route path="/practice/composition" element={<CompositionPracticePage />} />
            <Route path="/listening" element={<ListeningPage />} />
            <Route path="/exam" element={<ExamPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/games" element={<GamesHubPage />} />
            <Route path="/games/novel" element={<NovelGamePage />} />
            <Route path="/games/rhythm" element={<ToneRhythmGamePage />} />
            <Route path="/games/grammar-hunter" element={<GrammarCorrectionGamePage />} />
            <Route path="/games/word-puzzle" element={<WordOrderPuzzleGamePage />} />
            <Route path="/reader" element={<BookshelfPage />} />
            <Route path="/reader/:workId" element={<LiteratureReaderPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
};

export default App;
