
import { SimulationResult } from '../types';

export function SimulationDisplay({ result }: { result: SimulationResult }) {
  return (
    <div className={`card simulation-display ${result.success ? 'pass' : 'reject'}`}>
      <h3>Simulation</h3>
      {result.success ? (
        <div>
          <p className="sim-status">\u2713 Transaction simulated successfully</p>
          {result.gasUsed && <p>Gas used: {result.gasUsed}</p>}
        </div>
      ) : (
        <div>
          <p className="sim-status fail">\u2717 Simulation Failed</p>
          {result.error && <p className="reason">{result.error}</p>}
          <p><strong>Transaction will NOT be submitted.</strong></p>
        </div>
      )}
    </div>
  );
}
