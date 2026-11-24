import React, { useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatScopeSummary } from '../utils/scope';
import { ScopeSelectorModal } from '../components/ScopeSelectorModal';

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
    <div className="stack-lg">
      <div>
        <h2 style={{ margin: 0 }}>設定・データ管理</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          学習範囲・表示設定・学習データのJSONバックアップ（エクスポート/インポート）を管理します。
        </p>
      </div>

      <div className="card stack-md">
        <h3 style={{ margin: 0 }}>表示・学習設定</h3>
        <div className="row-between">
          <div>
            <strong>現在の学習範囲:</strong> {formatScopeSummary(userState.scope)}
          </div>
          <button type="button" className="btn btn-soft" onClick={() => setScopeOpen(true)}>
            学習範囲を変更
          </button>
        </div>

        <div className="grid-3">
          <label className="card-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={userState.settings.showPinyin}
              onChange={(e) => updateSettings({ showPinyin: e.target.checked })}
            />
            <span>例文にピンインを表示する</span>
          </label>
          <label className="card-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={userState.settings.toneColors}
              onChange={(e) => updateSettings({ toneColors: e.target.checked })}
            />
            <span>ピンインを声調別に色分けする</span>
          </label>
          <label className="card-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={userState.settings.theme === 'dark'}
              onChange={(e) => updateSettings({ theme: e.target.checked ? 'dark' : 'light' })}
            />
            <span>ダークモードを有効にする</span>
          </label>
        </div>
      </div>

      <div className="card stack-md">
        <h3 style={{ margin: 0 }}>学習データのエクスポート / インポート（JSON）</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          すべての回答履歴・作文記録・SRS習熟度・メモ・お気に入りを端末外へバックアップできます。
        </p>

        <div className="row-wrap">
          <button type="button" className="btn btn-primary" onClick={handleExportJson} data-testid="export-json-btn">
            <Download size={16} /> 学習データをJSONエクスポート
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> JSONファイルから読み込む
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>

        <div className="stack-sm">
          <label htmlFor="import-json-textarea" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            またはバックアップJSONを直接貼り付けてインポート
          </label>
          <textarea
            id="import-json-textarea"
            rows={5}
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
              インポートを実行すると、現在の学習履歴・設定が読み込んだデータで上書きされます。よろしいですか？
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
              <button type="button" className="btn btn-sm" onClick={() => setPendingOverwriteJson(null)}>
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
      </div>

      <div className="card stack-sm">
        <h3 style={{ margin: 0, color: 'var(--danger)' }}>データ初期化</h3>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          端末内の学習履歴をすべて削除し、初期状態に戻します。
        </p>
        <div>
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
            <RotateCcw size={14} /> 学習データをリセット
          </button>
        </div>
      </div>

      <ScopeSelectorModal open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </div>
  );
};
