import { useState } from 'react';
import { SwapIntent, Quote } from '../types';

type Props = {
  intent: SwapIntent;
  quote: Quote;
  onConfirmClick: () => void;
  onCancelClick: () => void;
};

export function ExecutionPanel({ intent, quote, onConfirmClick, onCancelClick }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirmClick();
    setConfirming(false);
  };

  return (
    <div className="card execution-panel">
      <h3>Ready to Execute</h3>
      <div className="execution-summary">
        <p>You are swapping:</p>
        <p className="swap-detail">
          <strong>{intent.amountIn} {intent.tokenIn}</strong>
          <span> \u2192 </span>
          <strong>{quote.expectedOutput}</strong>
        </p>
        <p>Max slippage: {intent.maxSlippageBps / 100}%</p>
        <p>Network: Sepolia (testnet)</p>
        <p>Protocol: Uniswap V3</p>
      </div>
      <div className="execution-buttons">
        <button
          className="btn-confirm"
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming ? 'Sending...' : 'Confirm Transaction'}
        </button>
        <button
          className="btn-cancel"
          onClick={onCancelClick}
          disabled={confirming}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
