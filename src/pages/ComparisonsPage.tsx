import React from 'react';
import { Link } from 'react-router-dom';
import { comparisons, grammarMap } from '../data';
import { ColoredPinyin, SpeakButton } from '../components/ChineseText';
import { useApp } from '../context/AppContext';

export const ComparisonsPage: React.FC = () => {
  const { userState } = useApp();

  return (
    <div className="stack-lg">
      <header className="page-header">
        <div>
          <h2 className="page-title">類似文法・紛らわしい表現の比較</h2>
          <p className="page-subtitle">意味・否定形・使用条件・例文による横並び整理</p>
        </div>
      </header>

      <div className="row-wrap">
        {comparisons.map((cmp) => (
          <a key={cmp.id} href={`#${cmp.id}`} className="btn btn-sm btn-soft">
            {cmp.title}
          </a>
        ))}
      </div>

      <div className="stack-lg">
        {comparisons.map((cmp, ci) => (
          <section key={cmp.id} id={cmp.id} className={ci === 0 ? 'stack-md' : 'doc-section stack-md'}>
            <div className="row-between">
              <div className="row-wrap">
                <h3 className="section-heading" style={{ fontSize: '1.12rem' }}>{cmp.title}</h3>
                {cmp.isSupplementary && <span className="badge badge-warning">発展解説</span>}
              </div>
              <div className="row-wrap">
                {cmp.grammarIds.map((gid) => (
                  <Link key={gid} to={`/grammar/${gid}`} className="badge badge-accent">
                    {grammarMap.get(gid)?.title ?? gid}
                  </Link>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{cmp.summary}</p>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>表現</th>
                    <th>意味・焦点</th>
                    <th>使用条件</th>
                    <th>否定形</th>
                    <th>独自例文</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.rows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }} lang="zh-Hans">
                        {row.item}
                      </td>
                      <td>{row.meaning}</td>
                      <td>{row.usage}</td>
                      <td lang="zh-Hans">{row.negation}</td>
                      <td>
                        <div className="row-between">
                          <span className="zh-md" lang="zh-Hans">
                            {row.example.hanzi}
                          </span>
                          <SpeakButton text={row.example.hanzi} />
                        </div>
                        {userState.settings.showPinyin && (
                          <div>
                            <ColoredPinyin
                              pinyin={row.example.pinyin}
                              toneColors={userState.settings.toneColors}
                            />
                          </div>
                        )}
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                          {row.example.ja}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div className="card-subtle stack-sm">
              <strong>判別・テスト対策の要点</strong>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {cmp.keyPoints.map((kp, i) => (
                  <li key={i}>{kp}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
