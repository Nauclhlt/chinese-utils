import React, { useState } from 'react';
import { X } from 'lucide-react';
import { lessons } from '../data';
import { useApp } from '../context/AppContext';
import type { StudyScope } from '../types/user';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ScopeSelectorModal: React.FC<Props> = ({ open, onClose }) => {
  const { userState, setScope } = useApp();
  const [draft, setDraft] = useState<StudyScope>(userState.scope);

  if (!open) return null;

  const toggleLesson = (id: string) => {
    setDraft((prev) => {
      const exists = prev.selectedLessons.includes(id);
      return {
        ...prev,
        selectedLessons: exists
          ? prev.selectedLessons.filter((x) => x !== id)
          : [...prev.selectedLessons, id],
      };
    });
  };

  const apply = () => {
    setScope(draft);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="学習範囲の設定">
      <div className="modal-panel stack-md">
        <div className="row-between">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>学習範囲（履修済み範囲）の設定</h2>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="閉じる">
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          ここで設定した範囲外の課・未学習の文法事項や語彙は、練習問題・フラッシュカード・総合テストに出題されません。
        </p>

        <div className="row-wrap">
          <button
            type="button"
            className={`btn ${draft.mode === 'upTo' ? 'btn-primary' : ''}`}
            onClick={() => setDraft((p) => ({ ...p, mode: 'upTo' }))}
          >
            第1課〜第N課まで一括指定
          </button>
          <button
            type="button"
            className={`btn ${draft.mode === 'custom' ? 'btn-primary' : ''}`}
            onClick={() => setDraft((p) => ({ ...p, mode: 'custom' }))}
          >
            任意の課を個別に選択
          </button>
        </div>

        {draft.mode === 'upTo' ? (
          <div className="card-subtle stack-sm">
            <label htmlFor="scope-upto-range" style={{ fontWeight: 600 }}>
              現在の履修済み課: 第1課 〜 第{draft.upToLesson}課
            </label>
            <input
              id="scope-upto-range"
              type="range"
              min={1}
              max={22}
              value={draft.upToLesson}
              onChange={(e) => setDraft((p) => ({ ...p, upToLesson: Number(e.target.value) }))}
            />
            <div className="row-wrap">
              {[4, 8, 11, 14, 18, 22].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${draft.upToLesson === n ? 'btn-soft' : ''}`}
                  onClick={() => setDraft((p) => ({ ...p, upToLesson: n }))}
                >
                  第{n}課まで
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="card-subtle stack-sm">
            <div className="row-between">
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                選択中の課 ({draft.selectedLessons.length}課)
              </span>
              <div className="row-wrap">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDraft((p) => ({ ...p, selectedLessons: lessons.map((l) => l.id) }))}
                >
                  全選択
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDraft((p) => ({ ...p, selectedLessons: ['L01'] }))}
                >
                  L01のみ
                </button>
              </div>
            </div>
            <div className="row-wrap">
              {lessons.map((l) => {
                const active = draft.selectedLessons.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`btn btn-sm ${active ? 'btn-primary' : ''}`}
                    onClick={() => toggleLesson(l.id)}
                  >
                    {l.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="row-between" style={{ marginTop: 6 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            ※ 設定は端末内に自動保存され、いつでも変更できます。
          </span>
          <div className="row-wrap">
            <button type="button" className="btn" onClick={onClose}>
              キャンセル
            </button>
            <button type="button" className="btn btn-primary" onClick={apply}>
              この範囲で保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
