import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Clock, RotateCcw } from 'lucide-react';
import { exercises, grammarMap, lessons } from '../data';
import { useApp } from '../context/AppContext';
import type { ExerciseItem, ExerciseType } from '../types/curriculum';
import { filterByScope } from '../utils/scope';
import { ExerciseCard, exerciseTypeLabel } from '../components/ExerciseCard';

export const ExamPage: React.FC = () => {
  const { userState, recordAnswer } = useApp();

  const [scopeSource, setScopeSource] = useState<'scope' | 'upTo'>('scope');
  const [upToN, setUpToN] = useState(userState.scope.upToLesson);
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedTypes, setSelectedTypes] = useState<ExerciseType[]>([
    'multiple-choice',
    'fill-blank',
    'word-order',
    'error-correction',
    'distinction',
  ]);
  const [difficulty, setDifficulty] = useState<string>('all');
  const [timeLimitMin, setTimeLimitMin] = useState<number>(0); // 0 = unlimited
  const [deferredReveal, setDeferredReveal] = useState(true);

  const [phase, setPhase] = useState<'setup' | 'running' | 'result'>('setup');
  const [examQuestions, setExamQuestions] = useState<ExerciseItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, { correct: boolean; userAnswer: string }>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  const candidatePool = useMemo(() => {
    let base =
      scopeSource === 'scope'
        ? filterByScope(exercises, userState.scope)
        : filterByScope(exercises, { mode: 'upTo', upToLesson: upToN, selectedLessons: [] });
    return base.filter((e) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(e.type)) return false;
      if (difficulty !== 'all' && String(e.difficulty) !== difficulty) return false;
      return true;
    });
  }, [scopeSource, userState.scope, upToN, selectedTypes, difficulty]);

  useEffect(() => {
    if (phase !== 'running' || timeLimitMin <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSec((s) => {
        if (s <= 1) {
          finishExam();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  });

  const startExam = () => {
    const shuffled = [...candidatePool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(questionCount, shuffled.length));
    setExamQuestions(chosen);
    setAnswers({});
    setCurrentIdx(0);
    setRemainingSec(timeLimitMin * 60);
    setPhase('running');
  };

  const finishExam = () => {
    for (const q of examQuestions) {
      const a = answers[q.id];
      recordAnswer({
        itemId: q.id,
        itemKind: 'exam',
        lessonId: q.lessonId,
        grammarIds: q.grammarIds,
        correct: a?.correct ?? false,
        userAnswer: a?.userAnswer ?? '(未回答)',
      });
    }
    setPhase('result');
  };

  const toggleType = (t: ExerciseType) => {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  // Result analytics
  const summary = useMemo(() => {
    if (phase !== 'result') return null;
    const total = examQuestions.length;
    const correctCount = examQuestions.filter((q) => answers[q.id]?.correct).length;
    const byType = new Map<ExerciseType, { total: number; ok: number }>();
    const byGrammar = new Map<string, { total: number; ok: number }>();

    for (const q of examQuestions) {
      const ok = Boolean(answers[q.id]?.correct);
      const tEntry = byType.get(q.type) ?? { total: 0, ok: 0 };
      tEntry.total += 1;
      if (ok) tEntry.ok += 1;
      byType.set(q.type, tEntry);

      for (const gid of q.grammarIds) {
        const gEntry = byGrammar.get(gid) ?? { total: 0, ok: 0 };
        gEntry.total += 1;
        if (ok) gEntry.ok += 1;
        byGrammar.set(gid, gEntry);
      }
    }

    const wrongQuestions = examQuestions.filter((q) => !answers[q.id]?.correct);
    return { total, correctCount, byType, byGrammar, wrongQuestions };
  }, [phase, examQuestions, answers]);

  return (
    <div className="stack-lg">
      <div>
        <h2 style={{ margin: 0 }}>総合テスト・試験対策モード</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          学習範囲内の複数形式からテストを生成し、問題形式別・文法事項別の弱点分析と復習を行います。
        </p>
      </div>

      {phase === 'setup' && (
        <div className="card stack-md" data-testid="exam-setup">
          <div className="grid-2">
            <div className="stack-sm">
              <label style={{ fontWeight: 600 }}>出題範囲</label>
              <select
                className="select"
                value={scopeSource}
                onChange={(e) => setScopeSource(e.target.value as 'scope' | 'upTo')}
              >
                <option value="scope">現在の学習範囲設定に従う</option>
                <option value="upTo">第1課〜第N課までを指定</option>
              </select>
              {scopeSource === 'upTo' && (
                <select
                  className="select"
                  value={upToN}
                  onChange={(e) => setUpToN(Number(e.target.value))}
                >
                  {lessons.map((l) => (
                    <option key={l.id} value={l.number}>
                      第1課〜{l.title}まで
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="stack-sm">
              <label style={{ fontWeight: 600 }}>問題数・制限時間・難易度</label>
              <div className="grid-3">
                <select
                  className="select"
                  aria-label="問題数"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                >
                  {[5, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>{n} 問</option>
                  ))}
                </select>
                <select
                  className="select"
                  aria-label="難易度"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="all">難易度: 全て</option>
                  <option value="1">難易度 1</option>
                  <option value="2">難易度 2</option>
                  <option value="3">難易度 3</option>
                </select>
                <select
                  className="select"
                  aria-label="制限時間"
                  value={timeLimitMin}
                  onChange={(e) => setTimeLimitMin(Number(e.target.value))}
                >
                  <option value={0}>時間無制限</option>
                  <option value={5}>5 分</option>
                  <option value={10}>10 分</option>
                  <option value={20}>20 分</option>
                </select>
              </div>
            </div>
          </div>

          <div className="stack-sm">
            <label style={{ fontWeight: 600 }}>出題する問題形式</label>
            <div className="row-wrap">
              {(
                [
                  'multiple-choice',
                  'fill-blank',
                  'word-order',
                  'error-correction',
                  'true-false',
                  'distinction',
                  'combined',
                ] as ExerciseType[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${selectedTypes.includes(t) ? 'btn-primary' : ''}`}
                  onClick={() => toggleType(t)}
                >
                  {exerciseTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div className="row-between">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deferredReveal}
                onChange={(e) => setDeferredReveal(e.target.checked)}
              />
              <span>試験モード（解答と解説を最後にまとめて確認する）</span>
            </label>
            <span className="badge">候補問題数: {candidatePool.length} 問</span>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={candidatePool.length === 0}
              onClick={startExam}
            >
              <Award size={16} /> テストを開始する
            </button>
          </div>
        </div>
      )}

      {phase === 'running' && examQuestions[currentIdx] && (
        <div className="stack-md">
          <div className="card row-between">
            <div className="row-wrap">
              <strong>
                問題 {currentIdx + 1} / {examQuestions.length}
              </strong>
              <span className="badge">
                回答済み: {Object.keys(answers).length} / {examQuestions.length}
              </span>
            </div>
            <div className="row-wrap">
              {timeLimitMin > 0 && (
                <span className="badge badge-warning">
                  <Clock size={14} /> 残り {Math.floor(remainingSec / 60)}:
                  {String(remainingSec % 60).padStart(2, '0')}
                </span>
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={finishExam}>
                採点して終了する
              </button>
            </div>
          </div>

          <div className="row-wrap">
            {examQuestions.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                className={`btn btn-sm ${
                  idx === currentIdx ? 'btn-primary' : answers[q.id] ? 'btn-soft' : ''
                }`}
                onClick={() => setCurrentIdx(idx)}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <ExerciseCard
            exercise={examQuestions[currentIdx]}
            examMode={deferredReveal}
            initialUserAnswer={answers[examQuestions[currentIdx].id]?.userAnswer ?? ''}
            onAnswered={(correct, userAnswer) => {
              setAnswers((prev) => ({
                ...prev,
                [examQuestions[currentIdx].id]: { correct, userAnswer },
              }));
            }}
            onNext={() => {
              if (currentIdx + 1 < examQuestions.length) {
                setCurrentIdx((i) => i + 1);
              }
            }}
          />

          <div className="row-between">
            <button
              type="button"
              className="btn btn-sm"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => i - 1)}
            >
              前の問題
            </button>
            {currentIdx + 1 < examQuestions.length ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setCurrentIdx((i) => i + 1)}
              >
                次の問題へ
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={finishExam}>
                結果を確定・採点する
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'result' && summary && (
        <div className="stack-lg" data-testid="exam-result">
          <div className="card stack-md">
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>テスト結果</h3>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {summary.correctCount} / {summary.total} 問正解（
                  {summary.total ? Math.round((summary.correctCount / summary.total) * 100) : 0}%）
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setPhase('setup')}>
                <RotateCcw size={15} /> 新しいテストを作る
              </button>
            </div>

            <div className="grid-2">
              <div className="card-subtle stack-sm">
                <strong>問題形式別の成績</strong>
                {Array.from(summary.byType.entries()).map(([type, st]) => (
                  <div key={type} className="row-between">
                    <span>{exerciseTypeLabel(type)}</span>
                    <span className="badge">
                      {st.ok}/{st.total} ({Math.round((st.ok / st.total) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>

              <div className="card-subtle stack-sm">
                <strong>文法事項別の成績・弱点分析</strong>
                {Array.from(summary.byGrammar.entries()).map(([gid, st]) => {
                  const pct = Math.round((st.ok / st.total) * 100);
                  return (
                    <div key={gid} className="row-between">
                      <Link to={`/grammar/${gid}`}>{grammarMap.get(gid)?.title ?? gid}</Link>
                      <span className={`badge ${pct < 60 ? 'badge-danger' : 'badge-success'}`}>
                        {st.ok}/{st.total} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card stack-md">
            <h3 style={{ margin: 0 }}>
              間違えた問題・未回答の復習 ({summary.wrongQuestions.length}問)
            </h3>
            {summary.wrongQuestions.length === 0 ? (
              <p style={{ margin: 0 }}>全問正解です！素晴らしい成績です。</p>
            ) : (
              summary.wrongQuestions.map((q) => (
                <div key={q.id} className="card-subtle stack-sm">
                  <div className="row-between">
                    <span className="badge badge-danger">要復習 ({q.lessonId})</span>
                    <span>
                      あなたの回答: {answers[q.id]?.userAnswer ?? '(未回答)'} ／ 正解:{' '}
                      <strong lang="zh-Hans">
                        {Array.isArray(q.answer) ? q.answer.join('') : q.answer}
                      </strong>
                    </span>
                  </div>
                  <div className="zh-md" lang="zh-Hans">{q.prompt}</div>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{q.explanation}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
