import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock, Flame, SlidersHorizontal, Target } from 'lucide-react';
import { compositions, exercises, grammarMap, grammarPoints, lessons, vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import { filterByScope, formatScopeSummary } from '../utils/scope';
import { isDueForReview } from '../utils/srs';
import { ScopeSelectorModal } from '../components/ScopeSelectorModal';

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
  const studiedPrimaryCount = userState.studiedGrammarIds.filter((id) => !grammarMap.get(id)?.isSupplementary).length;

  return (
    <div className="stack-lg">
      {/* First-time / quick scope banner */}
      <section className="card stack-md">
        <div className="row-between">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>学習ダッシュボード</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              京都大学中国語CALL教材の学習体系に沿って、理解・暗記・演習・作文を一元管理できます。
            </p>
          </div>
          <div className="row-wrap">
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => setScopeModalOpen(true)}
            >
              <SlidersHorizontal size={16} />
              学習範囲を変更 ({formatScopeSummary(userState.scope)})
            </button>
            {userState.settings.lastVisitedPath && userState.settings.lastVisitedPath !== '/' && (
              <Link to={userState.settings.lastVisitedPath} className="btn btn-primary">
                前回の続きへ ({userState.settings.lastVisitedLabel}) <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>

        {!userState.settings.scopeConfigured && (
          <div className="banner banner-info row-between">
            <span>
              <strong>初期設定:</strong> 現在の授業進度に合わせて学習範囲を設定すると、未習事項を除外して効率よく復習できます。
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
      </section>

      {/* Summary metrics */}
      <section className="grid-4">
        <div className="card stack-sm">
          <div className="row-between" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>学習済みの課</span>
            <BookOpen size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {userState.completedLessons.length} / {lessons.length} 課
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.round((userState.completedLessons.length / lessons.length) * 100)}%` }}
            />
          </div>
        </div>

        <div className="card stack-sm">
          <div className="row-between" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>学習済み文法事項</span>
            <CheckCircle2 size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {studiedPrimaryCount} / {primaryGrammarCount} 項目
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${primaryGrammarCount ? Math.round((studiedPrimaryCount / primaryGrammarCount) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="card stack-sm">
          <div className="row-between" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>単語の習熟度 (範囲内)</span>
            <Target size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {masteredVocabCount} / {scopedVocab.length} 語
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${scopedVocab.length ? Math.round((masteredVocabCount / scopedVocab.length) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="card stack-sm">
          <div className="row-between" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>本日の復習・累計時間</span>
            <Clock size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {dueVocabCount + recentWrong.length} 件 / {studyMinutes} 分
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            回答数 {userState.answerHistory.length} 問 / 作文 {userState.compositionHistory.length} 問
          </div>
        </div>
      </section>

      {/* Recommended & Quick Launch */}
      <section className="grid-2">
        <div className="card stack-md">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} color="var(--accent)" /> おすすめの次の学習内容
          </h3>
          <div className="stack-sm">
            {recommendedNext.nextLesson && (
              <div className="card-subtle row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>
                    次の未完了課: {recommendedNext.nextLesson.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {recommendedNext.nextLesson.topic}
                  </div>
                </div>
                <Link to={`/lessons/${recommendedNext.nextLesson.id}`} className="btn btn-sm btn-primary">
                  学習する
                </Link>
              </div>
            )}
            {recommendedNext.unstudiedGrammar && (
              <div className="card-subtle row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>
                    未確認の文法: {recommendedNext.unstudiedGrammar.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {recommendedNext.unstudiedGrammar.pattern}
                  </div>
                </div>
                <Link
                  to={`/grammar/${recommendedNext.unstudiedGrammar.id}`}
                  className="btn btn-sm btn-soft"
                >
                  解説を見る
                </Link>
              </div>
            )}
            <div className="card-subtle row-between">
              <div>
                <div style={{ fontWeight: 600 }}>範囲内の演習コンテンツ</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  練習問題 {scopedExercises.length} 問・中国語作文 {scopedCompositions.length} 問・語彙 {scopedVocab.length} 語
                </div>
              </div>
              <Link to="/practice/composition" className="btn btn-sm btn-soft">
                作文に挑戦
              </Link>
            </div>
          </div>
        </div>

        <div className="card stack-md">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>最近間違えた問題・復習対象</h3>
            <Link to="/review" style={{ fontSize: '0.86rem' }}>
              すべて見る →
            </Link>
          </div>
          {recentWrong.length === 0 ? (
            <div className="card-subtle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              最近の間違いはまだありません。練習問題やフラッシュカードに取り組むとここに復習候補が表示されます。
            </div>
          ) : (
            <div className="stack-sm">
              {recentWrong.map((item) => (
                <div key={item.id} className="card-subtle row-between">
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                      {item.lessonId} / {item.grammarIds.map((g) => grammarMap.get(g)?.title ?? g).join(', ')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                      あなたの回答: {item.userAnswer || '(未入力)'}
                    </div>
                  </div>
                  <Link to="/review" className="btn btn-sm">
                    復習する
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent history */}
      <section className="card stack-md">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>直近の学習履歴</h3>
          <span className="badge">全 {userState.answerHistory.length + userState.compositionHistory.length} 件</span>
        </div>
        {userState.answerHistory.length === 0 && userState.compositionHistory.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            まだ学習履歴がありません。まずは「課別学習」や「単語帳」「文法練習」から始めましょう。
          </p>
        ) : (
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
                    <td>{new Date(h.timestamp).toLocaleString('ja-JP')}</td>
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
        )}
      </section>

      <ScopeSelectorModal open={scopeModalOpen} onClose={() => setScopeModalOpen(false)} />
    </div>
  );
};
