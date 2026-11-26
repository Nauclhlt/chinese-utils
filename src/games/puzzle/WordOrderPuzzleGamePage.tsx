import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Eye, EyeOff, HelpCircle, Play, Puzzle, RotateCcw } from 'lucide-react';
import { grammarMap, grammarPoints } from '../../data';
import { wordPuzzleQuestions, wordPuzzleStages } from '../data';
import type { WordPuzzleChunk, WordPuzzleQuestion } from '../types/wordPuzzle';
import { useApp } from '../../context/AppContext';
import { gameAudio } from '../core/audioEngine';
import { loadGamesState, saveGamesState } from '../core/gameStorage';
import { createShuffleSeed, shuffleWithSeed } from '../../utils/shuffle';
import { normalizeChineseAnswer } from '../../utils/diff';
import { StructureDiagram } from '../../components/StructureDiagram';
import { SpeakButton } from '../../components/ChineseText';

type PuzzleMode = 'stage' | 'grammar' | 'time-attack' | 'endless' | 'weak' | 'exam';

interface ExamSubmission {
  question: WordPuzzleQuestion;
  conversionOk: boolean;
  orderOk: boolean;
  assembledZh: string;
}

export function evaluateWordPuzzleAnswer(
  question: WordPuzzleQuestion,
  inputs: Record<string, string>,
  placedIds: string[]
): {
  conversionOk: boolean;
  orderOk: boolean;
  matchedAccepted: boolean;
  assembledZh: string;
  chunkResults: Record<string, boolean>;
} {
  const chunkResults: Record<string, boolean> = {};
  const requiredChunks = question.chunks.filter((c) => !c.isDistractor);
  let allConvOk = true;

  for (const ch of requiredChunks) {
    const val = normalizeChineseAnswer(inputs[ch.id] ?? '');
    const candidates = [ch.hanzi, ...(ch.acceptableHanzi ?? [])].map(normalizeChineseAnswer);
    const ok = candidates.includes(val);
    chunkResults[ch.id] = ok;
    if (!ok) allConvOk = false;
  }

  const assembledZh = placedIds.map((id) => (inputs[id] ?? '').trim()).join('');
  const normAssembled = normalizeChineseAnswer(assembledZh);
  const acceptedNorms = [question.modelAnswer, ...question.acceptableAnswers].map(normalizeChineseAnswer);
  const matchedAccepted = acceptedNorms.includes(normAssembled);

  const exactOrderMatch =
    placedIds.length === question.correctOrderIds.length &&
    placedIds.every((id, idx) => id === question.correctOrderIds[idx]);

  return {
    conversionOk: allConvOk,
    orderOk: exactOrderMatch || matchedAccepted,
    matchedAccepted,
    assembledZh,
    chunkResults,
  };
}

