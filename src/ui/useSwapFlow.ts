import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { SwapIntent, Quote, PolicyResult, SimulationResult } from '../types';
import { uniswapAdapter } from '../protocol/uniswap-v3';
import { evaluatePolicy } from '../policy/engine';
import { simulateTransaction } from '../simulation/preflight';
import { AppState } from './App';

export type FlowState = {
  state: AppState;
  intent: SwapIntent | null;
  quote: Quote | null;
  policyResult: PolicyResult | null;
  simulation: SimulationResult | null;
  txHash: string | null;
  error: string | null;
};

export function useSwapFlow() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [flowState, setFlowState] = useState<FlowState>({
    state: 'idle',
    intent: null,
    quote: null,
    policyResult: null,
    simulation: null,
    txHash: null,
    error: null,
  });

  const reset = useCallback(() => {
    setFlowState({
      state: 'idle',
      intent: null,
      quote: null,
      policyResult: null,
      simulation: null,
      txHash: null,
      error: null,
    });
  }, []);

  /**
   * Execute the full flow after intent is parsed:
   * Intent -> Quote -> Policy -> Simulation -> Ready
   */
  const runFlow = useCallback(async (intent: SwapIntent) => {
    if (!address) {
      setFlowState(prev => ({ ...prev, state: 'error', error: 'Wallet not connected' }));
      return;
    }

    setFlowState(prev => ({ ...prev, intent, state: 'quoting', error: null }));

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
    let tx;
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
  }, [address]);

  /**
   * Execute the transaction after user approval
   */
  const executeTransaction = useCallback(async () => {
    if (!walletClient || !address || !flowState.intent) {
      setFlowState(prev => ({ ...prev, state: 'error', error: 'Missing wallet or intent' }));
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

      setFlowState(prev => ({ ...prev, txHash: hash, state: 'confirmed' }));
    } catch (e: any) {
      const msg = e.message?.includes('rejected') || e.message?.includes('denied')
        ? 'Transaction rejected by user'
        : `Execution failed: ${e.message}`;
      setFlowState(prev => ({ ...prev, state: 'error', error: msg }));
    }
  }, [walletClient, address, flowState.intent, flowState.quote, publicClient]);

  return {
    ...flowState,
    runFlow,
    executeTransaction,
    reset,
  };
}
