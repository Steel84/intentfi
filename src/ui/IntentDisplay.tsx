import React from 'react';
import { SwapIntent } from '../types';

export function IntentDisplay({ intent }: { intent: SwapIntent }) {
  return (
    <div className="card intent-display">
      <h3>Parsed Intent</h3>
      <div className="intent-fields">
        <div className="field"><span>Action:</span> <strong>{intent.action.toUpperCase()}</strong></div>
        <div className="field"><span>Input:</span> <strong>{intent.amountIn} {intent.tokenIn}</strong></div>
        <div className="field"><span>Output:</span> <strong>{intent.tokenOut}</strong></div>
        <div className="field"><span>Max Slippage:</span> <strong>{intent.maxSlippageBps / 100}%</strong></div>
        <div className="field"><span>Chain:</span> <strong>Sepolia ({intent.chainId})</strong></div>
      </div>
    </div>
  );
}
