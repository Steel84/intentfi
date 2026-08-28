import React from 'react';
import { PolicyResult } from '../types';

export function PolicyDisplay({ result }: { result: PolicyResult }) {
  return (
    <div className={`card policy-display ${result.status === 'PASS' ? 'pass' : 'reject'}`}>
      <h3>Policy Check</h3>
      <div className="policy-status">
        Status: <strong>{result.status === 'PASS' ? '\u2713 APPROVED' : '\u2717 REJECTED'}</strong>
      </div>
      <div className="checks">
        {result.checks.map((check, i) => (
          <div key={i} className={`check ${check.passed ? 'passed' : 'failed'}`}>
            <span>{check.passed ? '\u2713' : '\u2717'}</span>
            <span>{check.name}</span>
            {check.actual && <span className="detail">{check.actual}</span>}
            {!check.passed && check.reason && <span className="reason">{check.reason}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
