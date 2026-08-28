import { PolicyResult } from '../types';

export function PolicyDisplay({ result }: { result: PolicyResult }) {
  const passed = result.status === 'PASS';
  return (
    <div className={`card policy-display ${passed ? 'pass' : 'reject'}`}>
      <h3>Deterministic Policy</h3>
      <div className="policy-status">
        Status: <strong>{passed ? '✓ APPROVED FOR REVIEW' : '✗ REJECTED'}</strong>
      </div>
      <p className="policy-explanation">
        {passed
          ? 'Every configured safety check passed. You still control the final wallet approval.'
          : 'Execution is blocked because one or more safety checks failed.'}
      </p>
      <div className="checks">
        {result.checks.map((check, i) => (
          <div key={`${check.name}-${i}`} className={`check ${check.passed ? 'passed' : 'failed'}`}>
            <span>{check.passed ? '✓' : '✗'}</span>
            <span>{check.name}</span>
            {check.actual && <span className="detail">{check.actual}</span>}
            {!check.passed && check.reason && <span className="reason">{check.reason}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
