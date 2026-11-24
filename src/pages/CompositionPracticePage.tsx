import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, HelpCircle, RotateCcw } from 'lucide-react';
import { compositions, grammarMap, grammarPoints, lessons } from '../data';
import { useApp } from '../context/AppContext';
import type { CompositionSelfScore } from '../types/user';
import { filterByScope } from '../utils/scope';
import { computeCharDiff, matchesAcceptableChinese } from '../utils/diff';
import { ColoredPinyin, SpeakButton } from '../components/ChineseText';
import { StructureDiagram } from '../components/StructureDiagram';

export const CompositionPracticePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { userState, recordComposition, updateCompositionSelfScore } = useApp();

  const [scopeMode, setScopeMode] = useState<'scope' | 'upTo' | 'customLessons' | 'all'>('scope');
  const [upToN, setUpToN] = useState(userState.scope.upToLesson);
  const [customLessons, setCustomLessons] = useState<string[]>(
    searchParams.get('lesson') ? [searchParams.get('lesson')!] : []
  );
  const [selectedGrammars, setSelectedGrammars] = useState<string[]>(
    searchParams.get('grammar') ? [searchParams.get('grammar')!] : []
  );
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'wrong' | 'unanswered' | 'low-mastery'>('all');
  const [examModeHideHint, setExamModeHideHint] = useState(false);

  const [idx, setIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [checked, setChecked] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [selfScore, setSelfScore] = useState<CompositionSelfScore | null>(null);

  useEffect(() => {
    const l = searchParams.get('lesson');
    const g = searchParams.get('grammar');
    if (l) {
      setScopeMode('customLessons');
      setCustomLessons([l]);
    }
    if (g) {
      setSelectedGrammars([g]);
      setScopeMode('all');
    }
  }, [searchParams]);

  const pool = useMemo(() => {
    let base = compositions;
    if (scopeMode === 'scope') {
      base = filterByScope(compositions, userState.scope);
    } else if (scopeMode === 'upTo') {
      base = compositions.filter((c) => c.minLesson <= upToN);
    } else if (scopeMode === 'customLessons' && customLessons.length > 0) {
      base = compositions.filter((c) => customLessons.includes(c.lessonId));
    }

    return base.filter((c) => {
      if (selectedGrammars.length > 0 && !selectedGrammars.some((g) => c.grammarIds.includes(g))) {
        return false;
      }
      if (difficultyFilter !== 'all' && String(c.difficulty) !== difficultyFilter) {
        return false;
      }
      const logs = userState.compositionHistory.filter((h) => h.compositionId === c.id);
      if (statusFilter === 'unanswered' && logs.length > 0) return false;
      if (statusFilter === 'wrong' && !logs.some((h) => h.selfScore === 'wrong' || h.selfScore === 'partial')) {
        return false;
      }
      if (statusFilter === 'low-mastery') {
        const minMastery = Math.min(...c.grammarIds.map((gid) => userState.srs[gid]?.mastery ?? 0));
        if (minMastery >= 60) return false;
      }
      return true;
    });
  }, [
    scopeMode,
    userState.scope,
    userState.compositionHistory,
    userState.srs,
    upToN,
    customLessons,
    selectedGrammars,
    difficultyFilter,
    statusFilter,
  ]);

  const current = pool[idx % Math.max(1, pool.length)];

  useEffect(() => {
    setUserInput('');
    setHintLevel(0);
    setChecked(false);
    setCurrentHistoryId(null);
    setSelfScore(null);
  }, [current?.id]);

  const matchedModel = useMemo(() => {
    if (!current || !checked) return false;
    return matchesAcceptableChinese(userInput, current.modelAnswer, current.acceptableAnswers);
  }, [current, checked, userInput]);

  const diffSegments = useMemo(() => {
    if (!current || !checked) return [];
    return computeCharDiff(userInput, current.modelAnswer);
  }, [current, checked, userInput]);

  const handleCheck = () => {
    if (!current || !userInput.trim()) return;
    const matched = matchesAcceptableChinese(userInput, current.modelAnswer, current.acceptableAnswers);
    const initialScore: CompositionSelfScore | null = matched ? 'correct' : null;
    const hid = recordComposition({
      compositionId: current.id,
      lessonId: current.lessonId,
      grammarIds: current.grammarIds,
      userInput: userInput.trim(),
      matchedModel: matched,
      selfScore: initialScore,
    });
    setCurrentHistoryId(hid);
    setSelfScore(initialScore);
    setChecked(true);
  };

  const handleSelfScore = (score: CompositionSelfScore) => {
    setSelfScore(score);
    if (currentHistoryId) {
      updateCompositionSelfScore(currentHistoryId, score);
    }
  };

  const toggleLessonChip = (id: string) => {
    setCustomLessons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setIdx(0);
  };

  const toggleGrammarSelect = (gid: string) => {
    if (!gid) return;
    setSelectedGrammars((prev) => (prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]));
    setIdx(0);
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0 }}>中国語作文練習</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            日本語から中国語への翻訳・指定文法作文を練習し、模範解答・許容解答との差分比較と自己採点が行えます。
          </p>
        </div>
        <button
          type="button"
          className={`btn btn-sm ${examModeHideHint ? 'btn-primary' : 'btn-soft'}`}
          onClick={() => setExamModeHideHint((x) => !x)}
        >
          {examModeHideHint ? <EyeOff size={14} /> : <Eye size={14} />}
          {examModeHideHint ? '試験対策モード（指定文法非表示）' : '通常モード（使用文法表示）'}
        </button>
      </div>

      {/* Filters */}
      <div className="card stack-md">
        <div className="grid-4">
          <select
            className="select"
            aria-label="作文範囲モード"
            value={scopeMode}
            onChange={(e) => {
              setScopeMode(e.target.value as typeof scopeMode);
              setIdx(0);
            }}
          >
            <option value="scope">現在の学習範囲内</option>
            <option value="upTo">第N課までを指定</option>
            <option value="customLessons">任意の課を組み合わせ</option>
            <option value="all">全課から出題</option>
          </select>

          <select
            className="select"
            aria-label="文法追加フィルタ"
            value=""
            onChange={(e) => toggleGrammarSelect(e.target.value)}
          >
            <option value="">＋ 指定文法を追加/解除 ({selectedGrammars.length})</option>
            {grammarPoints.filter((g) => !g.isSupplementary).map((g) => (
              <option key={g.id} value={g.id}>
                {selectedGrammars.includes(g.id) ? '✓ ' : ''}{g.lessonId}: {g.title}
              </option>
            ))}
          </select>

          <select
            className="select"
            aria-label="難易度フィルタ"
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setIdx(0);
            }}
          >
            <option value="all">すべての難易度</option>
            <option value="1">難易度 1（基本）</option>
            <option value="2">難易度 2（標準）</option>
            <option value="3">難易度 3（発展）</option>
          </select>

          <select
            className="select"
            aria-label="履歴状態フィルタ"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setIdx(0);
            }}
          >
            <option value="all">すべて表示</option>
            <option value="unanswered">未回答のみ</option>
            <option value="wrong">過去に誤答/部分正解のみ</option>
            <option value="low-mastery">習熟度の低い文法のみ</option>
          </select>
        </div>

        {scopeMode === 'upTo' && (
          <div className="row-wrap">
            <label htmlFor="comp-upto">第1課〜第{upToN}課まで:</label>
            <input
              id="comp-upto"
              type="range"
              min={1}
              max={22}
              value={upToN}
              onChange={(e) => {
                setUpToN(Number(e.target.value));
                setIdx(0);
              }}
            />
          </div>
        )}

        {scopeMode === 'customLessons' && (
          <div className="row-wrap">
            {lessons.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`btn btn-sm ${customLessons.includes(l.id) ? 'btn-primary' : ''}`}
                onClick={() => toggleLessonChip(l.id)}
              >
                {l.title}
              </button>
            ))}
          </div>
        )}

        {selectedGrammars.length > 0 && (
          <div className="row-wrap">
            <span style={{ fontSize: '0.84rem', color: 'var(--text-light)' }}>指定中の文法:</span>
            {selectedGrammars.map((gid) => (
              <button
                key={gid}
                type="button"
                className="btn btn-sm btn-soft"
                onClick={() => toggleGrammarSelect(gid)}
              >
                {grammarMap.get(gid)?.title ?? gid} ×
              </button>
            ))}
          </div>
        )}

        <div className="row-between">
          <span className="badge">{pool.length} 問</span>
          {pool.length > 0 && (
            <div className="row-wrap">
              <button type="button" className="btn btn-sm" onClick={() => setIdx((i) => (i - 1 + pool.length) % pool.length)}>
                前の問題
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setIdx((i) => (i + 1) % pool.length)}>
                次の問題
              </button>
            </div>
          )}
        </div>
      </div>

      {!current ? (
        <div className="card">条件に一致する作文問題がありません。フィルタを調整してください。</div>
      ) : (
        <div className="card stack-md" data-testid="composition-card">
          <div className="row-between">
            <div className="row-wrap">
              <span className="badge badge-accent">{current.lessonId}</span>
              <span className="badge">難易度 {current.difficulty}</span>
              <span className="badge">問題 {(idx % pool.length) + 1} / {pool.length}</span>
            </div>
            {!examModeHideHint && (
              <div className="row-wrap">
                {current.grammarIds.map((gid) => (
                  <Link key={gid} to={`/grammar/${gid}`} className="badge badge-accent">
                    指定文法: {grammarMap.get(gid)?.title ?? gid}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card-subtle stack-sm">
            <div style={{ fontSize: '0.84rem', color: 'var(--text-light)' }}>日本語の問題文</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{current.japanesePrompt}</div>
            {!examModeHideHint && (
              <div style={{ fontSize: '0.88rem', color: 'var(--accent)' }}>
                目標ポイント: {current.targetGrammarHint}
              </div>
            )}
          </div>

          {/* Progressive hints */}
          <div className="stack-sm">
            <div className="row-wrap">
              <button
                type="button"
                className="btn btn-sm"
                disabled={hintLevel >= current.hints.length}
                onClick={() => setHintLevel((h) => Math.min(current.hints.length, h + 1))}
              >
                <HelpCircle size={14} /> ヒントを表示 ({hintLevel}/{current.hints.length})
              </button>
            </div>
            {hintLevel > 0 && (
              <div className="banner banner-info stack-sm">
                {current.hints.slice(0, hintLevel).map((h, i) => (
                  <div key={i}>
                    <strong>ヒント{i + 1}:</strong> {h}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User input */}
          <div className="stack-sm">
            <label htmlFor="comp-input" style={{ fontWeight: 600 }}>
              あなたの中国語作文（簡体字で入力）
            </label>
            <textarea
              id="comp-input"
              rows={2}
              className="textarea zh-lg"
              lang="zh-Hans"
              placeholder="例: 我昨天买了一本汉语书。"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
            <div className="row-wrap">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!userInput.trim()}
                onClick={handleCheck}
              >
                模範解答と比較・保存する
              </button>
              {checked && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setChecked(false);
                    setSelfScore(null);
                  }}
                >
                  <RotateCcw size={14} /> 書き直す
                </button>
              )}
            </div>
          </div>

          {/* Comparison Result */}
          {checked && (
            <div className="stack-md">
              {matchedModel ? (
                <div className="banner banner-success">
                  <strong>模範解答・許容解答と一致しました！</strong>（自動保存・正解として記録済み）
                </div>
              ) : (
                <div className="banner banner-warning">
                  <strong>模範解答と異なるため自己確認が必要です。</strong>
                  中国語には複数の自然な表現が存在するため、模範解答と文字列が異なるだけでは不正解になりません。下の解説・語順を確認し、自分で採点してください（本アプリはオフライン動作のため外部AIによる完全な自動添削は行いません）。
                </div>
              )}

              {/* Side-by-side comparison */}
              <div className="grid-2">
                <div className="card-subtle stack-sm">
                  <strong>あなたの解答</strong>
                  <div className="zh-lg" lang="zh-Hans">
                    {userInput}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-light)' }}>
                    差分比較（赤取消=入力のみ / 緑下線=模範のみ）:
                  </div>
                  <div className="zh-md" lang="zh-Hans">
                    {diffSegments.map((seg, i) => (
                      <span key={i} className={`diff-${seg.type}`}>
                        {seg.text}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card-subtle stack-sm">
                  <div className="row-between">
                    <strong>模範解答</strong>
                    <SpeakButton text={current.modelAnswer} size="sm" label="読み上げ" />
                  </div>
                  <div className="zh-lg" lang="zh-Hans">
                    {current.modelAnswer}
                  </div>
                  <ColoredPinyin pinyin={current.pinyin} toneColors={userState.settings.toneColors} />
                  {current.acceptableAnswers.length > 0 && (
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      <strong>その他の許容解答:</strong>{' '}
                      <span lang="zh-Hans">{current.acceptableAnswers.join(' ／ ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Grammar structure & explanation */}
              <div className="card-subtle stack-sm">
                <strong>語順・文法構造の色分け解説</strong>
                <StructureDiagram slots={current.structureBreakdown} />
                <p style={{ margin: '6px 0 0' }}>{current.explanation}</p>
              </div>

              {current.commonMistakes.length > 0 && (
                <div className="card-subtle stack-sm">
                  <strong>典型的な誤答とその理由</strong>
                  {current.commonMistakes.map((m, i) => (
                    <div key={i} style={{ fontSize: '0.9rem' }}>
                      <span className="badge badge-danger" style={{ marginRight: 6 }}>誤答例</span>
                      <span lang="zh-Hans" style={{ textDecoration: 'line-through', marginRight: 8 }}>
                        {m.wrong}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>→ {m.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Self grading */}
              <div className="card-subtle row-between">
                <strong>自己採点（間隔反復の優先度に反映されます）:</strong>
                <div className="row-wrap">
                  <button
                    type="button"
                    className={`btn btn-sm ${selfScore === 'correct' ? 'btn-primary' : ''}`}
                    onClick={() => handleSelfScore('correct')}
                  >
                    <CheckCircle2 size={14} /> 正解・自然
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${selfScore === 'partial' ? 'btn-soft' : ''}`}
                    onClick={() => handleSelfScore('partial')}
                  >
                    △ 惜しい・要復習
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${selfScore === 'wrong' ? 'btn-danger' : ''}`}
                    onClick={() => handleSelfScore('wrong')}
                  >
                    × 誤答（再出題）
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setIdx((i) => (i + 1) % pool.length)}
                  >
                    次の問題へ →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
