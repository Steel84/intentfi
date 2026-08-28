import { TxHistoryEntry } from './useSwapFlow';
import { CHAIN_CONFIG } from '../config';

type Props = {
  entries: TxHistoryEntry[];
};

export function TxHistory({ entries }: Props) {
  return (
    <div className="card tx-history">
      <h3>Recent Transactions</h3>
      <div className="history-list">
        {entries.map((entry) => (
          <div key={entry.hash} className="history-item">
            <div className="history-detail">
              <span className="history-action">
                {entry.intent.amountIn} {entry.intent.tokenIn} \u2192 {entry.intent.tokenOut}
              </span>
              <span className="history-time">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <a
              href={`${CHAIN_CONFIG.explorer}/tx/${entry.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="history-link"
            >
              {entry.hash.slice(0, 10)}...{entry.hash.slice(-6)}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
