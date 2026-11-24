import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AnswerHistoryEntry,
  CompositionHistoryEntry,
  CompositionSelfScore,
  SrsRating,
  StudyScope,
  UserCustomExercise,
  UserSettings,
  UserState,
  UserVocabNote,
} from '../types/user';
import {
  createDefaultUserState,
  loadUserState,
  saveUserState,
  validateImportedUserState,
} from '../utils/storage';
import { updateSrsRecord } from '../utils/srs';
import { detectSpeechSupport, type SpeechSupportInfo } from '../utils/speech';

interface AppContextValue {
  userState: UserState;
  corruptedStorageDetected: boolean;
  speechSupport: SpeechSupportInfo;
  setScope: (scope: StudyScope) => void;
  toggleLessonCompleted: (lessonId: string) => void;
  markGrammarStudied: (grammarId: string) => void;
  toggleFavoriteVocab: (vocabId: string) => void;
  toggleBookmarkGrammar: (grammarId: string) => void;
  saveGrammarNote: (grammarId: string, note: string) => void;
  rateSrsItem: (id: string, kind: 'vocab' | 'grammar' | 'exercise' | 'composition', rating: SrsRating) => void;
  recordAnswer: (entry: Omit<AnswerHistoryEntry, 'id' | 'timestamp'>) => void;
  recordComposition: (
    entry: Omit<CompositionHistoryEntry, 'id' | 'timestamp'>
  ) => string;
  updateCompositionSelfScore: (historyId: string, score: CompositionSelfScore) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  setLastVisited: (path: string, label: string) => void;
  addCustomVocab: (item: Omit<UserVocabNote, 'id' | 'createdAt'>) => void;
  deleteCustomVocab: (id: string) => void;
  addCustomExercise: (item: Omit<UserCustomExercise, 'id' | 'createdAt'>) => void;
  deleteCustomExercise: (id: string) => void;
  importUserStateJson: (rawJson: string) => { ok: boolean; error?: string };
  resetUserState: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => loadUserState(), []);
  const [userState, setUserState] = useState<UserState>(initial.state);
  const [corruptedStorageDetected] = useState<boolean>(initial.corrupted);
  const [speechSupport, setSpeechSupport] = useState<SpeechSupportInfo>(() => detectSpeechSupport());

  // Persist to localStorage
  useEffect(() => {
    saveUserState(userState);
  }, [userState]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', userState.settings.theme);
  }, [userState.settings.theme]);

  // Listen for speech synthesis voices loading
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const handleVoices = () => setSpeechSupport(detectSpeechSupport());
    window.speechSynthesis.addEventListener?.('voiceschanged', handleVoices);
    handleVoices();
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', handleVoices);
    };
  }, []);

  // Track study time in 30-second intervals while visible
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        const today = new Date().toISOString().slice(0, 10);
        setUserState((prev) => {
          const sessions = [...prev.studySessions];
          const idx = sessions.findIndex((s) => s.date === today);
          if (idx >= 0) {
            sessions[idx] = { ...sessions[idx], seconds: sessions[idx].seconds + 30 };
          } else {
            sessions.push({ date: today, seconds: 30 });
          }
          return {
            ...prev,
            studySecondsTotal: prev.studySecondsTotal + 30,
            studySessions: sessions.slice(-60),
          };
        });
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const setScope = useCallback((scope: StudyScope) => {
    setUserState((prev) => ({
      ...prev,
      scope,
      settings: { ...prev.settings, scopeConfigured: true },
    }));
  }, []);

  const toggleLessonCompleted = useCallback((lessonId: string) => {
    setUserState((prev) => {
      const exists = prev.completedLessons.includes(lessonId);
      return {
        ...prev,
        completedLessons: exists
          ? prev.completedLessons.filter((id) => id !== lessonId)
          : [...prev.completedLessons, lessonId],
      };
    });
  }, []);

  const markGrammarStudied = useCallback((grammarId: string) => {
    setUserState((prev) => {
      if (prev.studiedGrammarIds.includes(grammarId)) return prev;
      return {
        ...prev,
        studiedGrammarIds: [...prev.studiedGrammarIds, grammarId],
      };
    });
  }, []);

  const toggleFavoriteVocab = useCallback((vocabId: string) => {
    setUserState((prev) => {
      const exists = prev.favoritesVocab.includes(vocabId);
      return {
        ...prev,
        favoritesVocab: exists
          ? prev.favoritesVocab.filter((id) => id !== vocabId)
          : [...prev.favoritesVocab, vocabId],
      };
    });
  }, []);

  const toggleBookmarkGrammar = useCallback((grammarId: string) => {
    setUserState((prev) => {
      const exists = prev.bookmarkedGrammar.includes(grammarId);
      return {
        ...prev,
        bookmarkedGrammar: exists
          ? prev.bookmarkedGrammar.filter((id) => id !== grammarId)
          : [...prev.bookmarkedGrammar, grammarId],
      };
    });
  }, []);

  const saveGrammarNote = useCallback((grammarId: string, note: string) => {
    setUserState((prev) => ({
      ...prev,
      grammarNotes: { ...prev.grammarNotes, [grammarId]: note },
    }));
  }, []);

  const rateSrsItem = useCallback(
    (id: string, kind: 'vocab' | 'grammar' | 'exercise' | 'composition', rating: SrsRating) => {
      setUserState((prev) => ({
        ...prev,
        srs: {
          ...prev.srs,
          [id]: updateSrsRecord(prev.srs[id], id, kind, rating),
        },
      }));
    },
    []
  );

  const recordAnswer = useCallback((entry: Omit<AnswerHistoryEntry, 'id' | 'timestamp'>) => {
    const id = `ANS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();
    setUserState((prev) => {
      const nextSrs = { ...prev.srs };
      const rating: SrsRating = entry.correct ? 'good' : 'again';
      nextSrs[entry.itemId] = updateSrsRecord(nextSrs[entry.itemId], entry.itemId, 'exercise', rating);
      for (const gid of entry.grammarIds) {
        nextSrs[gid] = updateSrsRecord(nextSrs[gid], gid, 'grammar', rating);
      }
      return {
        ...prev,
        srs: nextSrs,
        answerHistory: [{ ...entry, id, timestamp }, ...prev.answerHistory].slice(0, 1000),
      };
    });
  }, []);

  const recordComposition = useCallback((entry: Omit<CompositionHistoryEntry, 'id' | 'timestamp'>) => {
    const id = `CMPH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();
    setUserState((prev) => {
      const nextSrs = { ...prev.srs };
      if (entry.selfScore) {
        const rating: SrsRating =
          entry.selfScore === 'correct' ? 'good' : entry.selfScore === 'partial' ? 'hard' : 'again';
        nextSrs[entry.compositionId] = updateSrsRecord(
          nextSrs[entry.compositionId],
          entry.compositionId,
          'composition',
          rating
        );
        for (const gid of entry.grammarIds) {
          nextSrs[gid] = updateSrsRecord(nextSrs[gid], gid, 'grammar', rating);
        }
      }
      return {
        ...prev,
        srs: nextSrs,
        compositionHistory: [{ ...entry, id, timestamp }, ...prev.compositionHistory].slice(0, 500),
      };
    });
    return id;
  }, []);

  const updateCompositionSelfScore = useCallback(
    (historyId: string, score: CompositionSelfScore) => {
      setUserState((prev) => {
        const target = prev.compositionHistory.find((h) => h.id === historyId);
        if (!target) return prev;
        const nextHistory = prev.compositionHistory.map((h) =>
          h.id === historyId ? { ...h, selfScore: score } : h
        );
        const nextSrs = { ...prev.srs };
        const rating: SrsRating =
          score === 'correct' ? 'good' : score === 'partial' ? 'hard' : 'again';
        nextSrs[target.compositionId] = updateSrsRecord(
          nextSrs[target.compositionId],
          target.compositionId,
          'composition',
          rating
        );
        for (const gid of target.grammarIds) {
          nextSrs[gid] = updateSrsRecord(nextSrs[gid], gid, 'grammar', rating);
        }
        return {
          ...prev,
          srs: nextSrs,
          compositionHistory: nextHistory,
        };
      });
    },
    []
  );

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setUserState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const setLastVisited = useCallback((path: string, label: string) => {
    setUserState((prev) => {
      if (prev.settings.lastVisitedPath === path) return prev;
      return {
        ...prev,
        settings: { ...prev.settings, lastVisitedPath: path, lastVisitedLabel: label },
      };
    });
  }, []);

  const addCustomVocab = useCallback((item: Omit<UserVocabNote, 'id' | 'createdAt'>) => {
    const newItem: UserVocabNote = {
      ...item,
      id: `UV-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUserState((prev) => ({
      ...prev,
      customVocab: [newItem, ...prev.customVocab],
    }));
  }, []);

  const deleteCustomVocab = useCallback((id: string) => {
    setUserState((prev) => ({
      ...prev,
      customVocab: prev.customVocab.filter((v) => v.id !== id),
    }));
  }, []);

  const addCustomExercise = useCallback((item: Omit<UserCustomExercise, 'id' | 'createdAt'>) => {
    const newItem: UserCustomExercise = {
      ...item,
      id: `UQ-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUserState((prev) => ({
      ...prev,
      customExercises: [newItem, ...prev.customExercises],
    }));
  }, []);

  const deleteCustomExercise = useCallback((id: string) => {
    setUserState((prev) => ({
      ...prev,
      customExercises: prev.customExercises.filter((q) => q.id !== id),
    }));
  }, []);

  const importUserStateJson = useCallback((rawJson: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawJson);
      const result = validateImportedUserState(parsed);
      if (!result.valid || !result.data) {
        return { ok: false, error: result.error ?? 'データの形式が不正です。' };
      }
      setUserState(result.data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'JSONの解析に失敗しました。破損している可能性があります。' };
    }
  }, []);

  const resetUserState = useCallback(() => {
    setUserState(createDefaultUserState());
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      userState,
      corruptedStorageDetected,
      speechSupport,
      setScope,
      toggleLessonCompleted,
      markGrammarStudied,
      toggleFavoriteVocab,
      toggleBookmarkGrammar,
      saveGrammarNote,
      rateSrsItem,
      recordAnswer,
      recordComposition,
      updateCompositionSelfScore,
      updateSettings,
      setLastVisited,
      addCustomVocab,
      deleteCustomVocab,
      addCustomExercise,
      deleteCustomExercise,
      importUserStateJson,
      resetUserState,
    }),
    [
      userState,
      corruptedStorageDetected,
      speechSupport,
      setScope,
      toggleLessonCompleted,
      markGrammarStudied,
      toggleFavoriteVocab,
      toggleBookmarkGrammar,
      saveGrammarNote,
      rateSrsItem,
      recordAnswer,
      recordComposition,
      updateCompositionSelfScore,
      updateSettings,
      setLastVisited,
      addCustomVocab,
      deleteCustomVocab,
      addCustomExercise,
      deleteCustomExercise,
      importUserStateJson,
      resetUserState,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
