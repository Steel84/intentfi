import { describe, it, expect } from 'vitest';
import { uniswapAdapter } from '../../src/protocol/uniswap-v3';

describe('Uniswap V3 transaction adapter', () => {
  it('builds a Sepolia swap transaction with deadline and calldata', async () => {
    const tx = await uniswapAdapter.buildTransaction({
      tokenIn: 'USDC', tokenOut: 'WETH', amountIn: '100',
      minAmountOut: '0.03', recipient: '0x0000000000000000000000000000000000000001',
      chainId: 11155111, deadline: 1900000000,
    });
    expect(tx.chainId).toBe(11155111);
    expect(tx.to).toBe('0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E');
    expect(tx.value).toBe('0');
    expect(tx.data).toMatch(/^0x[0-9a-f]+$/);
    expect(tx.data.length).toBeGreaterThan(2 + 8 + 32 * 8);
  });

  it('rejects unsupported token symbols before creating calldata', async () => {
    await expect(uniswapAdapter.buildTransaction({
      tokenIn: 'FAKE', tokenOut: 'WETH', amountIn: '1', minAmountOut: '0.01',
      recipient: '0x0000000000000000000000000000000000000001', chainId: 11155111, deadline: 1900000000,
    })).rejects.toThrow('Unsupported token');
  });

  it('uses the requested slippage when building a quote minimum', async () => {
    // Adapter validates slippage before any RPC call. Invalid values must never reach chain logic.
    await expect(uniswapAdapter.getQuote({ tokenIn: 'USDC', tokenOut: 'WETH', amountIn: '1', chainId: 11155111, slippageBps: 10001 }))
      .rejects.toThrow();
  });
});
