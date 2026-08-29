import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { sepolia } from 'viem/chains';
import {
  SwapIntent,
  Quote,
  PolicyResult,
  SimulationResult,
  TransactionRequest,
  PolicyConfig,
} from '../types';
import { uniswapAdapter } from '../protocol/uniswap-v3';
import { evaluatePolicy } from '../policy/engine';
import { simulateTransaction } from '../simulation/preflight';
import { CHAIN_CONFIG, DEFAULT_POLICY, normalizePolicyConfig } from '../config';
import { AppState } from './App';
import { isSupportedChain } from '../wallet/connection';
import { getHealthyClient } from '../utils/rpc';
import { getTokenDecimals, toBaseUnits } from '../utils/tokens';
import { toUserError } from '../utils/errors';
import { prepareSwap, readQuotedAmount } from '../flow/prepare';

export type TxHistoryEntry = {
  hash: string;
  intent: SwapIntent;
  quote: Quote;
  timestamp: number;
};

export type FlowState = {
  state: AppState;
  intent: SwapIntent | null;
  quote: Quote | null;
  policyResult: PolicyResult | null;
  simulation: SimulationResult | null;
  txHash: string | null;
  error: string | null;
  needsApproval: boolean;
  approving: boolean;
  txHistory: TxHistoryEntry[];
  policyConfig: PolicyConfig;
};

const HISTORY_LIMIT = 10;
const HISTORY_PREFIX = 'intentfi-history:';

