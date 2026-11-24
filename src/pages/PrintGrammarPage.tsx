import React from 'react';
import { Printer } from 'lucide-react';
import { grammarPoints, lessons } from '../data';

export const PrintGrammarPage: React.FC = () => {
  return (
    <div className="stack-lg">
      <div className="row-between no-print">
        <div>
          <h2 style={{ margin: 0 }}>印刷用 文法まとめシート</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            試験前の総復習や手元資料として印刷・PDF保存できます。
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> 印刷 / PDF保存
        </button>
      </div>

      {lessons.map((l) => {
        const gs = grammarPoints.filter((g) => g.lessonId === l.id);
        return (
          <section key={l.id} className="card stack-sm">
            <h3 style={{ margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
              {l.title}: {l.topic}
            </h3>
            {gs.map((g) => (
              <div key={g.id} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                <div style={{ fontWeight: 700 }}>
                  {g.title} — <span lang="zh-Hans">{g.pattern}</span>
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{g.meaning}</div>
                {g.examples[0] && (
                  <div style={{ fontSize: '0.88rem', marginTop: 3 }}>
                    <span lang="zh-Hans">{g.examples[0].hanzi}</span> ({g.examples[0].pinyin}) —{' '}
                    {g.examples[0].ja}
                  </div>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
};
