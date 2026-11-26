import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Switch } from './ui';

interface OrderControlsProps {
  randomOrder: boolean;
  onToggleRandom: () => void;
  onReshuffle: () => void;
  sequentialLabel?: string;
  randomLabel?: string;
}

export const OrderControls: React.FC<OrderControlsProps> = ({
  randomOrder,
  onToggleRandom,
  onReshuffle,
  randomLabel = 'ランダム出題',
}) => {
  return (
    <div className="row-wrap">
      <Switch
        checked={randomOrder}
        onChange={() => onToggleRandom()}
        label={randomLabel}
        testId="random-order-toggle"
        ariaLabel="出題順のランダム切り替え"
      />
      {randomOrder && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onReshuffle}
          data-testid="reshuffle-btn"
          title="並び順をシャッフルし直す"
        >
          <RefreshCw size={13} />
          <span>再シャッフル</span>
        </button>
      )}
    </div>
  );
};
