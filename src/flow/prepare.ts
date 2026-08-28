import {
  SwapIntent,
  Quote,
  PolicyResult,
  SimulationResult,
  TransactionRequest,
  PolicyConfig,
  SwapProtocol,
} from '../types';
import { CHAIN_CONFIG, DEFAULT_POLICY } from '../config';
import { uniswapAdapter } from '../protocol/uniswap-v3';
import { evaluatePolicy } from '../policy/engine';
import { simulateTransaction } from '../simulation/preflight';

export type PreparedSwap = {
  quote: Quote;
  transaction: TransactionRequest;
  simulation: SimulationResult;
  policyResult: PolicyResult;
};

export type PrepareDependencies = {
  adapter: Pick<SwapProtocol, 'getQuote' | 'buildTransaction'>;
  simulate: (
    intent: SwapIntent,
    tx: TransactionRequest,
    address: `0x${string}`,
  ) => Promise<SimulationResult>;
  now?: () => number;
};

/** Prepare the complete proposal without signing or broadcasting anything. */
export async function prepareSwap(
  intent: SwapIntent,
  recipient: `0x${string}`,
  policyConfig: PolicyConfig = DEFAULT_POLICY,
  dependencies: Partial<PrepareDependencies> = {},
): Promise<PreparedSwap> {
  if (intent.chainId !== CHAIN_CONFIG.chainId)
    throw new Error(`Wrong network. Please switch to ${CHAIN_CONFIG.name}.`);
  const adapter = dependencies.adapter ?? uniswapAdapter;
  const simulate = dependencies.simulate ?? simulateTransaction;
  const now = dependencies.now ?? Date.now;
  const quote = await adapter.getQuote({
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn,
    chainId: intent.chainId,
    slippageBps: intent.maxSlippageBps,
  });
  const transaction = await adapter.buildTransaction({
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn,
    minAmountOut: readQuotedAmount(quote.minimumOutput),
    recipient,
    chainId: intent.chainId,
    deadline: Math.floor(now() / 1000) + 1200,
  });
  const simulation = await simulate(intent, transaction, recipient);
  const policyResult = evaluatePolicy(intent, quote, simulation, policyConfig);
  return { quote, transaction, simulation, policyResult };
}

export function readQuotedAmount(value: string): string {
  const amount = value.trim().split(/\s+/)[0];
  if (!/^\d+(?:\.\d+)?$/.test(amount)) throw new Error('Quote returned an invalid minimum output');
  return amount;
}
