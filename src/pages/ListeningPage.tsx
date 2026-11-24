import React, { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { grammarPoints, vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import { filterByScope } from '../utils/scope';
import { speakChinese } from '../utils/speech';
import { normalizeChineseAnswer } from '../utils/diff';
import { ColoredPinyin } from '../components/ChineseText';

export const ListeningPage: React.FC = () => {
  const { userState, updateSettings, speechSupport, recordAnswer } = useApp();
  const [mode, setMode] = useState<'dictation' | 'meaning'>('dictation');
  const [idx, setIdx] = useState(0);
  const [dictInput, setDictInput] = useState('');
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const items = useMemo(() => {
    const scopedVocab = filterByScope(vocabulary, userState.scope);
    const list: { id: string; hanzi: string; pinyin: string; ja: string; lessonId: string; grammarIds: string[] }[] = [];
    for (const v of scopedVocab) {
      list.push({
        id: `LST-${v.id}`,
        hanzi: v.example.hanzi,
        pinyin: v.example.pinyin,
        ja: v.example.ja,
        lessonId: v.lessonId ?? 'L01',
        grammarIds: v.grammarIds,
      });
    }
    if (list.length === 0) {
      for (const g of grammarPoints.slice(0, 5)) {
        for (const ex of g.examples) {
          list.push({
            id: `LST-${ex.id}`,
            hanzi: ex.hanzi,
            pinyin: ex.pinyin,
            ja: ex.ja,
            lessonId: g.lessonId,
            grammarIds: [g.id],
          });
        }
      }
    }
    return list;
  }, [userState.scope]);

  const current = items[idx % Math.max(1, items.length)];

  const meaningChoices = useMemo(() => {
    if (!current) return [];
    const distractors = items
      .filter((x) => x.id !== current.id)
      .slice(0, 3)
      .map((x) => x.ja);
    return [current.ja, ...distractors].sort((a, b) => a.localeCompare(b));
  }, [current, items]);

  const handleSubmit = () => {
    if (!current) return;
    const ok =
      mode === 'dictation'
        ? normalizeChineseAnswer(dictInput) === normalizeChineseAnswer(current.hanzi)
        : selectedMeaning === current.ja;
    setIsCorrect(ok);
    setSubmitted(true);
    recordAnswer({
      itemId: current.id,
      itemKind: 'listening',
      lessonId: current.lessonId,
      grammarIds: current.grammarIds,
      correct: ok,
      userAnswer: mode === 'dictation' ? dictInput : selectedMeaning,
    });
  };

  const next = () => {
    setIdx((i) => i + 1);
    setDictInput('');
    setSelectedMeaning('');
    setSubmitted(false);
    setIsCorrect(false);
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0 }}>音声・リスニング練習</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Web Speech API を用いてサーバーレスで中国語例文を読み上げ、ディクテーションと意味選択を練習できます。
          </p>
        </div>
        <div className="row-wrap">
          <label htmlFor="speech-rate" style={{ fontSize: '0.86rem' }}>
            再生速度: {userState.settings.speechRate.toFixed(1)}x
          </label>
          <input
            id="speech-rate"
            type="range"
            min={0.5}
            max={1.4}
            step={0.1}
            value={userState.settings.speechRate}
            onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
          />
        </div>
      </div>

      {!speechSupport.supported ? (
        <div className="banner banner-danger stack-sm" data-testid="speech-unavailable-banner">
          <strong>中国語音声読み上げ機能が利用できません</strong>
          <p style={{ margin: 0 }}>{speechSupport.reason}</p>
          <p style={{ margin: 0, fontSize: '0.86rem' }}>
            ※ リスニング練習は無効化されていますが、課別学習・文法辞典・単語帳・ピンイン・文法問題・作文練習は引き続き利用できます。
          </p>
        </div>
      ) : (
        <>
          <div className="row-wrap">
            <button
              type="button"
              className={`btn btn-sm ${mode === 'dictation' ? 'btn-primary' : ''}`}
              onClick={() => { setMode('dictation'); setSubmitted(false); }}
            >
              ディクテーション（中国語入力）
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'meaning' ? 'btn-primary' : ''}`}
              onClick={() => { setMode('meaning'); setSubmitted(false); }}
            >
              音声を聞いて意味を選ぶ
            </button>
          </div>

          {current && (
            <div className="card stack-md">
              <div className="row-between">
                <span className="badge badge-accent">{current.lessonId}</span>
                <span className="badge">第 {(idx % items.length) + 1} 問</span>
              </div>

              <div className="row-wrap">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => speakChinese(current.hanzi, userState.settings.speechRate)}
                >
                  <Volume2 size={18} /> 音声を再生する
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => speakChinese(current.hanzi, Math.max(0.5, userState.settings.speechRate - 0.25))}
                >
                  <Volume2 size={16} /> ゆっくり再生
                </button>
              </div>

              {mode === 'dictation' ? (
                <div className="stack-sm">
                  <label htmlFor="dict-input">聞き取った中国語を簡体字で入力してください:</label>
                  <input
                    id="dict-input"
                    type="text"
                    className="input zh-lg"
                    lang="zh-Hans"
                    value={dictInput}
                    disabled={submitted}
                    onChange={(e) => setDictInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !submitted && dictInput.trim()) handleSubmit();
                    }}
                  />
                </div>
              ) : (
                <div className="stack-sm">
                  {meaningChoices.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className={`choice-btn ${selectedMeaning === ch ? 'selected' : ''}`}
                      disabled={submitted}
                      onClick={() => setSelectedMeaning(ch)}
                    >
                      <span>{ch}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="row-wrap">
                {!submitted ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={mode === 'dictation' ? !dictInput.trim() : !selectedMeaning}
                    onClick={handleSubmit}
                  >
                    解答を確認する
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={next}>
                    次の問題へ
                  </button>
                )}
              </div>

              {submitted && (
                <div className={`banner ${isCorrect ? 'banner-success' : 'banner-danger'} stack-sm`}>
                  <strong>{isCorrect ? '正解です！' : '不正解です'}</strong>
                  <div className="zh-lg" lang="zh-Hans">{current.hanzi}</div>
                  <ColoredPinyin pinyin={current.pinyin} toneColors={userState.settings.toneColors} />
                  <div>意味: {current.ja}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
