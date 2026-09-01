import { describe, it, expect } from 'vitest';
import { validateSwapIntent } from '../../src/intent/parser';

describe('Hybrid parser: LLM result through validateSwapIntent', () => {
  it('accepts a well-formed Gemini response without unsupported conditions', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 100,
      unsupportedConditions: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toBeUndefined();
      expect(r.intent.maxSlippageBps).toBe(100);
    }
  });

  it('passes through unsupported conditions from LLM', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '5',
      maxSlippageBps: 50,
      unsupportedConditions: ['gas must be below 30 gwei'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toEqual(['gas must be below 30 gwei']);
      expect(r.intent.tokenIn).toBe('USDC');
    }
  });

  it('passes through multiple unsupported conditions', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50,
      unsupportedConditions: [
        'cancel if price moves more than 2%',
        'execute only during US market hours',
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toHaveLength(2);
    }
  });

  it('ignores empty unsupported conditions array', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amountIn: '20',
      maxSlippageBps: 50,
      unsupportedConditions: [],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.unsupportedConditions).toBeUndefined();
  });

  it('filters out empty strings and whitespace from unsupported conditions', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 50,
      unsupportedConditions: ['gas limit', '', '  ', 'price check'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toEqual(['gas limit', 'price check']);
    }
  });

  it('rejects LLM error response', () => {
    const r = validateSwapIntent({ error: 'Amount must be a specific number' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('Amount must be a specific number');
  });

  it('rejects unsupported token even when LLM returns it', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'SHIB',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-integer slippage from LLM', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50.5,
    });
    expect(r.success).toBe(false);
  });

  it('ignores non-string values in unsupported conditions array', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 50,
      unsupportedConditions: [42, null, 'real condition', undefined],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toEqual(['real condition']);
    }
  });

  it('rejects unexpected fields from a malformed LLM response', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 50,
      calldata: '0xdeadbeef',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('Unexpected intent field');
  });

  it('validates LLM output with same strictness as fallback (same-token rejection)', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'USDC',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('different');
  });
});
