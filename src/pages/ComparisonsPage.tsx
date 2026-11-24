import React from 'react';
import { Link } from 'react-router-dom';
import { comparisons, grammarMap } from '../data';
import { ColoredPinyin, SpeakButton } from '../components/ChineseText';
import { useApp } from '../context/AppContext';

export const ComparisonsPage: React.FC = () => {
  const { userState } = useApp();

  return (
    <div className="stack-lg">
      <div>
        <h2 style={{ margin: 0 }}>類似文法・紛らわしい表現の比較</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          日本語母語話者が混同しやすい重要表現を、意味・否定形・使用条件・独自例文で横並び比較できます。
        </p>
      </div>

      <div className="row-wrap">
        {comparisons.map((cmp) => (
          <a key={cmp.id} href={`#${cmp.id}`} className="btn btn-sm btn-soft">
            {cmp.title}
          </a>
        ))}
      </div>

      <div className="stack-lg">
        {comparisons.map((cmp) => (
          <section key={cmp.id} id={cmp.id} className="card stack-md">
            <div className="row-between">
              <div className="row-wrap">
                <h3 style={{ margin: 0 }}>{cmp.title}</h3>
                {cmp.isSupplementary && <span className="badge badge-warning">発展解説含む</span>}
              </div>
              <div className="row-wrap">
                {cmp.grammarIds.map((gid) => (
                  <Link key={gid} to={`/grammar/${gid}`} className="badge badge-accent">
                    {grammarMap.get(gid)?.title ?? gid}
                  </Link>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{cmp.summary}</p>

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
