import { SimulationResult } from '../types';

export function SimulationDisplay({
  result,
  needsApproval = false,
  isQuoteExpired = false,
  isConfirmed = false,
}: {
  result: SimulationResult;
  needsApproval?: boolean;
  isQuoteExpired?: boolean;
  isConfirmed?: boolean;
}) {
  // If transaction is confirmed, always display in a calm, fully-passed state
  if (isConfirmed) {
    return (
      <div className="card simulation-display pass">
        <div className="card-heading">
          <h3>Simulation / Preflight</h3>
        </div>
        <div>
          <p className="sim-status">✓ Transaction simulated successfully</p>
          <div className="sim-details">
            {result.gasUsed && (
              <div className="sim-detail-row">
                <span>Gas used:</span>
                <span>{Number(result.gasUsed).toLocaleString()}</span>
              </div>
            )}
            <div className="sim-detail-row">
              <span>Balance check:</span>
              <span className="check-pass">✓ Sufficient</span>
            </div>
            <div className="sim-detail-row">
              <span>Allowance check:</span>
              <span className="check-pass">✓ Approved</span>
            </div>
            {result.details && (
              <div className="sim-detail-row">
                <span>Details:</span>
                <span>{result.details}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pre-confirmation logic
  const isApprovalCase = needsApproval || (!result.success && !result.allowanceCheck && result.balanceCheck);
  const cardClass = isApprovalCase
    ? 'warning'
    : isQuoteExpired
      ? 'stale'
      : result.success
        ? 'pass'
        : 'reject';

  return (
    <div className={`card simulation-display ${cardClass}`}>
      <div className="card-heading">
        <h3>Simulation / Preflight</h3>
        {isQuoteExpired && !isApprovalCase && <span className="quote-timer expired">Stale (Quote expired)</span>}
        {isApprovalCase && <span className="quote-timer warning">Needs Approval</span>}
      </div>
      {result.success ? (
        <div>
          {isQuoteExpired ? (
            <p className="sim-status stale">
              ⚠ Preflight passed (stale: quote expired, re-analyze or refresh quote)
            </p>
          ) : (
            <p className="sim-status">✓ Transaction simulated successfully</p>
          )}
          <div className="sim-details">
            {result.gasUsed && (
              <div className="sim-detail-row">
                <span>Gas used:</span>
                <span>{Number(result.gasUsed).toLocaleString()}</span>
              </div>
            )}
            <div className="sim-detail-row">
              <span>Balance check:</span>
              <span className="check-pass">✓ Sufficient</span>
            </div>
            <div className="sim-detail-row">
              <span>Allowance check:</span>
              <span className="check-pass">✓ Approved</span>
            </div>
            {result.details && (
              <div className="sim-detail-row">
                <span>Details:</span>
                <span>{result.details}</span>
              </div>
            )}
          </div>
        </div>
      ) : isApprovalCase ? (
        <div>
          <p className="sim-status warning">⏳ Approval required before simulation can complete</p>
          {result.error && <p className="sim-error warning" style={{ color: 'var(--text-muted)' }}>{result.error}</p>}
          <div className="sim-details">
            <div className="sim-detail-row">
              <span>Balance:</span>
              <span className="check-pass">✓ Sufficient</span>
            </div>
            <div className="sim-detail-row">
              <span>Allowance:</span>
              <span className="check-fail" style={{ color: 'var(--warning)' }}>⏳ Pending approval</span>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="sim-status fail">✗ Simulation Failed</p>
          {result.error && <p className="sim-error">{result.error}</p>}
          <div className="sim-details">
            <div className="sim-detail-row">
              <span>Balance:</span>
              <span className={result.balanceCheck ? 'check-pass' : 'check-fail'}>
                {result.balanceCheck ? '✓ OK' : '✗ Insufficient'}
              </span>
            </div>
            <div className="sim-detail-row">
              <span>Allowance:</span>
              <span className={result.allowanceCheck ? 'check-pass' : 'check-fail'}>
                {result.allowanceCheck ? '✓ OK' : '✗ Not approved'}
              </span>
            </div>
          </div>
          <p className="sim-block">
            <strong>Transaction will NOT be submitted.</strong>
          </p>
        </div>
      )}
    </div>
  );
}
