import { describe, expect, it } from 'vitest';
import { prepareSwap } from '../../src/flow/prepare';
import { SwapIntent } from '../../src/types';

const intent: SwapIntent = {
  action: 'swap',
  chainId: 11155111,
  tokenIn: 'USDC',
  tokenOut: 'WETH',
  amountIn: '100',
  maxSlippageBps: 50,
};
const quote = {
  inputAmount: '100 USDC',
  expectedOutput: '0.04 WETH',
  minimumOutput: '0.0398 WETH',
  price: '0.0004',
  priceImpactBps: 10,
  slippageBps: 50,
  gasEstimate: '150000',
  route: 'USDC -> WETH',
  expiresAt: Date.now() + 30_000,
};

describe('Swap preparation pipeline', () => {
  it('runs quote, calldata, simulation, and deterministic policy in order without signing', async () => {
    const calls: string[] = [];
    const result = await prepareSwap(
      intent,
      '0x0000000000000000000000000000000000000001',
      undefined,
      {
        adapter: {
          getQuote: async () => {
            calls.push('quote');
            return quote;
          },
          buildTransaction: async (params) => {
            calls.push('build');
            expect(params.minAmountOut).toBe('0.0398');
            return {
              to: '0x0000000000000000000000000000000000000002',
              data: '0x1234',
              value: '0',
              gasLimit: '300000',
              chainId: 11155111,
            };
          },
        },
        simulate: async (_intent, tx) => {
          calls.push('simulate');
          expect(tx.data).toBe('0x1234');
          return { success: true, balanceCheck: true, allowanceCheck: true, gasUsed: '145000' };
        },
        now: () => 1_900_000_000_000,
      },
    );

    expect(calls).toEqual(['quote', 'build', 'simulate']);
    expect(result.policyResult.status).toBe('PASS');
    expect(result.transaction.data).toBe('0x1234');
  });

  it('fails closed when the chain is not Sepolia', async () => {
    await expect(
      prepareSwap(
        { ...intent, chainId: 1 },
        '0x0000000000000000000000000000000000000001',
        undefined,
        {
          adapter: {
            getQuote: async () => quote,
            buildTransaction: async () => {
              throw new Error('should not build');
            },
          },
          simulate: async () => {
            throw new Error('should not simulate');
          },
        },
      ),
    ).rejects.toThrow('Wrong network');
  });
});
