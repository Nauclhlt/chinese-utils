import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { exercises, grammarPoints, lessons, vocabulary } from '../data';
import { useApp } from '../context/AppContext';

export const LessonsPage: React.FC = () => {
  const { userState, toggleLessonCompleted } = useApp();

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0 }}>課別学習（全22課）</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            参考教材の課順にそって、学習目標・文法事項・関連語彙・独自例文・練習問題・確認テストを進められます。
          </p>
        </div>
        <span className="badge badge-accent">
          完了: {userState.completedLessons.length} / {lessons.length} 課
        </span>
      </div>

      <div className="grid-2">
        {lessons.map((lesson) => {
          const done = userState.completedLessons.includes(lesson.id);
          const gCount = grammarPoints.filter((g) => g.lessonId === lesson.id).length;
          const vCount = vocabulary.filter((v) => v.lessonId === lesson.id).length;
          const qCount = exercises.filter((e) => e.lessonId === lesson.id).length;

          return (
            <div key={lesson.id} className="card stack-sm">
              <div className="row-between">
                <div className="row-wrap">
                  <span className="badge badge-accent">{lesson.id}</span>
                  <h3 style={{ margin: 0, fontSize: '1.08rem' }}>{lesson.title}</h3>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${done ? 'btn-soft' : ''}`}
                  onClick={() => toggleLessonCompleted(lesson.id)}
                >
                  <CheckCircle2 size={14} />
                  {done ? '学習済み' : '未完了'}
                </button>
              </div>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '0.94rem' }}>{lesson.topic}</p>
              <div className="row-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                <span>文法 {gCount}項目</span>
                <span>・</span>
                <span>語彙 {vCount}語</span>
                <span>・</span>
                <span>練習問題 {qCount}問</span>
              </div>
              <div className="row-between" style={{ marginTop: 6 }}>
                <Link to={`/lessons/${lesson.id}`} className="btn btn-sm btn-primary">
                  この課を学習する
                </Link>
                <a
                  href={lesson.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                >
                  参考教材 <ExternalLink size={13} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
