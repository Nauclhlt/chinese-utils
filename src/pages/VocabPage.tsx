import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Eye, EyeOff, Plus, Star, Trash2, X } from 'lucide-react';
import { grammarMap, lessons, vocabulary } from '../data';
import { useApp } from '../context/AppContext';
import type { VocabularyItem } from '../types/curriculum';
import { filterByScope } from '../utils/scope';
import { ColoredPinyin, SpeakButton } from '../components/ChineseText';
import { describeToneSandhi, extractTones } from '../utils/pinyin';
import { exportVocabToAnkiTsv, exportVocabToCsv } from '../utils/storage';

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const VocabPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { userState, toggleFavoriteVocab, rateSrsItem, addCustomVocab, deleteCustomVocab } = useApp();

  const [query, setQuery] = useState('');
  const [lessonFilter, setLessonFilter] = useState(searchParams.get('lesson') ?? 'scope');
  const [posFilter, setPosFilter] = useState('all');
  const [onlyFav, setOnlyFav] = useState(false);
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'lesson' | 'pinyin' | 'mastery'>('lesson');

  const [hideHanzi, setHideHanzi] = useState(false);
  const [hidePinyin, setHidePinyin] = useState(false);
  const [hideJa, setHideJa] = useState(false);

  const [detailItem, setDetailItem] = useState<VocabularyItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHanzi, setNewHanzi] = useState('');
  const [newPinyin, setNewPinyin] = useState('');
  const [newJa, setNewJa] = useState('');
  const [newPos, setNewPos] = useState('名詞');

  const allVocab = useMemo(() => {
    const customAsVocab: VocabularyItem[] = userState.customVocab.map((cv) => ({
      id: cv.id,
      hanzi: cv.hanzi,
      pinyin: cv.pinyin,
      tones: extractTones(cv.pinyin),
      meaningJa: cv.meaningJa,
      pos: cv.pos,
      usage: 'ユーザー登録単語',
      example: {
        hanzi: cv.exampleHanzi || cv.hanzi,
        pinyin: cv.pinyin,
        ja: cv.exampleJa || cv.meaningJa,
      },
      lessonId: cv.lessonId,
      minLesson: 1,
      source: 'supplement',
      grammarIds: [],
    }));
    return [...customAsVocab, ...vocabulary];
  }, [userState.customVocab]);

  const posOptions = useMemo(() => Array.from(new Set(allVocab.map((v) => v.pos))), [allVocab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scopedSet = new Set(filterByScope(allVocab, userState.scope).map((v) => v.id));

    const list = allVocab.filter((v) => {
      if (lessonFilter === 'scope' && !scopedSet.has(v.id)) return false;
      if (lessonFilter === 'supplement' && v.source !== 'supplement') return false;
      if (lessonFilter !== 'all' && lessonFilter !== 'scope' && lessonFilter !== 'supplement' && v.lessonId !== lessonFilter) {
        return false;
      }
      if (posFilter !== 'all' && v.pos !== posFilter) return false;
      if (onlyFav && !userState.favoritesVocab.includes(v.id)) return false;

      const mastery = userState.srs[v.id]?.mastery ?? 0;
      if (masteryFilter === 'low' && mastery >= 40) return false;
      if (masteryFilter === 'mid' && (mastery < 40 || mastery >= 80)) return false;
      if (masteryFilter === 'high' && mastery < 80) return false;

      if (!q) return true;
      return (
        v.hanzi.toLowerCase().includes(q) ||
        v.pinyin.toLowerCase().includes(q) ||
        v.meaningJa.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'pinyin') return a.pinyin.localeCompare(b.pinyin);
      if (sortBy === 'mastery') {
        return (userState.srs[a.id]?.mastery ?? 0) - (userState.srs[b.id]?.mastery ?? 0);
      }
      return (a.lessonId ?? 'ZZZ').localeCompare(b.lessonId ?? 'ZZZ') || a.id.localeCompare(b.id);
    });
  }, [allVocab, query, lessonFilter, posFilter, onlyFav, masteryFilter, sortBy, userState.scope, userState.favoritesVocab, userState.srs]);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHanzi.trim() || !newPinyin.trim() || !newJa.trim()) return;
    addCustomVocab({
      hanzi: newHanzi.trim(),
      pinyin: newPinyin.trim(),
      meaningJa: newJa.trim(),
      pos: newPos,
      lessonId: null,
    });
    setNewHanzi('');
    setNewPinyin('');
    setNewJa('');
    setShowAddForm(false);
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0 }}>単語帳・語彙データベース</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            教材の学習範囲に沿った独自解説・独自例文付き語彙データです。教材未確認語は「補足語彙」として区別しています。
          </p>
        </div>
        <div className="row-wrap">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadText('chinese-vocab.csv', exportVocabToCsv(filtered), 'text/csv;charset=utf-8')}
          >
            <Download size={14} /> CSV出力
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadText('chinese-anki.tsv', exportVocabToAnkiTsv(filtered), 'text/tab-separated-values;charset=utf-8')}
          >
            <Download size={14} /> Anki用TSV出力
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowAddForm((s) => !s)}>
            <Plus size={14} /> 独自単語を登録
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCustom} className="card stack-md">
          <h3 style={{ margin: 0 }}>独自単語の追加</h3>
          <div className="grid-4">
            <input
              className="input"
              placeholder="簡体字 (例: 图书馆)"
              value={newHanzi}
              onChange={(e) => setNewHanzi(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="ピンイン (例: túshūguǎn)"
              value={newPinyin}
              onChange={(e) => setNewPinyin(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="日本語訳 (例: 図書館)"
              value={newJa}
              onChange={(e) => setNewJa(e.target.value)}
              required
            />
            <select className="select" value={newPos} onChange={(e) => setNewPos(e.target.value)}>
              {['名詞', '動詞', '形容詞', '副詞', '代詞', '介詞', '量詞', '接続詞'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="row-wrap">
            <button type="submit" className="btn btn-primary btn-sm">登録する</button>
            <button type="button" className="btn btn-sm" onClick={() => setShowAddForm(false)}>キャンセル</button>
          </div>
        </form>
      )}

      <div className="card stack-md">
        <div className="grid-4">
          <input
            type="search"
            className="input"
            placeholder="簡体字・ピンイン・日本語訳を検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="select" aria-label="課フィルタ" value={lessonFilter} onChange={(e) => setLessonFilter(e.target.value)}>
            <option value="scope">現在の学習範囲内</option>
            <option value="all">全課・補足すべて</option>
            <option value="supplement">独自補足語彙のみ</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
          <select className="select" aria-label="品詞フィルタ" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
            <option value="all">すべての品詞</option>
            {posOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select className="select" aria-label="習熟度・並び替え" value={`${masteryFilter}:${sortBy}`} onChange={(e) => {
            const [m, s] = e.target.value.split(':');
            setMasteryFilter(m as typeof masteryFilter);
            setSortBy(s as typeof sortBy);
          }}>
            <option value="all:lesson">習熟度: 全て / 課順</option>
            <option value="low:mastery">苦手(&lt;40%) / 習熟度順</option>
            <option value="mid:lesson">学習中(40-79%) / 課順</option>
            <option value="high:lesson">習得済み(80%+) / 課順</option>
            <option value="all:pinyin">全て / ピンイン順</option>
          </select>
        </div>

        <div className="row-between">
          <div className="row-wrap">
            <button type="button" className={`btn btn-sm ${onlyFav ? 'btn-soft' : ''}`} onClick={() => setOnlyFav((x) => !x)}>
              <Star size={14} /> お気に入りのみ
            </button>
            <button type="button" className={`btn btn-sm ${hideHanzi ? 'btn-soft' : ''}`} onClick={() => setHideHanzi((x) => !x)}>
              {hideHanzi ? <EyeOff size={14} /> : <Eye size={14} />} 中国語を隠す
            </button>
            <button type="button" className={`btn btn-sm ${hidePinyin ? 'btn-soft' : ''}`} onClick={() => setHidePinyin((x) => !x)}>
              {hidePinyin ? <EyeOff size={14} /> : <Eye size={14} />} ピンインを隠す
            </button>
            <button type="button" className={`btn btn-sm ${hideJa ? 'btn-soft' : ''}`} onClick={() => setHideJa((x) => !x)}>
              {hideJa ? <EyeOff size={14} /> : <Eye size={14} />} 日本語訳を隠す
            </button>
          </div>
          <span className="badge">{filtered.length} 語表示</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>区分</th>
              <th>簡体字</th>
              <th>ピンイン (声調)</th>
              <th>日本語訳</th>
              <th>品詞</th>
              <th>習熟度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const fav = userState.favoritesVocab.includes(v.id);
              const mastery = userState.srs[v.id]?.mastery ?? 0;
              const isCustom = v.id.startsWith('UV-');
              return (
                <tr key={v.id} onClick={() => setDetailItem(v)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className={`badge ${v.source === 'supplement' ? 'badge-warning' : 'badge-accent'}`}>
                      {v.lessonId ?? '補足'}
                    </span>
                  </td>
                  <td className="zh-md" lang="zh-Hans">
                    {hideHanzi ? '••••' : v.hanzi}
                  </td>
                  <td>
                    {hidePinyin ? (
                      '••••'
                    ) : (
                      <span>
                        <ColoredPinyin pinyin={v.pinyin} toneColors={userState.settings.toneColors} />{' '}
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-light)' }}>
                          [{v.tones.join('-')}]
                        </span>
                      </span>
                    )}
                  </td>
                  <td>{hideJa ? '••••' : v.meaningJa}</td>
                  <td>{v.pos}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-wrap">
                      <span className="badge">{mastery}%</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        title="覚えたに設定"
                        onClick={() => rateSrsItem(v.id, 'vocab', 'easy')}
                      >
                        習得
                      </button>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-wrap">
                      <SpeakButton text={v.hanzi} />
                      <button
                        type="button"
                        className={`btn btn-sm ${fav ? 'btn-soft' : ''}`}
                        aria-label="お気に入り"
                        onClick={() => toggleFavoriteVocab(v.id)}
                      >
                        <Star size={14} />
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          aria-label="削除"
                          onClick={() => deleteCustomVocab(v.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailItem && (
        <div className="modal-backdrop" onClick={() => setDetailItem(null)}>
          <div className="modal-panel stack-md" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <div className="row-wrap">
                <span className="badge badge-accent">{detailItem.lessonId ?? '独自補足語彙'}</span>
                <span className="badge">{detailItem.pos}</span>
                {detailItem.measureWord && <span className="badge">量詞: {detailItem.measureWord}</span>}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setDetailItem(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="row-between">
              <div>
                <div className="zh-xl" lang="zh-Hans">{detailItem.hanzi}</div>
                <ColoredPinyin pinyin={detailItem.pinyin} toneColors={userState.settings.toneColors} />
              </div>
              <SpeakButton text={detailItem.hanzi} size="md" label="発音" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{detailItem.meaningJa}</div>
            <div className="card-subtle">
              <strong>意味・用法:</strong> {detailItem.usage}
            </div>
            {describeToneSandhi(detailItem.hanzi, detailItem.pinyin) && (
              <div className="banner banner-info">
                <strong>変調の注意:</strong> {describeToneSandhi(detailItem.hanzi, detailItem.pinyin)}
              </div>
            )}
            <div className="card-subtle stack-sm">
              <strong>独自例文</strong>
              <div className="row-between">
                <span className="zh-md" lang="zh-Hans">{detailItem.example.hanzi}</span>
                <SpeakButton text={detailItem.example.hanzi} />
              </div>
              <div className="pinyin-text">{detailItem.example.pinyin}</div>
              <div>{detailItem.example.ja}</div>
            </div>
            {(detailItem.synonyms?.length || detailItem.antonyms?.length || detailItem.related?.length) && (
              <div className="row-wrap" style={{ fontSize: '0.88rem' }}>
                {detailItem.synonyms?.length && <span className="badge">類義語: {detailItem.synonyms.join(', ')}</span>}
                {detailItem.antonyms?.length && <span className="badge">反義語: {detailItem.antonyms.join(', ')}</span>}
                {detailItem.related?.length && <span className="badge">関連語: {detailItem.related.join(', ')}</span>}
              </div>
            )}
            {detailItem.grammarIds.length > 0 && (
              <div className="row-wrap">
                {detailItem.grammarIds.map((gid) => (
                  <Link key={gid} to={`/grammar/${gid}`} className="btn btn-sm btn-soft" onClick={() => setDetailItem(null)}>
                    関連文法: {grammarMap.get(gid)?.title ?? gid}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
