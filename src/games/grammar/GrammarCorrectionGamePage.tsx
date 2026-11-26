import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bug, CheckCircle2, Clock, Heart, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import { grammarMap, grammarPoints } from '../../data';
import { grammarCorrectionQuestions, grammarStages } from '../data';
import type { GrammarCorrectionQuestion, GrammarGameQuestionType } from '../types/grammarGame';
import { useApp } from '../../context/AppContext';
import { gameAudio } from '../core/audioEngine';
import { loadGamesState, saveGamesState } from '../core/gameStorage';
import { createShuffleSeed, shuffleWithSeed } from '../../utils/shuffle';
import { normalizeChineseAnswer } from '../../utils/diff';
import { SpeakButton } from '../../components/ChineseText';

type GameMode = 'challenge' | 'time-attack' | 'practice' | 'grammar' | 'weak';

function typeLabel(t: GrammarGameQuestionType): string {
  switch (t) {
    case 'spot': return '誤り発見';
    case 'replace': return '語句置換';
    case 'delete': return '不要語削除';
    case 'insert': return '不足語追加';
    case 'reorder': return '語順修正';
    case 'rewrite': return '全文書換';
    case 'judge': return '正誤判定';
    case 'multi-error': return '複数誤り訂正';
  }
}

export const GrammarCorrectionGamePage: React.FC = () => {
  const { userState, recordAnswer } = useApp();
  const [gState, setGState] = useState(() => loadGamesState());

  const [screen, setScreen] = useState<'title' | 'play' | 'result'>('title');
  const [stageId, setStageId] = useState('stage01');
  const [mode, setMode] = useState<GameMode>('challenge');
  const [selectedGrammar, setSelectedGrammar] = useState('G01-02');

  const [questions, setQuestions] = useState<GrammarCorrectionQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [life, setLife] = useState(5);
  const [timeLeft, setTimeLeft] = useState(180);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Per-question interaction state
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [insertPos, setInsertPos] = useState<number | null>(null);
  const [orderedTokens, setOrderedTokens] = useState<string[]>([]);
  const [rewriteText, setRewriteText] = useState('');
  const [judgeChoice, setJudgeChoice] = useState<'correct' | 'wrong' | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; unverifiedFree?: boolean; msg: string } | null>(null);

  useEffect(() => {
    gameAudio.setVolumes(
      gState.globalSettings.bgmVolume,
      gState.globalSettings.sfxVolume,
      gState.globalSettings.muted
    );
    saveGamesState(gState);
  }, [gState]);

  const currentQ = questions[idx];

  const resetPerQuestion = (q?: GrammarCorrectionQuestion) => {
    setSelectedIndices([]);
    setSelectedChoice('');
    setInsertPos(null);
    setRewriteText('');
    setJudgeChoice(null);
    setFeedback(null);
    if (q && q.type === 'reorder') {
      setOrderedTokens([...q.tokens]);
    } else {
      setOrderedTokens([]);
    }
  };

  // Timer for time-attack
  useEffect(() => {
    if (screen !== 'play' || mode !== 'time-attack' || feedback) return;
    const t = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          finishStage(score, correctCount, questions.length);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  });

  const finishStage = (finalScore: number, okCnt: number, totalCnt: number) => {
    gameAudio.playSfx('clear');
    const acc = totalCnt > 0 ? Math.round((okCnt / totalCnt) * 100) : 0;
    const stars: 0 | 1 | 2 | 3 = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 50 ? 1 : 0;

    setGState((prev) => {
      const old = prev.grammarGame.stageRecords[stageId];
      const rec = {
        stageId,
        bestScore: Math.max(old?.bestScore ?? 0, finalScore),
        bestAccuracy: Math.max(old?.bestAccuracy ?? 0, acc),
        stars: Math.max(old?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
        cleared: (old?.cleared ?? false) || acc >= 50,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        grammarGame: {
          stageRecords: { ...prev.grammarGame.stageRecords, [stageId]: rec },
          totalClearedQuestions: prev.grammarGame.totalClearedQuestions + okCnt,
        },
      };
    });
    setScreen('result');
  };

  const startStage = (overrideStageId?: string) => {
    const targetStageId = overrideStageId ?? stageId;
    if (overrideStageId) setStageId(overrideStageId);
    const meta = grammarStages.find((s) => s.id === targetStageId) ?? grammarStages[0];

    let pool: GrammarCorrectionQuestion[] = [];
    if (mode === 'grammar') {
      pool = grammarCorrectionQuestions.filter((q) => q.grammarIds.includes(selectedGrammar));
    } else if (mode === 'weak') {
      const weakGrammarIds = new Set(
        Object.entries(userState.srs)
          .filter(([, rec]) => rec.kind === 'grammar' && (rec.wrongCount > 0 || rec.mastery < 60))
          .map(([id]) => id)
      );
      pool = grammarCorrectionQuestions.filter((q) => q.grammarIds.some((g) => weakGrammarIds.has(g)));
      if (pool.length === 0) {
        pool = grammarCorrectionQuestions.filter((q) => q.difficulty >= 2);
      }
    } else {
      pool = grammarCorrectionQuestions.filter((q) => q.stageId === targetStageId);
    }

    const picked = shuffleWithSeed(pool, createShuffleSeed()).slice(0, 10);
    setQuestions(picked);
    setIdx(0);
    setLife(meta.recommendedLife);
    setTimeLeft(meta.timeLimitSec);
    setScore(0);
    setCombo(0);
    setCorrectCount(0);
    resetPerQuestion(picked[0]);
    gameAudio.ensureContext();
    gameAudio.playSfx('scan');
    setScreen('play');
  };

  const submitAnswer = () => {
    if (!currentQ || feedback) return;

    let ok = false;
    let unverifiedFree = false;
    let userAnsSummary = '';

    const expectedIndices = [...(currentQ.errorIndices ?? [])].sort((a, b) => a - b);
    const actualIndices = [...selectedIndices].sort((a, b) => a - b);
    const indicesMatch =
      expectedIndices.length > 0 &&
      expectedIndices.length === actualIndices.length &&
      expectedIndices.every((v, i) => v === actualIndices[i]);

    switch (currentQ.type) {
      case 'spot':
      case 'delete':
        ok = indicesMatch;
        userAnsSummary = actualIndices.map((i) => currentQ.tokens[i]).join(' ');
        break;
      case 'replace': {
        const expectedChoice = currentQ.choices?.find((c) =>
          currentQ.acceptableSentences.some((s) => s.includes(c))
        );
        const tokenOk = expectedIndices.length === 0 || indicesMatch;
        const choiceOk = expectedChoice ? selectedChoice === expectedChoice : Boolean(selectedChoice);
        ok = tokenOk && choiceOk;
        userAnsSummary = `${actualIndices.map((i) => currentQ.tokens[i]).join(',')} -> ${selectedChoice}`;
        break;
      }
      case 'insert': {
        const expectedPosOk = currentQ.insertIndex === undefined || insertPos === currentQ.insertIndex;
        const expectedChoice = currentQ.choices?.find((c) =>
          currentQ.acceptableSentences.some((s) => s.includes(c))
        );
        ok = expectedPosOk && (expectedChoice ? selectedChoice === expectedChoice : Boolean(selectedChoice));
        userAnsSummary = `pos:${insertPos} + ${selectedChoice}`;
        break;
      }
      case 'reorder': {
        const joined = normalizeChineseAnswer(orderedTokens.join(''));
        ok = currentQ.acceptableSentences.map(normalizeChineseAnswer).includes(joined);
        userAnsSummary = orderedTokens.join('');
        break;
      }
      case 'judge': {
        const expectRight = Boolean(currentQ.isAlreadyCorrect);
        ok = (judgeChoice === 'correct' && expectRight) || (judgeChoice === 'wrong' && !expectRight);
        userAnsSummary = judgeChoice ?? '';
        break;
      }
      case 'rewrite':
      case 'multi-error': {
        const normUser = normalizeChineseAnswer(rewriteText);
        const matched = currentQ.acceptableSentences.map(normalizeChineseAnswer).includes(normUser);
        if (matched) {
          ok = true;
        } else {
          ok = false;
          unverifiedFree = true;
        }
        userAnsSummary = rewriteText;
        break;
      }
    }

    if (ok) {
      gameAudio.playSfx('fix-ok');
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setCorrectCount((c) => c + 1);
      setScore((s) => s + 150 + nextCombo * 30);
      setFeedback({ ok: true, msg: '訂正成功！完璧な文法判定です。' });
    } else {
      gameAudio.playSfx('fix-ng');
      setCombo(0);
      if (!unverifiedFree && mode === 'challenge') {
        setLife((l) => Math.max(0, l - 1));
      }
      setFeedback({
        ok: false,
        unverifiedFree,
        msg: unverifiedFree
          ? '許容解答リストと表記が異なります（自然な別表現の可能性もあるため下の模範解答と見比べて確認してください）。'
          : '惜しい！下の誤りポイントと正しい解説を確認しましょう。',
      });
    }

    recordAnswer({
      itemId: currentQ.id,
      itemKind: 'grammar-game',
      lessonId: currentQ.lessonId,
      grammarIds: currentQ.grammarIds,
      correct: ok,
      userAnswer: userAnsSummary,
    });
  };

  const nextQuestion = () => {
    if (mode === 'challenge' && life <= 0) {
      finishStage(score, correctCount, idx + 1);
      return;
    }
    if (idx + 1 >= questions.length) {
      finishStage(score, correctCount, questions.length);
      return;
    }
    const nxt = idx + 1;
    setIdx(nxt);
    resetPerQuestion(questions[nxt]);
  };

  const moveReorderToken = (fromIdx: number, dir: -1 | 1) => {
    const toIdx = fromIdx + dir;
    if (toIdx < 0 || toIdx >= orderedTokens.length) return;
    gameAudio.playSfx('snap');
    setOrderedTokens((prev) => {
      const next = [...prev];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });
  };

  const totalPoolForMode = useMemo(() => {
    if (mode === 'grammar') {
      return grammarCorrectionQuestions.filter((q) => q.grammarIds.includes(selectedGrammar)).length;
    }
    return grammarCorrectionQuestions.length;
  }, [mode, selectedGrammar]);

  return (
    <div className={`stack-lg ${gState.globalSettings.reducedMotion ? 'reduced-motion' : ''}`}>
      <div className="row-between">
        <Link to="/games" className="btn btn-sm">
          <ArrowLeft size={14} /> ゲームセンターへ戻る
        </Link>
        <span className="badge badge-accent">収録問題総数: {grammarCorrectionQuestions.length}問</span>
      </div>

      {/* TITLE & STAGE SELECT */}
      {screen === 'title' && (
        <div className="stack-lg" data-testid="grammar-game-title">
          <div className="card stack-md">
            <div className="row-between">
              <div>
                <span className="badge badge-accent">文法訂正パズル＆バトル</span>
                <h2 style={{ margin: '6px 0 4px' }}>
                  <span lang="zh-Hans">语病猎手</span> — Grammar Hunter
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                  誤り発見・語句置換・不要語削除・不足語追加・語順修正・全文書換・正誤判定・複数誤り訂正の全8形式で中国語の「語病」を狩り出そう！
                </p>
              </div>
              <Bug size={34} color="#059669" />
            </div>

            <div className="row-wrap">
              {(
                [
                  ['challenge', 'ライフ制チャレンジ'],
                  ['time-attack', 'タイムアタック'],
                  ['practice', '制限なし練習'],
                  ['grammar', '文法指定特訓'],
                  ['weak', '苦手文法優先復習'],
                ] as [GameMode, string][]
              ).map(([mId, lbl]) => (
                <button
                  key={mId}
                  type="button"
                  className={`btn btn-sm ${mode === mId ? 'btn-primary' : ''}`}
                  onClick={() => setMode(mId)}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {mode === 'grammar' && (
              <div className="row-wrap">
                <label htmlFor="gh-grammar-select" style={{ fontWeight: 600 }}>特訓する文法:</label>
                <select
                  id="gh-grammar-select"
                  className="select"
                  style={{ maxWidth: 360 }}
                  value={selectedGrammar}
                  onChange={(e) => setSelectedGrammar(e.target.value)}
                >
                  {grammarPoints.filter((g) => !g.isSupplementary).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.lessonId}: {g.title}
                    </option>
                  ))}
                </select>
                <span className="badge">該当 {totalPoolForMode} 問</span>
              </div>
            )}

            {(mode === 'grammar' || mode === 'weak') && (
              <div>
                <button type="button" className="btn btn-primary" onClick={() => startStage()}>
                  <Play size={16} /> このモードで出撃する
                </button>
              </div>
            )}
          </div>

          <div className="grid-3">
            {grammarStages.map((st) => {
              const rec = gState.grammarGame.stageRecords[st.id];
              const qCount = grammarCorrectionQuestions.filter((q) => q.stageId === st.id).length;
              return (
                <div
                  key={st.id}
                  className="card stack-sm"
                  style={{ borderTop: st.isBoss ? '4px solid #dc2626' : '4px solid #059669' }}
                >
                  <div className="row-between">
                    <span className={`badge ${st.isBoss ? 'badge-danger' : 'badge-accent'}`}>
                      {st.isBoss ? 'BOSS STAGE' : `STAGE ${st.number}`}
                    </span>
                    {rec && <span className="badge badge-success">{'★'.repeat(rec.stars)} {rec.bestScore}点</span>}
                  </div>
                  <strong>{st.title}</strong>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>{st.subtitle}</p>
                  <div className="row-between" style={{ marginTop: 'auto' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{qCount}問収録</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      data-testid={`grammar-start-${st.id}`}
                      onClick={() => startStage(st.id)}
                    >
                      挑戦する
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PLAY SCREEN */}
      {screen === 'play' && currentQ && (
        <div className="card stack-md" data-testid="grammar-game-play">
          <div className="row-between">
            <div className="row-wrap">
              <span className="badge badge-accent">{typeLabel(currentQ.type)}</span>
              <span className="badge">{currentQ.lessonId}</span>
              <span className="badge">第 {idx + 1} / {questions.length} 問</span>
            </div>
            <div className="row-wrap">
              {mode === 'challenge' && (
                <span className="badge badge-danger">
                  <Heart size={13} /> ライフ {life}
                </span>
              )}
              {mode === 'time-attack' && (
                <span className="badge badge-warning">
                  <Clock size={13} /> 残り {timeLeft}秒
                </span>
              )}
              <span className="badge badge-success">スコア {score} (コンボ {combo})</span>
            </div>
          </div>

          <div className="card-subtle stack-sm">
            <div style={{ fontWeight: 700 }}>{currentQ.promptJa}</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              {currentQ.type === 'spot' && '誤っている箇所の語句をクリックして選択してください。'}
              {currentQ.type === 'delete' && '不要な語句をクリックして削除対象に指定してください。'}
              {currentQ.type === 'replace' && '誤っている語句をクリックし、下の正しい置換候補を選んでください。'}
              {currentQ.type === 'insert' && '語句を補う位置 [＋] をクリックし、追加する語句を選んでください。'}
              {currentQ.type === 'reorder' && '語句の左右ボタン [←][→] で正しい中国語の語順に並べ替えてください。'}
              {currentQ.type === 'judge' && 'この中国語の文が文法的に正しいか誤っているかを判定してください。'}
              {(currentQ.type === 'rewrite' || currentQ.type === 'multi-error') &&
                '誤りをすべて修正した正しい中国語の文全体を入力してください。'}
            </div>
          </div>

          {/* Interactive sentence workspace */}
          {(currentQ.type === 'spot' || currentQ.type === 'delete' || currentQ.type === 'replace') && (
            <div className="row-wrap" style={{ padding: '12px 0' }}>
              {currentQ.tokens.map((tok, i) => {
                const active = selectedIndices.includes(i);
                const isAnswerSpot = feedback && currentQ.errorIndices?.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={Boolean(feedback)}
                    className={`hunter-token ${active ? 'flagged' : ''} ${isAnswerSpot ? 'correct-spot' : ''}`}
                    onClick={() =>
                      setSelectedIndices((prev) =>
                        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                      )
                    }
                  >
                    {tok}
                  </button>
                );
              })}
            </div>
          )}

          {currentQ.type === 'insert' && (
            <div className="row-wrap" style={{ padding: '12px 0', alignItems: 'center' }}>
              {Array.from({ length: currentQ.tokens.length + 1 }).map((_, pos) => (
                <React.Fragment key={pos}>
                  <button
                    type="button"
                    disabled={Boolean(feedback)}
                    className={`btn btn-sm ${insertPos === pos ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => setInsertPos(pos)}
                  >
                    {insertPos === pos && selectedChoice ? `+ ${selectedChoice}` : '[＋]'}
                  </button>
                  {pos < currentQ.tokens.length && (
                    <span className="zh-lg" lang="zh-Hans">{currentQ.tokens[pos]}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {(currentQ.type === 'replace' || currentQ.type === 'insert') && currentQ.choices && (
            <div className="row-wrap">
              <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>候補:</span>
              {currentQ.choices.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  disabled={Boolean(feedback)}
                  className={`btn ${selectedChoice === ch ? 'btn-primary' : ''}`}
                  onClick={() => setSelectedChoice(ch)}
                >
                  <span lang="zh-Hans">{ch}</span>
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'reorder' && (
            <div className="row-wrap" style={{ padding: '10px 0' }}>
              {orderedTokens.map((tok, i) => (
                <div key={`${i}-${tok}`} className="card-subtle row-wrap" style={{ padding: '6px 10px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={i === 0 || Boolean(feedback)}
                    onClick={() => moveReorderToken(i, -1)}
                  >
                    ←
                  </button>
                  <span className="zh-lg" lang="zh-Hans">{tok}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={i === orderedTokens.length - 1 || Boolean(feedback)}
                    onClick={() => moveReorderToken(i, 1)}
                  >
                    →
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentQ.type === 'judge' && (
            <div className="stack-md">
              <div className="zh-xl" lang="zh-Hans" style={{ padding: '10px 0' }}>
                {currentQ.sentenceZh}
              </div>
              <div className="row-wrap">
                <button
                  type="button"
                  disabled={Boolean(feedback)}
                  className={`btn ${judgeChoice === 'correct' ? 'btn-primary' : ''}`}
                  onClick={() => setJudgeChoice('correct')}
                >
                  ○ 正しい中国語である
                </button>
                <button
                  type="button"
                  disabled={Boolean(feedback)}
                  className={`btn ${judgeChoice === 'wrong' ? 'btn-primary' : ''}`}
                  onClick={() => setJudgeChoice('wrong')}
                >
                  × 文法的な誤りがある
                </button>
              </div>
            </div>
          )}

          {(currentQ.type === 'rewrite' || currentQ.type === 'multi-error') && (
            <div className="stack-sm">
              <div className="zh-lg" lang="zh-Hans" style={{ color: 'var(--danger)' }}>
                誤文: {currentQ.sentenceZh}
              </div>
              <input
                type="text"
                className="input zh-lg"
                lang="zh-Hans"
                placeholder="訂正後の正しい文を入力してください..."
                value={rewriteText}
                disabled={Boolean(feedback)}
                onChange={(e) => setRewriteText(e.target.value)}
              />
            </div>
          )}

          <div className="row-between">
            {!feedback ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitAnswer}
                data-testid="grammar-game-submit"
              >
                <ShieldAlert size={15} /> 訂正を実行する
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={nextQuestion}
                data-testid="grammar-game-next"
              >
                次の問題へ →
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setScreen('title')}>
              ステージ選択に戻る
            </button>
          </div>

          {feedback && (
            <div className={`banner ${feedback.ok ? 'banner-success' : feedback.unverifiedFree ? 'banner-warning' : 'banner-danger'} stack-sm`}>
              <div className="row-between">
                <strong>{feedback.msg}</strong>
                {feedback.unverifiedFree && (
                  <button
                    type="button"
                    className="btn btn-sm btn-soft"
                    onClick={() => {
                      setCorrectCount((c) => c + 1);
                      setScore((s) => s + 150);
                      setFeedback({ ok: true, msg: '自己確認により正解として記録しました。' });
                    }}
                  >
                    <CheckCircle2 size={14} /> 自然な別解として正解にする
                  </button>
                )}
              </div>
              <div className="row-between">
                <div>
                  正しい文: <strong className="zh-lg" lang="zh-Hans">{currentQ.correctedSentence}</strong>{' '}
                  <span className="pinyin-text">({currentQ.pinyin})</span>
                </div>
                <SpeakButton text={currentQ.correctedSentence} />
              </div>
              <p style={{ margin: 0 }}>{currentQ.explanation}</p>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                <strong>誤りやすい点:</strong> {currentQ.pitfallNote}
              </div>
              <div className="row-wrap">
                {currentQ.grammarIds.map((gid) => (
                  <Link key={gid} to={`/grammar/${gid}`} className="badge badge-accent">
                    関連文法: {grammarMap.get(gid)?.title ?? gid}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULT SCREEN */}
      {screen === 'result' && (
        <div className="card stack-md" data-testid="grammar-game-result">
          <span className="badge badge-accent">ステージ結果</span>
          <h2 style={{ margin: 0 }}>スコア: {score} 点</h2>
          <p style={{ margin: 0 }}>
            正答数: {correctCount} / {questions.length} 問（正答率{' '}
            {questions.length ? Math.round((correctCount / questions.length) * 100) : 0}%）
          </p>
          <div className="row-wrap">
            <button type="button" className="btn btn-primary" onClick={() => startStage()}>
              <RotateCcw size={15} /> もう一度挑戦
            </button>
            <button type="button" className="btn" onClick={() => setScreen('title')}>
              ステージ選択へ戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
