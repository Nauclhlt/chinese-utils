import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Download,
  FileUp,
  Heart,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { bundledWorks } from '../data';
import {
  deleteLocalWork,
  exportLocalWorksBackup,
  listLocalWorks,
  saveLocalWork,
} from '../core/localWorksDb';
import { validateWork } from '../core/validateWork';
import { loadReaderState, saveReaderState } from '../core/readerStorage';
import type { BundledOrLocalWorkEntry, LiteratureWork } from '../types/work';

export const BookshelfPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [readerState, setReaderState] = useState(() => loadReaderState());
  const [localEntries, setLocalEntries] = useState<BundledOrLocalWorkEntry[]>([]);
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'reading' | 'completed' | 'favorite'>('all');
  const [sortBy, setSortBy] = useState<'lastRead' | 'title' | 'chars' | 'progress'>('lastRead');

  // Import state
  const [dragOver, setDragOver] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    work: LiteratureWork;
    warnings: string[];
    isDuplicate: boolean;
  } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<string>('');

  const refreshLocalWorks = async () => {
    const items = await listLocalWorks();
    setLocalEntries(
      items.map((item) => ({
        work: item.work,
        origin: 'local',
        importedAt: item.importedAt,
      }))
    );
  };

  useEffect(() => {
    void refreshLocalWorks();
  }, []);

  useEffect(() => {
    saveReaderState(readerState);
  }, [readerState]);

  const allEntries = useMemo<BundledOrLocalWorkEntry[]>(() => {
    const map = new Map<string, BundledOrLocalWorkEntry>();
    for (const w of bundledWorks) {
      map.set(w.metadata.id, { work: w, origin: 'bundled' });
    }
    for (const local of localEntries) {
      map.set(local.work.metadata.id, local);
    }
    return Array.from(map.values());
  }, [localEntries]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) {
      for (const g of e.work.metadata.genres) set.add(g);
    }
    return Array.from(set);
  }, [allEntries]);

  const getWorkStatus = (work: LiteratureWork): 'unread' | 'reading' | 'completed' => {
    const prog = readerState.progressByWork[work.metadata.id];
    if (!prog) return 'unread';
    if (prog.completed) return 'completed';
    return 'reading';
  };

  const getProgressPercent = (work: LiteratureWork): number => {
    const prog = readerState.progressByWork[work.metadata.id];
    if (!prog) return 0;
    if (prog.completed) return 100;
    const total = Math.max(1, work.chapters.length);
    return Math.round(((prog.currentChapterIndex + 1) / total) * 100);
  };

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allEntries.filter(({ work }) => {
      const st = getWorkStatus(work);
      if (statusFilter === 'favorite' && !readerState.favoriteWorkIds.includes(work.metadata.id)) {
        return false;
      }
      if (
        (statusFilter === 'unread' || statusFilter === 'reading' || statusFilter === 'completed') &&
        st !== statusFilter
      ) {
        return false;
      }
      if (genreFilter !== 'all' && !work.metadata.genres.includes(genreFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        work.metadata.titleZh.toLowerCase().includes(q) ||
        work.metadata.titleJa.toLowerCase().includes(q) ||
        work.metadata.author.toLowerCase().includes(q) ||
        work.metadata.synopsis.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'title') {
        return a.work.metadata.titleZh.localeCompare(b.work.metadata.titleZh, 'zh');
      }
      if (sortBy === 'chars') {
        return b.work.metadata.charCount - a.work.metadata.charCount;
      }
      if (sortBy === 'progress') {
        return getProgressPercent(b.work) - getProgressPercent(a.work);
      }
      const la = readerState.progressByWork[a.work.metadata.id]?.lastReadAt ?? '';
      const lb = readerState.progressByWork[b.work.metadata.id]?.lastReadAt ?? '';
      return lb.localeCompare(la);
    });
  }, [allEntries, search, genreFilter, statusFilter, sortBy, readerState]);

  const toggleFavorite = (workId: string) => {
    setReaderState((prev) => {
      const exists = prev.favoriteWorkIds.includes(workId);
      return {
        ...prev,
        favoriteWorkIds: exists
          ? prev.favoriteWorkIds.filter((id) => id !== workId)
          : [...prev.favoriteWorkIds, workId],
      };
    });
  };

  const processImportedText = (rawText: string, byteSize: number) => {
    setImportErrors([]);
    setPendingImport(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      setImportErrors([`JSON構文エラー: ${e instanceof Error ? e.message : String(e)}`]);
      return;
    }

    // Handle full local backup format
    if (
      parsed &&
      typeof parsed === 'object' &&
      'works' in parsed &&
      Array.isArray((parsed as { works: unknown }).works)
    ) {
      const worksArr = (parsed as { works: unknown[] }).works;
      void (async () => {
        let importedCount = 0;
        const errs: string[] = [];
        for (const item of worksArr) {
          const res = validateWork(item);
          if (res.valid) {
            await saveLocalWork(item as LiteratureWork);
            importedCount++;
          } else {
            errs.push(...res.errors);
          }
        }
        await refreshLocalWorks();
        if (errs.length > 0) setImportErrors(errs);
        setToast(`バックアップから ${importedCount}作品を復元しました。`);
      })();
      return;
    }

    const res = validateWork(parsed, byteSize);
    if (!res.valid) {
      setImportErrors(res.errors);
      return;
    }
    const candidate = parsed as LiteratureWork;
    const isDuplicate = allEntries.some((e) => e.work.metadata.id === candidate.metadata.id);
    setPendingImport({ work: candidate, warnings: res.warnings, isDuplicate });
  };

  const handleFileSelected = async (file: File) => {
    const text = await file.text();
    processImportedText(text, file.size);
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    await saveLocalWork(pendingImport.work);
    await refreshLocalWorks();
    setToast(`ローカル作品「${pendingImport.work.metadata.titleZh}」を追加・保存しました。`);
    setPendingImport(null);
  };

  const handleDeleteLocal = async (workId: string, titleZh: string) => {
    await deleteLocalWork(workId);
    await refreshLocalWorks();
    setToast(`ローカル作品「${titleZh}」を削除しました。`);
  };

  const exportSingleWork = (work: LiteratureWork) => {
    const blob = new Blob([JSON.stringify(work, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${work.metadata.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupAll = async () => {
    const raw = await exportLocalWorksBackup();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chinese-reader-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack-lg" data-testid="bookshelf-page">
      <header className="page-header row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">注釈付き中国語文学リーダー・本棚</h1>
          <p className="page-subtitle">
            現代中国語の文学作品を読みながら、語彙・文法・表現・文化的背景を直感的に参照できます。
          </p>
        </div>
        <div className="row-wrap" style={{ gap: 8 }}>
          <span className="pill-meta">収録・登録作品 {allEntries.length}作</span>
          {localEntries.length > 0 && (
            <button type="button" className="btn btn-sm btn-soft" onClick={() => void handleBackupAll()}>
              <Download size={14} /> ローカル作品をバックアップ
            </button>
          )}
        </div>
      </header>

      {toast && (
        <div className="banner banner-success" data-testid="bookshelf-toast">
          {toast}
        </div>
      )}

      {/* Search / Filter / Sort */}
      <div className="row-wrap" style={{ gap: 10 }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="search"
            className="input"
            style={{ paddingLeft: 32, width: '100%' }}
            placeholder="タイトル・著者・あらすじで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="bookshelf-search"
          />
        </div>
          <select
            className="select"
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            aria-label="ジャンルで絞り込む"
          >
            <option value="all">すべてのジャンル</option>
            {allGenres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="読書状態で絞り込む"
          >
            <option value="all">すべて表示</option>
            <option value="unread">未読</option>
            <option value="reading">読書中</option>
            <option value="completed">読了</option>
            <option value="favorite">お気に入り</option>
          </select>
          <select
            className="select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="並べ替え"
          >
            <option value="lastRead">最終閲覧順</option>
            <option value="title">作品名順</option>
            <option value="chars">文字数順</option>
            <option value="progress">進捗順</option>
          </select>
      </div>

      {/* Bookshelf Grid */}
      <div className="bookshelf-grid">
        {filteredEntries.map(({ work, origin }) => {
          const st = getWorkStatus(work);
          const pct = getProgressPercent(work);
          const prog = readerState.progressByWork[work.metadata.id];
          const isFav = readerState.favoriteWorkIds.includes(work.metadata.id);
          return (
            <article key={work.metadata.id} className="book-card" data-testid={`book-card-${work.metadata.id}`}>
              <div className="book-cover-wrap">
                {work.metadata.coverImage ? (
                  <img
                    src={work.metadata.coverImage}
                    alt={work.metadata.coverAlt ?? `${work.metadata.titleZh} 表紙`}
                    className="book-cover-img"
                  />
                ) : (
                  <div
                    className="book-cover-img"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 8, textAlign: 'center', fontSize: '0.85rem' }}
                    lang={work.metadata.script}
                  >
                    {work.metadata.titleZh}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-between" style={{ gap: 6 }}>
                    <span className={`badge ${origin === 'local' ? 'badge-warning' : 'badge-accent'}`}>
                      {origin === 'local' ? 'ローカル保存' : 'サイト同梱'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => toggleFavorite(work.metadata.id)}
                      aria-label="お気に入り切替"
                      title="お気に入り切替"
                    >
                      <Heart size={14} fill={isFav ? 'currentColor' : 'none'} color={isFav ? '#dc2626' : 'currentColor'} />
                    </button>
                  </div>
                  <h3 className="zh-md" lang={work.metadata.script} style={{ margin: '6px 0 2px' }}>
                    {work.metadata.titleZh}
                  </h3>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                    {work.metadata.titleJa} / {work.metadata.author}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
                    {work.metadata.script === 'zh-Hant' ? '繁体字' : '簡体字'}・約{work.metadata.charCount}字・全{work.metadata.chapterCount}章
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div className="row-wrap" style={{ gap: 6 }}>
                  {work.metadata.genres.map((g) => (
                    <span key={g} className="badge">{g}</span>
                  ))}
                  <span className="badge badge-success">
                    {st === 'completed' ? '読了' : st === 'reading' ? `読書中 (${pct}%)` : '未読'}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}>{work.metadata.synopsis}</p>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <strong>難易度目安:</strong> {work.metadata.estimatedDifficulty}
                  {prog?.lastReadAt && (
                    <div>最終閲覧: {new Date(prog.lastReadAt).toLocaleDateString('ja-JP')}</div>
                  )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 6 }} className="row-between">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate(`/reader/${work.metadata.id}`)}
                    data-testid={`open-work-${work.metadata.id}`}
                  >
                    <BookOpen size={14} /> {st === 'reading' ? '続きを読む' : '読み始める'}
                  </button>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => exportSingleWork(work)}
                      title="JSONエクスポート"
                    >
                      <Download size={13} />
                    </button>
                    {origin === 'local' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void handleDeleteLocal(work.metadata.id, work.metadata.titleZh)}
                        data-testid={`delete-local-${work.metadata.id}`}
                        title="ローカル作品を削除"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Local JSON Import Panel */}
      <section className="card stack-md" data-testid="local-import-section">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>新しい作品JSONをローカルに追加（外部送信なし）</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              仕様バージョン 1.0.0 の単一JSON作品をブラウザ内の IndexedDB に保存します。個人利用の作品も外部サーバーへ送信されません。
            </p>
          </div>
          <Link to="/settings" className="btn btn-sm btn-soft">
            詳細設定へ
          </Link>
        </div>

        <div
          className={`reader-dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        >
          <Upload size={22} style={{ marginBottom: 6, color: 'var(--accent)' }} />
          <div style={{ fontWeight: 600 }}>作品JSONファイルをここにドラッグ＆ドロップ</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>
            またはファイルを選択してください（スキーマ・注釈位置・安全性を事前検証します）
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            data-testid="reader-import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={14} /> JSONファイルを選択
          </button>
        </div>

        {importErrors.length > 0 && (
          <div
            className="card-subtle stack-xs"
            style={{ borderLeft: '4px solid var(--danger)' }}
            data-testid="reader-import-error"
          >
            <strong style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={16} /> 検証エラーのためインポートを拒否しました
            </strong>
            <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.86rem' }}>
              {importErrors.slice(0, 8).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {pendingImport && (
          <div
            className="card-subtle stack-sm"
            style={{ borderLeft: '4px solid var(--accent)' }}
            data-testid="reader-import-preview"
          >
            <div className="row-between">
              <strong>インポート前プレビュー（検証合格）</strong>
              {pendingImport.isDuplicate && (
                <span className="badge badge-warning">既存ID重複：上書き更新されます</span>
              )}
            </div>
            <div>
              <strong lang={pendingImport.work.metadata.script}>
                {pendingImport.work.metadata.titleZh}
              </strong>{' '}
              ({pendingImport.work.metadata.titleJa}) — 著者: {pendingImport.work.metadata.author} / 全
              {pendingImport.work.chapters.length}章 / {pendingImport.work.metadata.charCount}字
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              権利表記: {pendingImport.work.metadata.rights.notice}
            </div>
            {pendingImport.warnings.length > 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>
                警告: {pendingImport.warnings.join(' / ')}
              </div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => void confirmImport()}
                data-testid="reader-confirm-import-btn"
              >
                {pendingImport.isDuplicate ? '上書きして保存' : '本棚に追加'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPendingImport(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
