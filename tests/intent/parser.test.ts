import { describe, it, expect } from 'vitest';
import { percentToBps, validateSwapIntent } from '../../src/intent/parser';

describe('Intent Validation', () => {
  it('converts percentage slippage without floating-point rounding', () => {
    expect(percentToBps('0.5')).toBe(50);
    expect(percentToBps('1.25')).toBe(125);
    expect(percentToBps('0.001')).toBe(-1);
  });

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

  it('should reject unsupported tokens before quoting', () => {
    const result = validateSwapIntent({
      action: 'swap',
      tokenIn: 'SHIB',
      tokenOut: 'ETH',
      amountIn: '1',
      maxSlippageBps: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should reject native ETH as an input token', () => {
    const result = validateSwapIntent({
      action: 'swap',
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amountIn: '1',
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
