import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import { vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import { filterByScope } from '../utils/scope';
import { sortByReviewPriority } from '../utils/srs';
import { speakChinese } from '../utils/speech';
import { createShuffleSeed, shuffleWithSeed } from '../utils/shuffle';
import { ColoredPinyin } from '../components/ChineseText';
import { OrderControls } from '../components/OrderControls';
import type { SrsRating } from '../types/user';

type Direction =
  | 'zh-to-ja'
  | 'ja-to-zh'
  | 'zh-to-pinyin'
  | 'pinyin-to-zh'
  | 'zh-to-tone'
  | 'audio-to-zh-ja';

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: 'zh-to-ja', label: '中国語 → 日本語' },
  { id: 'ja-to-zh', label: '日本語 → 中国語' },
  { id: 'zh-to-pinyin', label: '中国語 → ピンイン' },
  { id: 'pinyin-to-zh', label: 'ピンイン → 中国語' },
  { id: 'zh-to-tone', label: '中国語 → 声調' },
  { id: 'audio-to-zh-ja', label: '音声 → 中国語・日本語' },
];

export const FlashcardsPage: React.FC = () => {
  const { userState, rateSrsItem, recordAnswer, speechSupport } = useApp();
  const [direction, setDirection] = useState<Direction>('zh-to-ja');
  const [onlyFav, setOnlyFav] = useState(false);
  const [randomOrder, setRandomOrder] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(() => createShuffleSeed());
  const [flipped, setFlipped] = useState(false);
  const [index, setIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  const deck = useMemo(() => {
    let base = filterByScope(vocabulary, userState.scope);
    if (onlyFav) {
      base = base.filter((v) => userState.favoritesVocab.includes(v.id));
    }
    return randomOrder ? shuffleWithSeed(base, shuffleSeed) : sortByReviewPriority(base, userState.srs);
  }, [userState.scope, onlyFav, userState.favoritesVocab, userState.srs, randomOrder, shuffleSeed]);

  const current = deck[index % Math.max(1, deck.length)];

  useEffect(() => {
    setFlipped(false);
  }, [current?.id, direction]);

  const handleRate = (rating: SrsRating) => {
    if (!current) return;
    rateSrsItem(current.id, 'vocab', rating);
    recordAnswer({
      itemId: current.id,
      itemKind: 'flashcard',
      lessonId: current.lessonId ?? 'L01',
      grammarIds: current.grammarIds,
      correct: rating === 'good' || rating === 'easy',
      userAnswer: rating,
    });
    setReviewedCount((c) => c + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key.toLowerCase() === 'a' && current && speechSupport.supported) {
        speakChinese(current.hanzi, userState.settings.speechRate);
      } else if (flipped) {
        if (e.key === '1') handleRate('again');
        if (e.key === '2') handleRate('hard');
        if (e.key === '3') handleRate('good');
        if (e.key === '4') handleRate('easy');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!current) {
    return (
      <div className="card stack-md">
        <h2 style={{ margin: 0 }}>フラッシュカード</h2>
        <p>対象となる単語がありません。学習範囲やお気に入りフィルタを調整してください。</p>
      </div>
    );
  }

  const srsRec = userState.srs[current.id];

  const renderFront = () => {
    switch (direction) {
      case 'zh-to-ja':
      case 'zh-to-pinyin':
      case 'zh-to-tone':
        return (
          <div className="zh-xl" lang="zh-Hans" style={{ fontSize: '2.4rem' }}>
            {current.hanzi}
          </div>
        );
      case 'ja-to-zh':
        return <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{current.meaningJa}</div>;
      case 'pinyin-to-zh':
        return (
          <div style={{ fontSize: '1.8rem' }}>
            <ColoredPinyin pinyin={current.pinyin} toneColors={userState.settings.toneColors} />
          </div>
        );
      case 'audio-to-zh-ja':
        return (
          <div className="stack-md" style={{ alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!speechSupport.supported}
              onClick={(e) => {
                e.stopPropagation();
                speakChinese(current.hanzi, userState.settings.speechRate);
              }}
            >
              <Volume2 size={20} /> 音声を再生 (Aキー)
            </button>
            {!speechSupport.supported && (
              <span style={{ color: 'var(--danger)', fontSize: '0.86rem' }}>
                {speechSupport.reason}
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0 }}>フラッシュカード（間隔反復SRS）</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            習熟度と復習間隔に応じて苦手な単語・忘却時期の単語を優先出題します（Spaceで反転 / 1〜4で評価）。
          </p>
        </div>
        <span className="badge badge-accent">今回復習: {reviewedCount} 語 / デッキ {deck.length} 語</span>
      </div>

      <div className="card stack-sm">
        <div className="row-between">
          <div className="row-wrap">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`btn btn-sm ${direction === d.id ? 'btn-primary' : ''}`}
                disabled={d.id === 'audio-to-zh-ja' && !speechSupport.supported}
                onClick={() => setDirection(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="row-wrap">
            <OrderControls
              randomOrder={randomOrder}
              sequentialLabel="SRS優先"
              onToggleRandom={() => {
                setRandomOrder((prev) => {
                  const next = !prev;
                  if (next) setShuffleSeed(createShuffleSeed());
                  return next;
                });
                setIndex(0);
              }}
              onReshuffle={() => {
                setShuffleSeed(createShuffleSeed());
                setIndex(0);
              }}
            />
            <button
              type="button"
              className={`btn btn-sm ${onlyFav ? 'btn-soft' : ''}`}
              onClick={() => setOnlyFav((x) => !x)}
            >
              お気に入りのみ
            </button>
          </div>
        </div>
      </div>

      <div
        className="card stack-md"
        style={{ minHeight: 280, justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setFlipped((f) => !f)}
        data-testid="flashcard-surface"
      >
        <div className="row-between">
          <div className="row-wrap">
            <span className="badge badge-accent">{current.lessonId ?? '補足'}</span>
            <span className="badge">{current.pos}</span>
            <span className="badge">習熟度: {srsRec?.mastery ?? 0}%</span>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            {DIRECTIONS.find((d) => d.id === direction)?.label}
          </span>
        </div>

        <div style={{ textAlign: 'center', padding: '24px 10px' }}>
          {renderFront()}
          {flipped && (
            <div
              className="card-subtle stack-sm"
              style={{ marginTop: 22, textAlign: 'left' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="row-between">
                <div>
                  <span className="zh-lg" lang="zh-Hans" style={{ marginRight: 12 }}>
                    {current.hanzi}
                  </span>
                  <ColoredPinyin pinyin={current.pinyin} toneColors={userState.settings.toneColors} />
                  <span className="badge" style={{ marginLeft: 8 }}>
                    声調: {current.tones.join(' - ')}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!speechSupport.supported}
                  onClick={() => speakChinese(current.hanzi, userState.settings.speechRate)}
                >
                  <Volume2 size={14} /> 再生
                </button>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{current.meaningJa}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                例文: <span lang="zh-Hans">{current.example.hanzi}</span> ({current.example.pinyin}) —{' '}
                {current.example.ja}
              </div>
            </div>
          )}
        </div>

        {!flipped ? (
          <div style={{ textAlign: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={(e) => { e.stopPropagation(); setFlipped(true); }}>
              答えを見る (Space)
            </button>
          </div>
        ) : (
          <div className="row-wrap" style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-danger" onClick={() => handleRate('again')}>
              1. 覚えていない (すぐ復習)
            </button>
            <button type="button" className="btn" onClick={() => handleRate('hard')}>
              2. 曖昧 (短めに復習)
            </button>
            <button type="button" className="btn btn-soft" onClick={() => handleRate('good')}>
              3. 覚えた (通常間隔)
            </button>
            <button type="button" className="btn btn-primary" onClick={() => handleRate('easy')}>
              4. 余裕 (長期間隔)
            </button>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button type="button" className="btn btn-sm" onClick={() => setIndex((i) => i + 1)}>
          <RotateCcw size={14} /> スキップして次へ
        </button>
      </div>
    </div>
  );
};
