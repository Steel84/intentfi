import { describe, it, expect } from 'vitest';
import { validateSwapIntent } from '../../src/intent/parser';

// We need to test the fallback regex parser directly
// Since it's a private function in IntentInput, let's extract and test the logic

function tryFallbackParse(input: string) {
  const match = input.match(
    /swap\s+([\d.]+)\s+(\w+)\s+(?:to|for)\s+(\w+)(?:.*?(?:max|maximum)\s+([\d.]+)%\s*slippage)?/i
  );
  if (!match) return null;

  const [, amount, tokenIn, tokenOut, slippage] = match;
  const result = validateSwapIntent({
    action: 'swap',
    tokenIn: tokenIn.toUpperCase(),
    tokenOut: tokenOut.toUpperCase(),
    amountIn: amount,
    maxSlippageBps: slippage ? Math.round(parseFloat(slippage) * 100) : 50,
  });

  return result.success ? result.intent : null;
}

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
    const result = tryFallbackParse('swap 0.5 ETH to USDC');
    expect(result).not.toBeNull();
    expect(result!.amountIn).toBe('0.5');
    expect(result!.tokenIn).toBe('ETH');
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
});
