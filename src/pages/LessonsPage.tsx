import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { exercises, grammarPoints, lessons, vocabulary } from '../data';
import { useApp } from '../context/AppContext';

export const LessonsPage: React.FC = () => {
  const { userState, toggleLessonCompleted } = useApp();

  return (
    <div className="stack-lg">
      <header className="page-header">
        <div>
          <h2 className="page-title">課別学習（全22課）</h2>
          <p className="page-subtitle">各課の文法・語彙・例文・練習問題・確認テスト</p>
        </div>
        <span className="badge badge-accent num-tabular">
          完了 {userState.completedLessons.length} / {lessons.length}
        </span>
      </header>

      <div className="list-group">
        {lessons.map((lesson) => {
          const done = userState.completedLessons.includes(lesson.id);
          const gCount = grammarPoints.filter((g) => g.lessonId === lesson.id).length;
          const vCount = vocabulary.filter((v) => v.lessonId === lesson.id).length;
          const qCount = exercises.filter((e) => e.lessonId === lesson.id).length;

          return (
            <div key={lesson.id} className="list-row">
              <Link
                to={`/lessons/${lesson.id}`}
                data-testid={`lesson-link-${lesson.id}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="row-wrap" style={{ gap: 8 }}>
                    <span className="badge badge-accent num-tabular">{lesson.id}</span>
                    <strong style={{ fontSize: '0.96rem' }}>{lesson.title}</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      — {lesson.topic}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                    文法 {gCount} ・ 語彙 {vCount} ・ 練習 {qCount}
                  </div>
                </div>
              </Link>

              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${done ? 'btn-soft' : 'btn-ghost'}`}
                  onClick={() => toggleLessonCompleted(lesson.id)}
                  title={done ? '学習済みを取り消す' : '学習済みにする'}
                >
                  <CheckCircle2 size={14} />
                  <span>{done ? '完了' : '未完了'}</span>
                </button>
                <a
                  href={lesson.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  aria-label={`${lesson.id} 参考教材を開く`}
                  title="京都大学CALL参考教材"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
