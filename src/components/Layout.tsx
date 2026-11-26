import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Award,
  BookOpen,
  BookMarked,
  CheckSquare,
  Compass,
  FileEdit,
  Gamepad2,
  GitCompare,
  Headphones,
  Home,
  Layers,
  Library,
  Menu,
  Moon,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatScopeSummary } from '../utils/scope';
import { ScopeSelectorModal } from './ScopeSelectorModal';

const NAV_GROUPS = [
  {
    label: '学習ホーム・体系',
    items: [
      { to: '/', label: 'ダッシュボード', icon: Home },
      { to: '/lessons', label: '課別学習 (全22課)', icon: BookOpen },
      { to: '/grammar', label: '文法辞典', icon: BookMarked },
      { to: '/comparisons', label: '類似表現の比較', icon: GitCompare },
      { to: '/grammar-map', label: '文法学習マップ', icon: Compass },
    ],
  },
  {
    label: '暗記・基礎練習',
    items: [
      { to: '/vocab', label: '単語帳', icon: Layers },
      { to: '/flashcards', label: 'フラッシュカード', icon: RotateCcw },
      { to: '/pinyin', label: 'ピンイン・声調練習', icon: Volume2 },
      { to: '/listening', label: '音声・リスニング', icon: Headphones },
    ],
  },
  {
    label: '実践・作文・試験',
    items: [
      { to: '/practice/grammar', label: '文法練習問題', icon: CheckSquare },
      { to: '/practice/composition', label: '中国語作文練習', icon: FileEdit },
      { to: '/exam', label: '総合テスト・模試', icon: Award },
    ],
  },
  {
    label: 'ゲームで学ぶ',
    items: [
      { to: '/games', label: 'ゲームセンター (4種)', icon: Gamepad2 },
    ],
  },
  {
    label: '文学で学ぶ',
    items: [
      { to: '/reader', label: '中国語文学リーダー', icon: Library },
    ],
  },
  {
    label: '復習・管理',
    items: [
      { to: '/review', label: '復習・苦手・履歴', icon: RotateCcw },
      { to: '/settings', label: '設定・データ管理', icon: Settings },
    ],
  },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userState, updateSettings, setLastVisited, speechSupport, corruptedStorageDetected } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
    const flat = NAV_GROUPS.flatMap((g) => g.items);
    const found = flat.find((item) => item.to === location.pathname);
    if (found && location.pathname !== '/settings') {
      setLastVisited(location.pathname, found.label);
    }
  }, [location.pathname, setLastVisited]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="メインナビゲーション">
        <div className="sidebar-brand">
          <div className="row-between">
            <h1>
              <span lang="zh-Hans" style={{ color: 'var(--accent)' }}>汉语</span>
              <span>CALL学習スタジオ</span>
            </h1>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="メニューを閉じる"
            >
              <X size={16} />
            </button>
          </div>
          <p>京都大学中国語CALL教材準拠・初級〜初中級</p>
        </div>

        <nav style={{ flex: 1, paddingBottom: 20 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-section-label">{group.label}</div>
              <ul className="nav-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      >
                        <Icon size={17} />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="メニューを開く"
            >
              <Menu size={18} />
              <span>メニュー</span>
            </button>

            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => setScopeOpen(true)}
              data-testid="scope-trigger"
            >
              <SlidersHorizontal size={14} />
              <span>学習範囲: {formatScopeSummary(userState.scope)}</span>
            </button>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className={`btn btn-sm ${userState.settings.showPinyin ? 'btn-soft' : ''}`}
              onClick={() => updateSettings({ showPinyin: !userState.settings.showPinyin })}
              title="ピンイン表示の切り替え"
            >
              ピンイン: {userState.settings.showPinyin ? '表示' : '非表示'}
            </button>

            <button
              type="button"
              className={`btn btn-sm ${userState.settings.toneColors ? 'btn-soft' : ''}`}
              onClick={() => updateSettings({ toneColors: !userState.settings.toneColors })}
              title="声調別色分けの切り替え"
            >
              声調色: {userState.settings.toneColors ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                updateSettings({ theme: userState.settings.theme === 'light' ? 'dark' : 'light' })
              }
              aria-label="テーマ切り替え"
            >
              {userState.settings.theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              <span>{userState.settings.theme === 'light' ? 'ダーク' : 'ライト'}</span>
            </button>
          </div>
        </header>

        <main className="page-content">
          {corruptedStorageDetected && (
            <div className="banner banner-warning" style={{ marginBottom: 16 }}>
              保存されていた学習データの一部が破損していたため、初期状態から安全に復旧しました。設定画面からバックアップJSONを復元できます。
            </div>
          )}
          {!speechSupport.supported && (
            <div className="banner banner-info" style={{ marginBottom: 16, fontSize: '0.84rem' }}>
              音声読み上げ案内: {speechSupport.reason}（テキスト学習・文法・作文・フラッシュカード等の機能はそのままご利用いただけます）
            </div>
          )}
          {children}
        </main>
      </div>

      <ScopeSelectorModal open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </div>
  );
};
