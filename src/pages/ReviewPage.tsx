import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, RotateCcw } from 'lucide-react';
import { compositions, exerciseMap, exercises, grammarMap, vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import { isDueForReview, sortByReviewPriority } from '../utils/srs';
import { createShuffleSeed, shuffleWithSeed } from '../utils/shuffle';
import { ExerciseCard } from '../components/ExerciseCard';
import { OrderControls } from '../components/OrderControls';

export const ReviewPage: React.FC = () => {
  const { userState } = useApp();
  const [tab, setTab] = useState<'weak' | 'srs' | 'bookmarks' | 'history'>('weak');
  const [weakIdx, setWeakIdx] = useState(0);
  const [weakRandom, setWeakRandom] = useState(false);
  const [weakSeed, setWeakSeed] = useState(() => createShuffleSeed());

  const baseWeakExercises = useMemo(() => {
    const wrongIds = Array.from(
      new Set(userState.answerHistory.filter((h) => !h.correct).map((h) => h.itemId))
    );
    const list = wrongIds
      .map((id) => exerciseMap.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    return list.length > 0 ? list : sortByReviewPriority(exercises, userState.srs).slice(0, 15);
  }, [userState.answerHistory, userState.srs]);

  const weakExercises = useMemo(
    () => (weakRandom ? shuffleWithSeed(baseWeakExercises, weakSeed) : baseWeakExercises),
    [baseWeakExercises, weakRandom, weakSeed]
  );

  const dueVocab = useMemo(
    () =>
      sortByReviewPriority(
        vocabulary.filter((v) => userState.srs[v.id] && isDueForReview(userState.srs[v.id])),
        userState.srs
      ),
    [userState.srs]
  );

  const weakCompositions = useMemo(() => {
    const ids = new Set(
      userState.compositionHistory
        .filter((h) => h.selfScore === 'wrong' || h.selfScore === 'partial')
        .map((h) => h.compositionId)
    );
    return compositions.filter((c) => ids.has(c.id));
  }, [userState.compositionHistory]);

  return (
    <div className="stack-lg">
      <div>
        <h2 style={{ margin: 0 }}>復習・苦手問題集・学習履歴</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          過去に間違えた問題、間隔反復の復習予定、ブックマーク・学習メモ、回答・作文履歴をまとめて確認できます。
        </p>
      </div>

      <div className="row-wrap">
        <button
          type="button"
          className={`btn btn-sm ${tab === 'weak' ? 'btn-primary' : ''}`}
          onClick={() => setTab('weak')}
        >
          苦手問題集 ({weakExercises.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'srs' ? 'btn-primary' : ''}`}
          onClick={() => setTab('srs')}
        >
          復習スケジュール ({dueVocab.length}語期限到来)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'bookmarks' ? 'btn-primary' : ''}`}
          onClick={() => setTab('bookmarks')}
        >
          ブックマーク・メモ ({userState.bookmarkedGrammar.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : ''}`}
          onClick={() => setTab('history')}
        >
          回答・作文履歴
        </button>
      </div>

      {tab === 'weak' && (
        <div className="stack-md">
          {weakExercises.length > 0 && (
            <>
              <div className="row-between">
                <div className="row-wrap">
                  <span>
                    苦手演習 {(weakIdx % weakExercises.length) + 1} / {weakExercises.length}
                  </span>
                  <OrderControls
                    randomOrder={weakRandom}
                    onToggleRandom={() => {
                      setWeakRandom((prev) => {
                        const next = !prev;
                        if (next) setWeakSeed(createShuffleSeed());
                        return next;
                      });
                      setWeakIdx(0);
                    }}
                    onReshuffle={() => {
                      setWeakSeed(createShuffleSeed());
                      setWeakIdx(0);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setWeakIdx((i) => (i + 1) % weakExercises.length)}
                >
                  <RotateCcw size={14} /> 次の問題
                </button>
              </div>
              <ExerciseCard
                exercise={weakExercises[weakIdx % weakExercises.length]}
                onNext={() => setWeakIdx((i) => (i + 1) % weakExercises.length)}
              />
            </>
          )}

          {weakCompositions.length > 0 && (
            <div className="card stack-sm">
              <h3 style={{ margin: 0 }}>要復習の中国語作文 ({weakCompositions.length}問)</h3>
              {weakCompositions.map((c) => (
                <div key={c.id} className="card-subtle row-between">
                  <div>
                    <div>{c.japanesePrompt}</div>
                    <div className="zh-md" lang="zh-Hans" style={{ color: 'var(--accent)' }}>
                      {c.modelAnswer}
                    </div>
                  </div>
                  <Link to={`/practice/composition?grammar=${c.grammarIds[0]}`} className="btn btn-sm btn-soft">
                    再挑戦
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'srs' && (
        <div className="card stack-md">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>間隔反復（SRS）復習キュー</h3>
            <Link to="/flashcards" className="btn btn-sm btn-primary">
              フラッシュカードで復習開始
            </Link>
          </div>
          {dueVocab.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              現在期限が来ている語彙はありません。フラッシュカードや単語帳で新しい単語を学習すると復習予定が記録されます。
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>簡体字</th>
                    <th>ピンイン</th>
                    <th>日本語訳</th>
                    <th>習熟度</th>
                    <th>次回予定</th>
                  </tr>
                </thead>
                <tbody>
                  {dueVocab.slice(0, 40).map((v) => {
                    const rec = userState.srs[v.id];
                    return (
                      <tr key={v.id}>
                        <td className="zh-md" lang="zh-Hans">{v.hanzi}</td>
                        <td>{v.pinyin}</td>
                        <td>{v.meaningJa}</td>
                        <td>{rec?.mastery ?? 0}%</td>
                        <td>{rec ? new Date(rec.nextReviewAt).toLocaleDateString('ja-JP') : '今日'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'bookmarks' && (
        <div className="grid-2">
          <div className="card stack-sm">
            <h3 style={{ margin: 0 }}>ブックマークした文法事項</h3>
            {userState.bookmarkedGrammar.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>まだありません。</p>
            ) : (
              userState.bookmarkedGrammar.map((gid) => {
                const g = grammarMap.get(gid);
                return (
                  <Link key={gid} to={`/grammar/${gid}`} className="card-subtle row-between">
                    <span>
                      <Bookmark size={14} style={{ marginRight: 6 }} />
                      {g ? `${g.lessonId}: ${g.title}` : gid}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
          <div className="card stack-sm">
            <h3 style={{ margin: 0 }}>文法学習メモ一覧</h3>
            {Object.entries(userState.grammarNotes).filter(([, txt]) => txt.trim()).length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>まだメモはありません。</p>
            ) : (
              Object.entries(userState.grammarNotes)
                .filter(([, txt]) => txt.trim())
                .map(([gid, txt]) => (
                  <div key={gid} className="card-subtle">
                    <Link to={`/grammar/${gid}`} style={{ fontWeight: 600 }}>
                      {grammarMap.get(gid)?.title ?? gid}
                    </Link>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>{txt}</p>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="stack-md">
          <div className="card stack-sm">
            <h3 style={{ margin: 0 }}>作文履歴 ({userState.compositionHistory.length}件)</h3>
            {userState.compositionHistory.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>まだ作文履歴がありません。</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>日時</th>
                      <th>課</th>
                      <th>入力文</th>
                      <th>自己採点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userState.compositionHistory.slice(0, 30).map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.timestamp).toLocaleString('ja-JP')}</td>
                        <td>{h.lessonId}</td>
                        <td lang="zh-Hans">{h.userInput}</td>
                        <td>{h.selfScore ?? '未採点'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
