import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, ExternalLink, PlusCircle, Volume2, X } from 'lucide-react';
import type { BackgroundNote, GlossaryEntry, InlineAnnotation, StructureSlotRef } from '../types/work';
import type { SlotRole } from '../../types/curriculum';
import { labelAnnotationKind } from '../core/readerStorage';
import { speakChinese } from '../../utils/speech';
import { StructureDiagram } from '../../components/StructureDiagram';

function mapToSlotRole(role: StructureSlotRef['role']): SlotRole {
  const table: Record<string, SlotRole> = {
    subject: 'S',
    predicate: 'V',
    object: 'O',
    complement: 'C',
    adverb: 'Adv',
    modifier: 'Attr',
    particle: 'P',
    conjunction: 'Conj',
  };
  return table[role] ?? (role as SlotRole);
}

interface AnnotationSidePanelProps {
  annotations: InlineAnnotation[];
  glossaryMap: Map<string, GlossaryEntry>;
  backgroundMap: Map<string, BackgroundNote>;
  maxReachedChapterIndex: number;
  allowSpoilers: boolean;
  speechSupported: boolean;
  speechRate: number;
  isVocabInReview: (glossaryId: string) => boolean;
  onAddVocab: (ann: InlineAnnotation, entry: GlossaryEntry) => void;
  onAddGrammar: (ann: InlineAnnotation) => void;
  onClose: () => void;
}

function epistemicLabelText(label: 'fact' | 'common-interpretation' | 'fictional-setting'): string {
  switch (label) {
    case 'fact':
      return '検証済み事実';
    case 'common-interpretation':
      return '一般的な解釈・読み方の一例';
    case 'fictional-setting':
      return '作品固有の架空設定';
  }
}

