import React from 'react';
import { RefreshCw, Shuffle } from 'lucide-react';

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
  sequentialLabel = '順番通り',
  randomLabel = 'ランダム',
}) => {
  return (
    <div className="row-wrap">
      <button
        type="button"
        className={`btn btn-sm ${randomOrder ? 'btn-primary' : ''}`}
        onClick={onToggleRandom}
        data-testid="random-order-toggle"
      >
        <Shuffle size={14} />
        <span>出題順: {randomOrder ? randomLabel : sequentialLabel}</span>
      </button>
      {randomOrder && (
        <button
          type="button"
          className="btn btn-sm btn-soft"
          onClick={onReshuffle}
          data-testid="reshuffle-btn"
        >
          <RefreshCw size={14} />
          <span>シャッフルし直す</span>
        </button>
      )}
    </div>
  );
};
