import { describe, it, expect } from 'vitest';
import { tryFallbackParse } from '../../src/intent/parser';

describe('Fallback Regex Parser', () => {
  it('should parse "Swap 100 USDC to ETH, max 0.5% slippage"', () => {
    const result = tryFallbackParse('Swap 100 USDC to ETH, max 0.5% slippage');
    expect(result).not.toBeNull();
    expect(result!.tokenIn).toBe('USDC');
    expect(result!.tokenOut).toBe('ETH');
    expect(result!.amountIn).toBe('100');
    expect(result!.maxSlippageBps).toBe(50);
  });

  it('should parse "swap 50 WETH for USDC maximum 1% slippage"', () => {
    const result = tryFallbackParse('swap 50 WETH for USDC maximum 1% slippage');
    expect(result).not.toBeNull();
    expect(result!.tokenIn).toBe('WETH');
    expect(result!.tokenOut).toBe('USDC');
    expect(result!.amountIn).toBe('50');
    expect(result!.maxSlippageBps).toBe(100);
  });

  it('should parse without slippage (defaults to 50 bps)', () => {
    const result = tryFallbackParse('Swap 200 USDC to WETH');
    expect(result).not.toBeNull();
    expect(result!.amountIn).toBe('200');
    expect(result!.maxSlippageBps).toBe(50);
  });

  it('should parse decimal amounts', () => {
    const result = tryFallbackParse('swap 0.5 WETH to USDC');
    expect(result).not.toBeNull();
    expect(result!.amountIn).toBe('0.5');
    expect(result!.tokenIn).toBe('WETH');
  });

  it('should reject an unsupported token instead of sending it to the quote layer', () => {
    expect(tryFallbackParse('Swap 1 SHIB to ETH')).toBeNull();
  });

  it('should return null for non-swap input', () => {
    expect(tryFallbackParse('What is the price of ETH?')).toBeNull();
    expect(tryFallbackParse('lend 100 USDC')).toBeNull();
    expect(tryFallbackParse('')).toBeNull();
  });

  it('should be case-insensitive', () => {
    const result = tryFallbackParse('SWAP 10 usdc TO weth');
    expect(result).not.toBeNull();
    expect(result!.tokenIn).toBe('USDC');
    expect(result!.tokenOut).toBe('WETH');
  });
  it('fails closed when a slippage-like expression is malformed or unsupported', () => {
    const malformed = [
      'Swap 1 USDC to ETH, max 0.5% slippag',
      'Swap 1 USDC to ETH, max 0,5% slippage',
      'Swap 1 USDC to ETH, max 0.5 percent slippage',
      'Swap 1 USDC to ETH, max half a percent slippage',
      'Swap 1 USDC to ETH, max 0.5 slippage',
      'Swap 1 USDC to ETH, max 50 bps slippage',
      'Swap 1 USDC to ETH, max -0.5% slippage',
    ];
    for (const phrase of malformed) expect(tryFallbackParse(phrase)).toBeNull();
  });

  it('uses the 0.5% default only when slippage is not mentioned', () => {
    const result = tryFallbackParse('Swap 1 USDC to ETH');
    expect(result?.maxSlippageBps).toBe(50);
  });

  it('passes explicit 100% through parsing for policy evaluation', () => {
    const result = tryFallbackParse('Swap 1 USDC to ETH, max 100% slippage');
    expect(result?.maxSlippageBps).toBe(10000);
  });
});
