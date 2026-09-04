import { SimulationResult, TransactionRequest, SwapIntent } from '../types';
import { getHealthyClient } from '../utils/rpc';
import { uniswapAdapter } from '../protocol/uniswap-v3';
import { toBaseUnits, fromBaseUnits, getTokenDecimals } from '../utils/tokens';

/**
 * Simulation / Preflight Validation
 *
 * Performs strongest practical preflight before wallet approval:
 * 1. Validate transaction construction
 * 2. Verify sufficient balance
 * 3. Estimate gas
 * 4. Run RPC simulation (eth_call)
 * 5. Verify token allowances
 *
 * A FAILED simulation BLOCKS execution.
 */
export async function simulateTransaction(
  intent: SwapIntent,
  tx: TransactionRequest,
  userAddress: `0x${string}`,
): Promise<SimulationResult> {
  const client = await getHealthyClient();
  const decimalsIn = getTokenDecimals(intent.tokenIn);
  const requiredAmount = toBaseUnits(intent.amountIn, decimalsIn);

  // 1. Check balance
  let balanceCheck = false;
  try {
    const balance = await uniswapAdapter.getBalance(intent.tokenIn, userAddress);
    balanceCheck = balance >= requiredAmount;
    if (!balanceCheck) {
      return {
        success: false,
        balanceCheck: false,
        allowanceCheck: false,
        error: `Insufficient ${intent.tokenIn} balance. Have: ${fromBaseUnits(balance, decimalsIn)} ${intent.tokenIn}, need: ${intent.amountIn} ${intent.tokenIn}`,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      balanceCheck: false,
      allowanceCheck: false,
      error: `Failed to check balance: ${e.message}`,
    };
  }

  // 2. Check allowance
  let allowanceCheck = false;
  try {
    const allowance = await uniswapAdapter.getAllowance(intent.tokenIn, userAddress);
    allowanceCheck = allowance >= requiredAmount;
    if (!allowanceCheck) {
      return {
        success: false,
        balanceCheck: true,
        allowanceCheck: false,
        error: `Token approval required. Current allowance insufficient for ${intent.amountIn} ${intent.tokenIn}`,
        details: 'Approve the Uniswap router to spend your tokens first.',
      };
    }
  } catch (e: any) {
    return {
      success: false,
      balanceCheck: true,
      allowanceCheck: false,
      error: `Failed to check allowance: ${e.message}`,
    };
  }

  // 3. Estimate gas via eth_estimateGas
  let gasUsed: string | undefined;
  try {
    const gas = await client.estimateGas({
      account: userAddress,
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || '0'),
    });
    gasUsed = gas.toString();
  } catch (e: any) {
    return {
      success: false,
      balanceCheck: true,
      allowanceCheck: true,
      error: `Gas estimation failed: ${e.message}`,
      details: 'Transaction would likely revert on-chain.',
    };
  }

  // 4. eth_call simulation
  try {
    await client.call({
      account: userAddress,
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || '0'),
    });
  } catch (e: any) {
    return {
      success: false,
      balanceCheck: true,
      allowanceCheck: true,
      gasUsed,
      error: `Simulation reverted: ${e.message}`,
      details: 'The transaction would fail on-chain.',
    };
  }

  return {
    success: true,
    gasUsed,
    balanceCheck: true,
    allowanceCheck: true,
    details: 'All preflight checks passed.',
  };
}
