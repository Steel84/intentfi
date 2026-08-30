import { SwapIntent } from '../types';

type Props = {
  intent: SwapIntent;
  conditions: string[];
  onContinue: () => void;
  onCancel: () => void;
};

export function UnsupportedConditionsGate({ intent, conditions, onContinue, onCancel }: Props) {
  return (
    <div className="card unsupported-gate">
      <h3>Conditions We Cannot Enforce</h3>
      <p className="gate-intro">
        We understood your swap (
        <strong>
          {intent.amountIn} {intent.tokenIn} \u2192 {intent.tokenOut}
        </strong>
        ), but the following conditions are outside what IntentFi can enforce on-chain:
      </p>
      <ul className="gate-conditions">
        {conditions.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
      <p className="gate-warning">
        If you continue, these conditions will be <strong>ignored</strong>. The swap will proceed
        with only the standard safety checks (slippage, price impact, balance, simulation).
      </p>
      <div className="gate-buttons">
        <button className="btn-gate-continue" onClick={onContinue}>
          Continue without {conditions.length === 1 ? 'this condition' : 'these conditions'}
        </button>
        <button className="btn-gate-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
