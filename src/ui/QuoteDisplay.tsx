import React from 'react';
import { Quote } from '../types';

export function QuoteDisplay({ quote }: { quote: Quote }) {
  return (
    <div className="card quote-display">
      <h3>Live Quote</h3>
      <div className="intent-fields">
        <div className="field"><span>Input:</span> <strong>{quote.inputAmount}</strong></div>
        <div className="field"><span>Expected Output:</span> <strong>{quote.expectedOutput}</strong></div>
        <div className="field"><span>Minimum Output:</span> <strong>{quote.minimumOutput}</strong></div>
        <div className="field"><span>Price Impact:</span> <strong>{quote.priceImpactBps / 100}%</strong></div>
        <div className="field"><span>Gas Estimate:</span> <strong>{quote.gasEstimate}</strong></div>
        {quote.route && <div className="field"><span>Route:</span> <strong>{quote.route}</strong></div>}
      </div>
    </div>
  );
}
