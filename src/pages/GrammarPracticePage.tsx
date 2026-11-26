import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { exercises, grammarPoints, lessons } from '../data';
import { useApp } from '../context/AppContext';
import type { ExerciseItem, ExerciseType } from '../types/curriculum';
import { filterByScope } from '../utils/scope';
import { createShuffleSeed, shuffleWithSeed } from '../utils/shuffle';
import { ExerciseCard, exerciseTypeLabel } from '../components/ExerciseCard';
import { OrderControls } from '../components/OrderControls';

export const GrammarPracticePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { userState, addCustomExercise, deleteCustomExercise } = useApp();

  const [grammarFilter, setGrammarFilter] = useState(searchParams.get('grammar') ?? 'all');
  const [lessonFilter, setLessonFilter] = useState(searchParams.get('lesson') ?? 'scope');
  const [typeFilter, setTypeFilter] = useState<'all' | ExerciseType>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [randomOrder, setRandomOrder] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(() => createShuffleSeed());
  const [idx, setIdx] = useState(0);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [cPrompt, setCPrompt] = useState('');
  const [cChoices, setCChoices] = useState('');
  const [cAnswer, setCAnswer] = useState('');
  const [cExp, setCExp] = useState('');

  const wrongIdSet = useMemo(
    () => new Set(userState.answerHistory.filter((h) => !h.correct).map((h) => h.itemId)),
    [userState.answerHistory]
  );

  const allExercises = useMemo(() => {
    const customList: ExerciseItem[] = userState.customExercises.map((cq) => ({
      id: cq.id,
      lessonId: cq.lessonId,
      minLesson: 1,
      grammarIds: cq.grammarIds.length ? cq.grammarIds : ['G01-01'],
      type: cq.choices.length > 0 ? 'multiple-choice' : 'fill-blank',
      difficulty: 1,
      prompt: cq.prompt,
      choices: cq.choices.length > 0 ? cq.choices : undefined,
      answer: cq.answer,
      explanation: cq.explanation,
      grammarRuleNote: 'ユーザー登録問題',
    }));
    return [...customList, ...exercises];
  }, [userState.customExercises]);

  const filteredPool = useMemo(() => {
    const scopedSet = new Set(filterByScope(allExercises, userState.scope).map((e) => e.id));
    return allExercises.filter((e) => {
      if (lessonFilter === 'scope' && !scopedSet.has(e.id)) return false;
      if (lessonFilter !== 'all' && lessonFilter !== 'scope' && e.lessonId !== lessonFilter) return false;
      if (grammarFilter !== 'all' && !e.grammarIds.includes(grammarFilter)) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (difficultyFilter !== 'all' && String(e.difficulty) !== difficultyFilter) return false;
      if (onlyWeak && !wrongIdSet.has(e.id)) return false;
      return true;
    });
  }, [allExercises, userState.scope, lessonFilter, grammarFilter, typeFilter, difficultyFilter, onlyWeak, wrongIdSet]);

  const pool = useMemo(
    () => (randomOrder ? shuffleWithSeed(filteredPool, shuffleSeed) : filteredPool),
    [filteredPool, randomOrder, shuffleSeed]
  );

  const current = pool[idx % Math.max(1, pool.length)];

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cPrompt.trim() || !cAnswer.trim()) return;
    addCustomExercise({
      lessonId: 'L01',
      grammarIds: grammarFilter !== 'all' ? [grammarFilter] : ['G01-01'],
      prompt: cPrompt.trim(),
      choices: cChoices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      answer: cAnswer.trim(),
      explanation: cExp.trim() || '独自問題です。',
    });
    setCPrompt('');
    setCChoices('');
    setCAnswer('');
    setCExp('');
    setShowCustomForm(false);
  };

  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <header className="page-header">
        <div>
          <h2 className="page-title">文法練習問題</h2>
          <p className="page-subtitle">選択・穴埋め・語順整序・誤文訂正・使い分け</p>
        </div>
        <div className="row-wrap">
          <Link to="/practice/composition" className="btn btn-sm btn-soft">
            中国語作文へ
          </Link>
          <button type="button" className="btn btn-sm" onClick={() => setShowCustomForm((s) => !s)}>
            <Plus size={14} /> 独自問題登録
          </button>
        </div>
      </header>

      {showCustomForm && (
        <form onSubmit={handleAddCustom} className="card stack-md">
          <h3 className="section-heading">ユーザー独自問題の追加</h3>
          <input className="input" placeholder="問題文" value={cPrompt} onChange={(e) => setCPrompt(e.target.value)} required />
          <input className="input" placeholder="選択肢（カンマ区切り、記述式なら空欄）" value={cChoices} onChange={(e) => setCChoices(e.target.value)} />
          <input className="input" placeholder="正解" value={cAnswer} onChange={(e) => setCAnswer(e.target.value)} required />
          <input className="input" placeholder="解説" value={cExp} onChange={(e) => setCExp(e.target.value)} />
          <div className="row-wrap">
            <button type="submit" className="btn btn-primary btn-sm">追加</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCustomForm(false)}>キャンセル</button>
          </div>
        </form>
      )}

      <div className="stack-sm">
        <div className="grid-4">
          <select className="select" aria-label="課・範囲" value={lessonFilter} onChange={(e) => { setLessonFilter(e.target.value); setIdx(0); }}>
            <option value="scope">現在の学習範囲内</option>
            <option value="all">全課</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
          <select className="select" aria-label="文法事項" value={grammarFilter} onChange={(e) => { setGrammarFilter(e.target.value); setIdx(0); }}>
            <option value="all">すべての文法事項</option>
            {grammarPoints.filter((g) => !g.isSupplementary).map((g) => (
              <option key={g.id} value={g.id}>{g.lessonId}: {g.title}</option>
            ))}
          </select>
          <select className="select" aria-label="問題形式" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as 'all' | ExerciseType); setIdx(0); }}>
            <option value="all">すべての形式</option>
            {(['fill-blank', 'multiple-choice', 'word-order', 'error-correction', 'true-false', 'distinction', 'combined'] as ExerciseType[]).map((t) => (
              <option key={t} value={t}>{exerciseTypeLabel(t)}</option>
            ))}
          </select>
          <select className="select" aria-label="難易度" value={difficultyFilter} onChange={(e) => { setDifficultyFilter(e.target.value); setIdx(0); }}>
            <option value="all">すべての難易度</option>
            <option value="1">難易度 1（基礎）</option>
            <option value="2">難易度 2（標準）</option>
            <option value="3">難易度 3（応用）</option>
          </select>
        </div>

        <div className="row-between">
          <div className="row-wrap">
            <button type="button" className={`btn btn-sm ${onlyWeak ? 'btn-soft' : ''}`} onClick={() => { setOnlyWeak((x) => !x); setIdx(0); }}>
              過去に間違えた問題のみ ({wrongIdSet.size})
            </button>
            <OrderControls
              randomOrder={randomOrder}
              onToggleRandom={() => {
                setRandomOrder((prev) => {
                  const next = !prev;
                  if (next) setShuffleSeed(createShuffleSeed());
                  return next;
                });
                setIdx(0);
              }}
              onReshuffle={() => {
                setShuffleSeed(createShuffleSeed());
                setIdx(0);
              }}
            />
          </div>
          <div className="row-wrap">
            <span className="badge">{pool.length} 問該当</span>
            {pool.length > 0 && (
              <>
                <button type="button" className="btn btn-sm" onClick={() => setIdx((i) => (i - 1 + pool.length) % pool.length)}>
                  前へ
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setIdx((i) => (i + 1) % pool.length)}>
                  次へ
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!current ? (
        <div className="card">条件に一致する練習問題がありません。フィルタを緩めてください。</div>
      ) : (
        <div className="stack-sm">
          <div className="row-between">
            <span>問題 {(idx % pool.length) + 1} / {pool.length}</span>
            {current.id.startsWith('UQ-') && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteCustomExercise(current.id)}>
                <Trash2 size={14} /> この独自問題を削除
              </button>
            )}
          </div>
          <ExerciseCard
            exercise={current}
            onNext={() => setIdx((i) => (i + 1) % pool.length)}
          />
        </div>
      )}
    </div>
  );
};
