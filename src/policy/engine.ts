import {
  PolicyConfig,
  PolicyResult,
  PolicyCheck,
  SwapIntent,
  Quote,
  SimulationResult,
} from '../types';
import { DEFAULT_POLICY } from '../config';

/**
 * Deterministic Policy Engine
 *
 * Rules:
 * - No LLM calls
 * - No probabilistic decisions
 * - No hidden overrides
 * - Pure function: (intent, quote, simulation, config) => PolicyResult
 */
export function evaluatePolicy(
  intent: SwapIntent,
  quote: Quote,
  simulation: SimulationResult,
  config: PolicyConfig = DEFAULT_POLICY,
): PolicyResult {
  const checks: PolicyCheck[] = [];
  const protocol = 'uniswap-v3';

  checks.push({
    name: 'Chain Allowed',
    passed: intent.chainId === 11155111,
    actual: String(intent.chainId),
    limit: '11155111 (Sepolia)',
    reason: intent.chainId !== 11155111 ? 'Only Sepolia is enabled' : undefined,
  });

  checks.push({
    name: 'Protocol Allowed',
    passed: config.allowedProtocols.map((value) => value.toLowerCase()).includes(protocol),
    actual: protocol,
    limit: config.allowedProtocols.join(', '),
  });

  checks.push({
    name: 'Quote Fresh',
    passed: quote.expiresAt > Date.now(),
    actual: new Date(quote.expiresAt).toISOString(),
    reason: quote.expiresAt <= Date.now() ? 'Quote expired; request a fresh quote' : undefined,
  });

  // 1. Token allowlist
  checks.push({
    name: 'Token In Allowed',
    passed: config.allowedTokens.includes(intent.tokenIn.toUpperCase()),
    actual: intent.tokenIn,
    limit: config.allowedTokens.join(', '),
  });

  checks.push({
    name: 'Token Out Allowed',
    passed: config.allowedTokens.includes(intent.tokenOut.toUpperCase()),
    actual: intent.tokenOut,
    limit: config.allowedTokens.join(', '),
  });

  // 2. Slippage check
  checks.push({
    name: 'Slippage Within Limit',
    passed: intent.maxSlippageBps <= config.maxSlippageBps,
    actual: `${intent.maxSlippageBps} bps`,
    limit: `${config.maxSlippageBps} bps`,
  });

  // 3. Price impact check
  checks.push({
    name: 'Price Impact Within Limit',
    passed:
      typeof quote.priceImpactBps === 'number' && quote.priceImpactBps <= config.maxPriceImpactBps,
    actual:
      typeof quote.priceImpactBps === 'number' ? `${quote.priceImpactBps} bps` : 'unavailable',
    limit: `${config.maxPriceImpactBps} bps`,
    reason:
      typeof quote.priceImpactBps !== 'number'
        ? 'Pool spot price unavailable; execution is blocked'
        : undefined,
  });

  // 4. Simulation passed
  checks.push({
    name: 'Simulation Passed',
    passed: simulation.success,
    reason: simulation.error,
  });

  // 5. Balance sufficient
  checks.push({
    name: 'Balance Sufficient',
    passed: simulation.balanceCheck,
    reason: !simulation.balanceCheck ? 'Insufficient token balance' : undefined,
  });

  // 6. Allowance sufficient
  checks.push({
    name: 'Token Allowance Set',
    passed: simulation.allowanceCheck,
    reason: !simulation.allowanceCheck ? 'Token approval required' : undefined,
  });

  const allPassed = checks.every((c) => c.passed);

  return {
    status: allPassed ? 'PASS' : 'REJECT',
    checks,
  };
}
