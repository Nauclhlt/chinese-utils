import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Heart,
  Headphones,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
  Settings,
  Square,
  Volume2,
} from 'lucide-react';
import { getBundledWorkById } from '../data';
import { listLocalWorks } from '../core/localWorksDb';
import {
  addBookmarkToWork,
  addReaderGrammarToReview,
  addReaderVocabToReview,
  applyDisplayModePreset,
  loadReaderState,
  recordLookupHistory,
  removeBookmarkFromWork,
  saveReaderState,
  toggleFavoriteSentence,
  upsertWorkProgress,
} from '../core/readerStorage';
import { buildTextSegments } from '../core/annotationSegments';
import { AnnotationPopup } from '../components/AnnotationPopup';
import { AnnotationSidePanel } from '../components/AnnotationSidePanel';
import { ReaderPracticePanel } from '../components/ReaderPracticePanel';
import { useApp } from '../../context/AppContext';
import { speakChinese, stopSpeaking } from '../../utils/speech';
import { Switch } from '../../components/ui';
import type {
  BackgroundNote,
  GlossaryEntry,
  InlineAnnotation,
  LiteratureWork,
  ReaderContentWidth,
  ReaderDisplayMode,
  ReaderFontFamily,
  ReaderTheme,
  WorkSentence,
} from '../types/work';

