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
      <div className="card stack-md">
        <p>指定された文法事項が見つかりません。</p>
        <Link to="/grammar" className="btn btn-primary">
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
    <div className="stack-lg">
      <div className="card stack-md">
        <div className="row-between">
          <div className="row-wrap">
            <Link to="/grammar" className="btn btn-sm">
              <ArrowLeft size={14} /> 文法辞典
            </Link>
            {grammar.lessonId !== 'P00' && (
              <Link to={`/lessons/${grammar.lessonId}`} className="btn btn-sm">
                {grammar.lessonId} へ
              </Link>
            )}
          </div>
          <div className="row-wrap">
            <button
              type="button"
              className={`btn btn-sm ${bookmarked ? 'btn-soft' : ''}`}
              onClick={() => toggleBookmarkGrammar(grammar.id)}
            >
              <Bookmark size={14} /> {bookmarked ? '保存済み' : 'ブックマーク'}
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
              className="btn btn-sm"
            >
              参考教材ページ <ExternalLink size={13} />
            </a>
          </div>
        </div>

        <div>
          <div className="row-wrap">
            <span className="badge badge-accent">{grammar.id}</span>
            <span className="badge">{categoryMap.get(grammar.categoryId)?.name}</span>
            <span className="badge">難易度 {grammar.difficulty}</span>
            {grammar.isSupplementary && <span className="badge badge-warning">教材外の補足/発展</span>}
          </div>
          <h2 style={{ margin: '8px 0 4px' }}>{grammar.title}</h2>
          <p style={{ margin: 0, fontSize: '1rem' }}>{grammar.meaning}</p>
        </div>

        <div className="card-subtle stack-sm">
          <strong>基本構文・語順ビジュアル</strong>
          <div className="zh-lg" lang="zh-Hans" style={{ color: 'var(--accent)' }}>
            {grammar.pattern}
          </div>
          <StructureDiagram slots={grammar.structureSlots} />
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <strong>語順の説明:</strong> {grammar.wordOrderNote}
          </p>
        </div>

        <div className="grid-2">
          <div className="card-subtle stack-sm">
            <strong>使用条件</strong>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{grammar.usageConditions}</p>
          </div>
          <div className="card-subtle stack-sm">
            <strong>使い分けのポイント</strong>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{grammar.distinctionNotes}</p>
          </div>
        </div>

        {grammar.forms && (grammar.forms.affirmative || grammar.forms.negative || grammar.forms.interrogative) && (
          <div className="card-subtle stack-sm">
            <strong>肯定文・否定文・疑問文の作り方</strong>
            <div className="grid-3">
              {grammar.forms.affirmative && (
                <div>
                  <span className="badge badge-success">肯定</span>
                  <div className="zh-md" lang="zh-Hans" style={{ marginTop: 4 }}>
                    {grammar.forms.affirmative}
                  </div>
                </div>
              )}
              {grammar.forms.negative && (
                <div>
                  <span className="badge badge-danger">否定</span>
                  <div className="zh-md" lang="zh-Hans" style={{ marginTop: 4 }}>
                    {grammar.forms.negative}
                  </div>
                </div>
              )}
              {grammar.forms.interrogative && (
                <div>
                  <span className="badge badge-accent">疑問</span>
                  <div className="zh-md" lang="zh-Hans" style={{ marginTop: 4 }}>
                    {grammar.forms.interrogative}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pitfalls & Differences */}
      <div className="grid-2">
        <div className="card stack-sm">
          <h3 style={{ margin: 0 }}>日本語話者が間違えやすい点</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {grammar.japaneseLearnerPitfalls.map((pit, idx) => (
              <li key={idx} style={{ marginBottom: 6 }}>
                {pit}
              </li>
            ))}
          </ul>
        </div>
        <div className="card stack-sm">
          <h3 style={{ margin: 0 }}>類似表現との違い</h3>
          {grammar.similarDifferences.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>特記事項なし</p>
          ) : (
            <div className="stack-sm">
              {grammar.similarDifferences.map((diff, idx) => (
                <div key={idx} className="card-subtle">
                  <div style={{ fontWeight: 600 }}>
                    {diff.targetId ? (
                      <Link to={`/grammar/${diff.targetId}`}>{diff.targetName}</Link>
                    ) : (
                      diff.targetName
                    )}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {diff.difference}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Original Examples */}
      <div className="card stack-md">
        <h3 style={{ margin: 0 }}>独自例文（{grammar.examples.length}件）</h3>
        <div className="stack-sm">
          {grammar.examples.map((ex, idx) => (
            <div key={ex.id} className="card-subtle">
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 4 }}>
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
      </div>

      {/* Prerequisites, Related, Practice Links */}
      <div className="grid-2">
        <div className="card stack-md">
          <h3 style={{ margin: 0 }}>文法のつながり</h3>
          <div className="stack-sm">
            <div>
              <strong>前提となる文法事項:</strong>
              <div className="row-wrap" style={{ marginTop: 6 }}>
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
              <strong>関連する文法事項:</strong>
              <div className="row-wrap" style={{ marginTop: 6 }}>
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
        </div>

        <div className="card stack-md">
          <h3 style={{ margin: 0 }}>実践演習・学習メモ</h3>
          <div className="row-wrap">
            <Link to={`/practice/grammar?grammar=${grammar.id}`} className="btn btn-primary">
              この文法の練習問題 ({exercisesList.length}問)
            </Link>
            <Link to={`/practice/composition?grammar=${grammar.id}`} className="btn btn-soft">
              この文法の中国語作文 ({compositionsList.length}問)
            </Link>
          </div>
          <div className="stack-sm">
            <label htmlFor="grammar-memo" style={{ fontWeight: 600, fontSize: '0.88rem' }}>
              自分の学習メモ（自動保存）
            </label>
            <textarea
              id="grammar-memo"
              rows={3}
              className="textarea"
              placeholder="授業の補足や覚え方のメモを残せます..."
              value={noteDraft}
              onChange={(e) => {
                setNoteDraft(e.target.value);
                saveGrammarNote(grammar.id, e.target.value);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