export const WordOrderPuzzleGamePage: React.FC = () => {
  const { userState, recordAnswer } = useApp();
  const [gState, setGState] = useState(() => loadGamesState());

  const [screen, setScreen] = useState<'title' | 'play' | 'result'>('title');
  const [stageId, setStageId] = useState('stage01');
  const [mode, setMode] = useState<PuzzleMode>('stage');
  const [selectedGrammar, setSelectedGrammar] = useState('G01-03');
  const [showJaPrompt, setShowJaPrompt] = useState(true);
  const [showToneMarks, setShowToneMarks] = useState(true);

  const [questions, setQuestions] = useState<WordPuzzleQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [shuffledChunks, setShuffledChunks] = useState<WordPuzzleChunk[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [dragChunkId, setDragChunkId] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);

  const [score, setScore] = useState(0);
  const [convCorrectCount, setConvCorrectCount] = useState(0);
  const [orderCorrectCount, setOrderCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(240);
  const [examSubmissions, setExamSubmissions] = useState<ExamSubmission[]>([]);

  const [evalState, setEvalState] = useState<ReturnType<typeof evaluateWordPuzzleAnswer> | null>(null);

  // Track Chinese IME composition state to prevent Enter key collision
  const isComposingRef = useRef(false);

  useEffect(() => {
    gameAudio.setVolumes(
      gState.globalSettings.bgmVolume,
      gState.globalSettings.sfxVolume,
      gState.globalSettings.muted
    );
    saveGamesState(gState);
  }, [gState]);

  const currentQ = questions[idx];

  const setupQuestion = (q: WordPuzzleQuestion) => {
    setShuffledChunks(shuffleWithSeed(q.chunks, createShuffleSeed()));
    setInputs({});
    setPlacedIds([]);
    setHintLevel(0);
    setEvalState(null);
  };

  useEffect(() => {
    if (screen !== 'play' || mode !== 'time-attack') return;
    const t = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          finishSession(score, convCorrectCount, orderCorrectCount, Math.max(1, idx + 1));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  });

  const finishSession = (finalScore: number, convOk: number, orderOk: number, total: number) => {
    gameAudio.playSfx('clear');
    const acc = Math.round(((convOk + orderOk) / (total * 2)) * 100);
    const stars: 0 | 1 | 2 | 3 = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 50 ? 1 : 0;

    setGState((prev) => {
      const old = prev.wordPuzzle.stageRecords[stageId];
      const nextStageRec =
        mode === 'stage'
          ? {
              ...prev.wordPuzzle.stageRecords,
              [stageId]: {
                stageId,
                bestScore: Math.max(old?.bestScore ?? 0, finalScore),
                bestAccuracy: Math.max(old?.bestAccuracy ?? 0, acc),
                stars: Math.max(old?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
                cleared: (old?.cleared ?? false) || acc >= 50,
                updatedAt: new Date().toISOString(),
              },
            }
          : prev.wordPuzzle.stageRecords;

      return {
        ...prev,
        wordPuzzle: {
          stageRecords: nextStageRec,
          bestEndlessScore:
            mode === 'endless' ? Math.max(prev.wordPuzzle.bestEndlessScore, finalScore) : prev.wordPuzzle.bestEndlessScore,
          totalSolved: prev.wordPuzzle.totalSolved + orderOk,
        },
      };
    });
    setScreen('result');
  };

  const startSession = (overrideStageId?: string) => {
    const targetStageId = overrideStageId ?? stageId;
    if (overrideStageId) setStageId(overrideStageId);
    const stageMeta = wordPuzzleStages.find((s) => s.id === targetStageId);
    if (stageMeta) {
      setShowToneMarks(!stageMeta.hideToneMarksByDefault);
    }

    let pool: WordPuzzleQuestion[] = [];
    if (mode === 'grammar') {
      pool = wordPuzzleQuestions.filter((q) => q.grammarIds.includes(selectedGrammar));
    } else if (mode === 'weak') {
      const weakGids = new Set(
        Object.entries(userState.srs)
          .filter(([, r]) => r.wrongCount > 0 || r.mastery < 60)
          .map(([id]) => id)
      );
      pool = wordPuzzleQuestions.filter((q) => q.grammarIds.some((g) => weakGids.has(g)));
      if (pool.length === 0) pool = wordPuzzleQuestions.filter((q) => q.difficulty >= 2);
    } else if (mode === 'endless' || mode === 'time-attack') {
      pool = [...wordPuzzleQuestions];
    } else {
      pool = wordPuzzleQuestions.filter((q) => q.stageId === targetStageId);
    }

    const limit = mode === 'endless' ? 30 : mode === 'exam' ? 8 : 8;
    const picked = shuffleWithSeed(pool, createShuffleSeed()).slice(0, limit);
    setQuestions(picked);
    setIdx(0);
    setScore(0);
    setConvCorrectCount(0);
    setOrderCorrectCount(0);
    setTimeLeft(240);
    setExamSubmissions([]);
    if (picked[0]) setupQuestion(picked[0]);
    gameAudio.ensureContext();
    gameAudio.playSfx('chime');
    setScreen('play');
  };

  const togglePlaceChunk = (chunkId: string) => {
    if (evalState) return;
    gameAudio.playSfx('snap');
    setPlacedIds((prev) =>
      prev.includes(chunkId) ? prev.filter((id) => id !== chunkId) : [...prev, chunkId]
    );
  };

  const movePlaced = (pos: number, dir: -1 | 1) => {
    if (evalState) return;
    const to = pos + dir;
    if (to < 0 || to >= placedIds.length) return;
    gameAudio.playSfx('snap');
    setPlacedIds((prev) => {
      const next = [...prev];
      [next[pos], next[to]] = [next[to], next[pos]];
      return next;
    });
  };

  const handleDropOnSlot = (targetPos: number) => {
    if (!dragChunkId || evalState) return;
    gameAudio.playSfx('snap');
    setPlacedIds((prev) => {
      const without = prev.filter((id) => id !== dragChunkId);
      without.splice(targetPos, 0, dragChunkId);
      return without;
    });
    setDragChunkId(null);
  };

  const handleSubmit = () => {
    if (!currentQ || placedIds.length === 0) return;
    const res = evaluateWordPuzzleAnswer(currentQ, inputs, placedIds);

    if (mode === 'exam') {
      // Deferred grading in University Exam Simulation mode
      const nextSubs = [
        ...examSubmissions,
        {
          question: currentQ,
          conversionOk: res.conversionOk,
          orderOk: res.orderOk,
          assembledZh: res.assembledZh,
        },
      ];
      setExamSubmissions(nextSubs);
      const cNext = convCorrectCount + (res.conversionOk ? 1 : 0);
      const oNext = orderCorrectCount + (res.orderOk ? 1 : 0);
      setConvCorrectCount(cNext);
      setOrderCorrectCount(oNext);
      const gained = (res.conversionOk ? 100 : 0) + (res.orderOk ? 150 : 0);
      setScore((s) => s + gained);

      recordAnswer({
        itemId: currentQ.id,
        itemKind: 'word-puzzle',
        lessonId: currentQ.lessonId,
        grammarIds: currentQ.grammarIds,
        correct: res.conversionOk && res.orderOk,
        userAnswer: res.assembledZh,
      });

      if (idx + 1 >= questions.length) {
        finishSession(score + gained, cNext, oNext, questions.length);
      } else {
        setIdx(idx + 1);
        setupQuestion(questions[idx + 1]);
      }
      return;
    }

    setEvalState(res);
    const fullOk = res.conversionOk && res.orderOk;
    if (fullOk) gameAudio.playSfx('fix-ok');
    else if (res.orderOk || res.conversionOk) gameAudio.playSfx('good');
    else gameAudio.playSfx('fix-ng');

    const gained = (res.conversionOk ? 100 : 0) + (res.orderOk ? 150 : 0);
    setScore((s) => s + gained);
    if (res.conversionOk) setConvCorrectCount((c) => c + 1);
    if (res.orderOk) setOrderCorrectCount((c) => c + 1);

    recordAnswer({
      itemId: currentQ.id,
      itemKind: 'word-puzzle',
      lessonId: currentQ.lessonId,
      grammarIds: currentQ.grammarIds,
      correct: fullOk,
      userAnswer: res.assembledZh,
    });
  };

  const handleNext = () => {
    if (idx + 1 >= questions.length) {
      finishSession(score, convCorrectCount, orderCorrectCount, questions.length);
      return;
    }
    const nxt = idx + 1;
    setIdx(nxt);
    setupQuestion(questions[nxt]);
  };

  return (
    <div className={`stack-lg ${gState.globalSettings.reducedMotion ? 'reduced-motion' : ''}`}>
      <div className="row-between">
        <Link to="/games" className="btn btn-sm">
          <ArrowLeft size={14} /> ゲームセンターへ戻る
        </Link>
        <span className="badge badge-accent">収録問題総数: {wordPuzzleQuestions.length}問</span>
      </div>

      {/* TITLE */}
      {screen === 'title' && (
        <div className="stack-lg" data-testid="puzzle-game-title">
          <div className="card stack-md">
            <div className="row-between">
              <div>
                <span className="badge badge-accent">ピンイン漢字変換・語順パズル</span>
                <h2 style={{ margin: '6px 0 4px' }}>
                  <span lang="zh-Hans">字序工坊</span> — Pinyin Word Forge
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                  大学試験の定番「ピンイン語句の漢字変換＋語順整序」をパズル化。中国語IME変換確定のEnter干渉を防ぎ、D&D・クリック・キーボードで自在に並べ替えられます。
                </p>
              </div>
              <Puzzle size={34} color="#d97706" />
            </div>

            <div className="row-wrap">
              {(
                [
                  ['stage', 'ステージ攻略'],
                  ['grammar', '文法別ステージ'],
                  ['time-attack', 'タイムアタック'],
                  ['endless', 'エンドレス'],
                  ['weak', '苦手単語・文法復習'],
                  ['exam', '大学試験再現モード(一括採点)'],
                ] as [PuzzleMode, string][]
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

            <div className="row-wrap">
              <button
                type="button"
                className={`btn btn-sm ${showJaPrompt ? 'btn-soft' : ''}`}
                onClick={() => setShowJaPrompt((x) => !x)}
              >
                {showJaPrompt ? <Eye size={14} /> : <EyeOff size={14} />}
                日本語問題文: {showJaPrompt ? '表示' : '非表示 (試験仕様)'}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${showToneMarks ? 'btn-soft' : ''}`}
                onClick={() => setShowToneMarks((x) => !x)}
              >
                声調記号: {showToneMarks ? 'あり' : 'なし (高難度)'}
              </button>
            </div>

            {mode === 'grammar' && (
              <div className="row-wrap">
                <label htmlFor="wp-grammar-sel" style={{ fontWeight: 600 }}>文法事項:</label>
                <select
                  id="wp-grammar-sel"
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
              </div>
            )}

            {mode !== 'stage' && (
              <div>
                <button type="button" className="btn btn-primary" onClick={() => startSession()}>
                  <Play size={16} /> このモードで開始する
                </button>
              </div>
            )}
          </div>

          <div className="grid-3">
            {wordPuzzleStages.map((st) => {
              const rec = gState.wordPuzzle.stageRecords[st.id];
              const qCount = wordPuzzleQuestions.filter((q) => q.stageId === st.id).length;
              return (
                <div
                  key={st.id}
                  className="card stack-sm"
                  style={{ borderTop: st.isBoss ? '4px solid #dc2626' : '4px solid #d97706' }}
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
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{qCount}問</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      data-testid={`puzzle-start-${st.id}`}
                      onClick={() => startSession(st.id)}
                    >
                      プレイ
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
        <div className="card stack-md" data-testid="puzzle-game-play">
          <div className="row-between">
            <div className="row-wrap">
              <span className="badge badge-accent">{currentQ.lessonId}</span>
              <span className="badge">第 {idx + 1} / {questions.length} 問</span>
              {mode === 'exam' && <span className="badge badge-warning">大学試験再現モード</span>}
            </div>
            <div className="row-wrap">
              {mode === 'time-attack' && (
                <span className="badge badge-warning">
                  <Clock size={13} /> 残り {timeLeft}秒
                </span>
              )}
              <span className="badge badge-success">スコア {score}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowJaPrompt((x) => !x)}
              >
                日本語: {showJaPrompt ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowToneMarks((x) => !x)}
              >
                声調: {showToneMarks ? '表示' : '非表示'}
              </button>
            </div>
          </div>

          {showJaPrompt && (
            <div className="card-subtle">
              <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>日本語の意味</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{currentQ.japanesePrompt}</div>
            </div>
          )}

          {/* Step 1: Shuffled Pinyin Chunks with direct Hanzi input */}
          <div className="stack-sm">
            <strong>ステップ1: 各ピンイン語句に簡体字を入力し、「語順枠へ追加」またはドラッグしてください</strong>
            <div className="grid-3">
              {shuffledChunks.map((ch) => {
                const placed = placedIds.includes(ch.id);
                const val = inputs[ch.id] ?? '';
                const convOk = evalState?.chunkResults[ch.id];
                return (
                  <div
                    key={ch.id}
                    draggable={!evalState}
                    onDragStart={() => setDragChunkId(ch.id)}
                    className={`puzzle-card ${convOk ? 'matched' : ''}`}
                    data-testid={`puzzle-chunk-${ch.id}`}
                  >
                    <div className="row-between">
                      <strong style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>
                        {showToneMarks ? ch.pinyinMarked : ch.pinyinPlain}
                      </strong>
                      {ch.meaningHint && (
                        <span className="badge" style={{ fontSize: '0.72rem' }}>
                          {ch.meaningHint}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="input zh-md"
                      lang="zh-Hans"
                      placeholder="簡体字を入力..."
                      value={val}
                      disabled={Boolean(evalState)}
                      data-testid={`puzzle-input-${ch.id}`}
                      onCompositionStart={() => {
                        isComposingRef.current = true;
                      }}
                      onCompositionEnd={() => {
                        isComposingRef.current = false;
                      }}
                      onKeyDown={(e) => {
                        // Do NOT submit puzzle when confirming IME candidate with Enter
                        if (e.key === 'Enter' && (isComposingRef.current || e.nativeEvent.isComposing)) {
                          return;
                        }
                        if (e.key === 'Enter' && val.trim() && !placed) {
                          e.preventDefault();
                          togglePlaceChunk(ch.id);
                        }
                      }}
                      onChange={(e) => setInputs((p) => ({ ...p, [ch.id]: e.target.value }))}
                    />
                    <div className="row-between">
                      <button
                        type="button"
                        className={`btn btn-sm ${placed ? 'btn-soft' : 'btn-primary'}`}
                        disabled={Boolean(evalState)}
                        onClick={() => togglePlaceChunk(ch.id)}
                        data-testid={`puzzle-place-${ch.id}`}
                      >
                        {placed ? '枠から外す' : '語順枠へ追加'}
                      </button>
                      {evalState && (
                        <span style={{ fontSize: '0.78rem', color: ch.isDistractor ? 'var(--text-light)' : convOk ? 'var(--success)' : 'var(--danger)' }}>
                          {ch.isDistractor ? '(ダミー語句)' : `正解: ${ch.hanzi}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Assembly Tray (Reorder via drag & drop / buttons / keyboard) */}
          <div className="stack-sm">
            <strong>ステップ2: 並べ替え・語順組立エリア（← → ボタンやドラッグで並べ替え・文字修正も可能）</strong>
            <div
              className="card-subtle row-wrap"
              style={{ minHeight: 74, alignItems: 'center' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnSlot(placedIds.length)}
              data-testid="puzzle-assembly-tray"
            >
              {placedIds.length === 0 ? (
                <span style={{ color: 'var(--text-light)', fontSize: '0.88rem' }}>
                  上のカードから「語順枠へ追加」またはここへドラッグして文を組み立ててください
                </span>
              ) : (
                placedIds.map((cid, pos) => {
                  const ch = currentQ.chunks.find((x) => x.id === cid);
                  if (!ch) return null;
                  return (
                    <div
                      key={cid}
                      draggable={!evalState}
                      onDragStart={() => setDragChunkId(cid)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        handleDropOnSlot(pos);
                      }}
                      onKeyDown={(e) => {
                        if (e.altKey && e.key === 'ArrowLeft') {
                          e.preventDefault();
                          movePlaced(pos, -1);
                        } else if (e.altKey && e.key === 'ArrowRight') {
                          e.preventDefault();
                          movePlaced(pos, 1);
                        }
                      }}
                      className="card row-wrap"
                      style={{ padding: '6px 10px', gap: 6 }}
                    >
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={pos === 0 || Boolean(evalState)}
                        onClick={() => movePlaced(pos, -1)}
                        aria-label="左へ移動"
                      >
                        ←
                      </button>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                          {showToneMarks ? ch.pinyinMarked : ch.pinyinPlain}
                        </div>
                        <input
                          type="text"
                          className="input zh-md"
                          lang="zh-Hans"
                          style={{ width: 92, padding: '2px 6px', textAlign: 'center' }}
                          value={inputs[cid] ?? ''}
                          disabled={Boolean(evalState)}
                          onCompositionStart={() => { isComposingRef.current = true; }}
                          onCompositionEnd={() => { isComposingRef.current = false; }}
                          onChange={(e) => setInputs((p) => ({ ...p, [cid]: e.target.value }))}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={pos === placedIds.length - 1 || Boolean(evalState)}
                        onClick={() => movePlaced(pos, 1)}
                        aria-label="右へ移動"
                      >
                        →
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Hints & Submit */}
          <div className="row-between">
            <div className="row-wrap">
              <button
                type="button"
                className="btn btn-sm"
                disabled={hintLevel >= 3 || Boolean(evalState)}
                onClick={() => setHintLevel((h) => Math.min(3, h + 1))}
              >
                <HelpCircle size={14} /> 段階ヒント ({hintLevel}/3)
              </button>
              {!evalState ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={placedIds.length === 0}
                  onClick={handleSubmit}
                  data-testid="puzzle-submit-btn"
                >
                  {mode === 'exam' ? '解答を記録して次へ' : '完成した文を判定する'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNext}
                  data-testid="puzzle-next-btn"
                >
                  次のパズルへ →
                </button>
              )}
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setScreen('title')}>
              終了して戻る
            </button>
          </div>

          {hintLevel > 0 && !evalState && (
            <div className="banner banner-info stack-sm">
              {hintLevel >= 1 && <div><strong>ヒント1 (意味):</strong> {currentQ.japanesePrompt}</div>}
              {hintLevel >= 2 && (
                <div>
                  <strong>ヒント2 (先頭語句):</strong>{' '}
                  {currentQ.chunks.find((c) => c.id === currentQ.correctOrderIds[0])?.pinyinMarked}
                </div>
              )}
              {hintLevel >= 3 && (
                <div>
                  <strong>ヒント3 (先頭漢字):</strong>{' '}
                  <span lang="zh-Hans">
                    {currentQ.chunks.find((c) => c.id === currentQ.correctOrderIds[0])?.hanzi}
                  </span>
                </div>
              )}
            </div>
          )}

          {evalState && (
            <div
              className={`banner ${
                evalState.conversionOk && evalState.orderOk ? 'banner-success' : 'banner-warning'
              } stack-md`}
              data-testid="puzzle-feedback"
            >
              <div className="row-between">
                <div className="row-wrap">
                  <span className={`badge ${evalState.conversionOk ? 'badge-success' : 'badge-danger'}`}>
                    漢字変換: {evalState.conversionOk ? '正解' : '要確認'}
                  </span>
                  <span className={`badge ${evalState.orderOk ? 'badge-success' : 'badge-danger'}`}>
                    語順・文法: {evalState.orderOk ? '正解' : '要確認'}
                  </span>
                </div>
                {!(evalState.conversionOk && evalState.orderOk) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-soft"
                    onClick={() => {
                      setEvalState({ ...evalState, conversionOk: true, orderOk: true });
                      setScore((s) => s + 100);
                    }}
                  >
                    <CheckCircle2 size={14} /> 自然な別解として認める
                  </button>
                )}
              </div>

              <div className="row-between">
                <div>
                  <div>
                    <strong>模範解答:</strong>{' '}
                    <span className="zh-lg" lang="zh-Hans">{currentQ.modelAnswer}</span>
                  </div>
                  <div className="pinyin-text">{currentQ.fullPinyin}</div>
                  <div>日本語訳: {currentQ.japanesePrompt}</div>
                </div>
                <SpeakButton text={currentQ.modelAnswer} />
              </div>

              <StructureDiagram slots={currentQ.structureBreakdown} />
              <p style={{ margin: 0 }}>{currentQ.explanation}</p>
              <div className="row-wrap">
                {currentQ.grammarIds.map((gid) => (
                  <Link key={gid} to={`/grammar/${gid}`} className="badge badge-accent">
                    文法辞典: {grammarMap.get(gid)?.title ?? gid}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULT SCREEN */}
      {screen === 'result' && (
        <div className="card stack-lg" data-testid="puzzle-game-result">
          <span className="badge badge-accent">パズル結果</span>
          <h2 style={{ margin: 0 }}>トータルスコア: {score} 点</h2>
          <div className="grid-2">
            <div className="card-subtle">
              <strong>漢字変換 正答:</strong> {convCorrectCount} / {questions.length}
            </div>
            <div className="card-subtle">
              <strong>語順・文法 正答:</strong> {orderCorrectCount} / {questions.length}
            </div>
          </div>

          {examSubmissions.length > 0 && (
            <div className="stack-sm">
              <strong>大学試験再現モード 一括採点・解説</strong>
              {examSubmissions.map((sub, i) => (
                <div key={i} className="card-subtle stack-sm">
                  <div className="row-between">
                    <strong>Q{i + 1}. {sub.question.japanesePrompt}</strong>
                    <span className={`badge ${sub.conversionOk && sub.orderOk ? 'badge-success' : 'badge-danger'}`}>
                      変換:{sub.conversionOk ? '○' : '×'} / 語順:{sub.orderOk ? '○' : '×'}
                    </span>
                  </div>
                  <div>あなたの解答: <span lang="zh-Hans">{sub.assembledZh || '(未入力)'}</span></div>
                  <div>模範解答: <strong lang="zh-Hans">{sub.question.modelAnswer}</strong> ({sub.question.fullPinyin})</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{sub.question.explanation}</div>
                </div>
              ))}
            </div>
          )}

          <div className="row-wrap">
            <button type="button" className="btn btn-primary" onClick={() => startSession()}>
              <RotateCcw size={15} /> もう一度プレイ
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