export function useSwapFlow() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const runId = useRef(0);
  const actionInFlight = useRef(false);
  const [flowState, setFlowState] = useState<FlowState>({
    state: 'idle',
    intent: null,
    quote: null,
    policyResult: null,
    simulation: null,
    txHash: null,
    error: null,
    needsApproval: false,
    approving: false,
    txHistory: [],
    policyConfig: loadPolicyConfig(),
  });

  const isWrongChain = chainId !== undefined && !isSupportedChain(chainId);
  const policyConfig = flowState.policyConfig;

  useEffect(() => {
    runId.current += 1;
    actionInFlight.current = false;
    setFlowState((prev) => ({ ...prev, txHistory: loadHistory(address) }));
  }, [address, chainId]);

  const reset = useCallback(() => {
    runId.current += 1;
    actionInFlight.current = false;
    setFlowState((prev) => ({
      ...prev,
      state: 'idle',
      intent: null,
      quote: null,
      policyResult: null,
      simulation: null,
      txHash: null,
      error: null,
      needsApproval: false,
      approving: false,
    }));
  }, []);

  const switchToSepolia = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: CHAIN_CONFIG.chainId });
    } catch (error) {
      setFlowState((prev) => ({
        ...prev,
        error: toUserError(error, `Could not switch to ${CHAIN_CONFIG.name}.`),
      }));
    }
  }, [switchChainAsync]);

  const runFlow = useCallback(
    async (intent: SwapIntent) => {
      const currentRun = ++runId.current;
      const isCurrent = () => runId.current === currentRun;
      if (!address) {
        setFlowState((prev) => ({ ...prev, state: 'error', error: 'Wallet not connected' }));
        return;
      }
      if (isWrongChain || intent.chainId !== CHAIN_CONFIG.chainId) {
        setFlowState((prev) => ({
          ...prev,
          state: 'error',
          error: `Wrong network. Please switch to ${CHAIN_CONFIG.name}.`,
        }));
        return;
      }

      setFlowState((prev) => ({
        ...prev,
        intent,
        state: 'quoting',
        error: null,
        quote: null,
        policyResult: null,
        simulation: null,
        needsApproval: false,
      }));
      try {
        const prepared = await prepareSwap(intent, address as `0x${string}`, policyConfig);
        if (!isCurrent()) return;
        setFlowState((prev) => ({
          ...prev,
          quote: prepared.quote,
          simulation: prepared.simulation,
          policyResult: prepared.policyResult,
          state:
            prepared.simulation.allowanceCheck && prepared.policyResult.status === 'PASS'
              ? 'ready'
              : 'policy-done',
        }));

        if (!prepared.simulation.allowanceCheck && prepared.simulation.balanceCheck) {
          setFlowState((prev) => ({
            ...prev,
            state: 'error',
            needsApproval: true,
            error: `Token approval required. Approve ${intent.tokenIn} before swapping.`,
          }));
          return;
        }
        if (prepared.policyResult.status === 'REJECT') {
          setFlowState((prev) => ({
            ...prev,
            state: 'error',
            error: `Policy rejected: ${formatPolicyFailures(prepared.policyResult)}`,
          }));
        }
      } catch (error) {
        if (!isCurrent()) return;
        setFlowState((prev) => ({
          ...prev,
          state: 'error',
          error: toUserError(error, 'Could not prepare the swap. Refresh and try again.'),
        }));
      }
    },
    [address, isWrongChain, policyConfig],
  );

  const approveToken = useCallback(async () => {
    if (actionInFlight.current || !walletClient || !address || !flowState.intent) return;
    actionInFlight.current = true;
    setFlowState((prev) => ({ ...prev, approving: true, error: null }));
    try {
      const intent = flowState.intent;
      const amount = toBaseUnits(intent.amountIn, getTokenDecimals(intent.tokenIn));
      const approvalTx = uniswapAdapter.buildApprovalTx(intent.tokenIn, amount);
      const hash = await walletClient.sendTransaction({
        to: approvalTx.to as `0x${string}`,
        data: approvalTx.data as `0x${string}`,
        value: 0n,
        chain: sepolia,
        account: address as `0x${string}`,
      });
      const receipt = await (await getHealthyClient()).waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') throw new Error('Approval transaction reverted');
      actionInFlight.current = false;
      setFlowState((prev) => ({ ...prev, approving: false, needsApproval: false, error: null }));
      await runFlow(intent);
    } catch (error) {
      actionInFlight.current = false;
      setFlowState((prev) => ({
        ...prev,
        approving: false,
        error: toUserError(error, 'Token approval failed. No swap was submitted.'),
      }));
    }
  }, [walletClient, address, flowState.intent, runFlow]);

  const executeTransaction = useCallback(async () => {
    if (
      actionInFlight.current ||
      !walletClient ||
      !address ||
      !flowState.intent ||
      !flowState.quote
    ) {
      if (!actionInFlight.current)
        setFlowState((prev) => ({
          ...prev,
          state: 'error',
          error: 'Missing wallet, intent, or quote',
        }));
      return;
    }
    const { intent, quote, policyResult, simulation } = flowState;
    if (
      policyResult?.status !== 'PASS' ||
      !simulation?.success ||
      !simulation.allowanceCheck ||
      !simulation.balanceCheck
    ) {
      setFlowState((prev) => ({
        ...prev,
        state: 'error',
        error: 'Execution is blocked until policy and preflight checks pass.',
      }));
      return;
    }
    if (Date.now() >= quote.expiresAt) {
      setFlowState((prev) => ({
        ...prev,
        state: 'error',
        error: 'Quote expired. Refresh it before approving the transaction.',
      }));
      return;
    }

    actionInFlight.current = true;
    setFlowState((prev) => ({ ...prev, state: 'executing', error: null }));
    try {
      // Rebuild and simulate the exact calldata immediately before signing.
      const tx = await uniswapAdapter.buildTransaction({
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        minAmountOut: readQuotedAmount(quote.minimumOutput),
        recipient: address,
        chainId: intent.chainId,
        deadline: Math.floor(Date.now() / 1000) + 1200,
      });
      const finalSimulation = await simulateTransaction(intent, tx, address as `0x${string}`);
      if (
        !finalSimulation.success ||
        !finalSimulation.allowanceCheck ||
        !finalSimulation.balanceCheck
      ) {
        throw new Error(finalSimulation.error || 'Final preflight failed');
      }
      const finalPolicy = evaluatePolicy(intent, quote, finalSimulation, policyConfig);
      if (finalPolicy.status !== 'PASS') throw new Error('Final policy check failed');
      setFlowState((prev) => ({ ...prev, simulation: finalSimulation, policyResult: finalPolicy }));

      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value || '0'),
        chain: sepolia,
        account: address as `0x${string}`,
      });
      const receipt = await (await getHealthyClient()).waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain');

      const entry: TxHistoryEntry = { hash, intent, quote, timestamp: Date.now() };
      setFlowState((prev) => {
        const txHistory = [entry, ...prev.txHistory].slice(0, HISTORY_LIMIT);
        saveHistory(address, txHistory);
        return { ...prev, txHash: hash, state: 'confirmed', txHistory };
      });
    } catch (error) {
      setFlowState((prev) => ({
        ...prev,
        state: 'error',
        error: toUserError(error, 'Execution failed. The transaction was not confirmed.'),
      }));
    } finally {
      actionInFlight.current = false;
    }
  }, [
    walletClient,
    address,
    flowState.intent,
    flowState.quote,
    flowState.policyResult,
    flowState.simulation,
    policyConfig,
  ]);

  const refreshQuote = useCallback(() => {
    if (flowState.intent && !actionInFlight.current) void runFlow(flowState.intent);
  }, [flowState.intent, runFlow]);

  // Retry the complete proposal pipeline with a fresh quote and fresh preflight.
  const retry = useCallback(() => {
    if (flowState.intent && !actionInFlight.current) void runFlow(flowState.intent);
    else reset();
  }, [flowState.intent, reset, runFlow]);

  const updatePolicyConfig = useCallback((next: PolicyConfig) => {
    const safe = normalizePolicyConfig(next);
    localStorage.setItem('intentfi-policy', JSON.stringify(safe));
    setFlowState((prev) => ({ ...prev, policyConfig: safe }));
  }, []);

  return {
    ...flowState,
    isWrongChain,
    runFlow,
    executeTransaction,
    approveToken,
    switchToSepolia,
    refreshQuote,
    retry,
    reset,
    updatePolicyConfig,
  };
}

