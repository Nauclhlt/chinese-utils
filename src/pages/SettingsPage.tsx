import React, { useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatScopeSummary } from '../utils/scope';
import { ScopeSelectorModal } from '../components/ScopeSelectorModal';
import { Switch } from '../components/ui';

export const SettingsPage: React.FC = () => {
  const { userState, updateSettings, importUserStateJson, resetUserState } = useApp();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [pendingOverwriteJson, setPendingOverwriteJson] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const handleExportJson = () => {
    const json = JSON.stringify(userState, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chinese-learning-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setImportText(content);
      setPendingOverwriteJson(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  const confirmImport = (raw: string) => {
    const res = importUserStateJson(raw);
    if (res.ok) {
      setStatusMsg({ type: 'success', text: '学習データを正常にインポートしました。' });
      setPendingOverwriteJson(null);
      setImportText('');
    } else {
      setStatusMsg({ type: 'danger', text: res.error ?? 'インポートに失敗しました。' });
    }
  };

  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <header className="page-header">
        <div>
          <h2 className="page-title">設定・データ管理</h2>
          <p className="page-subtitle">学習範囲・表示設定・JSONバックアップ</p>
        </div>
      </header>

      <section className="stack-xs">
        <h3 className="section-heading">表示・学習設定</h3>
        <div className="card" style={{ padding: '4px 18px' }}>
          <div className="setting-row">
            <div>
              <div style={{ fontWeight: 500 }}>学習範囲</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                {formatScopeSummary(userState.scope)}
              </div>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setScopeOpen(true)}>
              変更
            </button>
          </div>

          <div className="setting-row">
            <div>
              <div style={{ fontWeight: 500 }}>例文のピンイン</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                課別・文法解説の例文にピンインを併記
              </div>
            </div>
            <Switch
              checked={userState.settings.showPinyin}
              onChange={(checked) => updateSettings({ showPinyin: checked })}
              label=""
              ariaLabel="例文にピンインを表示する"
            />
          </div>

          <div className="setting-row">
            <div>
              <div style={{ fontWeight: 500 }}>声調の色分け</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                第1〜4声・軽声を色分け表示
              </div>
            </div>
            <Switch
              checked={userState.settings.toneColors}
              onChange={(checked) => updateSettings({ toneColors: checked })}
              label=""
              ariaLabel="ピンインを声調別に色分けする"
            />
          </div>

          <div className="setting-row">
            <div>
              <div style={{ fontWeight: 500 }}>ダークテーマ</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                画面全体の配色を暗色表示に切り替え
              </div>
            </div>
            <Switch
              checked={userState.settings.theme === 'dark'}
              onChange={(checked) => updateSettings({ theme: checked ? 'dark' : 'light' })}
              label=""
              ariaLabel="ダークモードを有効にする"
            />
          </div>
        </div>
      </section>

      <section className="doc-section stack-md">
        <div>
          <h3 className="section-heading">JSONバックアップ（エクスポート / インポート）</h3>
          <p className="page-subtitle">回答履歴・作文記録・SRS習熟度・メモ・お気に入りを端末外へ保存できます。</p>
        </div>

        <div className="row-wrap">
          <button type="button" className="btn btn-primary" onClick={handleExportJson} data-testid="export-json-btn">
            <Download size={15} /> JSONエクスポート
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            <Upload size={15} /> ファイルから読み込む
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>

        <div className="stack-sm">
          <label htmlFor="import-json-textarea" style={{ fontSize: '0.86rem', fontWeight: 600 }}>
            JSONテキストを貼り付けて復元
          </label>
          <textarea
            id="import-json-textarea"
            rows={4}
            className="textarea"
            placeholder='{"version": 1, "scope": ...}'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div>
            <button
              type="button"
              className="btn btn-soft"
              disabled={!importText.trim()}
              onClick={() => setPendingOverwriteJson(importText)}
              data-testid="import-json-trigger"
            >
              JSONを検証してインポート
            </button>
          </div>
        </div>

        {pendingOverwriteJson && (
          <div className="banner banner-warning stack-sm" data-testid="import-confirm-box">
            <strong>既存データの上書き確認</strong>
            <p style={{ margin: 0 }}>
              現在の学習履歴・設定が読み込んだデータで上書きされます。よろしいですか？
            </p>
            <div className="row-wrap">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => confirmImport(pendingOverwriteJson)}
                data-testid="import-confirm-btn"
              >
                上書きしてインポートする
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingOverwriteJson(null)}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        {statusMsg && (
          <div className={`banner ${statusMsg.type === 'success' ? 'banner-success' : 'banner-danger'}`}>
            {statusMsg.text}
          </div>
        )}
      </section>

      <section className="doc-section stack-sm">
        <h3 className="section-heading" style={{ color: 'var(--danger)' }}>データ初期化</h3>
        <div className="row-between">
          <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            端末内の学習履歴をすべて削除し、初期状態に戻します。
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('本当にすべての学習データを初期化しますか？')) {
                resetUserState();
                setStatusMsg({ type: 'success', text: '学習データを初期化しました。' });
              }
            }}
          >
            <RotateCcw size={14} /> データをリセット
          </button>
        </div>
      </section>

      <ScopeSelectorModal open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </div>
  );
};
