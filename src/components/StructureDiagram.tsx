import React from 'react';
import type { StructureSlot } from '../types/curriculum';
import { useApp } from '../context/AppContext';

export const StructureDiagram: React.FC<{ slots: StructureSlot[] }> = ({ slots }) => {
  const { userState } = useApp();
  return (
    <div className="slot-list" role="region" aria-label="語順構造図">
      {slots.map((slot, idx) => (
        <div key={idx} className={`slot-box slot-role-${slot.role}`}>
          <span className="slot-label">{slot.label}</span>
          <span className="slot-text" lang="zh-Hans">
            {slot.text}
          </span>
          {userState.settings.showPinyin && slot.pinyin && (
            <span style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: 2 }}>
              {slot.pinyin}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
