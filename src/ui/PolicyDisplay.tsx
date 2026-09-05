import { PolicyResult } from '../types';

export function PolicyDisplay({
  result,
  needsApproval = false,
  isQuoteExpired = false,
  isConfirmed = false,
}: {
  result: PolicyResult;
  needsApproval?: boolean;
  isQuoteExpired?: boolean;
  isConfirmed?: boolean;
}) {
  // If transaction is confirmed, always display in clean, fully-passed state
  if (isConfirmed) {
    return (
      <div className="card policy-display pass">
        <div className="card-heading">
          <h3>Deterministic Policy</h3>
        </div>
        <div className="policy-status">
          Status: <strong>✓ APPROVED FOR REVIEW</strong>
        </div>
        <p className="policy-explanation">
          Every configured safety check passed. Transaction confirmed on-chain.
        </p>
        <div className="checks">
          {result.checks.map((check, i) => (
            <div key={`${check.name}-${i}`} className="check passed">
              <span>✓</span>
              <span>{check.name}</span>
              {check.actual && <span className="detail">{check.actual}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pre-confirmation logic
  const isOnlyApprovalFailed =
    needsApproval ||
    (result.status === 'REJECT' &&
      result.checks.every((c) => {
        if (c.name === 'Token Allowance Set' || c.name === 'Simulation Passed') return true;
        return c.passed;
      }));

  const isStale = isQuoteExpired && result.status === 'PASS' && !isOnlyApprovalFailed;
  const passed = result.status === 'PASS' && !isQuoteExpired;
  const cardClass = isOnlyApprovalFailed
    ? 'warning'
    : isStale
      ? 'stale'
      : passed
        ? 'pass'
        : 'reject';

  return (
    <div className={`card policy-display ${cardClass}`}>
      <div className="card-heading">
        <h3>Deterministic Policy</h3>
        {isStale && <span className="quote-timer expired">Stale (Quote expired)</span>}
        {isOnlyApprovalFailed && <span className="quote-timer warning">Needs Approval</span>}
      </div>
      <div className="policy-status">
        Status:{' '}
        <strong>
          {isOnlyApprovalFailed
            ? '⏳ NEEDS APPROVAL'
            : isStale
              ? '⚠ STALE (Quote expired)'
              : passed
                ? '✓ APPROVED FOR REVIEW'
                : '✗ REJECTED'}
        </strong>
      </div>
      <p className="policy-explanation">
        {isOnlyApprovalFailed
          ? 'Token approval is required before simulation and swap can execute.'
          : isStale
            ? 'Quote expired after policy check. Please refresh quote before submitting.'
            : passed
              ? 'Every configured safety check passed. You still control the final wallet approval.'
              : 'Execution is blocked because one or more safety checks failed.'}
      </p>
      <div className="checks">
        {result.checks.map((check, i) => {
          const checkExpired = isQuoteExpired && check.name === 'Quote Fresh' && !isOnlyApprovalFailed;
          const isPendingApprovalCheck =
            isOnlyApprovalFailed &&
            (check.name === 'Token Allowance Set' || check.name === 'Simulation Passed');

          if (isPendingApprovalCheck) {
            return (
              <div key={`${check.name}-${i}`} className="check warning">
                <span>⏳</span>
                <span>{check.name}</span>
                <span className="reason" style={{ color: 'var(--warning)' }}>
                  {check.name === 'Token Allowance Set' ? 'Pending approval' : 'Awaiting approval'}
                </span>
              </div>
            );
          }

          const checkPassed = check.passed && !checkExpired;
          const statusClass = checkExpired ? 'failed' : checkPassed ? 'passed' : 'failed';
          return (
            <div key={`${check.name}-${i}`} className={`check ${statusClass}`}>
              <span>{checkExpired ? '⚠' : checkPassed ? '✓' : '✗'}</span>
              <span>{check.name}</span>
              {check.actual && <span className="detail">{check.actual}</span>}
              {checkExpired ? (
                <span className="reason">Expired</span>
              ) : (
                !check.passed && check.reason && <span className="reason">{check.reason}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
