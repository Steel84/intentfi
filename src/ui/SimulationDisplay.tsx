import { SimulationResult } from '../types';

export function SimulationDisplay({ result }: { result: SimulationResult }) {
  return (
    <div className={`card simulation-display ${result.success ? 'pass' : 'reject'}`}>
      <h3>Simulation / Preflight</h3>
      {result.success ? (
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
