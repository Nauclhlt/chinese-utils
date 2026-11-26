import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  EyeOff,
  FastForward,
  History,
  Image as ImageIcon,
  Play,
  PlusCircle,
  Save,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { novelChapters, novelMeta } from '../data';
import type { NovelChapterData, NovelChoice, NovelLine, NovelTokenInfo } from '../types/novel';
import type { NovelSaveSlot } from '../types/common';
import { gameAudio } from '../core/audioEngine';
import { loadGamesState, saveGamesState } from '../core/gameStorage';
import { useApp } from '../../context/AppContext';
import { speakChinese } from '../../utils/speech';

type Screen = 'title' | 'play' | 'chapter-end';

export const NovelGamePage: React.FC = () => {
  const { userState, addNovelVocabToReview, speechSupport } = useApp();
  const [gState, setGState] = useState(() => loadGamesState());

  const [screen, setScreen] = useState<Screen>('title');
  const [chapterId, setChapterId] = useState<string>('ch01');
  const [lineId, setLineId] = useState<string>('');
  const [flags, setFlags] = useState<Record<string, string | number | boolean>>({});
  const [visitedIds, setVisitedIds] = useState<string[]>([]);

  // Typewriter & play controls
  const [displayedChars, setDisplayedChars] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [skipMode, setSkipMode] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [showLineJa, setShowLineJa] = useState(false);
  const [selectedToken, setSelectedToken] = useState<NovelTokenInfo | null>(null);
  const [showGrammarPanel, setShowGrammarPanel] = useState(false);
  const [modal, setModal] = useState<
    null | 'save' | 'load' | 'backlog' | 'chapters' | 'gallery' | 'settings' | 'glossary'
  >(null);
  const [toast, setToast] = useState<string | null>(null);

  // Chapter-end optional quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const chapterMap = useMemo(() => new Map(novelChapters.map((c) => [c.id, c])), []);
  const currentChapter: NovelChapterData | undefined = chapterMap.get(chapterId);
  const currentLine: NovelLine | undefined = useMemo(
    () => currentChapter?.lines.find((l) => l.id === lineId),
    [currentChapter, lineId]
  );

  // Sync audio volumes
  useEffect(() => {
    gameAudio.setVolumes(
      gState.globalSettings.bgmVolume,
      gState.globalSettings.sfxVolume,
      gState.globalSettings.muted
    );
    saveGamesState(gState);
  }, [gState]);

  useEffect(() => {
    return () => {
      gameAudio.stopAll();
    };
  }, []);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // Start BGM / Ambient / SFX when screen or line changes
  useEffect(() => {
    if (screen === 'title') {
      gameAudio.startNovelBgm('title');
      gameAudio.stopAmbient();
      return;
    }
    if (screen === 'play' && currentLine) {
      if (currentLine.bgm) gameAudio.startNovelBgm(currentLine.bgm);
      if (currentLine.ambient) gameAudio.startAmbient(currentLine.ambient);
      if (currentLine.sfx && currentLine.sfx !== 'none') gameAudio.playSfx(currentLine.sfx);
    }
  }, [screen, currentLine]);

  // Mark line read & unlock CG/Ending
  useEffect(() => {
    if (screen !== 'play' || !currentLine) return;
    setShowLineJa(false);
    setSelectedToken(null);
    setDisplayedChars(gState.globalSettings.reducedMotion ? currentLine.textZh.length : 0);

    setVisitedIds((prev) => (prev.includes(currentLine.id) ? prev : [...prev, currentLine.id]));

    setGState((prev) => {
      const readSet = new Set(prev.novel.readLineIds);
      const cgSet = new Set(prev.novel.unlockedCgs);
      const endSet = new Set(prev.novel.unlockedEndings);
      let changed = false;

      if (!readSet.has(currentLine.id)) {
        readSet.add(currentLine.id);
        changed = true;
      }
      if (currentLine.unlockCg && !cgSet.has(currentLine.unlockCg)) {
        cgSet.add(currentLine.unlockCg);
        changed = true;
      }
      if (currentLine.unlockEnding && !endSet.has(currentLine.unlockEnding)) {
        endSet.add(currentLine.unlockEnding);
        changed = true;
      }

      // Auto-save snapshot
      const autoSlot: NovelSaveSlot = {
        slotId: 'auto',
        savedAt: new Date().toISOString(),
        chapterId,
        lineId: currentLine.id,
        speaker: currentLine.speaker || '地の文',
        previewText: currentLine.textZh.slice(0, 32),
        flags,
        visitedLineIds: Array.from(new Set([...visitedIds, currentLine.id])),
        unlockedCgs: Array.from(cgSet),
      };

      return {
        ...prev,
        novel: {
          ...prev.novel,
          readLineIds: changed ? Array.from(readSet) : prev.novel.readLineIds,
          unlockedCgs: Array.from(cgSet),
          unlockedEndings: Array.from(endSet),
          slots: { ...prev.novel.slots, auto: autoSlot },
        },
      };
    });
  }, [screen, currentLine?.id]);

  // Typewriter animation
  const isTyping =
    screen === 'play' &&
    Boolean(currentLine) &&
    displayedChars < (currentLine?.textZh.length ?? 0);

  useEffect(() => {
    if (!isTyping || !currentLine) return;
    const speed = gState.globalSettings.reducedMotion ? 0 : gState.novel.settings.textSpeed;
    if (speed <= 0) {
      setDisplayedChars(currentLine.textZh.length);
      return;
    }
    const t = window.setTimeout(() => {
      setDisplayedChars((c) => Math.min(currentLine.textZh.length, c + 1));
    }, speed);
    return () => window.clearTimeout(t);
  }, [isTyping, displayedChars, currentLine, gState.novel.settings.textSpeed, gState.globalSettings.reducedMotion]);

  const startChapter = (chId: string, startLine?: string, nextFlags?: Record<string, string | number | boolean>) => {
    const ch = chapterMap.get(chId);
    if (!ch) return;
    gameAudio.ensureContext();
    gameAudio.playSfx('chime');
    setChapterId(ch.id);
    setLineId(startLine ?? ch.startLineId);
    if (nextFlags) setFlags(nextFlags);
    setVisitedIds([]);
    setAutoMode(false);
    setSkipMode(false);
    setScreen('play');
    setModal(null);
  };

  const startNewGame = () => {
    startChapter('ch01', undefined, { affection: 0, shared_star_map: false, honest_feeling: false });
  };

  const loadSlot = (slot: NovelSaveSlot) => {
    gameAudio.ensureContext();
    gameAudio.playSfx('page');
    setChapterId(slot.chapterId);
    setLineId(slot.lineId);
    setFlags(slot.flags);
    setVisitedIds(slot.visitedLineIds);
    setScreen('play');
    setModal(null);
    showToastMsg('セーブデータをロードしました');
  };

  const saveToSlot = (slotId: string) => {
    if (!currentLine) return;
    const slot: NovelSaveSlot = {
      slotId,
      savedAt: new Date().toISOString(),
      chapterId,
      lineId: currentLine.id,
      speaker: currentLine.speaker || '地の文',
      previewText: currentLine.textZh.slice(0, 32),
      flags,
      visitedLineIds: visitedIds,
      unlockedCgs: gState.novel.unlockedCgs,
    };
    setGState((prev) => ({
      ...prev,
      novel: { ...prev.novel, slots: { ...prev.novel.slots, [slotId]: slot } },
    }));
    gameAudio.playSfx('click');
    showToastMsg(`${slotId === 'quick' ? 'クイックセーブ' : slotId} に保存しました`);
  };

  const advanceNext = useCallback(() => {
    if (!currentLine || !currentChapter) return;
    if (isTyping) {
      setDisplayedChars(currentLine.textZh.length);
      return;
    }
    if (currentLine.choices && currentLine.choices.length > 0) {
      return; // wait for choice
    }
    gameAudio.playSfx('page');

    if (currentLine.branchCheck) {
      const bc = currentLine.branchCheck;
      const val = flags[bc.flag];
      const cond =
        bc.gte !== undefined
          ? Number(val ?? 0) >= bc.gte
          : val === bc.eq;
      setLineId(cond ? bc.trueNextLineId : bc.falseNextLineId);
      return;
    }

    if (currentLine.nextLineId) {
      setLineId(currentLine.nextLineId);
      return;
    }

    // Chapter finished
    setAutoMode(false);
    setSkipMode(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setScreen('chapter-end');
  }, [currentLine, currentChapter, isTyping, flags]);

  const chooseOption = (ch: NovelChoice) => {
    gameAudio.playSfx('click');
    setFlags((prev) => {
      const next = { ...prev, ...(ch.setFlags ?? {}) };
      if (ch.addNumbers) {
        for (const [k, delta] of Object.entries(ch.addNumbers)) {
          next[k] = Number(next[k] ?? 0) + delta;
        }
      }
      return next;
    });
    setLineId(ch.nextLineId);
  };

  // Auto & Read-skip timers
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (screen !== 'play' || !currentLine || isTyping) return;
    if (currentLine.choices && currentLine.choices.length > 0) return;

    const alreadyRead = gState.novel.readLineIds.includes(currentLine.id);
    if (skipMode && alreadyRead) {
      timerRef.current = window.setTimeout(advanceNext, 130);
    } else if (autoMode) {
      timerRef.current = window.setTimeout(advanceNext, gState.novel.settings.autoAdvanceDelayMs);
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [screen, currentLine, isTyping, skipMode, autoMode, advanceNext, gState.novel.readLineIds, gState.novel.settings.autoAdvanceDelayMs]);

  // All encountered tokens & grammar across chapters for glossary
  const allGlossary = useMemo(() => {
    const tokenMap = new Map<string, NovelTokenInfo>();
    const grammarList: { pattern: string; title: string; explanation: string; chapterId: string }[] = [];
    for (const ch of novelChapters) {
      for (const ln of ch.lines) {
        for (const tok of ln.tokens) {
          if (!tokenMap.has(tok.word)) tokenMap.set(tok.word, tok);
        }
        for (const gn of ln.grammarNotes ?? []) {
          if (!grammarList.some((x) => x.pattern === gn.pattern)) {
            grammarList.push({ ...gn, chapterId: ch.id });
          }
        }
      }
    }
    return { tokens: Array.from(tokenMap.values()), grammar: grammarList };
  }, []);

  // Render clickable Chinese text using tokens
  const renderInteractiveZh = (text: string, tokens: NovelTokenInfo[]) => {
    const visible = text.slice(0, displayedChars);
    if (isTyping || tokens.length === 0) {
      return <span lang="zh-Hans">{visible}</span>;
    }
    // Split text greedily by known token words
    const sorted = [...tokens].sort((a, b) => b.word.length - a.word.length);
    const parts: React.ReactNode[] = [];
    let idx = 0;
    while (idx < visible.length) {
      const matched = sorted.find((t) => visible.startsWith(t.word, idx));
      if (matched) {
        const key = `${idx}-${matched.word}`;
        parts.push(
          <span
            key={key}
            lang="zh-Hans"
            className="novel-token-word"
            title="クリックで辞書解説を表示"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedToken(matched);
              gameAudio.playSfx('click');
            }}
          >
            {matched.word}
          </span>
        );
        idx += matched.word.length;
      } else {
        parts.push(<span key={idx} lang="zh-Hans">{visible[idx]}</span>);
        idx += 1;
      }
    }
    return <>{parts}</>;
  };

  // Resolve active background & characters (carry forward from visited lines if omitted)
  const resolvedVisuals = useMemo(() => {
    if (!currentChapter || !currentLine) {
      return { bgKey: 'observatory_rain', cgKey: null as string | null, chars: [] as NovelLine['characters'] };
    }
    const lineIdx = currentChapter.lines.findIndex((l) => l.id === currentLine.id);
    let bgKey = 'observatory_rain';
    let cgKey: string | null = null;
    let chars: NovelLine['characters'] = [];

    for (let i = 0; i <= lineIdx; i++) {
      const ln = currentChapter.lines[i];
      if (ln.background) bgKey = ln.background;
      if (ln.cg !== undefined) cgKey = ln.cg;
      if (ln.characters !== undefined) chars = ln.characters;
    }
    return { bgKey, cgKey, chars };
  }, [currentChapter, currentLine]);

  const backlogLines = useMemo(() => {
    if (!currentChapter) return [];
    return visitedIds
      .map((id) => currentChapter.lines.find((l) => l.id === id))
      .filter((x): x is NovelLine => Boolean(x))
      .slice(-40);
  }, [currentChapter, visitedIds]);

  const nextChapter = useMemo(() => {
    if (!currentChapter) return undefined;
    return novelChapters.find((c) => c.number === currentChapter.number + 1);
  }, [currentChapter]);

  return (
    <div className={`stack-lg ${gState.globalSettings.reducedMotion ? 'reduced-motion' : ''}`}>
      <div className="row-between">
        <Link to="/games" className="btn btn-sm">
          <ArrowLeft size={14} /> ゲームセンターへ戻る
        </Link>
        {toast && <span className="badge badge-success">{toast}</span>}
      </div>

      {/* TITLE SCREEN */}
      {screen === 'title' && (
        <div className="novel-stage" data-testid="novel-title-screen">
          <img
            src={novelMeta.titleImage}
            alt="雨霁星语 タイトルビジュアル"
            className="novel-bg-img"
          />
          <div className="novel-scrim" />
          <div
            style={{
              position: 'relative',
              zIndex: 5,
              padding: '44px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 540,
            }}
          >
            <div
              style={{
                maxWidth: 460,
                background: 'rgba(10, 17, 34, 0.56)',
                backdropFilter: 'blur(6px)',
                borderRadius: 14,
                padding: '18px 20px',
                border: '1px solid rgba(147, 197, 253, 0.24)',
              }}
            >
              <span className="badge badge-accent" style={{ marginBottom: 10 }}>
                中国語青春・静謐SFノベル（全5章・3エンディング）
              </span>
              <h2 className="zh-xl" lang="zh-Hans" style={{ margin: 0, fontSize: '2.5rem', color: '#fff' }}>
                {novelMeta.titleZh}
              </h2>
              <div style={{ fontSize: '1.15rem', color: '#dbeafe', fontWeight: 600 }}>
                {novelMeta.titleJa} — {novelMeta.subtitle}
              </div>
              <p style={{ color: '#f1f5f9', marginTop: 10, marginBottom: 0, fontSize: '0.92rem' }}>
                6月の海辺の旧天文台図書室。雨の夜にだけ「過去の光の残響」を視る先輩・蘇晩星と、記録係・林澄の静かな夏のはじまり。
                通常のノベルゲームとしても、辞書・ピンイン・翻訳付きの中国語多読教材としても楽しめます。
              </p>
            </div>

            <div className="row-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={startNewGame}
                data-testid="novel-start-btn"
              >
                <Play size={16} /> はじめから
              </button>
              {gState.novel.slots.auto && (
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#0f172a' }}
                  onClick={() => loadSlot(gState.novel.slots.auto)}
                  data-testid="novel-continue-btn"
                >
                  つづきから ({gState.novel.slots.auto.chapterId})
                </button>
              )}
              <button type="button" className="novel-glass-btn" onClick={() => setModal('load')}>
                ロード
              </button>
              <button type="button" className="novel-glass-btn" onClick={() => setModal('chapters')}>
                章選択
              </button>
              <button type="button" className="novel-glass-btn" onClick={() => setModal('gallery')}>
                <ImageIcon size={14} /> CG・END ({gState.novel.unlockedEndings.length}/{novelMeta.endings.length})
              </button>
              <button type="button" className="novel-glass-btn" onClick={() => setModal('glossary')}>
                <BookOpen size={14} /> 登場語彙・文法 ({allGlossary.tokens.length})
              </button>
              <button type="button" className="novel-glass-btn" onClick={() => setModal('settings')}>
                <Settings size={14} /> 設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAY SCREEN */}
      {screen === 'play' && currentLine && currentChapter && (
        <div className="stack-md">
          <div
            className="novel-stage"
            onClick={() => {
              if (uiHidden) {
                setUiHidden(false);
                return;
              }
              advanceNext();
            }}
            data-testid="novel-play-stage"
          >
            <img
              src={
                resolvedVisuals.cgKey
                  ? novelMeta.cgs.find((c) => c.id === resolvedVisuals.cgKey)?.image ??
                    novelMeta.backgrounds[resolvedVisuals.bgKey]
                  : novelMeta.backgrounds[resolvedVisuals.bgKey]
              }
              alt="シーン背景"
              className="novel-bg-img"
            />
            <div className="novel-scrim" />

            {/* Characters (hidden when CG is showing) */}
            {!resolvedVisuals.cgKey && resolvedVisuals.chars && resolvedVisuals.chars.length > 0 && (
              <div className="novel-char-layer">
                {resolvedVisuals.chars.map((c, idx) => {
                  const src = novelMeta.characters[c.characterId]?.[c.expression];
                  if (!src) return null;
                  const isSpeaking =
                    (c.characterId === 'wanxing' && currentLine.speaker.includes('晚星')) ||
                    (c.characterId === 'zhixia' && currentLine.speaker.includes('知夏')) ||
                    (c.characterId === 'cheng' && currentLine.speaker.includes('林澄'));
                  return (
                    <div
                      key={`${c.characterId}-${idx}`}
                      className="novel-char-card"
                      style={{
                        opacity: isSpeaking || !currentLine.speaker ? 1 : 0.78,
                        transform: isSpeaking ? 'scale(1.03)' : 'scale(0.97)',
                      }}
                    >
                      <img src={src} alt={c.characterId} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top HUD */}
            {!uiHidden && (
              <div className="novel-top-hud" onClick={(e) => e.stopPropagation()}>
                <div className="row-wrap">
                  <span className="novel-glass-btn" style={{ cursor: 'default' }}>
                    第{currentChapter.number}章: {currentChapter.titleZh}
                  </span>
                  <button
                    type="button"
                    className={`novel-glass-btn ${gState.novel.settings.showPinyin ? 'active' : ''}`}
                    onClick={() =>
                      setGState((p) => ({
                        ...p,
                        novel: {
                          ...p.novel,
                          settings: { ...p.novel.settings, showPinyin: !p.novel.settings.showPinyin },
                        },
                      }))
                    }
                  >
                    ピンイン
                  </button>
                  <button
                    type="button"
                    className={`novel-glass-btn ${gState.novel.settings.showJaTranslation ? 'active' : ''}`}
                    onClick={() =>
                      setGState((p) => ({
                        ...p,
                        novel: {
                          ...p.novel,
                          settings: {
                            ...p.novel.settings,
                            showJaTranslation: !p.novel.settings.showJaTranslation,
                          },
                        },
                      }))
                    }
                  >
                    日本語訳
                  </button>
                  <button
                    type="button"
                    className={`novel-glass-btn ${autoMode ? 'active' : ''}`}
                    onClick={() => setAutoMode((a) => !a)}
                  >
                    オート
                  </button>
                  <button
                    type="button"
                    className={`novel-glass-btn ${skipMode ? 'active' : ''}`}
                    onClick={() => setSkipMode((s) => !s)}
                  >
                    <FastForward size={13} /> 既読スキップ
                  </button>
                </div>

                <div className="row-wrap">
                  <button type="button" className="novel-glass-btn" onClick={() => setModal('backlog')}>
                    <History size={13} /> 履歴
                  </button>
                  <button type="button" className="novel-glass-btn" onClick={() => saveToSlot('quick')}>
                    Q.Save
                  </button>
                  {gState.novel.slots.quick && (
                    <button
                      type="button"
                      className="novel-glass-btn"
                      onClick={() => loadSlot(gState.novel.slots.quick)}
                    >
                      Q.Load
                    </button>
                  )}
                  <button type="button" className="novel-glass-btn" onClick={() => setModal('save')}>
                    <Save size={13} /> セーブ
                  </button>
                  <button type="button" className="novel-glass-btn" onClick={() => setModal('load')}>
                    ロード
                  </button>
                  <button
                    type="button"
                    className="novel-glass-btn"
                    onClick={() => setUiHidden(true)}
                    title="UIを隠す（クリックで復帰）"
                  >
                    <EyeOff size={13} />
                  </button>
                  <button
                    type="button"
                    className="novel-glass-btn"
                    onClick={() =>
                      setGState((p) => ({
                        ...p,
                        globalSettings: { ...p.globalSettings, muted: !p.globalSettings.muted },
                      }))
                    }
                  >
                    {gState.globalSettings.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                  <button type="button" className="novel-glass-btn" onClick={() => setScreen('title')}>
                    タイトル
                  </button>
                </div>
              </div>
            )}

            {/* Choices Overlay */}
            {!uiHidden && !isTyping && currentLine.choices && currentLine.choices.length > 0 && (
              <div className="novel-choice-overlay" onClick={(e) => e.stopPropagation()}>
                {currentLine.choices.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="novel-choice-btn"
                    onClick={() => chooseOption(ch)}
                    data-testid={`novel-choice-${ch.id}`}
                  >
                    <div className="zh-lg" lang="zh-Hans">{ch.labelZh}</div>
                    {(gState.novel.settings.showJaTranslation || showLineJa) && (
                      <div style={{ fontSize: '0.86rem', color: '#cbd5e1', marginTop: 4 }}>
                        {ch.labelJa}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Dialogue Box */}
            {!uiHidden && (
              <div className="novel-textbox" onClick={(e) => { e.stopPropagation(); advanceNext(); }}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <div>
                    {currentLine.speaker && (
                      <span className="novel-speaker-tag">{currentLine.speaker}</span>
                    )}
                  </div>
                  <div className="row-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="novel-glass-btn"
                      disabled={!speechSupport.supported}
                      onClick={() => speakChinese(currentLine.textZh, userState.settings.speechRate)}
                    >
                      <Volume2 size={13} /> 読み上げ
                    </button>
                    {!gState.novel.settings.showJaTranslation && (
                      <button
                        type="button"
                        className="novel-glass-btn"
                        onClick={() => setShowLineJa((s) => !s)}
                      >
                        1文訳
                      </button>
                    )}
                    {currentLine.grammarNotes && currentLine.grammarNotes.length > 0 && (
                      <button
                        type="button"
                        className={`novel-glass-btn ${showGrammarPanel ? 'active' : ''}`}
                        onClick={() => setShowGrammarPanel((g) => !g)}
                      >
                        表現・文法解説 ({currentLine.grammarNotes.length})
                      </button>
                    )}
                  </div>
                </div>

                {gState.novel.settings.showPinyin && (
                  <div style={{ fontSize: '0.9rem', color: '#bfdbfe', marginBottom: 4 }}>
                    {currentLine.pinyin}
                  </div>
                )}

                <div className="zh-lg" style={{ color: '#ffffff', lineHeight: 1.65 }}>
                  {renderInteractiveZh(currentLine.textZh, currentLine.tokens)}
                </div>

                {(gState.novel.settings.showJaTranslation || showLineJa) && (
                  <div style={{ fontSize: '0.92rem', color: '#cbd5e1', marginTop: 8 }}>
                    {currentLine.textJa}
                  </div>
                )}

                {!isTyping && (!currentLine.choices || currentLine.choices.length === 0) && (
                  <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#93c5fd', marginTop: 6 }}>
                    クリックで次へ ▶（単語をクリックで辞書表示）
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inline Dictionary Popover & Grammar Notes (Non-intrusive below stage) */}
          {(selectedToken || (showGrammarPanel && currentLine.grammarNotes?.length)) && (
            <div className="grid-2">
              {selectedToken && (
                <div className="card stack-sm" data-testid="novel-dict-card">
                  <div className="row-between">
                    <div className="row-wrap">
                      <span className="zh-lg" lang="zh-Hans">{selectedToken.word}</span>
                      <span className="badge">{selectedToken.pinyin}</span>
                      <span className="badge">{selectedToken.pos}</span>
                      <span
                        className={`badge ${
                          selectedToken.source === 'novel-extra' ? 'badge-warning' : 'badge-accent'
                        }`}
                      >
                        {selectedToken.source === 'novel-extra' ? '教材外(ノベル語彙)' : selectedToken.lessonId ?? '教材範囲'}
                      </span>
                    </div>
                    <button type="button" className="btn btn-sm" onClick={() => setSelectedToken(null)}>
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ fontWeight: 700 }}>{selectedToken.meaningJa}</div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    文脈用法: {selectedToken.contextualNote}
                  </div>
                  <div className="row-wrap">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!speechSupport.supported}
                      onClick={() => speakChinese(selectedToken.word, userState.settings.speechRate)}
                    >
                      <Volume2 size={14} /> 発音
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      data-testid="novel-add-vocab-btn"
                      onClick={() => {
                        addNovelVocabToReview({
                          word: selectedToken.word,
                          pinyin: selectedToken.pinyin,
                          pos: selectedToken.pos,
                          meaningJa: selectedToken.meaningJa,
                          contextualNote: selectedToken.contextualNote,
                          source: selectedToken.source,
                          chapterId,
                        });
                        showToastMsg(`「${selectedToken.word}」を復習帳へ追加しました`);
                      }}
                    >
                      <PlusCircle size={14} /> 復習帳へ追加
                    </button>
                  </div>
                </div>
              )}

              {showGrammarPanel && currentLine.grammarNotes && currentLine.grammarNotes.length > 0 && (
                <div className="card stack-sm">
                  <div className="row-between">
                    <strong>この行の表現・文法解説</strong>
                    <button type="button" className="btn btn-sm" onClick={() => setShowGrammarPanel(false)}>
                      <X size={14} />
                    </button>
                  </div>
                  {currentLine.grammarNotes.map((gn, i) => (
                    <div key={i} className="card-subtle stack-sm">
                      <div className="row-wrap">
                        <span className="zh-md" lang="zh-Hans" style={{ color: 'var(--accent)' }}>
                          {gn.pattern}
                        </span>
                        <strong>{gn.title}</strong>
                        {gn.isColloquial && <span className="badge badge-warning">口語・慣用表現</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.88rem' }}>{gn.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CHAPTER END & OPTIONAL REVIEW QUIZ */}
      {screen === 'chapter-end' && currentChapter && (
        <div className="card stack-lg" data-testid="novel-chapter-end">
          <div>
            <span className="badge badge-accent">第{currentChapter.number}章 読了</span>
            <h3 style={{ margin: '6px 0 4px' }}>
              <span lang="zh-Hans">{currentChapter.titleZh}</span> — {currentChapter.titleJa}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{currentChapter.synopsis}</p>
          </div>

          <div className="row-wrap">
            {nextChapter ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startChapter(nextChapter.id, undefined, flags)}
              >
                第{nextChapter.number}章へ進む ({nextChapter.titleZh}) →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('title')}
              >
                タイトル画面へ戻る（お疲れさまでした！）
              </button>
            )}
            <button type="button" className="btn" onClick={() => setModal('gallery')}>
              CG・エンディング達成状況を見る
            </button>
          </div>

          {currentChapter.reviewQuiz.length > 0 && (
            <div className="card-subtle stack-md">
              <div>
                <strong>任意の章末 語彙・読解ミニ確認（スキップ可）</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  物語に登場した自然な中国語表現を軽く振り返ることができます。
                </p>
              </div>
              {currentChapter.reviewQuiz.map((q, qIdx) => (
                <div key={q.id} className="card stack-sm">
                  <div style={{ fontWeight: 600 }}>Q{qIdx + 1}. {q.prompt}</div>
                  <div className="grid-2">
                    {q.choices.map((ch) => {
                      const selected = quizAnswers[q.id] === ch;
                      const isCorrect = ch === q.answer;
                      let cls = 'choice-btn';
                      if (quizSubmitted) {
                        if (isCorrect) cls += ' correct';
                        else if (selected) cls += ' wrong';
                      } else if (selected) {
                        cls += ' selected';
                      }
                      return (
                        <button
                          key={ch}
                          type="button"
                          className={cls}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers((p) => ({ ...p, [q.id]: ch }))}
                        >
                          <span lang="zh-Hans">{ch}</span>
                        </button>
                      );
                    })}
                  </div>
                  {quizSubmitted && (
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      正解: <strong lang="zh-Hans">{q.answer}</strong> — {q.explanation}
                    </div>
                  )}
                </div>
              ))}
              {!quizSubmitted && (
                <div>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => setQuizSubmitted(true)}>
                    ミニ確認を採点する
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-panel stack-md" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h3 style={{ margin: 0 }}>
                {modal === 'save' && 'セーブ'}
                {modal === 'load' && 'ロード'}
                {modal === 'backlog' && 'バックログ・文章復習'}
                {modal === 'chapters' && '章選択'}
                {modal === 'gallery' && 'CGギャラリー & エンディング達成状況'}
                {modal === 'glossary' && '作中登場語彙・口語文法一覧'}
                {modal === 'settings' && 'ノベル設定'}
              </h3>
              <button type="button" className="btn btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            {(modal === 'save' || modal === 'load') && (
              <div className="grid-2">
                {['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', ...(modal === 'load' ? ['auto', 'quick'] : [])].map(
                  (slotId) => {
                    const slot = gState.novel.slots[slotId];
                    return (
                      <div key={slotId} className="card-subtle stack-sm">
                        <div className="row-between">
                          <strong>{slotId.toUpperCase()}</strong>
                          {slot && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                              {new Date(slot.savedAt).toLocaleString('ja-JP')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.86rem', minHeight: 38 }}>
                          {slot ? `${slot.chapterId} [${slot.speaker}] ${slot.previewText}...` : '空きスロット'}
                        </div>
                        {modal === 'save' ? (
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => saveToSlot(slotId)}>
                            ここに保存
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-soft"
                            disabled={!slot}
                            onClick={() => slot && loadSlot(slot)}
                          >
                            このデータから再開
                          </button>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {modal === 'backlog' && (
              <div className="stack-sm">
                {backlogLines.map((ln) => (
                  <div key={ln.id} className="card-subtle stack-sm">
                    <div className="row-between">
                      <strong>{ln.speaker || '地の文'}</strong>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!speechSupport.supported}
                        onClick={() => speakChinese(ln.textZh, userState.settings.speechRate)}
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                    <div className="zh-md" lang="zh-Hans">{ln.textZh}</div>
                    <div className="pinyin-text">{ln.pinyin}</div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{ln.textJa}</div>
                  </div>
                ))}
              </div>
            )}

            {modal === 'chapters' && (
              <div className="stack-sm">
                {novelChapters.map((ch) => (
                  <div key={ch.id} className="card-subtle row-between">
                    <div>
                      <strong>
                        第{ch.number}章: <span lang="zh-Hans">{ch.titleZh}</span> ({ch.titleJa})
                      </strong>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{ch.synopsis}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const baseAffection =
                          ch.id === 'ch01'
                            ? 0
                            : ch.id === 'ch02'
                              ? 1
                              : ch.id === 'ch03'
                                ? 3
                                : ch.id === 'ch04'
                                  ? 5
                                  : 7;
                        startChapter(ch.id, undefined, {
                          affection: baseAffection,
                          shared_star_map: false,
                          honest_feeling: false,
                        });
                      }}
                    >
                      この章から読む
                    </button>
                  </div>
                ))}
              </div>
            )}

            {modal === 'gallery' && (
              <div className="stack-md">
                <div>
                  <strong>エンディング達成状況 ({gState.novel.unlockedEndings.length}/{novelMeta.endings.length})</strong>
                  <div className="stack-sm" style={{ marginTop: 8 }}>
                    {novelMeta.endings.map((e) => {
                      const unlocked = gState.novel.unlockedEndings.includes(e.id);
                      return (
                        <div key={e.id} className="card-subtle row-between">
                          <div>
                            <strong>{unlocked ? `${e.titleZh} — ${e.titleJa}` : '？？？ (未達成)'}</strong>
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                              {unlocked ? e.description : '第5章の選択によって解放されます'}
                            </div>
                          </div>
                          <span className={`badge ${unlocked ? 'badge-success' : ''}`}>
                            {unlocked ? '達成済み' : '未達成'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <strong>イベントCG ({gState.novel.unlockedCgs.length}/{novelMeta.cgs.length})</strong>
                  <div className="grid-2" style={{ marginTop: 8 }}>
                    {novelMeta.cgs.map((cg) => {
                      const unlocked = gState.novel.unlockedCgs.includes(cg.id);
                      return (
                        <div key={cg.id} className="card-subtle stack-sm">
                          {unlocked ? (
                            <img
                              src={cg.image}
                              alt={cg.title}
                              style={{ width: '100%', borderRadius: 8, aspectRatio: '16/9', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                aspectRatio: '16/9',
                                borderRadius: 8,
                                background: '#1e293b',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              未解放CG
                            </div>
                          )}
                          <strong>{unlocked ? cg.title : '？？？'}</strong>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {unlocked ? cg.description : '物語を進めることで解放されます'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {modal === 'glossary' && (
              <div className="stack-md">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>単語</th>
                        <th>ピンイン</th>
                        <th>品詞・意味</th>
                        <th>区分</th>
                        <th>復習</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allGlossary.tokens.slice(0, 80).map((t) => (
                        <tr key={t.word}>
                          <td className="zh-md" lang="zh-Hans">{t.word}</td>
                          <td>{t.pinyin}</td>
                          <td>[{t.pos}] {t.meaningJa}</td>
                          <td>
                            <span className={`badge ${t.source === 'novel-extra' ? 'badge-warning' : 'badge-accent'}`}>
                              {t.source === 'novel-extra' ? 'ノベル語彙' : t.lessonId ?? '教材'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                addNovelVocabToReview({
                                  word: t.word,
                                  pinyin: t.pinyin,
                                  pos: t.pos,
                                  meaningJa: t.meaningJa,
                                  contextualNote: t.contextualNote,
                                  source: t.source,
                                  chapterId: 'glossary',
                                });
                                showToastMsg(`「${t.word}」を復習帳へ追加`);
                              }}
                            >
                              追加
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {modal === 'settings' && (
              <div className="stack-md">
                <label className="stack-sm">
                  <span>文字送り速度 ({gState.novel.settings.textSpeed} ms/字)</span>
                  <input
                    type="range"
                    min={8}
                    max={60}
                    value={gState.novel.settings.textSpeed}
                    onChange={(e) =>
                      setGState((p) => ({
                        ...p,
                        novel: { ...p.novel, settings: { ...p.novel.settings, textSpeed: Number(e.target.value) } },
                      }))
                    }
                  />
                </label>
                <label className="stack-sm">
                  <span>BGM・環境音 音量 ({Math.round(gState.globalSettings.bgmVolume * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={gState.globalSettings.bgmVolume}
                    onChange={(e) =>
                      setGState((p) => ({
                        ...p,
                        globalSettings: { ...p.globalSettings, bgmVolume: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
                <label className="stack-sm">
                  <span>効果音 音量 ({Math.round(gState.globalSettings.sfxVolume * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={gState.globalSettings.sfxVolume}
                    onChange={(e) =>
                      setGState((p) => ({
                        ...p,
                        globalSettings: { ...p.globalSettings, sfxVolume: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
                <label className="row-wrap">
                  <input
                    type="checkbox"
                    checked={gState.globalSettings.reducedMotion}
                    onChange={(e) =>
                      setGState((p) => ({
                        ...p,
                        globalSettings: { ...p.globalSettings, reducedMotion: e.target.checked },
                      }))
                    }
                  />
                  <span>演出を軽減する（即時文字表示・アニメーション抑制）</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
