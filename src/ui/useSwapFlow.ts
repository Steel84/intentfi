import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { SwapIntent, Quote, PolicyResult, SimulationResult, TransactionRequest } from '../types';
import { uniswapAdapter } from '../protocol/uniswap-v3';
import { evaluatePolicy } from '../policy/engine';
import { simulateTransaction } from '../simulation/preflight';
import { CHAIN_CONFIG } from '../config';
import { AppState } from './App';

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
};

export function useSwapFlow() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();

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
  });

  const isWrongChain = chainId !== undefined && chainId !== CHAIN_CONFIG.chainId;

  const reset = useCallback(() => {
    setFlowState(prev => ({
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
      switchChain({ chainId: CHAIN_CONFIG.chainId });
    } catch (e: any) {
      setFlowState(prev => ({ ...prev, error: `Failed to switch network: ${e.message}` }));
    }
  }, [switchChain]);

  /**
   * Execute the full flow after intent is parsed:
   * Intent -> Quote -> Policy -> Simulation -> Ready
   */
  const runFlow = useCallback(async (intent: SwapIntent) => {
    if (!address) {
      setFlowState(prev => ({ ...prev, state: 'error', error: 'Wallet not connected' }));
      return;
    }

    if (isWrongChain) {
      setFlowState(prev => ({ ...prev, state: 'error', error: `Wrong network. Please switch to ${CHAIN_CONFIG.name}.` }));
      return;
    }

    setFlowState(prev => ({ ...prev, intent, state: 'quoting', error: null, needsApproval: false }));

    // 1. Get live quote
    let quote: Quote;
    try {
      quote = await uniswapAdapter.getQuote({
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        chainId: intent.chainId,
      });
      setFlowState(prev => ({ ...prev, quote, state: 'checking-policy' }));
    } catch (e: any) {
      setFlowState(prev => ({
        ...prev,
        state: 'error',
        error: `Quote failed: ${e.message}`,
      }));
      return;
    }

    // 2. Build transaction
    let tx: TransactionRequest;
    try {
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min
      tx = await uniswapAdapter.buildTransaction({
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        minAmountOut: quote.minimumOutput.split(' ')[0],
        recipient: address,
        chainId: intent.chainId,
        deadline,
      });
    } catch (e: any) {
      setFlowState(prev => ({
        ...prev,
        state: 'error',
        error: `Transaction build failed: ${e.message}`,
      }));
      return;
    }

    // 3. Simulate
    setFlowState(prev => ({ ...prev, state: 'simulating' }));
    let simulation: SimulationResult;
    try {
      simulation = await simulateTransaction(intent, tx, address as `0x${string}`);
      setFlowState(prev => ({ ...prev, simulation }));
    } catch (e: any) {
      simulation = {
        success: false,
        balanceCheck: false,
        allowanceCheck: false,
        error: `Simulation error: ${e.message}`,
      };
      setFlowState(prev => ({ ...prev, simulation }));
    }

    // Check if approval is needed (allowance failed but balance is ok)
    if (!simulation.allowanceCheck && simulation.balanceCheck) {
      setFlowState(prev => ({
        ...prev,
        needsApproval: true,
        simulation,
        state: 'error',
        error: `Token approval required. Approve ${intent.tokenIn} spending before swapping.`,
      }));
      return;
    }

    // 4. Policy check
    const policyResult = evaluatePolicy(intent, quote, simulation);
    setFlowState(prev => ({ ...prev, policyResult, state: 'policy-done' }));

    if (policyResult.status === 'REJECT') {
      setFlowState(prev => ({
        ...prev,
        state: 'error',
        error: `Policy rejected: ${policyResult.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`,
      }));
      return;
    }

    // All checks passed - ready for user approval
    setFlowState(prev => ({ ...prev, state: 'ready' }));
  }, [address, isWrongChain]);

  /**
   * Approve ERC20 token spending for the router
   */
  const approveToken = useCallback(async () => {
    if (!walletClient || !address || !flowState.intent) return;

    setFlowState(prev => ({ ...prev, approving: true, error: null }));

    try {
      const intent = flowState.intent;
      const amount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'); // max approval
      const approvalTx = uniswapAdapter.buildApprovalTx(intent.tokenIn, amount);

      const hash = await walletClient.sendTransaction({
        to: approvalTx.to as `0x${string}`,
        data: approvalTx.data as `0x${string}`,
        value: 0n,
        chain: undefined,
        account: address as `0x${string}`,
      });

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setFlowState(prev => ({ ...prev, approving: false, needsApproval: false, error: null }));

      // Re-run the flow now that approval is done
      await runFlow(intent);
    } catch (e: any) {
      const msg = e.message?.includes('rejected') || e.message?.includes('denied')
        ? 'Approval rejected by user'
        : `Approval failed: ${e.message}`;
      setFlowState(prev => ({ ...prev, approving: false, error: msg }));
    }
  }, [walletClient, address, flowState.intent, publicClient, runFlow]);

  /**
   * Execute the transaction after user approval
   */
  const executeTransaction = useCallback(async () => {
    if (!walletClient || !address || !flowState.intent) {
      setFlowState(prev => ({ ...prev, state: 'error', error: 'Missing wallet or intent' }));
      return;
    }

    // Check quote expiry
    if (flowState.quote && Date.now() > flowState.quote.expiresAt) {
      setFlowState(prev => ({
        ...prev,
        state: 'error',
        error: 'Quote expired. Please try again.',
      }));
      return;
    }

    setFlowState(prev => ({ ...prev, state: 'executing' }));

    try {
      const intent = flowState.intent;
      const quote = flowState.quote!;
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      const tx = await uniswapAdapter.buildTransaction({
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        minAmountOut: quote.minimumOutput.split(' ')[0],
        recipient: address,
        chainId: intent.chainId,
        deadline,
      });

      // Send transaction via wallet
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value || '0'),
        chain: undefined,
        account: address as `0x${string}`,
      });

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Add to history
      const entry: TxHistoryEntry = {
        hash,
        intent,
        quote,
        timestamp: Date.now(),
      };

      setFlowState(prev => ({
        ...prev,
        txHash: hash,
        state: 'confirmed',
        txHistory: [entry, ...prev.txHistory],
      }));
    } catch (e: any) {
      let msg: string;
      if (e.message?.includes('rejected') || e.message?.includes('denied')) {
        msg = 'Transaction rejected by user';
      } else if (e.message?.includes('insufficient funds')) {
        msg = 'Insufficient funds for gas';
      } else if (e.message?.includes('nonce')) {
        msg = 'Transaction nonce error. Please try again.';
      } else {
        msg = `Execution failed: ${e.message?.slice(0, 200)}`;
      }
      setFlowState(prev => ({ ...prev, state: 'error', error: msg }));
    }
  }, [walletClient, address, flowState.intent, flowState.quote, publicClient]);

  return {
    ...flowState,
    isWrongChain,
    runFlow,
    executeTransaction,
    approveToken,
    switchToSepolia,
    reset,
  };
}
