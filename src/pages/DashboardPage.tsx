import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { compositions, exercises, grammarMap, grammarPoints, lessons, vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import { filterByScope, formatScopeSummary } from '../utils/scope';
import { isDueForReview } from '../utils/srs';
import { ScopeSelectorModal } from '../components/ScopeSelectorModal';
import { ProgressBar } from '../components/ui';

export const DashboardPage: React.FC = () => {
  const { userState, setScope } = useApp();
  const [scopeModalOpen, setScopeModalOpen] = useState(false);

  const scopedLessons = useMemo(
    () => filterByScope(lessons.map((l) => ({ ...l, lessonId: l.id, minLesson: l.number })), userState.scope),
    [userState.scope]
  );
  const scopedGrammar = useMemo(
    () =>
      grammarPoints.filter((g) => {
        if (g.lessonId === 'P00') return true;
        return scopedLessons.some((l) => l.id === g.lessonId);
      }),
    [scopedLessons]
  );
  const scopedVocab = useMemo(() => filterByScope(vocabulary, userState.scope), [userState.scope]);
  const scopedExercises = useMemo(() => filterByScope(exercises, userState.scope), [userState.scope]);
  const scopedCompositions = useMemo(() => filterByScope(compositions, userState.scope), [userState.scope]);

  const masteredVocabCount = useMemo(
    () => scopedVocab.filter((v) => (userState.srs[v.id]?.mastery ?? 0) >= 60).length,
    [scopedVocab, userState.srs]
  );

  const dueVocabCount = useMemo(
    () =>
      scopedVocab.filter((v) => {
        const rec = userState.srs[v.id];
        return rec && isDueForReview(rec);
      }).length,
    [scopedVocab, userState.srs]
  );

  const recentWrong = useMemo(
    () => userState.answerHistory.filter((h) => !h.correct).slice(0, 5),
    [userState.answerHistory]
  );

  const recommendedNext = useMemo(() => {
    const nextLesson = lessons.find((l) => !userState.completedLessons.includes(l.id));
    const unstudiedGrammar = scopedGrammar.find(
      (g) => !g.isSupplementary && !userState.studiedGrammarIds.includes(g.id)
    );
    return { nextLesson, unstudiedGrammar };
  }, [userState.completedLessons, userState.studiedGrammarIds, scopedGrammar]);

  const studyMinutes = Math.round(userState.studySecondsTotal / 60);
  const primaryGrammarCount = grammarPoints.filter((g) => !g.isSupplementary).length;
  const studiedPrimaryCount = userState.studiedGrammarIds.filter(
    (id) => !grammarMap.get(id)?.isSupplementary
  ).length;

  const lessonPct = lessons.length
    ? Math.round((userState.completedLessons.length / lessons.length) * 100)
    : 0;
  const grammarPct = primaryGrammarCount
    ? Math.round((studiedPrimaryCount / primaryGrammarCount) * 100)
    : 0;
  const vocabPct = scopedVocab.length
    ? Math.round((masteredVocabCount / scopedVocab.length) * 100)
    : 0;

  return (
    <div className="stack-lg">
      {/* Header (open typographic header, no card frame) */}
      <header className="page-header">
        <div>
          <h2 className="page-title">学習ダッシュボード</h2>
          <p className="page-subtitle">現在の範囲: {formatScopeSummary(userState.scope)}</p>
        </div>
        <div className="row-wrap">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setScopeModalOpen(true)}
          >
            <SlidersHorizontal size={14} />
            範囲設定
          </button>
          {userState.settings.lastVisitedPath && userState.settings.lastVisitedPath !== '/' && (
            <Link to={userState.settings.lastVisitedPath} className="btn btn-sm btn-primary">
              {userState.settings.lastVisitedLabel} を続ける <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </header>

      {/* Initial setup prompt — only visible before user configures scope */}
      {!userState.settings.scopeConfigured && (
        <div className="banner banner-info row-between">
          <span>
            <strong>初期設定:</strong> 授業の進度に合わせて出題・復習範囲を選択できます。
          </span>
          <div className="row-wrap">
            {[4, 8, 14, 22].map((n) => (
              <button
                key={n}
                type="button"
                className="btn btn-sm btn-soft"
                onClick={() =>
                  setScope({
                    mode: 'upTo',
                    upToLesson: n,
                    selectedLessons: lessons.slice(0, n).map((l) => l.id),
                  })
                }
              >
                第{n}課まで
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unified Stat Strip (no bordered stat card grid) */}
      <section className="stat-strip" aria-label="学習統計サマリー">
        <div className="stat-item">
          <span className="stat-label">学習済みの課</span>
          <div className="stat-value">
            {userState.completedLessons.length}{' '}
            <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
              / {lessons.length} 課
            </span>
          </div>
          <ProgressBar percent={lessonPct} label="課の進捗" />
        </div>

        <div className="stat-item">
          <span className="stat-label">学習済み文法</span>
          <div className="stat-value">
            {studiedPrimaryCount}{' '}
            <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
              / {primaryGrammarCount}
            </span>
          </div>
          <ProgressBar percent={grammarPct} label="文法の進捗" />
        </div>

        <div className="stat-item">
          <span className="stat-label">範囲内の語彙習熟</span>
          <div className="stat-value">
            {masteredVocabCount}{' '}
            <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
              / {scopedVocab.length} 語
            </span>
          </div>
          <ProgressBar percent={vocabPct} label="語彙の習熟度" />
        </div>

        <div className="stat-item">
          <span className="stat-label">復習待ち・累計時間</span>
          <div className="stat-value">
            {dueVocabCount + recentWrong.length}{' '}
            <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
              件 ・ {studyMinutes} 分
            </span>
          </div>
          <div className="stat-meta num-tabular">
            演習 {userState.answerHistory.length} / 作文 {userState.compositionHistory.length}
          </div>
        </div>
      </section>

      {/* Recommended & Recent Mistakes (clean clickable hairline rows) */}
      <section className="grid-2">
        <div className="stack-sm">
          <h3 className="section-heading">次のステップ</h3>
          <div className="list-group">
            {recommendedNext.nextLesson && (
              <Link to={`/lessons/${recommendedNext.nextLesson.id}`} className="list-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                    {recommendedNext.nextLesson.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {recommendedNext.nextLesson.topic}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </Link>
            )}
            {recommendedNext.unstudiedGrammar && (
              <Link to={`/grammar/${recommendedNext.unstudiedGrammar.id}`} className="list-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                    未確認文法: {recommendedNext.unstudiedGrammar.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }} lang="zh-Hans">
                    {recommendedNext.unstudiedGrammar.pattern}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </Link>
            )}
            <Link to="/practice/composition" className="list-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>中国語作文・演習に挑戦</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  練習 {scopedExercises.length}問 ・ 作文 {scopedCompositions.length}問 ・ 語彙 {scopedVocab.length}語
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-tertiary)" />
            </Link>
          </div>
        </div>

        <div className="stack-sm">
          <div className="row-between">
            <h3 className="section-heading">最近の誤答・復習候補</h3>
            <Link to="/review" style={{ fontSize: '0.82rem' }}>
              一覧へ <ArrowRight size={12} style={{ verticalAlign: 'middle' }} />
            </Link>
          </div>
          {recentWrong.length === 0 ? (
            <div className="card-subtle" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              最近の間違いはありません。練習問題やフラッシュカードに取り組むと復習候補が記録されます。
            </div>
          ) : (
            <div className="list-group">
              {recentWrong.map((item) => (
                <Link key={item.id} to="/review" className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                      {item.lessonId} / {item.grammarIds.map((g) => grammarMap.get(g)?.title ?? g).join(', ')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      回答: {item.userAnswer || '(未入力)'}
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-tertiary)" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent history */}
      <section className="doc-section stack-sm">
        <div className="row-between">
          <h3 className="section-heading">直近の学習履歴</h3>
          <span className="badge num-tabular">
            全 {userState.answerHistory.length + userState.compositionHistory.length} 件
          </span>
        </div>
        {userState.answerHistory.length === 0 && userState.compositionHistory.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            学習履歴はまだありません。「課別学習」や「単語帳」から学習を始められます。
          </p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>種別</th>
                    <th>課</th>
                    <th>入力内容</th>
                    <th>結果</th>
                  </tr>
                </thead>
                <tbody>
                  {userState.answerHistory.slice(0, 8).map((h) => (
                    <tr key={h.id}>
                      <td className="num-tabular">{new Date(h.timestamp).toLocaleString('ja-JP')}</td>
                      <td>{h.itemKind}</td>
                      <td>{h.lessonId}</td>
                      <td lang="zh-Hans">{h.userAnswer}</td>
                      <td>
                        <span className={`badge ${h.correct ? 'badge-success' : 'badge-danger'}`}>
                          {h.correct ? '正解' : '誤答'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ScopeSelectorModal open={scopeModalOpen} onClose={() => setScopeModalOpen(false)} />
    </div>
  );
};
