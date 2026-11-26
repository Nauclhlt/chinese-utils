import React, { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { lessons, pronunciationData, vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import { filterByScope } from '../utils/scope';
import {
  applyToneMark,
  describeToneSandhi,
  isPinyinEquivalent,
  parseSyllable,
  splitPinyinSyllables,
} from '../utils/pinyin';
import { speakChinese } from '../utils/speech';
import { createShuffleSeed, shuffleWithSeed } from '../utils/shuffle';
import { ColoredPinyin } from '../components/ChineseText';
import { OrderControls } from '../components/OrderControls';

type PinyinMode =
  | 'input-pinyin'
  | 'pinyin-mc'
  | 'select-tones'
  | 'mark-tones'
  | 'pinyin-to-hanzi'
  | 'similar-pairs'
  | 'audio-tone'
  | 'sandhi-guide';

type PinyinScopeMode = 'scope' | 'upTo' | 'customLessons' | 'single' | 'all';

const MODES: { id: PinyinMode; label: string }[] = [
  { id: 'input-pinyin', label: '1. 漢字→ピンイン入力' },
  { id: 'pinyin-mc', label: '2. ピンイン四択' },
  { id: 'select-tones', label: '3. 各音節の声調選択' },
  { id: 'mark-tones', label: '4. ピンインに声調記号を付ける' },
  { id: 'pinyin-to-hanzi', label: '5. ピンイン→漢字選択' },
  { id: 'similar-pairs', label: '6. 似た発音の区別' },
  { id: 'audio-tone', label: '7. 音声→声調判別' },
  { id: 'sandhi-guide', label: '声調・変調ガイド' },
];

export const PinyinPracticePage: React.FC = () => {
  const { userState, recordAnswer, speechSupport } = useApp();
  const [mode, setMode] = useState<PinyinMode>('input-pinyin');
  const [idx, setIdx] = useState(0);

  const [scopeMode, setScopeMode] = useState<PinyinScopeMode>('scope');
  const [upToN, setUpToN] = useState(userState.scope.upToLesson);
  const [customLessons, setCustomLessons] = useState<string[]>(['L01']);
  const [singleLesson, setSingleLesson] = useState<string>('L01');

  const [randomOrder, setRandomOrder] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(() => createShuffleSeed());

  const [pinyinInput, setPinyinInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState('');
  const [toneSelections, setToneSelections] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const resetQuestion = (nextIdx: number) => {
    setIdx(nextIdx);
    setPinyinInput('');
    setSelectedChoice('');
    setToneSelections([]);
    setSubmitted(false);
    setIsCorrect(false);
  };

  const applyScopeFilter = <T extends { lessonId: string | null; minLesson?: number }>(items: T[]): T[] => {
    if (scopeMode === 'all') return items;
    if (scopeMode === 'scope') return filterByScope(items, userState.scope);
    if (scopeMode === 'upTo') {
      return filterByScope(items, { mode: 'upTo', upToLesson: upToN, selectedLessons: [] });
    }
    if (scopeMode === 'single') {
      return items.filter((item) => item.lessonId === singleLesson);
    }
    return items.filter((item) => item.lessonId !== null && customLessons.includes(item.lessonId));
  };

  const baseVocabPool = useMemo(
    () => applyScopeFilter(vocabulary),
    [scopeMode, userState.scope, upToN, singleLesson, customLessons]
  );

  const vocabPool = useMemo(
    () => (randomOrder ? shuffleWithSeed(baseVocabPool, shuffleSeed) : baseVocabPool),
    [baseVocabPool, randomOrder, shuffleSeed]
  );

  const basePairDrills = useMemo(
    () => applyScopeFilter(pronunciationData.pairDrills),
    [scopeMode, userState.scope, upToN, singleLesson, customLessons]
  );

  const pairDrills = useMemo(
    () => (randomOrder ? shuffleWithSeed(basePairDrills, shuffleSeed) : basePairDrills),
    [basePairDrills, randomOrder, shuffleSeed]
  );

  const singleToneList = useMemo(() => {
    const ones = vocabPool.filter((v) => v.tones.length === 1);
    return ones.length > 0 ? ones : vocabPool;
  }, [vocabPool]);

  const currentVocab = vocabPool.length > 0 ? vocabPool[idx % vocabPool.length] : undefined;
  const currentPair = pairDrills.length > 0 ? pairDrills[idx % pairDrills.length] : undefined;
  const singleToneVocab =
    singleToneList.length > 0 ? singleToneList[idx % singleToneList.length] : undefined;

  const activePoolLength =
    mode === 'similar-pairs'
      ? pairDrills.length
      : mode === 'audio-tone'
      ? singleToneList.length
      : vocabPool.length;

  // Generate deterministic distractors for multiple choice modes
  const mcChoices = useMemo(() => {
    if (!currentVocab) return [];
    const syls = splitPinyinSyllables(currentVocab.pinyin).map(parseSyllable);
    const correct = currentVocab.pinyin;
    const variants = new Set<string>([correct]);
    for (let t = 1; t <= 4; t++) {
      const mod = syls
        .map((s, sIdx) => (sIdx === 0 ? applyToneMark(s.base, t as 1 | 2 | 3 | 4) : s.marked))
        .join(' ');
      variants.add(mod);
    }
    if (syls.length > 1) {
      const mod2 = syls
        .map((s, sIdx) =>
          sIdx === 1 ? applyToneMark(s.base, ((s.tone % 4) + 1) as 1 | 2 | 3 | 4) : s.marked
        )
        .join(' ');
      variants.add(mod2);
    }
    return Array.from(variants).slice(0, 4).sort((a, b) => a.localeCompare(b));
  }, [currentVocab]);

  const hanziChoices = useMemo(() => {
    if (!currentVocab) return [];
    const pool = vocabPool.filter((v) => v.id !== currentVocab.id);
    const fallback = pool.length >= 3 ? pool : vocabulary.filter((v) => v.id !== currentVocab.id);
    const distractors = fallback.slice(0, 3).map((v) => v.hanzi);
    return [currentVocab.hanzi, ...distractors].sort((a, b) => a.localeCompare(b));
  }, [currentVocab, vocabPool]);

  const syllableList = useMemo(
    () => (currentVocab ? splitPinyinSyllables(currentVocab.pinyin).map(parseSyllable) : []),
    [currentVocab]
  );

  const toggleLessonChip = (id: string) => {
    setCustomLessons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    resetQuestion(0);
  };

  const handleSubmit = () => {
    if (mode === 'similar-pairs' && !currentPair) return;
    if (mode === 'audio-tone' && !singleToneVocab) return;
    if (mode !== 'similar-pairs' && mode !== 'audio-tone' && !currentVocab) return;

    let ok = false;
    let userAns = '';

    if (mode === 'input-pinyin' && currentVocab) {
      ok = isPinyinEquivalent(pinyinInput, currentVocab.pinyin);
      userAns = pinyinInput;
    } else if (mode === 'pinyin-mc' && currentVocab) {
      ok = isPinyinEquivalent(selectedChoice, currentVocab.pinyin);
      userAns = selectedChoice;
    } else if (mode === 'pinyin-to-hanzi' && currentVocab) {
      ok = selectedChoice === currentVocab.hanzi;
      userAns = selectedChoice;
    } else if ((mode === 'select-tones' || mode === 'mark-tones') && currentVocab) {
      ok =
        syllableList.length > 0 &&
        syllableList.every((s, i) => toneSelections[i] === s.tone);
      userAns = toneSelections.join('-');
    } else if (mode === 'similar-pairs' && currentPair) {
      ok = selectedChoice === currentPair.target;
      userAns = selectedChoice;
    } else if (mode === 'audio-tone' && singleToneVocab) {
      ok = Number(selectedChoice) === singleToneVocab.tones[0];
      userAns = selectedChoice;
    }

    setIsCorrect(ok);
    setSubmitted(true);
    const targetItem =
      mode === 'similar-pairs'
        ? currentPair!
        : mode === 'audio-tone'
        ? singleToneVocab!
        : currentVocab!;

    recordAnswer({
      itemId: targetItem.id,
      itemKind: 'pinyin',
      lessonId: targetItem.lessonId ?? 'L01',
      grammarIds: 'grammarIds' in targetItem ? targetItem.grammarIds : ['GP-01'],
      correct: ok,
      userAnswer: userAns,
    });
  };

  const activeVocab = mode === 'audio-tone' ? singleToneVocab : currentVocab;

  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <header className="page-header">
        <div>
          <h2 className="page-title">ピンイン・声調練習</h2>
          <p className="page-subtitle">声調記号（nǐ hǎo）・数字（ni3 hao3 / lv4 / lu:4 / 軽声5）対応</p>
        </div>
      </header>

      <div className="tabs-bar" role="tablist" aria-label="練習モード">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`tab-btn ${mode === m.id ? 'active' : ''}`}
              disabled={m.id === 'audio-tone' && !speechSupport.supported}
              onClick={() => {
                setMode(m.id);
                resetQuestion(0);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode !== 'sandhi-guide' && (
          <div className="stack-sm" style={{ paddingTop: 12 }}>
            <div className="grid-2">
              <div className="row-wrap">
                <label htmlFor="pinyin-scope-mode" style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                  出題範囲:
                </label>
                <select
                  id="pinyin-scope-mode"
                  className="select"
                  aria-label="ピンイン出題範囲"
                  style={{ maxWidth: 260 }}
                  value={scopeMode}
                  onChange={(e) => {
                    setScopeMode(e.target.value as PinyinScopeMode);
                    resetQuestion(0);
                  }}
                >
                  <option value="scope">現在の学習範囲設定に従う</option>
                  <option value="upTo">第1課〜第N課まで</option>
                  <option value="single">特定の1課のみ</option>
                  <option value="customLessons">任意の課を組み合わせ</option>
                  <option value="all">全課・補足語彙すべて</option>
                </select>

                {scopeMode === 'single' && (
                  <select
                    className="select"
                    aria-label="対象課を選択"
                    style={{ maxWidth: 160 }}
                    value={singleLesson}
                    onChange={(e) => {
                      setSingleLesson(e.target.value);
                      resetQuestion(0);
                    }}
                  >
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="row-between">
                <OrderControls
                  randomOrder={randomOrder}
                  onToggleRandom={() => {
                    setRandomOrder((prev) => {
                      const next = !prev;
                      if (next) setShuffleSeed(createShuffleSeed());
                      return next;
                    });
                    resetQuestion(0);
                  }}
                  onReshuffle={() => {
                    setShuffleSeed(createShuffleSeed());
                    resetQuestion(0);
                  }}
                />
                <div className="row-wrap">
                  <span className="badge" data-testid="pinyin-pool-count">
                    対象 {activePoolLength} 件
                  </span>
                  {activePoolLength > 0 && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          resetQuestion((idx - 1 + activePoolLength) % activePoolLength)
                        }
                      >
                        前へ
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => resetQuestion((idx + 1) % activePoolLength)}
                      >
                        次へ
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {scopeMode === 'upTo' && (
              <div className="row-wrap">
                <label htmlFor="pinyin-upto">第1課〜第{upToN}課まで:</label>
                <input
                  id="pinyin-upto"
                  type="range"
                  min={1}
                  max={22}
                  value={upToN}
                  onChange={(e) => {
                    setUpToN(Number(e.target.value));
                    resetQuestion(0);
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
          </div>
        )}

      {mode === 'sandhi-guide' ? (
        <div className="stack-md">
          {pronunciationData.sandhiRules.map((rule) => (
            <div key={rule.id} className="card stack-sm">
              <h3 style={{ margin: 0 }}>{rule.title}</h3>
              <p style={{ margin: 0 }}>{rule.description}</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>漢字</th>
                      <th>本来の声調（本調）</th>
                      <th>実際の発音（変調後）</th>
                      <th>意味・解説</th>
                      <th>音声</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule.examples.map((ex, i) => (
                      <tr key={i}>
                        <td className="zh-md" lang="zh-Hans">{ex.hanzi}</td>
                        <td>{ex.originalPinyin}</td>
                        <td><strong>{ex.spokenPinyin}</strong></td>
                        <td>{ex.ja} — <span style={{ color: 'var(--text-muted)' }}>{ex.note}</span></td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={!speechSupport.supported}
                            onClick={() => speakChinese(ex.hanzi, userState.settings.speechRate)}
                          >
                            <Volume2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : activePoolLength === 0 ? (
        <div className="card">
          選択した範囲に該当する問題がありません。学習範囲を広げるか、別の課を選択してください。
        </div>
      ) : (
        <div className="card stack-md" data-testid="pinyin-drill-card">
          <div className="row-between">
            <span className="badge badge-accent">
              {mode === 'similar-pairs'
                ? currentPair?.lessonId
                : activeVocab?.lessonId ?? '補足'}
            </span>
            <span className="badge">
              第 {(idx % activePoolLength) + 1} / {activePoolLength} 問
            </span>
          </div>

          {mode === 'input-pinyin' && currentVocab && (
            <div className="stack-md">
              <div className="row-between">
                <div>
                  <div className="zh-xl" lang="zh-Hans">{currentVocab.hanzi}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{currentVocab.meaningJa}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!speechSupport.supported}
                  onClick={() => speakChinese(currentVocab.hanzi, userState.settings.speechRate)}
                >
                  <Volume2 size={14} /> 音声
                </button>
              </div>
              <input
                type="text"
                className="input"
                placeholder="例: ni3 hao3 または nǐ hǎo（ü は v や u: も可）"
                value={pinyinInput}
                disabled={submitted}
                onChange={(e) => setPinyinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !submitted && pinyinInput.trim()) handleSubmit();
                }}
              />
            </div>
          )}

          {mode === 'pinyin-mc' && currentVocab && (
            <div className="stack-md">
              <div>
                <div className="zh-xl" lang="zh-Hans">{currentVocab.hanzi}</div>
                <div style={{ color: 'var(--text-muted)' }}>{currentVocab.meaningJa}</div>
              </div>
              <div className="grid-2">
                {mcChoices.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    className={`choice-btn ${selectedChoice === ch ? 'selected' : ''}`}
                    disabled={submitted}
                    onClick={() => setSelectedChoice(ch)}
                  >
                    <span>{ch}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(mode === 'select-tones' || mode === 'mark-tones') && currentVocab && (
            <div className="stack-md">
              <div>
                <div className="zh-xl" lang="zh-Hans">{currentVocab.hanzi}</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {mode === 'select-tones'
                    ? '各音節の「本来の声調（1〜4・軽声5）」を選択してください。'
                    : '無標のピンインに正しい声調記号を付けてください（各音節の声調を選択）。'}
                </div>
              </div>
              {syllableList.map((syl, sIdx) => (
                <div key={sIdx} className="card-subtle row-between">
                  <strong style={{ fontSize: '1.1rem' }}>
                    {mode === 'mark-tones'
                      ? toneSelections[sIdx]
                        ? applyToneMark(syl.base, toneSelections[sIdx] as 1 | 2 | 3 | 4 | 5)
                        : syl.base
                      : `${sIdx + 1}音節目 (${syl.base})`}
                  </strong>
                  <div className="row-wrap">
                    {[1, 2, 3, 4, 5].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`btn btn-sm ${toneSelections[sIdx] === t ? 'btn-primary' : ''}`}
                        disabled={submitted}
                        onClick={() => {
                          const next = [...toneSelections];
                          next[sIdx] = t;
                          setToneSelections(next);
                        }}
                      >
                        {mode === 'mark-tones'
                          ? applyToneMark(syl.base, t as 1 | 2 | 3 | 4 | 5)
                          : t === 5
                          ? '軽声'
                          : `第${t}声`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mode === 'pinyin-to-hanzi' && currentVocab && (
            <div className="stack-md">
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  <ColoredPinyin pinyin={currentVocab.pinyin} toneColors={userState.settings.toneColors} />
                </div>
                <div style={{ color: 'var(--text-muted)' }}>意味: {currentVocab.meaningJa}</div>
              </div>
              <div className="grid-2">
                {hanziChoices.map((hz) => (
                  <button
                    key={hz}
                    type="button"
                    className={`choice-btn ${selectedChoice === hz ? 'selected' : ''}`}
                    disabled={submitted}
                    onClick={() => setSelectedChoice(hz)}
                  >
                    <span className="zh-lg" lang="zh-Hans">{hz}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'similar-pairs' && currentPair && (
            <div className="stack-md">
              <div style={{ fontWeight: 600 }}>{currentPair.prompt}</div>
              <div className="grid-2">
                {(['A', 'B'] as const).map((optKey) => {
                  const opt = optKey === 'A' ? currentPair.optionA : currentPair.optionB;
                  return (
                    <button
                      key={optKey}
                      type="button"
                      className={`choice-btn ${selectedChoice === optKey ? 'selected' : ''}`}
                      disabled={submitted}
                      onClick={() => setSelectedChoice(optKey)}
                    >
                      <div>
                        <div className="zh-lg" lang="zh-Hans">{opt.hanzi}</div>
                        <div className="pinyin-text">{opt.pinyin}</div>
                      </div>
                      <span>{optKey}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'audio-tone' && singleToneVocab && (
            <div className="stack-md">
              <div className="row-wrap">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!speechSupport.supported}
                  onClick={() => speakChinese(singleToneVocab.hanzi, userState.settings.speechRate)}
                >
                  <Volume2 size={18} /> 音声を聞いて声調を判別する
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  （ヒント: 意味「{singleToneVocab.meaningJa}」）
                </span>
              </div>
              <div className="row-wrap">
                {[1, 2, 3, 4].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${selectedChoice === String(t) ? 'btn-primary' : ''}`}
                    disabled={submitted}
                    onClick={() => setSelectedChoice(String(t))}
                  >
                    第{t}声
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="row-wrap">
            {!submitted ? (
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                判定する
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => resetQuestion((idx + 1) % activePoolLength)}
              >
                次の問題へ
              </button>
            )}
          </div>

          {submitted && (
            <div className={`banner ${isCorrect ? 'banner-success' : 'banner-danger'} stack-sm`}>
              <strong>{isCorrect ? '正解です！' : '不正解です'}</strong>
              {mode === 'similar-pairs' && currentPair ? (
                <p style={{ margin: 0 }}>{currentPair.explanation}</p>
              ) : activeVocab ? (
                <>
                  <div>
                    正解:{' '}
                    <span className="zh-md" lang="zh-Hans" style={{ marginRight: 8 }}>
                      {activeVocab.hanzi}
                    </span>
                    <strong>{activeVocab.pinyin}</strong>
                    （声調: {activeVocab.tones.join('-')}）
                  </div>
                  {describeToneSandhi(activeVocab.hanzi, activeVocab.pinyin) && (
                    <div style={{ fontSize: '0.86rem' }}>
                      <strong>変調注意:</strong> {describeToneSandhi(activeVocab.hanzi, activeVocab.pinyin)}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
