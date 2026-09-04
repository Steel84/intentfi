import { useState, useEffect } from 'react';
import { SwapIntent, Quote } from '../types';

type Props = {
  intent: SwapIntent;
  quote: Quote;
  onConfirmClick: () => void;
  onCancelClick: () => void;
  onRefreshQuote?: () => void;
};

export function ExecutionPanel({
  intent,
  quote,
  onConfirmClick,
  onCancelClick,
  onRefreshQuote,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, quote.expiresAt - Date.now()));

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, quote.expiresAt - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [quote.expiresAt]);

  const expired = remaining === 0;

  const handleConfirm = async () => {
    if (expired) return;
    setConfirming(true);
    await onConfirmClick();
    setConfirming(false);
  };

  return (
    <div className={`card execution-panel ${expired ? 'quote-expired' : ''}`}>
      <h3>Ready to Execute</h3>
      <div className="execution-summary">
        <p>You are swapping:</p>
        <p className="swap-detail">
          <strong>
            {intent.amountIn} {intent.tokenIn}
          </strong>
          <span> → </span>
          <strong>{quote.expectedOutput}</strong>
        </p>
        <p>Max slippage: {intent.maxSlippageBps / 100}%</p>
        <p>Network: Sepolia (testnet)</p>
        <p>Protocol: Uniswap V3</p>
      </div>
      {expired && (
        <div className="quote-expired-warning">
          Quote expired. Please refresh before confirming.
        </div>
      )}
      <div className="execution-buttons">
        {expired ? (
          <button className="btn-confirm btn-refresh-quote" onClick={onRefreshQuote}>
            Refresh Quote
          </button>
        ) : (
          <button className="btn-confirm" onClick={handleConfirm} disabled={confirming}>
            {confirming ? 'Sending...' : `Confirm Transaction (${Math.ceil(remaining / 1000)}s)`}
          </button>
        )}
        <button className="btn-cancel" onClick={onCancelClick} disabled={confirming}>
          Cancel
        </button>
      </div>
    </div>
  );
}
