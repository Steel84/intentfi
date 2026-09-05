import { useEffect, useState } from 'react';
import { Quote } from '../types';

type Props = {
  quote: Quote;
  onRefresh?: () => void;
  isConfirmed?: boolean;
};

export function QuoteDisplay({ quote, onRefresh, isConfirmed = false }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, quote.expiresAt - Date.now()));

  useEffect(() => {
    if (isConfirmed) return;
    const update = () => setRemaining(Math.max(0, quote.expiresAt - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [quote.expiresAt, isConfirmed]);

  const expired = !isConfirmed && remaining === 0;

  return (
    <div className={`card quote-display ${expired ? 'quote-expired' : ''}`}>
      <div className="card-heading">
        <h3>Live Quote</h3>
        <span className={`quote-timer ${expired ? 'expired' : ''}`}>
          {isConfirmed ? 'Executed' : expired ? 'Expired' : `Valid for ${Math.ceil(remaining / 1000)}s`}
        </span>
      </div>
      <div className="intent-fields">
        <div className="field">
          <span>Input:</span> <strong>{quote.inputAmount}</strong>
        </div>
        <div className="field">
          <span>Expected Output:</span> <strong>{quote.expectedOutput}</strong>
        </div>
        <div className="field">
          <span>Minimum Output:</span> <strong>{quote.minimumOutput}</strong>
        </div>
        <div className="field">
          <span>Max Slippage:</span> <strong>{quote.slippageBps / 100}%</strong>
        </div>
        <div className="field">
          <span>Price Impact:</span>{' '}
          <strong>
            {typeof quote.priceImpactBps === 'number'
              ? `${quote.priceImpactBps / 100}%`
              : 'Unavailable'}
          </strong>
        </div>
        <div className="field">
          <span>Gas Estimate:</span> <strong>{quote.gasEstimate}</strong>
        </div>
        {quote.route && (
          <div className="field">
            <span>Route:</span> <strong>{quote.route}</strong>
          </div>
        )}
      </div>
      {expired && onRefresh && (
        <button className="btn-refresh-quote" onClick={onRefresh}>
          Refresh quote
        </button>
      )}
    </div>
  );
}
