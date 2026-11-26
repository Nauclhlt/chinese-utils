import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Gamepad2, PlusCircle, RotateCcw, Volume2 } from 'lucide-react';
import type { LiteratureWork, WorkChapter } from '../types/work';
import { speakChinese } from '../../utils/speech';

interface ReaderPracticePanelProps {
  work: LiteratureWork;
  currentChapter: WorkChapter;
  speechSupported: boolean;
  speechRate: number;
  masteredIds: Set<string>;
  isVocabInReview: (glossaryId: string) => boolean;
  onAddGlossaryToReview: (glossaryId: string) => void;
}

export const ReaderPracticePanel: React.FC<ReaderPracticePanelProps> = ({
  work,
  currentChapter,
  speechSupported,
  speechRate,
  masteredIds,
  isVocabInReview,
  onAddGlossaryToReview,
}) => {
  const [subTab, setSubTab] = useState<'vocab' | 'quiz' | 'drills'>('vocab');
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);

  // Chapter comprehension quiz state
  const [quizSelected, setQuizSelected] = useState<Record<string, number>>({});

  // Mini practice drill state (word-order / tone / grammar from work.practiceItems)
  const items = work.practiceItems ?? [];
  const [drillIdx, setDrillIdx] = useState(0);
  const [pickedChunks, setPickedChunks] = useState<string[]>([]);
  const [pickedChoice, setPickedChoice] = useState<string>('');
  const [drillResult, setDrillResult] = useState<'correct' | 'wrong' | null>(null);

  const visibleGlossary = useMemo(() => {
    if (!onlyUnmastered) return work.glossary;
    return work.glossary.filter(
      (g) => !(g.relatedVocabId && masteredIds.has(g.relatedVocabId))
    );
  }, [work.glossary, onlyUnmastered, masteredIds]);

  const currentDrill = items[drillIdx];
  const remainingChunks = useMemo(() => {
    if (!currentDrill?.chunks) return [];
    const used = [...pickedChunks];
    return currentDrill.chunks.filter((c) => {
      const idx = used.indexOf(c);
      if (idx >= 0) {
        used.splice(idx, 1);
        return false;
      }
      return true;
    });
  }, [currentDrill, pickedChunks]);

  const checkDrill = () => {
    if (!currentDrill) return;
    const submitted =
      currentDrill.kind === 'word-order' ? pickedChunks.join('') : pickedChoice;
    const norm = (s: string) => s.replace(/[\s，。！？、“”"‘’']/g, '');
    const accepted = [currentDrill.answer, ...(currentDrill.acceptableAnswers ?? [])].map(norm);
    setDrillResult(accepted.includes(norm(submitted)) ? 'correct' : 'wrong');
  };

  const resetDrill = (nextIdx: number) => {
    setDrillIdx(nextIdx);
    setPickedChunks([]);
    setPickedChoice('');
    setDrillResult(null);
  };

  return (
    <div className="card stack-md" data-testid="reader-practice-panel">
      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>任意の学習・演習ワークスペース</h3>
          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            読書を妨げない任意の復習ツールです。作品語彙・章末読解・語順/声調ミニ練習を行えます。
          </p>
        </div>
        <div className="row-wrap" style={{ gap: 6 }}>
          <Link to="/games/rhythm" className="btn btn-sm btn-soft">
            <Gamepad2 size={14} /> 声調リズムへ
          </Link>
          <Link to="/games/word-puzzle" className="btn btn-sm btn-soft">
            <Gamepad2 size={14} /> 語順パズルへ
          </Link>
          <Link to="/games/grammar-hunter" className="btn btn-sm btn-soft">
            <Gamepad2 size={14} /> 誤文ハンターへ
          </Link>
        </div>
      </div>

      <div className="row-wrap" style={{ gap: 8 }}>
        <button
          type="button"
          className={`btn btn-sm ${subTab === 'vocab' ? 'btn-primary' : ''}`}
          onClick={() => setSubTab('vocab')}
        >
          作品別単語帳 ({work.glossary.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${subTab === 'quiz' ? 'btn-primary' : ''}`}
          onClick={() => setSubTab('quiz')}
          data-testid="reader-practice-quiz-tab"
        >
          第{currentChapter.number}章 読解チェック ({currentChapter.quiz?.length ?? 0})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${subTab === 'drills' ? 'btn-primary' : ''}`}
          onClick={() => setSubTab('drills')}
          data-testid="reader-practice-drills-tab"
        >
          作品例文トレーニング ({items.length})
        </button>
      </div>

      {subTab === 'vocab' && (
        <div className="stack-sm">
          <div className="row-between">
            <label style={{ fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={onlyUnmastered}
                onChange={(e) => setOnlyUnmastered(e.target.checked)}
              />
              未習得・教材外語彙のみ表示
            </label>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              表示中: {visibleGlossary.length}語
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>見出し語</th>
                  <th>ピンイン</th>
                  <th>意味・品詞</th>
                  <th>教材対応</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleGlossary.map((g) => {
                  const inReview = isVocabInReview(g.id);
                  const mastered = Boolean(g.relatedVocabId && masteredIds.has(g.relatedVocabId));
                  return (
                    <tr key={g.id}>
                      <td className="zh-md" lang="zh-Hans">{g.headword}</td>
                      <td>{g.pinyin}</td>
                      <td>
                        <div>{g.generalMeaningJa}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{g.pos}</div>
                      </td>
                      <td>
                        {g.relatedLessonId ? (
                          <span className="badge badge-success">
                            {g.relatedLessonId} {mastered ? '(習得済)' : ''}
                          </span>
                        ) : (
                          <span className="badge">教材外語彙</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {speechSupported && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => speakChinese(g.headword, speechRate)}
                              title="発音"
                            >
                              <Volume2 size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={inReview}
                            onClick={() => onAddGlossaryToReview(g.id)}
                          >
                            <PlusCircle size={13} /> {inReview ? '登録済' : '復習へ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'quiz' && (
        <div className="stack-md">
          {!currentChapter.quiz || currentChapter.quiz.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>この章に任意の読解チェックはありません。</p>
          ) : (
            currentChapter.quiz.map((q, qi) => {
              const chosen = quizSelected[q.id];
              return (
                <div key={q.id} className="card-subtle stack-xs">
                  <strong>
                    Q{qi + 1}. {q.promptJa}
                  </strong>
                  <div className="row-wrap" style={{ gap: 8 }}>
                    {q.choices.map((c, ci) => {
                      const isPicked = chosen === ci;
                      const isRight = chosen !== undefined && ci === q.answerIndex;
                      return (
                        <button
                          key={ci}
                          type="button"
                          className={`btn btn-sm ${
                            isRight ? 'btn-primary' : isPicked ? 'btn-soft' : ''
                          }`}
                          onClick={() => setQuizSelected((prev) => ({ ...prev, [q.id]: ci }))}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  {chosen !== undefined && (
                    <div style={{ fontSize: '0.86rem', marginTop: 4 }}>
                      <strong style={{ color: chosen === q.answerIndex ? 'var(--success)' : 'var(--danger)' }}>
                        {chosen === q.answerIndex ? '正解！' : '解説:'}
                      </strong>{' '}
                      {q.explanationJa}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {subTab === 'drills' && (
        <div className="stack-sm">
          {!currentDrill ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>作品連動ミニ練習問題はまだありません。</p>
          ) : (
            <div className="card-subtle stack-sm">
              <div className="row-between">
                <span className="badge badge-accent">
                  {currentDrill.kind === 'tone'
                    ? '作品語彙 声調チェック'
                    : currentDrill.kind === 'word-order'
                      ? '作品文 語順パズル'
                      : '作品 文法チェック'}
                </span>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {drillIdx + 1} / {items.length}
                </span>
              </div>
              <div style={{ fontWeight: 600 }}>{currentDrill.promptJa}</div>

              {currentDrill.kind === 'word-order' ? (
                <div className="stack-xs">
                  <div className="card" style={{ padding: 10, minHeight: 44 }}>
                    {pickedChunks.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        下の語句をクリックして文を組み立ててください
                      </span>
                    ) : (
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {pickedChunks.map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="btn btn-sm btn-soft"
                            lang="zh-Hans"
                            onClick={() =>
                              setPickedChunks((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="row-wrap" style={{ gap: 6 }}>
                    {remainingChunks.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="btn btn-sm"
                        lang="zh-Hans"
                        onClick={() => setPickedChunks((prev) => [...prev, c])}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="row-wrap" style={{ gap: 8 }}>
                  {(currentDrill.choices ?? []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`btn btn-sm ${pickedChoice === c ? 'btn-primary' : ''}`}
                      lang="zh-Hans"
                      onClick={() => setPickedChoice(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="row-wrap" style={{ gap: 8 }}>
                <button type="button" className="btn btn-sm btn-primary" onClick={checkDrill}>
                  <CheckCircle2 size={14} /> 判定する
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => resetDrill((drillIdx + 1) % items.length)}
                >
                  次の問題 →
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => resetDrill(drillIdx)}
                >
                  <RotateCcw size={13} /> リセット
                </button>
              </div>

              {drillResult && (
                <div className="card" style={{ padding: 10 }}>
                  <strong style={{ color: drillResult === 'correct' ? 'var(--success)' : 'var(--danger)' }}>
                    {drillResult === 'correct' ? '正解！' : `正解例: ${currentDrill.answer}`}
                  </strong>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{currentDrill.explanationJa}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
