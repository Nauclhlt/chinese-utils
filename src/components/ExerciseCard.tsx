import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import type { ExerciseItem } from '../types/curriculum';
import { grammarMap } from '../data';
import { ColoredPinyin, SpeakButton } from './ChineseText';
import { useApp } from '../context/AppContext';

export function exerciseTypeLabel(type: ExerciseItem['type']): string {
  switch (type) {
    case 'fill-blank': return '穴埋め';
    case 'multiple-choice': return '選択問題';
    case 'word-order': return '語順整序';
    case 'error-correction': return '誤文訂正';
    case 'true-false': return '正誤判定';
    case 'distinction': return '類似表現の使い分け';
    case 'combined': return '複数文法応用';
  }
}

interface Props {
  exercise: ExerciseItem;
  onAnswered?: (correct: boolean, userAnswer: string) => void;
  onNext?: () => void;
  examMode?: boolean;
  initialUserAnswer?: string;
  hideResultUntilSubmit?: boolean;
}

function normalizeTextAnswer(s: string): string {
  return s
    .normalize('NFC')
    .trim()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，,。．.！!？?、；;：:""“”''‘’（）()]/g, '');
}

export const ExerciseCard: React.FC<Props> = ({
  exercise,
  onAnswered,
  onNext,
  examMode = false,
  initialUserAnswer = '',
}) => {
  const { userState, recordAnswer } = useApp();
  const [textAnswer, setTextAnswer] = useState(initialUserAnswer);
  const [selectedChoice, setSelectedChoice] = useState(initialUserAnswer);
  const [orderedIndices, setOrderedIndices] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Shuffle word-order tokens deterministically by exercise id if needed, keeping stable per question
  const shuffledTokens = useMemo(() => {
    if (!exercise.tokens) return [];
    const arr = exercise.tokens.map((t, i) => ({ text: t, origIdx: i }));
    // Deterministic Fisher-Yates using id hash
    let seed = [...exercise.id].reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Ensure not already identical to original order if >= 2 tokens
    if (arr.length >= 2 && arr.every((item, idx) => item.origIdx === idx)) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  }, [exercise]);

  useEffect(() => {
    setTextAnswer(initialUserAnswer);
    setSelectedChoice(initialUserAnswer);
    setOrderedIndices([]);
    setSubmitted(false);
    setIsCorrect(false);
  }, [exercise.id, initialUserAnswer]);

  const expectedStr = Array.isArray(exercise.answer)
    ? exercise.answer.join('')
    : String(exercise.answer);

  const currentAnswerStr =
    exercise.type === 'word-order'
      ? orderedIndices.map((idx) => shuffledTokens[idx]?.text ?? '').join('')
      : exercise.choices && exercise.choices.length > 0
      ? selectedChoice
      : textAnswer;

  const canSubmit =
    exercise.type === 'word-order'
      ? orderedIndices.length === shuffledTokens.length
      : currentAnswerStr.trim().length > 0;

  const handleSubmit = (overrideChoice?: string) => {
    if (submitted && !examMode) return;
    const rawAns = overrideChoice ?? currentAnswerStr;
    if (!rawAns.trim()) return;

    const candidates = [expectedStr, ...(exercise.acceptableAnswers ?? [])].map(normalizeTextAnswer);
    const ok = candidates.includes(normalizeTextAnswer(rawAns));
    setIsCorrect(ok);
    setSubmitted(true);

    if (!examMode) {
      recordAnswer({
        itemId: exercise.id,
        itemKind: 'exercise',
        lessonId: exercise.lessonId,
        grammarIds: exercise.grammarIds,
        correct: ok,
        userAnswer: rawAns,
      });
    }
    onAnswered?.(ok, rawAns);
  };

  // Keyboard shortcuts for choice selection and next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        if (e.key === 'Enter' && submitted && onNext && !examMode) {
          e.preventDefault();
          onNext();
        }
        return;
      }
      if (exercise.choices && exercise.choices.length > 0 && !submitted) {
        const num = Number(e.key);
        if (num >= 1 && num <= exercise.choices.length) {
          const val = exercise.choices[num - 1];
          setSelectedChoice(val);
          handleSubmit(val);
        }
      } else if (e.key === 'Enter' && submitted && onNext && !examMode) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="card stack-md" data-testid={`exercise-card-${exercise.id}`}>
      <div className="row-between">
        <div className="row-wrap">
          <span className="badge badge-accent">{exerciseTypeLabel(exercise.type)}</span>
          <span className="badge">{exercise.lessonId}</span>
          <span className="badge">難易度 {exercise.difficulty}</span>
          {exercise.isLessonComprehensive && <span className="badge badge-warning">課総合</span>}
        </div>
        <div className="row-wrap">
          {exercise.grammarIds.map((gid) => {
            const g = grammarMap.get(gid);
            return (
              <Link key={gid} to={`/grammar/${gid}`} className="badge" style={{ textDecoration: 'none' }}>
                {g ? g.title : gid}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="stack-sm">
        <div className="row-between">
          <div className="zh-lg" lang="zh-Hans" style={{ whiteSpace: 'pre-wrap' }}>
            {exercise.prompt}
          </div>
          {!/____|（\s*）/.test(exercise.prompt) && <SpeakButton text={exercise.prompt} />}
        </div>
        {userState.settings.showPinyin && exercise.promptPinyin && (
          <ColoredPinyin pinyin={exercise.promptPinyin} toneColors={userState.settings.toneColors} />
        )}
        {exercise.promptJa && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{exercise.promptJa}</div>
        )}
      </div>

      {/* Input UI by type */}
      {exercise.type === 'word-order' ? (
        <div className="stack-sm">
          <div
            className="card-subtle"
            style={{ minHeight: 54, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
            aria-label="組み立てた語順"
          >
            {orderedIndices.length === 0 ? (
              <span style={{ color: 'var(--text-light)', fontSize: '0.88rem' }}>
                下の語句カードをクリックして正しい中国語の語順に並べてください
              </span>
            ) : (
              orderedIndices.map((tokIdx, pos) => (
                <button
                  key={`${tokIdx}-${pos}`}
                  type="button"
                  className="token-chip"
                  disabled={submitted && !examMode}
                  onClick={() => setOrderedIndices((prev) => prev.filter((_, i) => i !== pos))}
                >
                  {shuffledTokens[tokIdx]?.text}
                </button>
              ))
            )}
          </div>
          <div className="row-wrap">
            {shuffledTokens.map((tok, idx) => {
              const used = orderedIndices.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className="token-chip"
                  disabled={used || (submitted && !examMode)}
                  style={{ opacity: used ? 0.35 : 1 }}
                  onClick={() => setOrderedIndices((prev) => [...prev, idx])}
                >
                  {tok.text}
                </button>
              );
            })}
            {orderedIndices.length > 0 && (!submitted || examMode) && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setOrderedIndices([])}
              >
                <RotateCcw size={14} /> リセット
              </button>
            )}
          </div>
        </div>
      ) : exercise.choices && exercise.choices.length > 0 ? (
        <div className="stack-sm">
          {exercise.choices.map((ch, idx) => {
            const isSelected = selectedChoice === ch;
            const isAns = normalizeTextAnswer(ch) === normalizeTextAnswer(expectedStr);
            let cls = 'choice-btn';
            if (submitted && !examMode) {
              if (isAns) cls += ' correct';
              else if (isSelected) cls += ' wrong';
            } else if (isSelected) {
              cls += ' selected';
            }
            return (
              <button
                key={idx}
                type="button"
                className={cls}
                disabled={submitted && !examMode}
                onClick={() => {
                  setSelectedChoice(ch);
                  if (examMode) {
                    handleSubmit(ch);
                  }
                }}
              >
                <span className="zh-md" lang="zh-Hans">
                  <strong style={{ marginRight: 8, color: 'var(--text-light)' }}>{idx + 1}.</strong>
                  {ch}
                </span>
                {submitted && !examMode && isAns && <CheckCircle2 size={18} color="var(--success)" />}
                {submitted && !examMode && isSelected && !isAns && (
                  <XCircle size={18} color="var(--danger)" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="row-wrap">
          <input
            type="text"
            className="input"
            placeholder="中国語または語句を入力してください"
            value={textAnswer}
            disabled={submitted && !examMode}
            onChange={(e) => setTextAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit && !submitted) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
      )}

      {!examMode && (
        <div className="row-between">
          {!submitted ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSubmit}
              onClick={() => handleSubmit()}
            >
              解答を確認する
            </button>
          ) : (
            onNext && (
              <button type="button" className="btn btn-primary" onClick={onNext}>
                次の問題へ (Enter)
              </button>
            )
          )}
          {!submitted && exercise.choices && exercise.choices.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              ヒント: 数字キー 1〜{exercise.choices.length} でも回答できます
            </span>
          )}
        </div>
      )}

      {examMode && exercise.type === 'word-order' && !submitted && (
        <div>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={!canSubmit}
            onClick={() => handleSubmit()}
          >
            この語順を確定する
          </button>
        </div>
      )}
      {examMode && !exercise.choices?.length && exercise.type !== 'word-order' && (
        <div>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={!canSubmit}
            onClick={() => handleSubmit()}
          >
            回答を記録する
          </button>
        </div>
      )}

      {submitted && !examMode && (
        <div className={`banner ${isCorrect ? 'banner-success' : 'banner-danger'} stack-sm`}>
          <div className="row-between">
            <strong>{isCorrect ? '正解です！' : '不正解です'}</strong>
            <div className="row-wrap">
              <span className="zh-md" lang="zh-Hans">
                正解: {expectedStr}
              </span>
              <SpeakButton text={expectedStr} />
            </div>
          </div>
          <p style={{ margin: 0 }}>{exercise.explanation}</p>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            <strong>関係する文法規則:</strong> {exercise.grammarRuleNote}
          </div>
        </div>
      )}
    </div>
  );
};
