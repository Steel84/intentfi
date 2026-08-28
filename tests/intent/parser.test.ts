import { describe, it, expect } from 'vitest';
import { validateSwapIntent } from '../../src/intent/parser';

describe('Intent Validation', () => {
  it('should validate correct swap intent', () => {
    const result = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.intent.action).toBe('swap');
      expect(result.intent.tokenIn).toBe('USDC');
      expect(result.intent.tokenOut).toBe('ETH');
      expect(result.intent.amountIn).toBe('100');
      expect(result.intent.maxSlippageBps).toBe(50);
    }
  });

  it('should reject missing token', () => {
    const result = validateSwapIntent({
      action: 'swap',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should reject malformed amount', () => {
    const result = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: 'abc',
      maxSlippageBps: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slippage', () => {
    const result = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: -5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject unsupported action', () => {
    const result = validateSwapIntent({
      action: 'lend',
      tokenIn: 'USDC',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should handle LLM error response', () => {
    const result = validateSwapIntent({
      error: 'Missing output token',
    });
    expect(result.success).toBe(false);
  });
});
