import { AppState } from './App';
import { PolicyResult, Quote, SimulationResult } from '../types';

type Props = {
  state: AppState;
  quote: Quote | null;
  policy: PolicyResult | null;
  simulation: SimulationResult | null;
};

export function AgentStatus({ state, quote, policy, simulation }: Props) {
  const message =
    state === 'quoting'
      ? 'Getting a live Uniswap V3 quote. No transaction has been created yet.'
      : state === 'checking-policy'
        ? 'The proposal is ready. Deterministic safety rules are checking it now.'
        : state === 'simulating'
          ? 'Preflight is checking balance, allowance, gas, and on-chain execution.'
          : state === 'ready'
            ? `All checks passed${quote?.route ? ` on ${quote.route}` : ''}. Your wallet is the only thing that can approve this swap.`
            : state === 'executing'
              ? 'Waiting for your wallet signature, then confirmation from Sepolia.'
              : policy?.status === 'REJECT'
                ? 'The policy blocked this proposal. Nothing can be submitted until the failed checks pass.'
                : simulation && !simulation.success
                  ? 'Preflight failed. The transaction is blocked and was not submitted.'
                  : null;

  if (!message) return null;
  return (
    <div className="agent-status" role="status">
      <span className="agent-pulse" />
      {message}
    </div>
  );
}
