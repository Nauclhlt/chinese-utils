import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ExternalLink, PlusCircle, Volume2, X } from 'lucide-react';
import type { GlossaryEntry, InlineAnnotation } from '../types/work';
import { labelAnnotationKind } from '../core/readerStorage';
import { speakChinese } from '../../utils/speech';

interface AnnotationPopupProps {
  annotations: InlineAnnotation[];
  anchorRect: { left: number; top: number; bottom: number; right: number };
  glossaryMap: Map<string, GlossaryEntry>;
  speechSupported: boolean;
  speechRate: number;
  isVocabInReview: (glossaryId: string) => boolean;
  onAddVocab: (ann: InlineAnnotation, entry: GlossaryEntry) => void;
  onAddGrammar: (ann: InlineAnnotation) => void;
  onOpenSidePanel: (annotations: InlineAnnotation[]) => void;
  onClose: () => void;
}

export const AnnotationPopup: React.FC<AnnotationPopupProps> = ({
  annotations,
  anchorRect,
  glossaryMap,
  speechSupported,
  speechRate,
  isVocabInReview,
  onAddVocab,
  onAddGrammar,
  onOpenSidePanel,
  onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: anchorRect.left,
    top: anchorRect.bottom + 8,
  });

  useLayoutEffect(() => {
    const el = popupRef.current;
    const width = el ? el.offsetWidth : 360;
    const height = el ? el.offsetHeight : 240;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;

    let left = Math.max(margin, Math.min(anchorRect.left, vw - width - margin));
    let top = anchorRect.bottom + 8;
    if (top + height > vh - margin) {
      const above = anchorRect.top - height - 8;
      top = above >= margin ? above : Math.max(margin, vh - height - margin);
    }
    setPos({ left, top });
  }, [anchorRect, annotations]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (annotations.length === 0) return null;

  return (
    <div
      ref={popupRef}
      className="reader-popup stack-sm"
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      role="dialog"
      aria-label="注釈ポップアップ"
      data-testid="reader-annotation-popup"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="row-between">
        <span className="badge badge-accent">
          重なり注釈 {annotations.length}件
        </span>
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            onClick={() => onOpenSidePanel(annotations)}
            data-testid="reader-open-sidepanel-btn"
          >
            <ExternalLink size={13} /> 詳細パネル
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            aria-label="注釈を閉じる"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {annotations.map((ann) => {
        if (ann.kind === 'vocab' && ann.vocab) {
          const entry = glossaryMap.get(ann.vocab.glossaryId);
          const inReview = isVocabInReview(ann.vocab.glossaryId);
          return (
            <div key={ann.id} className="card-subtle stack-xs" style={{ padding: '10px 12px' }}>
              <div className="row-between">
                <div>
                  <span className="badge">{labelAnnotationKind(ann.kind)}</span>{' '}
                  <strong lang="zh-Hans" style={{ fontSize: '1.1rem' }}>
                    {ann.vocab.surface}
                  </strong>{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                    [{ann.vocab.contextualPinyin}]
                  </span>
                </div>
                {speechSupported && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => speakChinese(ann.vocab!.surface, speechRate)}
                    title="発音を再生"
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                <strong>文脈の意味:</strong> {ann.vocab.contextualMeaningJa}
              </div>
              {entry && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  品詞: {entry.pos} / 一般: {entry.generalMeaningJa}
                  {entry.relatedLessonId && ` / 教材 ${entry.relatedLessonId}`}
                </div>
              )}
              {entry && (
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={inReview}
                    onClick={() => onAddVocab(ann, entry)}
                    data-testid={`popup-add-vocab-${ann.vocab.glossaryId}`}
                  >
                    <PlusCircle size={13} /> {inReview ? '復習帳登録済み' : '復習帳へ追加'}
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (ann.kind === 'grammar' && ann.grammar) {
          return (
            <div key={ann.id} className="card-subtle stack-xs" style={{ padding: '10px 12px' }}>
              <div className="row-between">
                <span className="badge badge-success">{labelAnnotationKind(ann.kind)}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-soft"
                  onClick={() => onAddGrammar(ann)}
                >
                  <PlusCircle size={13} /> 文法メモ追加
                </button>
              </div>
              <strong style={{ fontSize: '0.94rem' }}>{ann.grammar.title}</strong>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }} lang="zh-Hans">
                構文: {ann.grammar.pattern}
              </div>
              <div style={{ fontSize: '0.86rem' }}>{ann.grammar.roleExplanation}</div>
            </div>
          );
        }

        if (ann.kind === 'expression' && ann.expression) {
          return (
            <div key={ann.id} className="card-subtle stack-xs" style={{ padding: '10px 12px' }}>
              <div className="row-between">
                <span className="badge badge-warning">{ann.expression.subtypeLabelJa}</span>
                <span className="badge">
                  {ann.expression.factType === 'fact'
                    ? '事実・定型解説'
                    : ann.expression.factType === 'common-interpretation'
                      ? '解釈の一例'
                      : '作品固有'}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                <strong lang="zh-Hans">「{ann.surface}」</strong>: {ann.expression.meaningJa}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {ann.expression.nuanceNote}
              </div>
            </div>
          );
        }

        if (ann.kind === 'background' && ann.background) {
          return (
            <div key={ann.id} className="card-subtle stack-xs" style={{ padding: '10px 12px' }}>
              <div className="row-between">
                <span className="badge">{labelAnnotationKind(ann.kind)}</span>
                <BookOpen size={14} />
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                <strong lang="zh-Hans">{ann.surface}</strong>: {ann.background.shortHintJa}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