export const LiteratureReaderPage: React.FC = () => {
  const { workId } = useParams<{ workId: string }>();
  const { userState, speechSupport, rateSrsItem } = useApp();

  const [work, setWork] = useState<LiteratureWork | undefined>(() =>
    workId ? getBundledWorkById(workId) : undefined
  );
  const [loading, setLoading] = useState(!work);
  const [readerState, setReaderState] = useState(() => loadReaderState());
  const [chapterIndex, setChapterIndex] = useState<number>(() => {
    if (!workId) return 0;
    return readerState.progressByWork[workId]?.currentChapterIndex ?? 0;
  });

  // UI overlays
  const [activePopup, setActivePopup] = useState<{
    annotations: InlineAnnotation[];
    anchorRect: { left: number; top: number; bottom: number; right: number };
    sentence: WorkSentence;
  } | null>(null);
  const [sidePanelAnnotations, setSidePanelAnnotations] = useState<InlineAnnotation[]>([]);
  const [drawerTab, setDrawerTab] = useState<'none' | 'toc' | 'info' | 'settings' | 'search' | 'practice'>('none');
  const [infoSubTab, setInfoSubTab] = useState<'background' | 'characters' | 'glossary' | 'timeline'>('background');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');

  // Audio playback
  const [isListeningPlaying, setIsListeningPlaying] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const listeningCancelRef = useRef(false);
  const hoverTimerRef = useRef<number | null>(null);

  // Load work from local IndexedDB if not bundled (or if overridden locally)
  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!workId) {
        setLoading(false);
        return;
      }
      const locals = await listLocalWorks();
      const localMatch = locals.find((l) => l.id === workId);
      if (mounted) {
        if (localMatch) {
          setWork(localMatch.work);
        } else {
          setWork(getBundledWorkById(workId));
        }
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [workId]);

  useEffect(() => {
    saveReaderState(readerState);
  }, [readerState]);

  useEffect(() => {
    return () => {
      listeningCancelRef.current = true;
      stopSpeaking();
      audioElRef.current?.pause();
    };
  }, []);

  // Auto-save reading position whenever chapter changes
  useEffect(() => {
    if (!work) return;
    const bounded = Math.max(0, Math.min(chapterIndex, work.chapters.length - 1));
    if (bounded !== chapterIndex) {
      setChapterIndex(bounded);
      return;
    }
    const firstSentenceId = work.chapters[bounded]?.paragraphs[0]?.sentences[0]?.id ?? null;
    setReaderState((prev) =>
      upsertWorkProgress(prev, work.metadata.id, bounded, firstSentenceId, work.chapters.length, false)
    );
  }, [work, chapterIndex]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? '' : cur)), 2600);
  };

  const glossaryMap = useMemo(() => {
    const m = new Map<string, GlossaryEntry>();
    for (const g of work?.glossary ?? []) m.set(g.id, g);
    return m;
  }, [work]);

  const backgroundMap = useMemo(() => {
    const m = new Map<string, BackgroundNote>();
    for (const b of work?.backgroundNotes ?? []) m.set(b.id, b);
    return m;
  }, [work]);

  const masteredVocabIds = useMemo(() => {
    const s = new Set<string>();
    for (const [id, rec] of Object.entries(userState.srs)) {
      if (rec.mastery >= 70) s.add(id);
    }
    return s;
  }, [userState.srs]);

  if (loading) {
    return <div className="card">作品データを読み込んでいます...</div>;
  }

  if (!work) {
    return (
      <div className="card stack-md">
        <h2 style={{ margin: 0 }}>作品が見つかりません</h2>
        <Link to="/reader" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} /> 本棚へ戻る
        </Link>
      </div>
    );
  }

  const currentChapter = work.chapters[chapterIndex] ?? work.chapters[0];
  const progress = readerState.progressByWork[work.metadata.id];
  const maxReachedChapterIndex = progress?.maxReachedChapterIndex ?? chapterIndex;
  const settings = readerState.settings;
  const allSentences = currentChapter.paragraphs.flatMap((p) => p.sentences);

  const searchMatches = searchQuery.trim()
    ? work.chapters.flatMap((ch) =>
        ch.paragraphs.flatMap((p) =>
          p.sentences
            .filter(
              (s) =>
                s.text.includes(searchQuery.trim()) ||
                s.translationJa.includes(searchQuery.trim())
            )
            .map((s) => ({ chapterIndex: ch.index, chapterNumber: ch.number, sentence: s }))
        )
      )
    : [];

  const handleSegmentActivate = (
    anns: InlineAnnotation[],
    sentence: WorkSentence,
    targetEl: HTMLElement
  ) => {
    if (anns.length === 0) return;
    const rect = targetEl.getBoundingClientRect();
    setActivePopup({
      annotations: anns,
      anchorRect: { left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right },
      sentence,
    });

    const top = anns[0];
    setReaderState((prev) => {
      const nextWithProgress = upsertWorkProgress(
        prev,
        work.metadata.id,
        chapterIndex,
        sentence.id,
        work.chapters.length,
        false
      );
      return recordLookupHistory(nextWithProgress, {
        workId: work.metadata.id,
        workTitleZh: work.metadata.titleZh,
        chapterIndex,
        kind: top.kind,
        surface: top.surface,
        pinyin: top.vocab?.contextualPinyin,
        meaningJa:
          top.vocab?.contextualMeaningJa ??
          top.grammar?.title ??
          top.expression?.meaningJa ??
          top.background?.shortHintJa ??
          top.surface,
      });
    });
  };

  const handleAddVocab = (ann: InlineAnnotation, entry: GlossaryEntry) => {
    const id = `${work.metadata.id}::${entry.id}`;
    setReaderState((prev) =>
      addReaderVocabToReview(prev, {
        id,
        workId: work.metadata.id,
        workTitleZh: work.metadata.titleZh,
        glossaryId: entry.id,
        word: entry.headword,
        pinyin: ann.vocab?.contextualPinyin ?? entry.pinyin,
        pos: entry.pos,
        meaningJa: ann.vocab?.contextualMeaningJa ?? entry.generalMeaningJa,
        contextualNote: ann.vocab?.contextualNote,
        relatedLessonId: entry.relatedLessonId,
      })
    );
    rateSrsItem(id, 'vocab', 'good');
    showToast(`「${entry.headword}」を復習帳へ追加しました`);
  };

  const handleAddGrammar = (ann: InlineAnnotation) => {
    if (!ann.grammar) return;
    const id = `${work.metadata.id}::${ann.id}`;
    setReaderState((prev) =>
      addReaderGrammarToReview(prev, {
        id,
        workId: work.metadata.id,
        workTitleZh: work.metadata.titleZh,
        title: ann.grammar!.title,
        pattern: ann.grammar!.pattern,
        explanationJa: ann.grammar!.roleExplanation,
        relatedGrammarId: ann.grammar!.relatedGrammarId,
      })
    );
    rateSrsItem(id, 'grammar', 'good');
    showToast(`文法「${ann.grammar.title}」を復習帳へ追加しました`);
  };

  const playSentenceAudio = (sentence: WorkSentence, onDone?: () => void) => {
    setActiveSentenceId(sentence.id);
    if (sentence.audioUrl) {
      try {
        audioElRef.current?.pause();
        const audio = new Audio(sentence.audioUrl);
        audioElRef.current = audio;
        audio.playbackRate = settings.speechRate;
        audio.onended = () => onDone?.();
        audio.onerror = () => {
          speakChinese(sentence.text, settings.speechRate, onDone, onDone);
        };
        void audio.play();
        return;
      } catch {
        // fallback to Web Speech API
      }
    }
    if (speechSupport.supported) {
      speakChinese(sentence.text, settings.speechRate, onDone, onDone);
    } else {
      onDone?.();
    }
  };

  const startContinuousListening = (startIdx = 0) => {
    if (!speechSupport.supported && !allSentences.some((s) => s.audioUrl)) {
      showToast('音声合成が利用できないため読み上げを開始できません。');
      return;
    }
    listeningCancelRef.current = false;
    setIsListeningPlaying(true);

    const step = (idx: number) => {
      if (listeningCancelRef.current || idx >= allSentences.length) {
        setIsListeningPlaying(false);
        setActiveSentenceId(null);
        return;
      }
      playSentenceAudio(allSentences[idx], () => {
        if (!listeningCancelRef.current) {
          step(idx + 1);
        }
      });
    };
    step(startIdx);
  };

  const stopContinuousListening = () => {
    listeningCancelRef.current = true;
    setIsListeningPlaying(false);
    setActiveSentenceId(null);
    stopSpeaking();
    audioElRef.current?.pause();
  };

  const copyText = async (text: string) => {
    const sel = window.getSelection()?.toString().trim();
    const target = sel || text;
    try {
      await navigator.clipboard.writeText(target);
      showToast('中国語テキストをコピーしました');
    } catch {
      showToast('コピーに失敗しました');
    }
  };

  const modeLabels: { id: ReaderDisplayMode; label: string }[] = [
    { id: 'reading', label: '読書' },
    { id: 'intensive', label: '精読' },
    { id: 'bilingual', label: '対訳' },
    { id: 'pinyin', label: 'ピンイン' },
    { id: 'listening', label: 'リスニング' },
  ];

  const isVocabInReview = (glossaryId: string) =>
    readerState.vocabReview.some((v) => v.id === `${work.metadata.id}::${glossaryId}`);

  return (
    <div
      className={`reader-page-wrap stack-md ${settings.focusMode ? 'reader-focus-mode' : ''}`}
      data-reader-theme={settings.theme}
      data-testid="literature-reader-page"
      onClick={() => setActivePopup(null)}
    >
      {/* Quiet Top Reading Bar */}
      <div className="reader-topbar" onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="row-wrap" style={{ gap: 8 }}>
            <Link to="/reader" className="btn btn-ghost btn-sm">
              <ArrowLeft size={14} /> 本棚へ
            </Link>
            <strong className="zh-md" lang={work.metadata.script}>
              {work.metadata.titleZh}
            </strong>
            <span className="badge badge-accent num-tabular">
              第{currentChapter.number}章 / {work.chapters.length} ({Math.round(((chapterIndex + 1) / work.chapters.length) * 100)}%)
            </span>
          </div>

          <div className="row-wrap" style={{ gap: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${drawerTab === 'toc' ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => setDrawerTab((d) => (d === 'toc' ? 'none' : 'toc'))}
            >
              <BookOpen size={14} /> 目次・しおり
            </button>
            <button
              type="button"
              className={`btn btn-sm ${drawerTab === 'info' ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => setDrawerTab((d) => (d === 'info' ? 'none' : 'info'))}
              data-testid="reader-info-btn"
            >
              <Info size={14} /> 背景・人物
            </button>
            <button
              type="button"
              className={`btn btn-sm ${drawerTab === 'search' ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => setDrawerTab((d) => (d === 'search' ? 'none' : 'search'))}
            >
              <Search size={14} /> 検索
            </button>
            <button
              type="button"
              className={`btn btn-sm ${drawerTab === 'practice' ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => setDrawerTab((d) => (d === 'practice' ? 'none' : 'practice'))}
              data-testid="reader-practice-toggle"
            >
              演習
            </button>
            <button
              type="button"
              className={`btn btn-sm ${drawerTab === 'settings' ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => setDrawerTab((d) => (d === 'settings' ? 'none' : 'settings'))}
              data-testid="reader-settings-btn"
            >
              <Settings size={14} /> 表示設定
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setReaderState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, focusMode: !prev.settings.focusMode },
                }))
              }
              title="集中読書モード切替"
              aria-label="集中読書モード切替"
              data-testid="reader-focus-toggle"
            >
              {settings.focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        {/* Display modes + clean Switch toggles */}
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="row-wrap" style={{ gap: 4 }} role="group" aria-label="表示モード">
            {modeLabels.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`btn btn-sm ${settings.displayMode === m.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() =>
                  setReaderState((prev) => ({
                    ...prev,
                    settings: applyDisplayModePreset(prev.settings, m.id),
                  }))
                }
                data-testid={`reader-mode-${m.id}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="row-wrap" style={{ gap: 12 }}>
            <Switch
              checked={settings.showPinyin}
              onChange={(checked) =>
                setReaderState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, showPinyin: checked },
                }))
              }
              label="ピンイン"
              testId="reader-toggle-pinyin"
            />
            <Switch
              checked={settings.showTranslation}
              onChange={(checked) =>
                setReaderState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, showTranslation: checked },
                }))
              }
              label="日本語訳"
              testId="reader-toggle-translation"
            />
            <div className="row" style={{ gap: 2 }}>
              {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${settings.theme === t ? 'btn-soft' : 'btn-ghost'}`}
                  onClick={() =>
                    setReaderState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, theme: t },
                    }))
                  }
                  data-testid={`reader-theme-${t}`}
                >
                  {t === 'light' ? 'ライト' : t === 'sepia' ? 'セピア' : 'ダーク'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Listening bar when in listening mode or currently playing */}
        {(settings.displayMode === 'listening' || isListeningPlaying) && (
          <div className="card-subtle row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <Headphones size={16} />
              <span style={{ fontSize: '0.88rem' }}>
                {speechSupport.supported
                  ? '章内の文章を順番に音声再生しながら読めます。'
                  : 'このブラウザでは中国語TTSが未検出です（音声ファイルがある文のみ再生）。'}
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label style={{ fontSize: '0.82rem' }}>
                速度 {settings.speechRate.toFixed(1)}x
                <input
                  type="range"
                  min={0.6}
                  max={1.3}
                  step={0.1}
                  value={settings.speechRate}
                  onChange={(e) =>
                    setReaderState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, speechRate: Number(e.target.value) },
                    }))
                  }
                  style={{ width: 90, marginLeft: 6 }}
                />
              </label>
              {!isListeningPlaying ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => startContinuousListening(0)}
                >
                  <Play size={14} /> 章の連続再生
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-soft"
                  onClick={stopContinuousListening}
                >
                  <Square size={14} /> 停止
                </button>
              )}
            </div>
          </div>
        )}

        {toast && (
          <div className="badge badge-success" style={{ alignSelf: 'flex-start' }}>
            {toast}
          </div>
        )}
      </div>

      {/* Auxiliary Drawers */}
      {drawerTab === 'toc' && (
        <div className="card stack-md" onClick={(e) => e.stopPropagation()} data-testid="reader-toc-drawer">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>章選択・しおり</h3>
            <button type="button" className="btn btn-sm" onClick={() => setDrawerTab('none')}>閉じる</button>
          </div>
          <div className="stack-xs">
            {work.chapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`btn btn-sm ${ch.index === chapterIndex ? 'btn-primary' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => {
                  setChapterIndex(ch.index);
                  setDrawerTab('none');
                }}
              >
                <span lang={work.metadata.script}>
                  第{ch.number}章 {ch.titleZh} ({ch.titleJa})
                </span>
                <span style={{ fontSize: '0.78rem' }}>{ch.summaryNoSpoiler}</span>
              </button>
            ))}
          </div>
          <div>
            <strong>保存済みしおり ({progress?.bookmarks.length ?? 0}件)</strong>
            {!progress?.bookmarks.length ? (
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                各文の右上にあるしおりボタンから位置を保存できます。
              </p>
            ) : (
              <div className="stack-xs" style={{ marginTop: 6 }}>
                {progress.bookmarks.map((bm) => (
                  <div key={bm.id} className="card-subtle row-between">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setChapterIndex(bm.chapterIndex);
                        setActiveSentenceId(bm.sentenceId);
                        setDrawerTab('none');
                      }}
                    >
                      第{bm.chapterIndex + 1}章: <span lang={work.metadata.script}>{bm.excerpt}…</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setReaderState((prev) => removeBookmarkFromWork(prev, work.metadata.id, bm.id))
                      }
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {drawerTab === 'info' && (
        <div className="card stack-md" onClick={(e) => e.stopPropagation()} data-testid="reader-info-drawer">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>背景知識・登場人物・時系列・用語集（ネタバレ管理中）</h3>
            <button type="button" className="btn btn-sm" onClick={() => setDrawerTab('none')}>閉じる</button>
          </div>
          <div className="row-wrap" style={{ gap: 6 }}>
            <button type="button" className={`btn btn-sm ${infoSubTab === 'background' ? 'btn-primary' : ''}`} onClick={() => setInfoSubTab('background')}>
              背景知識 ({work.backgroundNotes.length})
            </button>
            <button type="button" className={`btn btn-sm ${infoSubTab === 'characters' ? 'btn-primary' : ''}`} onClick={() => setInfoSubTab('characters')}>
              登場人物 ({work.characters.length})
            </button>
            <button type="button" className={`btn btn-sm ${infoSubTab === 'timeline' ? 'btn-primary' : ''}`} onClick={() => setInfoSubTab('timeline')}>
              時系列 ({work.timeline?.length ?? 0})
            </button>
            <button type="button" className={`btn btn-sm ${infoSubTab === 'glossary' ? 'btn-primary' : ''}`} onClick={() => setInfoSubTab('glossary')}>
              作品語彙集 ({work.glossary.length})
            </button>
          </div>

          {infoSubTab === 'background' && (
            <div className="stack-sm">
              {work.backgroundNotes.map((bg) => {
                const locked = !settings.allowSpoilers && bg.revealFromChapterIndex > maxReachedChapterIndex;
                const manualShow = revealedSpoilers[bg.id];
                if (locked && !manualShow) {
                  return (
                    <div key={bg.id} className="card-subtle row-between" data-testid={`spoiler-locked-bg-${bg.id}`}>
                      <span>
                        <strong>{bg.title}</strong>（第{bg.revealFromChapterIndex + 1}章以降のネタバレ防止のため非表示）
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-soft"
                        onClick={() => setRevealedSpoilers((p) => ({ ...p, [bg.id]: true }))}
                      >
                        <Eye size={13} /> 明示的に開く
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={bg.id} className="card-subtle stack-xs">
                    <div className="row-between">
                      <strong>{bg.title}</strong>
                      <span className="badge badge-accent">
                        {bg.factType === 'fact' ? '事実' : bg.factType === 'common-interpretation' ? '解釈' : '架空設定'}
                      </span>
                    </div>
                    <div>{bg.detail}</div>
                    {bg.sources.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        出典:{' '}
                        {bg.sources.map((s, i) => (
                          <span key={i}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> ({s.checkedAt})
                            {i < bg.sources.length - 1 ? ' / ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {infoSubTab === 'characters' && (
            <div className="stack-sm">
              {work.characters.map((ch) => {
                const spoilerLocked =
                  !settings.allowSpoilers &&
                  ch.spoilerDescription &&
                  ch.revealFromChapterIndex > maxReachedChapterIndex &&
                  !revealedSpoilers[ch.id];
                return (
                  <div key={ch.id} className="card-subtle stack-xs">
                    <div>
                      <strong lang={work.metadata.script}>{ch.nameZh}</strong> ({ch.pinyin} / {ch.nameJa}) — {ch.role}
                    </div>
                    <div style={{ fontSize: '0.88rem' }}>{ch.description}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>口調: {ch.speechStyle}</div>
                    {ch.spoilerDescription && (
                      spoilerLocked ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-soft"
                          style={{ alignSelf: 'flex-start' }}
                          onClick={() => setRevealedSpoilers((p) => ({ ...p, [ch.id]: true }))}
                        >
                          <Eye size={13} /> 第{ch.revealFromChapterIndex + 1}章以降の人物設定を表示
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>{ch.spoilerDescription}</div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {infoSubTab === 'timeline' && (
            <div className="stack-xs">
              {(work.timeline ?? []).map((t) => {
                const locked = !settings.allowSpoilers && t.revealFromChapterIndex > maxReachedChapterIndex && !revealedSpoilers[t.id];
                return locked ? (
                  <div key={t.id} className="card-subtle row-between">
                    <span>{t.label}（未読章ネタバレ防止中）</span>
                    <button type="button" className="btn btn-sm" onClick={() => setRevealedSpoilers((p) => ({ ...p, [t.id]: true }))}>表示</button>
                  </div>
                ) : (
                  <div key={t.id} className="card-subtle">
                    <strong>{t.label}</strong>: {t.description}
                  </div>
                );
              })}
            </div>
          )}

          {infoSubTab === 'glossary' && (
            <div className="row-wrap" style={{ gap: 8 }}>
              {work.glossary.map((g) => (
                <div key={g.id} className="card-subtle" style={{ flex: '1 1 230px' }}>
                  <strong lang={work.metadata.script}>{g.headword}</strong> ({g.pinyin}) — {g.generalMeaningJa}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {drawerTab === 'search' && (
        <div className="card stack-sm" onClick={(e) => e.stopPropagation()}>
          <div className="row-between">
            <h3 style={{ margin: 0 }}>作品内テキスト検索</h3>
            <button type="button" className="btn btn-sm" onClick={() => setDrawerTab('none')}>閉じる</button>
          </div>
          <input
            type="search"
            className="input"
            placeholder="中国語原文または日本語訳で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.trim() && (
            <div className="stack-xs">
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                ヒット件数: {searchMatches.length}件
              </div>
              {searchMatches.slice(0, 20).map((m) => (
                <button
                  key={m.sentence.id}
                  type="button"
                  className="btn btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    setChapterIndex(m.chapterIndex);
                    setActiveSentenceId(m.sentence.id);
                    setDrawerTab('none');
                  }}
                >
                  第{m.chapterNumber}章: <span lang={work.metadata.script}>{m.sentence.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {drawerTab === 'settings' && (
        <div className="card stack-md" onClick={(e) => e.stopPropagation()} data-testid="reader-settings-drawer">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>読書・注釈表示設定</h3>
            <button type="button" className="btn btn-sm" onClick={() => setDrawerTab('none')}>閉じる</button>
          </div>
          <div className="row-wrap" style={{ gap: 14 }}>
            <label>
              書体:
              <select
                className="select"
                style={{ marginLeft: 6 }}
                value={settings.fontFamily}
                onChange={(e) =>
                  setReaderState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, fontFamily: e.target.value as ReaderFontFamily },
                  }))
                }
              >
                <option value="serif">明朝・宋体 (Serif)</option>
                <option value="sans">ゴシック (Sans)</option>
                <option value="kai">楷書風 (Kaiti)</option>
              </select>
            </label>
            <label>
              本文幅:
              <select
                className="select"
                style={{ marginLeft: 6 }}
                value={settings.contentWidth}
                onChange={(e) =>
                  setReaderState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, contentWidth: e.target.value as ReaderContentWidth },
                  }))
                }
              >
                <option value="narrow">狭め</option>
                <option value="medium">標準</option>
                <option value="wide">広め</option>
              </select>
            </label>
            <label>
              文字サイズ ({settings.fontSizePx}px):
              <input
                type="range"
                min={15}
                max={26}
                value={settings.fontSizePx}
                onChange={(e) =>
                  setReaderState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, fontSizePx: Number(e.target.value) },
                  }))
                }
              />
            </label>
            <label>
              行間 ({settings.lineHeight.toFixed(1)}):
              <input
                type="range"
                min={1.6}
                max={2.6}
                step={0.1}
                value={settings.lineHeight}
                onChange={(e) =>
                  setReaderState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, lineHeight: Number(e.target.value) },
                  }))
                }
              />
            </label>
          </div>

          <div className="row-wrap" style={{ gap: 14 }}>
            <label><input type="checkbox" checked={settings.showVocabMarkers} onChange={(e) => setReaderState((p) => ({ ...p, settings: { ...p.settings, showVocabMarkers: e.target.checked } }))} /> 語彙下線 (青破線)</label>
            <label><input type="checkbox" checked={settings.showGrammarMarkers} onChange={(e) => setReaderState((p) => ({ ...p, settings: { ...p.settings, showGrammarMarkers: e.target.checked } }))} /> 文法下線 (緑実線)</label>
            <label><input type="checkbox" checked={settings.showExpressionMarkers} onChange={(e) => setReaderState((p) => ({ ...p, settings: { ...p.settings, showExpressionMarkers: e.target.checked } }))} /> 表現下線 (橙点線)</label>
            <label><input type="checkbox" checked={settings.showBackgroundMarkers} onChange={(e) => setReaderState((p) => ({ ...p, settings: { ...p.settings, showBackgroundMarkers: e.target.checked } }))} /> 背景下線 (紫波線)</label>
            <label><input type="checkbox" checked={settings.dimMasteredVocab} onChange={(e) => setReaderState((p) => ({ ...p, settings: { ...p.settings, dimMasteredVocab: e.target.checked } }))} /> 習得済み語彙を薄く表示</label>
            <label><input type="checkbox" checked={settings.allowSpoilers} onChange={(e) => setReaderState((p) => ({ ...p, settings: { ...p.settings, allowSpoilers: e.target.checked } }))} /> ネタバレ解説もすべて表示</label>
          </div>
        </div>
      )}

      {drawerTab === 'practice' && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReaderPracticePanel
            work={work}
            currentChapter={currentChapter}
            speechSupported={speechSupport.supported}
            speechRate={settings.speechRate}
            masteredIds={masteredVocabIds}
            isVocabInReview={isVocabInReview}
            onAddGlossaryToReview={(gid) => {
              const g = glossaryMap.get(gid);
              if (!g) return;
              const id = `${work.metadata.id}::${g.id}`;
              setReaderState((prev) =>
                addReaderVocabToReview(prev, {
                  id,
                  workId: work.metadata.id,
                  workTitleZh: work.metadata.titleZh,
                  glossaryId: g.id,
                  word: g.headword,
                  pinyin: g.pinyin,
                  pos: g.pos,
                  meaningJa: g.generalMeaningJa,
                  relatedLessonId: g.relatedLessonId,
                })
              );
              rateSrsItem(id, 'vocab', 'good');
              showToast(`「${g.headword}」を復習帳へ追加しました`);
            }}
          />
        </div>
      )}

      {/* Main Book Reading Surface */}
      <main
        className={`reader-book-surface reader-width-${settings.contentWidth} reader-font-${settings.fontFamily}`}
        style={{ fontSize: `${settings.fontSizePx}px`, lineHeight: settings.lineHeight }}
        data-testid="reader-book-surface"
      >
        <header style={{ marginBottom: 24, borderBottom: '1px solid var(--r-border)', paddingBottom: 14 }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--r-muted)' }}>
            第{currentChapter.number}章 / 全{work.chapters.length}章
          </div>
          <h2 lang={work.metadata.script} style={{ margin: '4px 0' }}>
            {currentChapter.titleZh}
          </h2>
          {settings.showPinyin && (
            <div className="reader-pinyin-line">{currentChapter.titlePinyin}</div>
          )}
          <div style={{ fontSize: '0.95rem', color: 'var(--r-muted)' }}>{currentChapter.titleJa}</div>
        </header>

        {currentChapter.paragraphs.map((para) => (
          <div
            key={para.id}
            className={`reader-paragraph ${
              para.kind === 'letter'
                ? 'reader-paragraph-letter'
                : para.kind === 'heading'
                  ? 'reader-paragraph-heading'
                  : ''
            }`}
          >
            {para.sentences.map((sentence) => {
              const segments = buildTextSegments(sentence.text, sentence.annotations, {
                showVocab: settings.showVocabMarkers,
                showGrammar: settings.showGrammarMarkers,
                showExpression: settings.showExpressionMarkers,
                showBackground: settings.showBackgroundMarkers,
                currentChapterIndex: chapterIndex,
                maxReachedChapterIndex,
                allowSpoilers: settings.allowSpoilers,
              });
              const isBookmarked = Boolean(
                progress?.bookmarks.some(
                  (b) => b.chapterIndex === chapterIndex && b.sentenceId === sentence.id
                )
              );
              const isFavSent = readerState.favoriteSentences.some(
                (f) => f.workId === work.metadata.id && f.sentenceId === sentence.id
              );
              const isSearchHit = Boolean(
                searchQuery.trim() && sentence.text.includes(searchQuery.trim())
              );

              return (
                <div
                  key={sentence.id}
                  className={`reader-sentence-block ${
                    activeSentenceId === sentence.id ? 'active-listening' : ''
                  } ${isSearchHit ? 'active-search-hit' : ''}`}
                  data-sentence-id={sentence.id}
                >
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <div lang={work.metadata.script} style={{ flex: 1 }}>
                      {segments.map((seg) => {
                        if (seg.annotations.length === 0) {
                          return <span key={`${sentence.id}_${seg.start}`}>{seg.text}</span>;
                        }
                        const primaryKind = seg.kinds[0];
                        const isMasteredDim =
                          settings.dimMasteredVocab &&
                          seg.annotations.every((a) => {
                            if (a.kind !== 'vocab' || !a.vocab) return false;
                            const entry = glossaryMap.get(a.vocab.glossaryId);
                            return Boolean(entry?.relatedVocabId && masteredVocabIds.has(entry.relatedVocabId));
                          });

                        return (
                          <span
                            key={`${sentence.id}_${seg.start}_${seg.end}`}
                            role="button"
                            tabIndex={0}
                            className={`reader-seg reader-seg-interactive reader-seg-${primaryKind} ${
                              seg.annotations.length > 1 ? 'reader-seg-multi' : ''
                            } ${isMasteredDim ? 'reader-seg-dimmed' : ''}`}
                            data-testid={`ann-seg-${sentence.id}-${seg.start}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
                              handleSegmentActivate(seg.annotations, sentence, e.currentTarget);
                            }}
                            onMouseEnter={(e) => {
                              const el = e.currentTarget;
                              if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
                              hoverTimerRef.current = window.setTimeout(() => {
                                handleSegmentActivate(seg.annotations, sentence, el);
                              }, 380);
                            }}
                            onMouseLeave={() => {
                              if (hoverTimerRef.current) {
                                window.clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = null;
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSegmentActivate(seg.annotations, sentence, e.currentTarget);
                              }
                            }}
                          >
                            {seg.text}
                          </span>
                        );
                      })}
                    </div>

                    <div className="reader-sentence-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 6px' }}
                        title="この文を読み上げ"
                        onClick={() => {
                          if (activeSentenceId === sentence.id && isListeningPlaying) {
                            stopContinuousListening();
                          } else {
                            playSentenceAudio(sentence, () => setActiveSentenceId(null));
                          }
                        }}
                      >
                        {activeSentenceId === sentence.id && isListeningPlaying ? <Pause size={12} /> : <Volume2 size={12} />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 6px' }}
                        title="しおりに追加/解除"
                        data-testid={`bookmark-btn-${sentence.id}`}
                        onClick={() => {
                          if (isBookmarked) {
                            const bm = progress?.bookmarks.find((b) => b.sentenceId === sentence.id);
                            if (bm) {
                              setReaderState((p) => removeBookmarkFromWork(p, work.metadata.id, bm.id));
                              showToast('しおりを解除しました');
                            }
                          } else {
                            setReaderState((p) =>
                              addBookmarkToWork(p, work.metadata.id, chapterIndex, sentence.id, sentence.text)
                            );
                            showToast('しおりを保存しました');
                          }
                        }}
                      >
                        <Bookmark size={12} fill={isBookmarked ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 6px' }}
                        title="お気に入りの文として保存"
                        onClick={() => {
                          setReaderState((p) =>
                            toggleFavoriteSentence(p, {
                              workId: work.metadata.id,
                              workTitleZh: work.metadata.titleZh,
                              chapterIndex,
                              sentenceId: sentence.id,
                              text: sentence.text,
                              pinyin: sentence.pinyin,
                              translationJa: sentence.translationJa,
                            })
                          );
                          showToast(isFavSent ? 'お気に入り文を解除' : 'お気に入り文に保存しました');
                        }}
                      >
                        <Heart size={12} fill={isFavSent ? 'currentColor' : 'none'} color={isFavSent ? '#dc2626' : 'currentColor'} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 6px' }}
                        title="文をコピー（選択範囲優先）"
                        onClick={() => void copyText(sentence.text)}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {settings.showPinyin && (
                    <div className="reader-pinyin-line" data-testid={`pinyin-line-${sentence.id}`}>
                      {sentence.pinyin}
                    </div>
                  )}
                  {settings.showTranslation && (
                    <div className="reader-translation-line" data-testid={`translation-line-${sentence.id}`}>
                      {sentence.translationJa}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Chapter Footer Navigation */}
        <footer
          style={{
            marginTop: 32,
            paddingTop: 18,
            borderTop: '1px solid var(--r-border)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-sm"
            disabled={chapterIndex === 0}
            onClick={() => {
              stopContinuousListening();
              setChapterIndex((i) => Math.max(0, i - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            data-testid="reader-prev-chapter"
          >
            <ChevronLeft size={15} /> 前の章
          </button>

          <button
            type="button"
            className="btn btn-sm btn-soft"
            onClick={() => setDrawerTab('practice')}
          >
            第{currentChapter.number}章の語彙・読解を復習する
          </button>

          {chapterIndex < work.chapters.length - 1 ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                stopContinuousListening();
                setChapterIndex((i) => Math.min(work.chapters.length - 1, i + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              data-testid="reader-next-chapter"
            >
              次の章へ <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setReaderState((prev) =>
                  upsertWorkProgress(
                    prev,
                    work.metadata.id,
                    chapterIndex,
                    allSentences[allSentences.length - 1]?.id ?? null,
                    work.chapters.length,
                    true
                  )
                );
                showToast('読了を記録しました！お疲れさまでした。');
              }}
              data-testid="reader-complete-work"
            >
              {progress?.completed ? '読了済み（記録更新）' : 'この作品を読了として記録'}
            </button>
          )}
        </footer>
      </main>

      {/* Floating Annotation Popup */}
      {activePopup && (
        <AnnotationPopup
          annotations={activePopup.annotations}
          anchorRect={activePopup.anchorRect}
          glossaryMap={glossaryMap}
          speechSupported={speechSupport.supported}
          speechRate={settings.speechRate}
          isVocabInReview={isVocabInReview}
          onAddVocab={handleAddVocab}
          onAddGrammar={handleAddGrammar}
          onOpenSidePanel={(anns) => {
            setSidePanelAnnotations(anns);
            setActivePopup(null);
          }}
          onClose={() => setActivePopup(null)}
        />
      )}

      {/* Detail Slide-over Side Panel */}
      <AnnotationSidePanel
        annotations={sidePanelAnnotations}
        glossaryMap={glossaryMap}
        backgroundMap={backgroundMap}
        maxReachedChapterIndex={maxReachedChapterIndex}
        allowSpoilers={settings.allowSpoilers}
        speechSupported={speechSupport.supported}
        speechRate={settings.speechRate}
        isVocabInReview={isVocabInReview}
        onAddVocab={handleAddVocab}
        onAddGrammar={handleAddGrammar}
        onClose={() => setSidePanelAnnotations([])}
      />
    </div>
  );
};
