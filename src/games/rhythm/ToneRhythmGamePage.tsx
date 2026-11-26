import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Settings, Volume2 } from 'lucide-react';
import { vocabulary } from '../../data';
import { useApp } from '../../context/AppContext';
import { filterByScope } from '../../utils/scope';
import { describeToneSandhi, splitPinyinSyllables } from '../../utils/pinyin';
import { speakChinese } from '../../utils/speech';
import { RHYTHM_SONGS } from '../data/rhythm/songs';
import type { RhythmDifficulty, RhythmJudgment, RhythmLearnMode, RhythmNote, RhythmSong } from '../types/rhythm';
import { gameAudio } from '../core/audioEngine';
import { loadGamesState, saveGamesState } from '../core/gameStorage';

interface NoteResult {
  note: RhythmNote;
  judgment: RhythmJudgment;
  pressedTone: number | null;
  deltaMs: number;
}

const TONE_LABELS = ['第1声 (ˉ)', '第2声 (ˊ)', '第3声 (ˇ)', '第4声 (ˋ)', '軽声 (・)'];

export function stripToneMarks(pinyin: string): string {
  return pinyin
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

export function buildRhythmChart(
  song: RhythmSong,
  difficulty: RhythmDifficulty,
  learnMode: RhythmLearnMode,
  vocabPool: typeof vocabulary,
  weakIds: Set<string>
): RhythmNote[] {
  let pool = vocabPool;
  if (learnMode === 'multi-syllable') {
    const multi = vocabPool.filter((v) => v.tones.length >= 2);
    if (multi.length > 0) pool = multi;
  } else if (learnMode === 'weak-vocab') {
    const weak = vocabPool.filter((v) => weakIds.has(v.id));
    if (weak.length > 0) pool = weak;
  }
  if (pool.length === 0) pool = vocabulary;

  const beatSec = 60 / song.bpm;
  const stepBeats = song.density[difficulty];
  const notes: RhythmNote[] = [];

  let t = 2.4; // lead-in seconds
  let idx = 0;
  while (t < song.durationSec - 1.5) {
    const v = pool[(idx * 7 + song.bpm) % pool.length];
    const syls = splitPinyinSyllables(v.pinyin);
    notes.push({
      id: `RN-${idx}-${v.id}`,
      vocabId: v.id,
      hanzi: v.hanzi,
      pinyinDisplay: v.pinyin,
      pinyinNoTone: stripToneMarks(v.pinyin),
      meaningJa: v.meaningJa,
      tones: v.tones as (1 | 2 | 3 | 4 | 5)[],
      syllables: syls.length === v.tones.length ? syls : [v.pinyin],
      targetTimeSec: Number(t.toFixed(3)),
      sandhiNote: describeToneSandhi(v.hanzi, v.pinyin),
    });
    t += stepBeats * beatSec;
    idx++;
  }
  return notes;
}

export function evaluateRhythmHit(
  deltaMs: number,
  expectedTone: number,
  pressedTone: number
): RhythmJudgment {
  if (pressedTone !== expectedTone) return 'tone-miss';
  const abs = Math.abs(deltaMs);
  if (abs <= 75) return 'perfect';
  if (abs <= 145) return 'great';
  if (abs <= 230) return 'good';
  return 'miss';
}

export const ToneRhythmGamePage: React.FC = () => {
  const { userState, recordAnswer, speechSupport } = useApp();
  const [gState, setGState] = useState(() => loadGamesState());

  const [screen, setScreen] = useState<'title' | 'play' | 'result'>('title');
  const [songId, setSongId] = useState(RHYTHM_SONGS[0].id);
  const [difficulty, setDifficulty] = useState<RhythmDifficulty>('normal');
  const [learnMode, setLearnMode] = useState<RhythmLearnMode>('hanzi');
  const [showSettings, setShowSettings] = useState(false);

  // Active play state
  const [chart, setChart] = useState<RhythmNote[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [syllableCursor, setSyllableCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [results, setResults] = useState<NoteResult[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{ label: string; color: string; sub?: string } | null>(null);
  const [pressedPad, setPressedPad] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioStartSecRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const selectedSong = useMemo(
    () => RHYTHM_SONGS.find((s) => s.id === songId) ?? RHYTHM_SONGS[0],
    [songId]
  );

  const weakIds = useMemo(() => {
    const s = new Set<string>();
    for (const h of userState.answerHistory) {
      if (!h.correct) s.add(h.itemId);
    }
    for (const [id, rec] of Object.entries(userState.srs)) {
      if (rec.wrongCount > 0 || rec.mastery < 50) s.add(id);
    }
    return s;
  }, [userState.answerHistory, userState.srs]);

  useEffect(() => {
    gameAudio.setVolumes(
      gState.globalSettings.bgmVolume,
      gState.globalSettings.sfxVolume,
      gState.globalSettings.muted
    );
    saveGamesState(gState);
  }, [gState]);

  useEffect(() => {
    return () => gameAudio.stopAll();
  }, []);

  const isUntimedMode = learnMode === 'practice' || learnMode === 'audio';

  const finishGame = useCallback(
    (finalResults: NoteResult[], finalScore: number, finalMaxCombo: number, usedChart: RhythmNote[]) => {
      gameAudio.stopAll();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      gameAudio.playSfx('clear');

      const total = Math.max(1, usedChart.length);
      const okCount = finalResults.filter((r) => ['perfect', 'great', 'good'].includes(r.judgment)).length;
      const accuracy = Math.round((okCount / total) * 100);
      const rank: 'S' | 'A' | 'B' | 'C' =
        accuracy >= 92 ? 'S' : accuracy >= 78 ? 'A' : accuracy >= 60 ? 'B' : 'C';

      const key = `${songId}:${difficulty}:${learnMode}`;
      setGState((prev) => {
        const old = prev.rhythm.highScores[key];
        if (!old || finalScore > old.score) {
          return {
            ...prev,
            rhythm: {
              ...prev.rhythm,
              highScores: {
                ...prev.rhythm.highScores,
                [key]: {
                  songId,
                  difficulty,
                  mode: learnMode,
                  score: finalScore,
                  accuracy,
                  maxCombo: finalMaxCombo,
                  rank,
                  updatedAt: new Date().toISOString(),
                },
              },
            },
          };
        }
        return prev;
      });
      setScreen('result');
    },
    [songId, difficulty, learnMode]
  );

  const startGame = () => {
    const scopedVocab = filterByScope(vocabulary, userState.scope);
    const notes = buildRhythmChart(
      selectedSong,
      difficulty,
      learnMode,
      scopedVocab.length > 0 ? scopedVocab : vocabulary,
      weakIds
    );
    const limited = isUntimedMode ? notes.slice(0, 12) : notes;

    setChart(limited);
    setCurrentIdx(0);
    setSyllableCursor(0);
    setPaused(false);
    pausedRef.current = false;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setResults([]);
    setLastFeedback(null);

    if (!isUntimedMode) {
      audioStartSecRef.current = gameAudio.startRhythmSong(selectedSong);
    } else {
      gameAudio.stopAll();
      gameAudio.ensureContext();
      if (learnMode === 'audio' && limited[0] && speechSupport.supported) {
        speakChinese(limited[0].hanzi, userState.settings.speechRate);
      }
    }
    setScreen('play');
  };

  // Refs for fresh state inside animation loop & input handler
  const stateRef = useRef({ currentIdx, syllableCursor, score, combo, maxCombo, results, chart });
  stateRef.current = { currentIdx, syllableCursor, score, combo, maxCombo, results, chart };

  // Canvas render loop (neutral central track — NO color/lane spoilers!)
  useEffect(() => {
    if (screen !== 'play' || isUntimedMode) return;

    const render = () => {
      const canvas = canvasRef.current;
      const st = stateRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const elapsed = gameAudio.getCurrentTime() - audioStartSecRef.current - gState.rhythm.settings.offsetMs / 1000;

      // Auto-miss notes that passed > 260ms
      if (!pausedRef.current && st.currentIdx < st.chart.length) {
        const curNote = st.chart[st.currentIdx];
        if (elapsed - curNote.targetTimeSec > 0.28) {
          gameAudio.playSfx('miss');
          const nextRes: NoteResult = {
            note: curNote,
            judgment: 'miss',
            pressedTone: null,
            deltaMs: Math.round((elapsed - curNote.targetTimeSec) * 1000),
          };
          const updatedResults = [...st.results, nextRes];
          setResults(updatedResults);
          setCombo(0);
          setSyllableCursor(0);
          setLastFeedback({ label: 'MISS (時間切れ)', color: '#f87171', sub: `${curNote.hanzi} (${curNote.pinyinDisplay})` });
          recordAnswer({
            itemId: curNote.vocabId,
            itemKind: 'rhythm',
            lessonId: 'L01',
            grammarIds: ['GP-01'],
            correct: false,
            userAnswer: 'miss',
          });

          const nextI = st.currentIdx + 1;
          setCurrentIdx(nextI);
          if (nextI >= st.chart.length) {
            finishGame(updatedResults, st.score, st.maxCombo, st.chart);
            return;
          }
        }
      }

      // Draw Canvas
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, w, h);

      // Subtle central track guide
      const cx = w / 2;
      const judgeY = h - 68;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 120, 0);
      ctx.lineTo(cx - 120, h);
      ctx.moveTo(cx + 120, 0);
      ctx.lineTo(cx + 120, h);
      ctx.stroke();

      // Judgment line
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 160, judgeY);
      ctx.lineTo(cx + 160, judgeY);
      ctx.stroke();

      const pixelsPerSec = 175 * gState.rhythm.settings.noteSpeed;

      // Draw upcoming neutral notes along central line
      for (let i = st.currentIdx; i < Math.min(st.chart.length, st.currentIdx + 7); i++) {
        const note = st.chart[i];
        const dt = note.targetTimeSec - elapsed;
        const y = judgeY - dt * pixelsPerSec;
        if (y < -40 || y > h + 40) continue;

        const isCurrent = i === st.currentIdx;
        ctx.fillStyle = isCurrent ? '#1e3a8a' : '#1e293b';
        ctx.strokeStyle = isCurrent ? '#93c5fd' : '#64748b';
        ctx.lineWidth = isCurrent ? 3 : 1.5;

        const boxW = 210;
        const boxH = 54;
        ctx.beginPath();
        ctx.roundRect(cx - boxW / 2, y - boxH / 2, boxW, boxH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
        const label =
          learnMode === 'pinyin-hint' ? note.pinyinNoTone : note.hanzi;
        ctx.fillText(label, cx, y + 2);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px sans-serif';
        const sub =
          learnMode === 'pinyin-hint'
            ? `${note.hanzi} — ${note.meaningJa}`
            : note.meaningJa;
        ctx.fillText(sub.slice(0, 18), cx, y + 20);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [screen, isUntimedMode, gState.rhythm.settings.noteSpeed, gState.rhythm.settings.offsetMs, learnMode, finishGame, recordAnswer]);

  const handleToneInput = useCallback(
    (tone: number) => {
      if (screen !== 'play' || pausedRef.current) return;
      const st = stateRef.current;
      const curNote = st.chart[st.currentIdx];
      if (!curNote) return;

      setPressedPad(tone);
      window.setTimeout(() => setPressedPad(null), 110);

      const expectedTone = curNote.tones[st.syllableCursor] ?? curNote.tones[0];
      const deltaMs = isUntimedMode
        ? 0
        : Math.round(
            (gameAudio.getCurrentTime() -
              audioStartSecRef.current -
              gState.rhythm.settings.offsetMs / 1000 -
              curNote.targetTimeSec) *
              1000
          );

      // Multi-syllable handling in untimed or timed modes:
      // If word has >1 syllable and user presses current syllable correctly before advancing note
      if (curNote.tones.length > 1 && st.syllableCursor + 1 < curNote.tones.length && tone === expectedTone) {
        gameAudio.playSfx('snap');
        setSyllableCursor((c) => c + 1);
        setLastFeedback({
          label: `${st.syllableCursor + 1}音節目 OK (${curNote.syllables[st.syllableCursor]})`,
          color: '#60a5fa',
        });
        return;
      }

      const judgment: RhythmJudgment = isUntimedMode
        ? tone === expectedTone
          ? 'perfect'
          : 'tone-miss'
        : evaluateRhythmHit(deltaMs, expectedTone, tone);

      const isOk = judgment === 'perfect' || judgment === 'great' || judgment === 'good';
      if (judgment === 'perfect') gameAudio.playSfx('perfect');
      else if (judgment === 'great') gameAudio.playSfx('great');
      else if (judgment === 'good') gameAudio.playSfx('good');
      else gameAudio.playSfx('miss');

      const pts = judgment === 'perfect' ? 300 : judgment === 'great' ? 200 : judgment === 'good' ? 100 : 0;
      const nextCombo = isOk ? st.combo + 1 : 0;
      const nextMax = Math.max(st.maxCombo, nextCombo);
      const nextScore = st.score + pts + (isOk ? nextCombo * 15 : 0);

      setScore(nextScore);
      setCombo(nextCombo);
      setMaxCombo(nextMax);
      setSyllableCursor(0);

      const colorMap: Record<RhythmJudgment, string> = {
        perfect: '#34d399',
        great: '#60a5fa',
        good: '#fbbf24',
        'tone-miss': '#f87171',
        miss: '#f87171',
      };

      setLastFeedback({
        label: judgment === 'tone-miss' ? `声調ミス (正解: 第${expectedTone}声)` : judgment.toUpperCase(),
        color: colorMap[judgment],
        sub: `${curNote.hanzi} [${curNote.pinyinDisplay}]${curNote.sandhiNote ? ' ※変調あり' : ''}`,
      });

      recordAnswer({
        itemId: curNote.vocabId,
        itemKind: 'rhythm',
        lessonId: 'L01',
        grammarIds: ['GP-01'],
        correct: isOk,
        userAnswer: String(tone),
      });

      const nextResults = [...st.results, { note: curNote, judgment, pressedTone: tone, deltaMs }];
      setResults(nextResults);

      const nextI = st.currentIdx + 1;
      setCurrentIdx(nextI);

      if (nextI >= st.chart.length) {
        finishGame(nextResults, nextScore, nextMax, st.chart);
      } else if (learnMode === 'audio' && speechSupport.supported) {
        speakChinese(st.chart[nextI].hanzi, userState.settings.speechRate);
      }
    },
    [screen, isUntimedMode, gState.rhythm.settings.offsetMs, recordAnswer, finishGame, learnMode, speechSupport.supported, userState.settings.speechRate]
  );

  // Keyboard listener
  useEffect(() => {
    if (screen !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPaused((p) => {
          pausedRef.current = !p;
          return !p;
        });
        return;
      }
      const bindings = gState.rhythm.settings.keyBindings;
      const idx = bindings.findIndex((k) => k.toLowerCase() === e.key.toLowerCase());
      if (idx >= 0) {
        e.preventDefault();
        handleToneInput(idx + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, gState.rhythm.settings.keyBindings, handleToneInput]);

  const currentUntimedNote = chart[currentIdx];

  return (
    <div className={`stack-lg ${gState.globalSettings.reducedMotion ? 'reduced-motion' : ''}`}>
      <div className="row-between">
        <Link to="/games" className="btn btn-sm">
          <ArrowLeft size={14} /> ゲームセンターへ戻る
        </Link>
        <button type="button" className="btn btn-sm" onClick={() => setShowSettings((s) => !s)}>
          <Settings size={14} /> リズム設定
        </button>
      </div>

      {showSettings && (
        <div className="card stack-md">
          <h3 style={{ margin: 0 }}>リズムゲーム設定</h3>
          <div className="grid-3">
            <label className="stack-sm">
              <span>ノーツ速度 ({gState.rhythm.settings.noteSpeed.toFixed(1)}x)</span>
              <input
                type="range"
                min={0.8}
                max={2.4}
                step={0.1}
                value={gState.rhythm.settings.noteSpeed}
                onChange={(e) =>
                  setGState((p) => ({
                    ...p,
                    rhythm: { ...p.rhythm, settings: { ...p.rhythm.settings, noteSpeed: Number(e.target.value) } },
                  }))
                }
              />
            </label>
            <label className="stack-sm">
              <span>判定タイミング調整 ({gState.rhythm.settings.offsetMs} ms)</span>
              <input
                type="range"
                min={-150}
                max={150}
                step={10}
                value={gState.rhythm.settings.offsetMs}
                onChange={(e) =>
                  setGState((p) => ({
                    ...p,
                    rhythm: { ...p.rhythm, settings: { ...p.rhythm.settings, offsetMs: Number(e.target.value) } },
                  }))
                }
              />
            </label>
            <div className="stack-sm">
              <span>キー割り当て (1〜4声・軽声)</span>
              <div className="row-wrap">
                {gState.rhythm.settings.keyBindings.map((k, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    className="input"
                    style={{ width: 42, textAlign: 'center', padding: 4 }}
                    value={k}
                    onChange={(e) => {
                      const val = e.target.value || String(idx + 1);
                      setGState((p) => {
                        const next = [...p.rhythm.settings.keyBindings] as [string, string, string, string, string];
                        next[idx] = val;
                        return { ...p, rhythm: { ...p.rhythm, settings: { ...p.rhythm.settings, keyBindings: next } } };
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TITLE & SONG SELECT */}
      {screen === 'title' && (
        <div className="card stack-lg" data-testid="rhythm-title-screen">
          <div>
            <span className="badge badge-accent">声調リズムアクション</span>
            <h2 style={{ margin: '6px 0 4px' }}>
              <span lang="zh-Hans">声律星轨</span> — Tone Beat Orbit
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              中央軌道に流れる単語の本来の声調を判断し、5つの声調キー（{gState.rhythm.settings.keyBindings.join(' / ')}）またはタップで入力します。
              ※ノーツの位置や色で正解が分からない真剣勝負仕様です。
            </p>
          </div>

          <div className="grid-2">
            {RHYTHM_SONGS.map((s) => {
              const hs = gState.rhythm.highScores[`${s.id}:${difficulty}:${learnMode}`];
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`card-subtle stack-sm`}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: songId === s.id ? `2px solid ${s.themeColor}` : undefined,
                  }}
                  onClick={() => setSongId(s.id)}
                >
                  <div className="row-between">
                    <strong lang="zh-Hans" style={{ fontSize: '1.1rem' }}>{s.titleZh} — {s.title}</strong>
                    <span className="badge">{s.bpm} BPM</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>{s.description}</p>
                  {hs && (
                    <span className="badge badge-success">
                      BEST: {hs.score}点 ({hs.rank} / {hs.accuracy}%)
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid-2">
            <div className="stack-sm">
              <strong>難易度</strong>
              <div className="row-wrap">
                {(['easy', 'normal', 'hard'] as RhythmDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`btn btn-sm ${difficulty === d ? 'btn-primary' : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="stack-sm">
              <strong>学習モード</strong>
              <div className="row-wrap">
                {(
                  [
                    ['hanzi', '漢字判別'],
                    ['pinyin-hint', '無標ピンイン(意味付)'],
                    ['multi-syllable', '複数音節集中'],
                    ['weak-vocab', '苦手単語集中'],
                    ['audio', '音声ターン制'],
                    ['practice', '無制限練習'],
                  ] as [RhythmLearnMode, string][]
                ).map(([mId, label]) => (
                  <button
                    key={mId}
                    type="button"
                    className={`btn btn-sm ${learnMode === mId ? 'btn-primary' : ''}`}
                    disabled={mId === 'audio' && !speechSupport.supported}
                    onClick={() => setLearnMode(mId)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button type="button" className="btn btn-primary" onClick={startGame} data-testid="rhythm-start-btn">
              <Play size={16} /> 演奏スタート
            </button>
          </div>
        </div>
      )}

      {/* PLAY SCREEN */}
      {screen === 'play' && (
        <div className="card stack-md" data-testid="rhythm-play-screen">
          <div className="row-between">
            <div className="row-wrap">
              <span className="badge badge-accent">{selectedSong.titleZh} ({difficulty})</span>
              <span className="badge">スコア: {score}</span>
              <span className="badge badge-success">コンボ: {combo}</span>
              <span className="badge">進捗: {currentIdx}/{chart.length}</span>
            </div>
            <div className="row-wrap">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setPaused((p) => {
                    pausedRef.current = !p;
                    return !p;
                  });
                }}
              >
                <Pause size={14} /> {paused ? '再開' : 'ポーズ'}
              </button>
              <button type="button" className="btn btn-sm" onClick={startGame}>
                <RotateCcw size={14} /> リトライ
              </button>
              <button
                type="button"
                className="btn btn-sm btn-soft"
                onClick={() => finishGame(results, score, maxCombo, chart)}
              >
                終了して結果へ
              </button>
            </div>
          </div>

          {!isUntimedMode ? (
            <div className="rhythm-canvas-wrap">
              <canvas ref={canvasRef} width={720} height={340} style={{ width: '100%', display: 'block' }} />
            </div>
          ) : (
            currentUntimedNote && (
              <div className="card-subtle stack-md" style={{ textAlign: 'center', padding: 28 }}>
                <div className="badge">
                  {learnMode === 'audio' ? '音声ターン制モード（タイミング制限なし）' : '練習モード（タイミング制限なし）'}
                </div>
                {learnMode === 'audio' ? (
                  <div className="row-wrap" style={{ justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => speakChinese(currentUntimedNote.hanzi, userState.settings.speechRate)}
                    >
                      <Volume2 size={18} /> もう一度聞く
                    </button>
                    <span>ヒント: {currentUntimedNote.meaningJa}</span>
                  </div>
                ) : (
                  <>
                    <div className="zh-xl" lang="zh-Hans" style={{ fontSize: '2.4rem' }}>
                      {currentUntimedNote.hanzi}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {currentUntimedNote.pinyinNoTone} — {currentUntimedNote.meaningJa}
                    </div>
                  </>
                )}
                {currentUntimedNote.tones.length > 1 && (
                  <div style={{ fontSize: '0.88rem', color: 'var(--accent)' }}>
                    {syllableCursor + 1}音節目 / 全{currentUntimedNote.tones.length}音節 の本来の声調を入力してください
                  </div>
                )}
              </div>
            )
          )}

          {lastFeedback && (
            <div className="banner row-between" style={{ borderColor: lastFeedback.color }}>
              <strong style={{ color: lastFeedback.color }}>{lastFeedback.label}</strong>
              {lastFeedback.sub && <span lang="zh-Hans">{lastFeedback.sub}</span>}
            </div>
          )}

          <div className="rhythm-pad-grid">
            {TONE_LABELS.map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                className={`rhythm-pad ${pressedPad === idx + 1 ? 'pressed' : ''}`}
                onClick={() => handleToneInput(idx + 1)}
                data-testid={`tone-pad-${idx + 1}`}
              >
                <span className="badge">{gState.rhythm.settings.keyBindings[idx]}</span>
                <span>{lbl}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESULT SCREEN */}
      {screen === 'result' && (
        <div className="card stack-lg" data-testid="rhythm-result-screen">
          <div className="row-between">
            <div>
              <span className="badge badge-accent">リザルト</span>
              <h2 style={{ margin: '6px 0' }}>{selectedSong.titleZh} ({difficulty})</h2>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)' }}>
                スコア {score} 点 / 最大コンボ {maxCombo}
              </div>
            </div>
            <div className="row-wrap">
              <button type="button" className="btn btn-primary" onClick={startGame}>
                <RotateCcw size={15} /> もう一度プレイ
              </button>
              <button type="button" className="btn" onClick={() => setScreen('title')}>
                選曲画面へ
              </button>
            </div>
          </div>

          <div className="grid-3">
            {(['perfect', 'great', 'good', 'tone-miss', 'miss'] as RhythmJudgment[]).map((j) => (
              <div key={j} className="card-subtle row-between">
                <span>{j.toUpperCase()}</span>
                <strong>{results.filter((r) => r.judgment === j).length}</strong>
              </div>
            ))}
          </div>

          <div className="stack-sm">
            <strong>ミスした単語・変調解説（復習リストにも記録されました）</strong>
            {results.filter((r) => r.judgment === 'tone-miss' || r.judgment === 'miss').length === 0 ? (
              <p style={{ margin: 0, color: 'var(--success)' }}>ノーミス！完璧な声調判定でした。</p>
            ) : (
              results
                .filter((r) => r.judgment === 'tone-miss' || r.judgment === 'miss')
                .slice(0, 15)
                .map((r, i) => (
                  <div key={i} className="card-subtle row-between">
                    <div>
                      <span className="zh-md" lang="zh-Hans" style={{ marginRight: 10 }}>{r.note.hanzi}</span>
                      <span>{r.note.pinyinDisplay}</span> — <span>{r.note.meaningJa}</span>
                      {r.note.sandhiNote && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{r.note.sandhiNote}</div>
                      )}
                    </div>
                    <span className="badge badge-danger">本調: {r.note.tones.join('-')}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
