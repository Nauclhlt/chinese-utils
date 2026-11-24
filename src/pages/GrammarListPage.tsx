import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Printer, Search } from 'lucide-react';
import { categories, categoryMap, grammarPoints, lessons } from '../data';
import { useApp } from '../context/AppContext';
import { SpeakButton } from '../components/ChineseText';

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
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0 }}>文法辞典・例文検索</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            全 {grammarPoints.length} 項目の文法を分類別・課別・日本語/中国語/ピンインで横断検索できます。
          </p>
        </div>
        <div className="row-wrap">
          <Link to="/comparisons" className="btn btn-sm btn-soft">
            類似表現の比較
          </Link>
          <Link to="/grammar-map" className="btn btn-sm btn-soft">
            学習マップ
          </Link>
          <Link to="/print/grammar" className="btn btn-sm">
            <Printer size={14} /> 印刷用まとめ
          </Link>
        </div>
      </div>

      <div className="card stack-md">
        <div className="grid-3">
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-light)' }}
            />
            <input
              type="search"
              className="input"
              style={{ paddingLeft: 34 }}
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
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
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
              <option key={l.id} value={l.id}>
                {l.title}: {l.topic}
              </option>
            ))}
          </select>
        </div>

        <div className="row-between">
          <div className="row-wrap">
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'category' ? 'btn-primary' : ''}`}
              onClick={() => setViewMode('category')}
            >
              分類別表示
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'lesson' ? 'btn-primary' : ''}`}
              onClick={() => setViewMode('lesson')}
            >
              課順表示
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'examples' ? 'btn-primary' : ''}`}
              onClick={() => setViewMode('examples')}
            >
              中国語例文検索 ({matchingExamples.length}件)
            </button>
          </div>
          <span className="badge">{filteredGrammar.length} 項目ヒット</span>
        </div>
      </div>

      {viewMode === 'examples' ? (
        <div className="stack-sm">
          {matchingExamples.slice(0, 80).map((ex) => (
            <div key={ex.id} className="card row-between">
              <div className="stack-sm">
                <div className="row-wrap">
                  <span className="badge">{ex.lessonId}</span>
                  <Link to={`/grammar/${ex.grammarId}`} style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                    {ex.grammarTitle}
                  </Link>
                </div>
                <div className="zh-md" lang="zh-Hans">
                  {ex.hanzi}
                </div>
                <div className="pinyin-text">{ex.pinyin}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{ex.ja}</div>
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
                <h3 style={{ margin: 0 }}>{grp.heading}</h3>
                {grp.sub && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-light)' }}>
                    {grp.sub}
                  </p>
                )}
              </div>
              <div className="grid-2">
                {grp.items.map((g) => {
                  const bookmarked = userState.bookmarkedGrammar.includes(g.id);
                  return (
                    <div key={g.id} className="card stack-sm">
                      <div className="row-between">
                        <div className="row-wrap">
                          <span className="badge badge-accent">{g.lessonId}</span>
                          <span className="badge">{categoryMap.get(g.categoryId)?.name}</span>
                          {g.isSupplementary && <span className="badge badge-warning">発展/補足</span>}
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm ${bookmarked ? 'btn-soft' : ''}`}
                          aria-label="ブックマーク"
                          onClick={() => toggleBookmarkGrammar(g.id)}
                        >
                          <Bookmark size={14} />
                        </button>
                      </div>
                      <Link
                        to={`/grammar/${g.id}`}
                        style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}
                      >
                        {g.title}
                      </Link>
                      <div className="zh-md" lang="zh-Hans" style={{ color: 'var(--accent)' }}>
                        {g.pattern}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        {g.meaning}
                      </p>
                      <div className="row-between" style={{ marginTop: 4 }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                          独自例文 {g.examples.length}件
                        </span>
                        <Link to={`/grammar/${g.id}`} className="btn btn-sm btn-soft">
                          詳細・例文・練習へ →
                        </Link>
                      </div>
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
