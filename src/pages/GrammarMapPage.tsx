import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { grammarMap, grammarPoints } from '../data';
import { useApp } from '../context/AppContext';

export const GrammarMapPage: React.FC = () => {
  const { userState } = useApp();
  const [selectedId, setSelectedId] = useState<string>('G07-04');

  const selected = grammarMap.get(selectedId);

  const levels = useMemo(() => {
    const depthCache = new Map<string, number>();
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (depthCache.has(id)) return depthCache.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);
      const g = grammarMap.get(id);
      if (!g || g.prerequisites.length === 0) {
        depthCache.set(id, 0);
        return 0;
      }
      const maxParent = Math.max(...g.prerequisites.map((pid) => getDepth(pid, new Set(visited))));
      const d = maxParent + 1;
      depthCache.set(id, d);
      return d;
    };

    const grouped = new Map<number, typeof grammarPoints>();
    for (const g of grammarPoints) {
      const d = getDepth(g.id);
      if (!grouped.has(d)) grouped.set(d, []);
      grouped.get(d)!.push(g);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  }, []);

  const dependents = useMemo(
    () => grammarPoints.filter((g) => g.prerequisites.includes(selectedId)),
    [selectedId]
  );

  return (
    <div className="stack-lg">
      <div>
        <h2 style={{ margin: 0 }}>文法前提関係・学習マップ</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          どの文法がどの基礎文法の土台の上に成り立っているかを階層別に表示します。ノードをクリックすると依存関係を確認できます。
        </p>
      </div>

      {selected && (
        <div className="card stack-md">
          <div className="row-between">
            <div>
              <span className="badge badge-accent" style={{ marginRight: 8 }}>
                {selected.lessonId}
              </span>
              <strong style={{ fontSize: '1.1rem' }}>{selected.title}</strong>
            </div>
            <Link to={`/grammar/${selected.id}`} className="btn btn-sm btn-primary">
              解説ページを開く
            </Link>
          </div>
          <div className="grid-2">
            <div className="card-subtle stack-sm">
              <strong>← 必要な前提文法 ({selected.prerequisites.length})</strong>
              <div className="row-wrap">
                {selected.prerequisites.length === 0 ? (
                  <span className="badge">基礎（前提なし）</span>
                ) : (
                  selected.prerequisites.map((pid) => {
                    const pg = grammarMap.get(pid);
                    return (
                      <button
                        key={pid}
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setSelectedId(pid)}
                      >
                        {pg ? `${pg.lessonId} ${pg.title}` : pid}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="card-subtle stack-sm">
              <strong>→ この文法から発展する項目 ({dependents.length})</strong>
              <div className="row-wrap">
                {dependents.length === 0 ? (
                  <span className="badge">発展先なし</span>
                ) : (
                  dependents.map((dg) => (
                    <button
                      key={dg.id}
                      type="button"
                      className="btn btn-sm btn-soft"
                      onClick={() => setSelectedId(dg.id)}
                    >
                      {dg.lessonId} {dg.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stack-md">
        {levels.map(([depth, items]) => (
          <div key={depth} className="card stack-sm">
            <div className="badge">ステップ {depth + 1}（前提深度 {depth}）</div>
            <div className="row-wrap">
              {items.map((g) => {
                const isSelected = g.id === selectedId;
                const isPrereq = selected?.prerequisites.includes(g.id);
                const isDep = dependents.some((d) => d.id === g.id);
                const studied = userState.studiedGrammarIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`btn btn-sm ${
                      isSelected ? 'btn-primary' : isPrereq || isDep ? 'btn-soft' : ''
                    }`}
                    style={{
                      borderColor: studied ? 'var(--success)' : undefined,
                    }}
                    onClick={() => setSelectedId(g.id)}
                  >
                    <span>{g.lessonId}</span>
                    <span>{g.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
