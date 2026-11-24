import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import {
  compositions,
  getExercisesByLesson,
  getGrammarByLesson,
  getLessonById,
  getVocabByLesson,
} from '../data';
import { useApp } from '../context/AppContext';
import { ChineseSentenceBlock, ColoredPinyin, SpeakButton } from '../components/ChineseText';
import { ExerciseCard } from '../components/ExerciseCard';
import { OrderControls } from '../components/OrderControls';
import { createShuffleSeed, shuffleWithSeed } from '../utils/shuffle';

export const LessonDetailPage: React.FC = () => {
  const { lessonId = 'L01' } = useParams();
  const lesson = getLessonById(lessonId);
  const { userState, toggleLessonCompleted } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'vocab' | 'practice' | 'quiz'>('overview');
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [practiceRandom, setPracticeRandom] = useState(false);
  const [practiceSeed, setPracticeSeed] = useState(() => createShuffleSeed());
  const [quizRandom, setQuizRandom] = useState(false);
  const [quizSeed, setQuizSeed] = useState(() => createShuffleSeed());

  const lessonGrammar = useMemo(() => getGrammarByLesson(lessonId), [lessonId]);
  const lessonVocab = useMemo(() => getVocabByLesson(lessonId), [lessonId]);
  const rawLessonExercises = useMemo(() => getExercisesByLesson(lessonId), [lessonId]);
  const lessonExercises = useMemo(
    () => (practiceRandom ? shuffleWithSeed(rawLessonExercises, practiceSeed) : rawLessonExercises),
    [rawLessonExercises, practiceRandom, practiceSeed]
  );
  const rawComprehensiveQuiz = useMemo(
    () => rawLessonExercises.filter((e) => e.isLessonComprehensive),
    [rawLessonExercises]
  );
  const comprehensiveQuiz = useMemo(
    () => (quizRandom ? shuffleWithSeed(rawComprehensiveQuiz, quizSeed) : rawComprehensiveQuiz),
    [rawComprehensiveQuiz, quizRandom, quizSeed]
  );
  const lessonCompositions = useMemo(
    () => compositions.filter((c) => c.lessonId === lessonId),
    [lessonId]
  );

  if (!lesson) {
    return (
      <div className="card stack-md">
        <p>指定された課が見つかりません。</p>
        <Link to="/lessons" className="btn btn-primary">
          課一覧に戻る
        </Link>
      </div>
    );
  }

  const isDone = userState.completedLessons.includes(lesson.id);

  return (
    <div className="stack-lg">
      <div className="card stack-md">
        <div className="row-between">
          <Link to="/lessons" className="btn btn-sm">
            <ArrowLeft size={14} /> 課一覧
          </Link>
          <div className="row-wrap">
            <a
              href={lesson.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
            >
              原典（京都大学CALL教材） <ExternalLink size={13} />
            </a>
            <button
              type="button"
              className={`btn btn-sm ${isDone ? 'btn-primary' : ''}`}
              onClick={() => toggleLessonCompleted(lesson.id)}
            >
              <CheckCircle2 size={14} /> {isDone ? '学習済み' : '学習完了にする'}
            </button>
          </div>
        </div>

        <div>
          <div className="row-wrap">
            <span className="badge badge-accent">{lesson.id}</span>
            <h2 style={{ margin: 0 }}>{lesson.title}: {lesson.topic}</h2>
          </div>
          {lesson.pronunciationFocus && (
            <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              <strong>発音・声調のポイント:</strong> {lesson.pronunciationFocus}
            </p>
          )}
        </div>

        <div className="card-subtle stack-sm">
          <strong>学習目標</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {lesson.objectives.map((obj, idx) => (
              <li key={idx}>{obj}</li>
            ))}
          </ul>
        </div>

        <div className="row-wrap">
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            文法・独自例文 ({lessonGrammar.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'vocab' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('vocab')}
          >
            関連語彙 ({lessonVocab.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'practice' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            課内練習問題 ({lessonExercises.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'quiz' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            確認テスト ({comprehensiveQuiz.length})
          </button>
          <Link to={`/practice/composition?lesson=${lesson.id}`} className="btn btn-sm btn-soft">
            この課の中国語作文 ({lessonCompositions.length})
          </Link>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="stack-md">
          {lessonGrammar.map((g) => (
            <div key={g.id} className="card stack-md">
              <div className="row-between">
                <div>
                  <span className="badge badge-accent" style={{ marginRight: 8 }}>
                    {g.id}
                  </span>
                  <strong style={{ fontSize: '1.1rem' }}>{g.title}</strong>
                </div>
                <div className="row-wrap">
                  <Link to={`/grammar/${g.id}`} className="btn btn-sm btn-primary">
                    詳細解説ページへ
                  </Link>
                </div>
              </div>
              <p style={{ margin: 0 }}>{g.meaning}</p>
              <div className="card-subtle">
                <strong>基本構文:</strong>{' '}
                <span lang="zh-Hans" className="zh-md">
                  {g.pattern}
                </span>
              </div>
              <div className="grid-2">
                {g.examples.slice(0, 2).map((ex) => (
                  <div key={ex.id} className="card-subtle">
                    <ChineseSentenceBlock hanzi={ex.hanzi} pinyin={ex.pinyin} ja={ex.ja} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'vocab' && (
        <div className="card stack-md">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>{lesson.title} 関連語彙（独自解説・例文）</h3>
            <Link to={`/vocab?lesson=${lesson.id}`} className="btn btn-sm btn-soft">
              単語帳で詳しく見る
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>簡体字</th>
                  <th>ピンイン</th>
                  <th>品詞</th>
                  <th>意味</th>
                  <th>独自例文</th>
                  <th>音声</th>
                </tr>
              </thead>
              <tbody>
                {lessonVocab.map((v) => (
                  <tr key={v.id}>
                    <td className="zh-md" lang="zh-Hans">
                      {v.hanzi}
                    </td>
                    <td>
                      <ColoredPinyin pinyin={v.pinyin} toneColors={userState.settings.toneColors} />
                    </td>
                    <td>{v.pos}</td>
                    <td>{v.meaningJa}</td>
                    <td>
                      <div lang="zh-Hans">{v.example.hanzi}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{v.example.ja}</div>
                    </td>
                    <td>
                      <SpeakButton text={v.hanzi} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'practice' && lessonExercises.length > 0 && (
        <div className="stack-md">
          <div className="row-between">
            <div className="row-wrap">
              <span>
                問題 {practiceIdx + 1} / {lessonExercises.length}
              </span>
              <OrderControls
                randomOrder={practiceRandom}
                onToggleRandom={() => {
                  setPracticeRandom((prev) => {
                    const next = !prev;
                    if (next) setPracticeSeed(createShuffleSeed());
                    return next;
                  });
                  setPracticeIdx(0);
                }}
                onReshuffle={() => {
                  setPracticeSeed(createShuffleSeed());
                  setPracticeIdx(0);
                }}
              />
            </div>
            <div className="row-wrap">
              <button
                type="button"
                className="btn btn-sm"
                disabled={practiceIdx === 0}
                onClick={() => setPracticeIdx((i) => Math.max(0, i - 1))}
              >
                前の問題
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={practiceIdx >= lessonExercises.length - 1}
                onClick={() => setPracticeIdx((i) => Math.min(lessonExercises.length - 1, i + 1))}
              >
                次の問題
              </button>
            </div>
          </div>
          <ExerciseCard
            exercise={lessonExercises[practiceIdx]}
            onNext={() =>
              setPracticeIdx((i) => (i + 1 < lessonExercises.length ? i + 1 : 0))
            }
          />
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="stack-md">
          {comprehensiveQuiz.length === 0 ? (
            <div className="card">この課の総合確認問題はありません。</div>
          ) : (
            <>
              <div className="row-between">
                <div className="row-wrap">
                  <strong>
                    確認テスト: {quizIdx + 1} / {comprehensiveQuiz.length} 問
                  </strong>
                  <OrderControls
                    randomOrder={quizRandom}
                    onToggleRandom={() => {
                      setQuizRandom((prev) => {
                        const next = !prev;
                        if (next) setQuizSeed(createShuffleSeed());
                        return next;
                      });
                      setQuizIdx(0);
                    }}
                    onReshuffle={() => {
                      setQuizSeed(createShuffleSeed());
                      setQuizIdx(0);
                    }}
                  />
                </div>
                <div className="row-wrap">
                  {comprehensiveQuiz.map((q, idx) => (
                    <button
                      key={q.id}
                      type="button"
                      className={`btn btn-sm ${idx === quizIdx ? 'btn-primary' : ''}`}
                      onClick={() => setQuizIdx(idx)}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
              <ExerciseCard
                exercise={comprehensiveQuiz[quizIdx]}
                onNext={() =>
                  setQuizIdx((i) => (i + 1 < comprehensiveQuiz.length ? i + 1 : 0))
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
