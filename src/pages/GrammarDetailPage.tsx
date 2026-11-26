import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, CheckCircle2, ExternalLink } from 'lucide-react';
import {
  categoryMap,
  getCompositionsByGrammar,
  getExercisesByGrammar,
  getGrammarById,
} from '../data';
import { useApp } from '../context/AppContext';
import { StructureDiagram } from '../components/StructureDiagram';
import { ChineseSentenceBlock } from '../components/ChineseText';

export const GrammarDetailPage: React.FC = () => {
  const { grammarId = 'G01-01' } = useParams();
  const grammar = getGrammarById(grammarId);
  const {
    userState,
    markGrammarStudied,
    toggleBookmarkGrammar,
    saveGrammarNote,
  } = useApp();

  const [noteDraft, setNoteDraft] = useState(userState.grammarNotes[grammarId] ?? '');

  useEffect(() => {
    setNoteDraft(userState.grammarNotes[grammarId] ?? '');
  }, [grammarId, userState.grammarNotes]);

  if (!grammar) {
    return (
      <div className="stack-md">
        <p>指定された文法事項が見つかりません。</p>
        <Link to="/grammar" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          文法辞典へ戻る
        </Link>
      </div>
    );
  }

  const exercisesList = getExercisesByGrammar(grammar.id);
  const compositionsList = getCompositionsByGrammar(grammar.id);
  const bookmarked = userState.bookmarkedGrammar.includes(grammar.id);
  const studied = userState.studiedGrammarIds.includes(grammar.id);

  return (
    <div className="stack-lg" style={{ maxWidth: 880 }}>
      {/* Top breadcrumb & controls */}
      <div className="row-between">
        <div className="row-wrap">
          <Link to="/grammar" className="btn btn-ghost btn-sm">
            <ArrowLeft size={14} /> 文法辞典
          </Link>
          {grammar.lessonId !== 'P00' && (
            <Link to={`/lessons/${grammar.lessonId}`} className="btn btn-ghost btn-sm">
              {grammar.lessonId} へ
            </Link>
          )}
        </div>
        <div className="row-wrap">
          <button
            type="button"
            className={`btn btn-sm ${bookmarked ? 'btn-soft' : 'btn-ghost'}`}
            onClick={() => toggleBookmarkGrammar(grammar.id)}
          >
            <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} /> {bookmarked ? '保存済み' : 'ブックマーク'}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${studied ? 'btn-primary' : ''}`}
            onClick={() => markGrammarStudied(grammar.id)}
          >
            <CheckCircle2 size={14} /> {studied ? '確認済み' : '学習済みにする'}
          </button>
          <a
            href={grammar.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            参考教材 <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Document Title Header */}
      <header className="stack-xs">
        <div className="row-wrap">
          <span className="badge badge-accent">{grammar.id}</span>
          <span className="badge">{categoryMap.get(grammar.categoryId)?.name}</span>
          <span className="badge">難易度 {grammar.difficulty}</span>
          {grammar.isSupplementary && <span className="badge badge-warning">補足・発展</span>}
        </div>
        <h2 className="page-title" style={{ marginTop: 4 }}>{grammar.title}</h2>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>{grammar.meaning}</p>
      </header>

      {/* Syntax & Visual Diagram (single clean tonal inset, no double borders) */}
      <section className="card-subtle stack-sm">
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
          基本構文・語順構造
        </div>
        <div className="zh-xl" lang="zh-Hans" style={{ color: 'var(--accent)' }}>
          {grammar.pattern}
        </div>
        <StructureDiagram slots={grammar.structureSlots} />
        <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <strong>語順の説明:</strong> {grammar.wordOrderNote}
        </p>
      </section>

      {/* Conditions & Distinctions — open 2-column reading layout */}
      <section className="grid-2 doc-section">
        <div className="stack-xs">
          <h3 className="section-heading">使用条件</h3>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
            {grammar.usageConditions}
          </p>
        </div>
        <div className="stack-xs">
          <h3 className="section-heading">使い分けのポイント</h3>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
            {grammar.distinctionNotes}
          </p>
        </div>
      </section>

      {grammar.forms && (grammar.forms.affirmative || grammar.forms.negative || grammar.forms.interrogative) && (
        <section className="doc-section stack-sm">
          <h3 className="section-heading">肯定・否定・疑問の形</h3>
          <div className="grid-3">
            {grammar.forms.affirmative && (
              <div className="card-subtle">
                <span className="badge badge-success">肯定</span>
                <div className="zh-md" lang="zh-Hans" style={{ marginTop: 6 }}>
                  {grammar.forms.affirmative}
                </div>
              </div>
            )}
            {grammar.forms.negative && (
              <div className="card-subtle">
                <span className="badge badge-danger">否定</span>
                <div className="zh-md" lang="zh-Hans" style={{ marginTop: 6 }}>
                  {grammar.forms.negative}
                </div>
              </div>
            )}
            {grammar.forms.interrogative && (
              <div className="card-subtle">
                <span className="badge badge-accent">疑問</span>
                <div className="zh-md" lang="zh-Hans" style={{ marginTop: 6 }}>
                  {grammar.forms.interrogative}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Pitfalls & Differences */}
      <section className="grid-2 doc-section">
        <div className="stack-sm">
          <h3 className="section-heading">日本語話者が間違えやすい点</h3>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {grammar.japaneseLearnerPitfalls.map((pit, idx) => (
              <li key={idx} style={{ marginBottom: 6 }}>{pit}</li>
            ))}
          </ul>
        </div>
        <div className="stack-sm">
          <h3 className="section-heading">類似表現との違い</h3>
          {grammar.similarDifferences.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>特記事項なし</p>
          ) : (
            <div className="stack-sm">
              {grammar.similarDifferences.map((diff, idx) => (
                <div key={idx} style={{ paddingLeft: 12, borderLeft: '2px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                    {diff.targetId ? (
                      <Link to={`/grammar/${diff.targetId}`}>{diff.targetName}</Link>
                    ) : (
                      diff.targetName
                    )}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {diff.difference}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Original Examples (editorial prose list, no boxed clutter) */}
      <section className="doc-section stack-md">
        <h3 className="section-heading">独自例文（{grammar.examples.length}件）</h3>
        <div className="stack-md">
          {grammar.examples.map((ex, idx) => (
            <div
              key={ex.id}
              style={{
                paddingLeft: 14,
                borderLeft: '2px solid var(--accent-border)',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                例文 {idx + 1}
              </div>
              <ChineseSentenceBlock
                hanzi={ex.hanzi}
                pinyin={ex.pinyin}
                ja={ex.ja}
                note={ex.note}
                large
              />
            </div>
          ))}
        </div>
      </section>

      {/* Connections, Practice Links & Personal Notes */}
      <section className="grid-2 doc-section">
        <div className="stack-sm">
          <h3 className="section-heading">文法のつながり</h3>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>前提となる文法</div>
            <div className="row-wrap">
              {grammar.prerequisites.length === 0 ? (
                <span className="badge">前提なし（初学可）</span>
              ) : (
                grammar.prerequisites.map((pid) => {
                  const pg = getGrammarById(pid);
                  return (
                    <Link key={pid} to={`/grammar/${pid}`} className="btn btn-sm">
                      {pg ? `${pg.lessonId}: ${pg.title}` : pid}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>関連する文法</div>
            <div className="row-wrap">
              {grammar.relatedIds.map((rid) => {
                const rg = getGrammarById(rid);
                return (
                  <Link key={rid} to={`/grammar/${rid}`} className="btn btn-sm btn-soft">
                    {rg ? `${rg.lessonId}: ${rg.title}` : rid}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="stack-sm">
          <h3 className="section-heading">実践演習・メモ</h3>
          <div className="row-wrap">
            <Link to={`/practice/grammar?grammar=${grammar.id}`} className="btn btn-primary btn-sm">
              練習問題 ({exercisesList.length}問)
            </Link>
            <Link to={`/practice/composition?grammar=${grammar.id}`} className="btn btn-soft btn-sm">
              中国語作文 ({compositionsList.length}問)
            </Link>
          </div>
          <label htmlFor="grammar-memo" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            学習メモ（自動保存）
          </label>
          <textarea
            id="grammar-memo"
            rows={3}
            className="textarea"
            placeholder="授業の補足や覚え方をメモできます..."
            value={noteDraft}
            onChange={(e) => {
              setNoteDraft(e.target.value);
              saveGrammarNote(grammar.id, e.target.value);
            }}
          />
        </div>
      </section>
    </div>
  );
};