export const AnnotationSidePanel: React.FC<AnnotationSidePanelProps> = ({
  annotations,
  glossaryMap,
  backgroundMap,
  maxReachedChapterIndex,
  allowSpoilers,
  speechSupported,
  speechRate,
  isVocabInReview,
  onAddVocab,
  onAddGrammar,
  onClose,
}) => {
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  if (annotations.length === 0) return null;

  return (
    <div
      className="reader-sidepanel-backdrop"
      onClick={onClose}
      data-testid="reader-sidepanel-backdrop"
    >
      <aside
        className="reader-sidepanel stack-md"
        aria-label="注釈詳細パネル"
        data-testid="reader-sidepanel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h3 style={{ margin: 0 }}>注釈・文脈詳細 ({annotations.length}件)</h3>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="詳細パネルを閉じる">
            <X size={16} /> 閉じる
          </button>
        </div>

        {annotations.map((ann) => {
          if (ann.kind === 'vocab' && ann.vocab) {
            const entry = glossaryMap.get(ann.vocab.glossaryId);
            const inReview = isVocabInReview(ann.vocab.glossaryId);
            const tones = ann.vocab.contextualTones ?? entry?.tones ?? [];
            return (
              <div key={ann.id} className="card stack-sm">
                <div className="row-between">
                  <span className="badge badge-accent">{labelAnnotationKind(ann.kind)}</span>
                  {speechSupported && (
                    <button
                      type="button"
                      className="btn btn-sm btn-soft"
                      onClick={() => speakChinese(ann.vocab!.surface, speechRate)}
                    >
                      <Volume2 size={14} /> 発音再生
                    </button>
                  )}
                </div>

                <div>
                  <div className="zh-lg" lang="zh-Hans">
                    {entry?.headword ?? ann.vocab.surface}
                    {entry && entry.headword !== ann.vocab.surface && (
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                        (文中表記: {ann.vocab.surface})
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {ann.vocab.contextualPinyin}
                    {tones.length > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: '0.85rem' }}>
                        声調: {tones.map((t) => `${t.syllable}(${t.tone === 5 ? '軽' : t.tone}声)`).join('・')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-subtle stack-xs">
                  <div>
                    <strong>この場面での意味:</strong> {ann.vocab.contextualMeaningJa}
                  </div>
                  {ann.vocab.contextualNote && (
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      {ann.vocab.contextualNote}
                    </div>
                  )}
                </div>

                {entry && (
                  <div className="stack-xs" style={{ fontSize: '0.88rem' }}>
                    <div><strong>品詞:</strong> {entry.pos}</div>
                    <div><strong>一般的な意味:</strong> {entry.generalMeaningJa}</div>
                    {entry.wordStructure && (
                      <div><strong>語の構成:</strong> {entry.wordStructure}</div>
                    )}
                    {entry.usageNote && (
                      <div><strong>用法:</strong> {entry.usageNote}</div>
                    )}
                    {entry.synonymDiff && (
                      <div><strong>類義語との違い:</strong> {entry.synonymDiff}</div>
                    )}
                    {entry.examples.length > 0 && (
                      <div>
                        <strong>用例:</strong>
                        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                          {entry.examples.map((ex, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>
                              <span lang="zh-Hans">{ex.zh}</span> ({ex.pinyin}) — {ex.ja}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="row-wrap" style={{ marginTop: 6 }}>
                      {entry.relatedLessonId && (
                        <Link to={`/lessons/${entry.relatedLessonId}`} className="btn btn-sm btn-soft">
                          <BookOpen size={13} /> 教材 {entry.relatedLessonId} を見る
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={inReview}
                        onClick={() => onAddVocab(ann, entry)}
                      >
                        <PlusCircle size={13} /> {inReview ? '復習帳登録済み' : '復習帳へ追加'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (ann.kind === 'grammar' && ann.grammar) {
            return (
              <div key={ann.id} className="card stack-sm">
                <div className="row-between">
                  <span className="badge badge-success">{labelAnnotationKind(ann.kind)}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-soft"
                    onClick={() => onAddGrammar(ann)}
                  >
                    <PlusCircle size={13} /> 文法復習へ登録
                  </button>
                </div>
                <h4 style={{ margin: 0 }}>{ann.grammar.title}</h4>
                <div className="card-subtle">
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>構文パターン</div>
                  <div className="zh-md" lang="zh-Hans">{ann.grammar.pattern}</div>
                  <div style={{ fontSize: '0.86rem', marginTop: 4 }}>{ann.grammar.structureSummary}</div>
                </div>
                {ann.grammar.slots && ann.grammar.slots.length > 0 && (
                  <StructureDiagram
                    slots={ann.grammar.slots.map((s) => ({
                      ...s,
                      role: mapToSlotRole(s.role),
                    }))}
                  />
                )}
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>文法機能の解説:</strong> {ann.grammar.roleExplanation}
                </div>
                {ann.grammar.wordOrderReason && (
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong>語順の理由:</strong> {ann.grammar.wordOrderReason}
                  </div>
                )}
                {ann.grammar.particleOrAspectNote && (
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong>助詞・アスペクト・モダリティ:</strong> {ann.grammar.particleOrAspectNote}
                  </div>
                )}
                {ann.grammar.literalVsNaturalJa && (
                  <div className="card-subtle stack-xs" style={{ fontSize: '0.86rem' }}>
                    <div><strong>直訳:</strong> {ann.grammar.literalVsNaturalJa.literal}</div>
                    <div><strong>自然な解釈:</strong> {ann.grammar.literalVsNaturalJa.natural}</div>
                  </div>
                )}
                {ann.grammar.comparisonNote && (
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong>類似表現比較:</strong> {ann.grammar.comparisonNote}
                  </div>
                )}
                {ann.grammar.extraExamples && ann.grammar.extraExamples.length > 0 && (
                  <div style={{ fontSize: '0.86rem' }}>
                    <strong>追加例文:</strong>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {ann.grammar.extraExamples.map((ex, i) => (
                        <li key={i}>
                          <span lang="zh-Hans">{ex.zh}</span> ({ex.pinyin}) — {ex.ja}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ann.grammar.relatedGrammarId && (
                  <div>
                    <Link to={`/grammar/${ann.grammar.relatedGrammarId}`} className="btn btn-sm btn-soft">
                      <ExternalLink size={13} /> 既存文法解説 ({ann.grammar.relatedGrammarId}) を開く
                    </Link>
                  </div>
                )}
              </div>
            );
          }

          if (ann.kind === 'expression' && ann.expression) {
            return (
              <div key={ann.id} className="card stack-sm">
                <div className="row-between">
                  <span className="badge badge-warning">{ann.expression.subtypeLabelJa}</span>
                  <span className="badge">{epistemicLabelText(ann.expression.factType)}</span>
                </div>
                <div className="zh-md" lang="zh-Hans">「{ann.surface}」</div>
                <div style={{ fontSize: '0.92rem' }}>
                  <strong>意味・働き:</strong> {ann.expression.meaningJa}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {ann.expression.nuanceNote}
                </div>
              </div>
            );
          }

          if (ann.kind === 'background' && ann.background) {
            const bg = backgroundMap.get(ann.background.backgroundNoteId);
            if (!bg) return null;
            const spoilerLocked =
              !allowSpoilers &&
              bg.spoilerDetail &&
              maxReachedChapterIndex < Math.max(bg.revealFromChapterIndex + 1, 2) &&
              !revealedSpoilers[bg.id];

            return (
              <div key={ann.id} className="card stack-sm">
                <div className="row-between">
                  <span className="badge">背景知識 ({bg.category})</span>
                  <span className="badge badge-accent">{epistemicLabelText(bg.factType)}</span>
                </div>
                <h4 style={{ margin: 0 }}>{bg.title}</h4>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{bg.summary}</div>
                <div style={{ fontSize: '0.88rem' }}>{bg.detail}</div>

                {bg.spoilerDetail && (
                  <div className="card-subtle">
                    {spoilerLocked ? (
                      <div className="row-between">
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                          物語の後半に関する解説はネタバレ防止のため非表示です。
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-soft"
                          onClick={() =>
                            setRevealedSpoilers((prev) => ({ ...prev, [bg.id]: true }))
                          }
                        >
                          <Eye size={13} /> ネタバレを表示
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.86rem' }}>
                        <strong>詳細な関連解説:</strong> {bg.spoilerDetail}
                      </div>
                    )}
                  </div>
                )}

                {bg.sources.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <strong>出典:</strong>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {bg.sources.map((src, i) => (
                        <li key={i}>
                          <a href={src.url} target="_blank" rel="noopener noreferrer">
                            {src.title}
                          </a>{' '}
                          (確認日: {src.checkedAt})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </aside>
    </div>
  );
};