function loadPolicyConfig(): PolicyConfig {
  try {
    return normalizePolicyConfig(JSON.parse(localStorage.getItem('intentfi-policy') || 'null'));
  } catch {
    return DEFAULT_POLICY;
  }
}

function loadHistory(address?: `0x${string}`): TxHistoryEntry[] {
  if (!address) return [];
  try {
    const value = JSON.parse(
      localStorage.getItem(`${HISTORY_PREFIX}${address.toLowerCase()}`) || '[]',
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is TxHistoryEntry =>
        Boolean(
          entry &&
          typeof entry.hash === 'string' &&
          /^0x[a-fA-F0-9]{64}$/.test(entry.hash) &&
          entry.intent &&
          entry.quote,
        ),
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveHistory(address: `0x${string}`, entries: TxHistoryEntry[]) {
  try {
    localStorage.setItem(`${HISTORY_PREFIX}${address.toLowerCase()}`, JSON.stringify(entries));
  } catch {
    /* storage is optional */
  }
}

function formatPolicyFailures(result: PolicyResult): string {
  return result.checks
    .filter((check) => !check.passed)
    .map((check) => {
      switch (check.name) {
        case 'Slippage Within Limit':
          return `Slippage exceeds limit (${check.actual ?? 'unknown'} requested, max ${check.limit ?? 'unknown'} allowed)`;
        case 'Price Impact Within Limit':
          return `Price impact exceeds limit (${check.actual ?? 'unknown'}, max ${check.limit ?? 'unknown'})`;
        case 'Balance Sufficient':
          return 'Insufficient token balance for this swap';
        case 'Token Allowance Set':
          return 'Token approval is required before this swap';
        case 'Quote Fresh':
          return 'Quote expired, please refresh the quote';
        case 'Chain Allowed':
          return 'Wrong network, switch to Sepolia';
        case 'Protocol Allowed':
          return `Protocol is not allowed (${check.actual ?? 'unknown'})`;
        case 'Token In Allowed':
          return `Input token is not allowed (${check.actual ?? 'unknown'})`;
        case 'Token Out Allowed':
          return `Output token is not allowed (${check.actual ?? 'unknown'})`;
        case 'Simulation Passed':
          return check.reason ? `Simulation failed (${check.reason})` : 'Simulation failed';
        default:
          return check.reason || `${check.name} failed`;
      }
    })
    .join('; ');
}
