import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  testId?: string;
  ariaLabel?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  id,
  testId,
  ariaLabel,
}) => {
  return (
    <label htmlFor={id} className="ui-switch-wrap">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        data-testid={testId}
        className="ui-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="ui-switch-thumb" aria-hidden="true" />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
};

interface TabItem {
  id: string;
  label: string;
  testId?: string;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeId, onChange, ariaLabel }) => {
  return (
    <div className="tabs-bar" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={item.testId}
            className={`tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export const ProgressBar: React.FC<{ percent: number; label?: string }> = ({ percent, label }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
};
