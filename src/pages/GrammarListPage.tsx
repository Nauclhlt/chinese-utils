import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, ChevronRight, Printer, Search } from 'lucide-react';
import { categories, categoryMap, grammarPoints, lessons } from '../data';
import { useApp } from '../context/AppContext';
import { SpeakButton } from '../components/ChineseText';
import { Tabs } from '../components/ui';

export const GrammarListPage: React.FC = () => {
  const { userState, toggleBookmarkGrammar } = useApp();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'category' | 'lesson' | 'examples'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLesson, setSelectedLesson] = useState<string>('all');

  const filteredGrammar = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grammarPoints.filter((g) => {
      if (selectedCategory !== 'all' && g.categoryId !== selectedCategory) return false;
      if (selectedLesson !== 'all' && g.lessonId !== selectedLesson) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.meaning.toLowerCase().includes(q) ||
        g.pattern.toLowerCase().includes(q) ||
        g.examples.some(
          (ex) =>
            ex.hanzi.toLowerCase().includes(q) ||
            ex.pinyin.toLowerCase().includes(q) ||
            ex.ja.toLowerCase().includes(q)
        )
      );
    });
  }, [query, selectedCategory, selectedLesson]);

  const matchingExamples = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: { grammarId: string; grammarTitle: string; lessonId: string; hanzi: string; pinyin: string; ja: string; id: string }[] = [];
    for (const g of filteredGrammar) {
      for (const ex of g.examples) {
        if (
          !q ||
          ex.hanzi.toLowerCase().includes(q) ||
          ex.pinyin.toLowerCase().includes(q) ||
          ex.ja.toLowerCase().includes(q)
        ) {
          list.push({
            id: ex.id,
            grammarId: g.id,
            grammarTitle: g.title,
            lessonId: g.lessonId,
            hanzi: ex.hanzi,
            pinyin: ex.pinyin,
            ja: ex.ja,
          });
        }
      }
    }
    return list;
  }, [filteredGrammar, query]);

  return (
    <div className="stack-lg">
      <header className="page-header">
        <div>
          <h2 className="page-title">文法辞典・例文検索</h2>
          <p className="page-subtitle">全 {grammarPoints.length} 項目</p>
        </div>
        <div className="row-wrap">
          <Link to="/comparisons" className="btn btn-sm">類似表現の比較</Link>
          <Link to="/grammar-map" className="btn btn-sm">学習マップ</Link>
          <Link to="/print/grammar" className="btn btn-ghost btn-sm">
            <Printer size={14} /> 印刷用
          </Link>
        </div>
      </header>

      <div className="stack-md">
        <div className="grid-3">
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-tertiary)' }}
            />
            <input
              type="search"
              className="input"
              style={{ paddingLeft: 32 }}
              placeholder="文法名・中国語・ピンイン・日本語訳を検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="select"
            aria-label="文法分類フィルタ"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">すべての文法分類</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="select"
            aria-label="課フィルタ"
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value)}
          >
            <option value="all">すべての課</option>
            <option value="P00">P00（基礎発音・補足）</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}: {l.topic}</option>
            ))}
          </select>
        </div>

        <div className="row-between">
          <Tabs
            activeId={viewMode}
            onChange={(id) => setViewMode(id as typeof viewMode)}
            ariaLabel="表示形式"
            items={[
              { id: 'category', label: '分類別' },
              { id: 'lesson', label: '課順' },
              { id: 'examples', label: `例文検索 (${matchingExamples.length})` },
            ]}
          />
          <span className="badge num-tabular">{filteredGrammar.length} 項目</span>
        </div>
      </div>

      {viewMode === 'examples' ? (
        <div className="list-group">
          {matchingExamples.slice(0, 80).map((ex) => (
            <div key={ex.id} className="list-row">
              <div className="stack-xs" style={{ flex: 1 }}>
                <div className="row-wrap">
                  <span className="badge">{ex.lessonId}</span>
                  <Link to={`/grammar/${ex.grammarId}`} style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                    {ex.grammarTitle}
                  </Link>
                </div>
                <div className="zh-md" lang="zh-Hans">{ex.hanzi}</div>
                <div className="pinyin-text">{ex.pinyin}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{ex.ja}</div>
              </div>
              <SpeakButton text={ex.hanzi} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stack-lg">
          {(viewMode === 'category'
            ? categories
                .map((c) => ({
                  key: c.id,
                  heading: c.name,
                  sub: c.description,
                  items: filteredGrammar.filter((g) => g.categoryId === c.id),
                }))
                .filter((grp) => grp.items.length > 0)
            : [
                {
                  key: 'P00',
                  heading: '基礎発音・声調モジュール（補足）',
                  sub: '教材全体を学ぶ前提となる四声・軽声・変調ルール',
                  items: filteredGrammar.filter((g) => g.lessonId === 'P00'),
                },
                ...lessons.map((l) => ({
                  key: l.id,
                  heading: `${l.title} — ${l.topic}`,
                  sub: '',
                  items: filteredGrammar.filter((g) => g.lessonId === l.id),
                })),
              ].filter((grp) => grp.items.length > 0)
          ).map((grp) => (
            <section key={grp.key} className="stack-sm">
              <div>
                <h3 className="section-heading">{grp.heading}</h3>
                {grp.sub && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    {grp.sub}
                  </p>
                )}
              </div>
              <div className="list-group">
                {grp.items.map((g) => {
                  const bookmarked = userState.bookmarkedGrammar.includes(g.id);
                  return (
                    <div key={g.id} className="list-row">
                      <Link
                        to={`/grammar/${g.id}`}
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
                            <span className="badge badge-accent">{g.lessonId}</span>
                            <strong style={{ fontSize: '0.96rem' }}>{g.title}</strong>
                            <span className="zh-md" lang="zh-Hans" style={{ color: 'var(--accent)', fontSize: '0.94rem' }}>
                              {g.pattern}
                            </span>
                            {g.isSupplementary && <span className="badge badge-warning">補足</span>}
                          </div>
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {g.meaning} ・ 例文 {g.examples.length}件 ({categoryMap.get(g.categoryId)?.name})
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                      </Link>
                      <button
                        type="button"
                        className={`btn btn-sm ${bookmarked ? 'btn-soft' : 'btn-ghost'}`}
                        aria-label="ブックマーク"
                        onClick={() => toggleBookmarkGrammar(g.id)}
                      >
                        <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
