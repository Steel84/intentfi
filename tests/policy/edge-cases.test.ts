import { describe, it, expect } from 'vitest';
import { evaluatePolicy } from '../../src/policy/engine';
import { SwapIntent, Quote, SimulationResult, PolicyConfig } from '../../src/types';

const policy: PolicyConfig = {
  maxTransactionValueUsd: 100,
  maxSlippageBps: 50,
  maxPriceImpactBps: 100,
  allowedProtocols: ['uniswap-v3'],
  allowedTokens: ['USDC', 'WETH', 'ETH'],
};

const baseIntent: SwapIntent = {
  action: 'swap',
  chainId: 11155111,
  tokenIn: 'USDC',
  tokenOut: 'WETH',
  amountIn: '100',
  maxSlippageBps: 50,
};

const baseQuote: Quote = {
  inputAmount: '100000000',
  expectedOutput: '40000000000000000',
  minimumOutput: '39800000000000000',
  price: '0.0004',
  priceImpactBps: 10,
  slippageBps: 30,
  gasEstimate: '150000',
  expiresAt: Date.now() + 60000,
};

const baseSimulation: SimulationResult = {
  success: true,
  gasUsed: '145000',
  balanceCheck: true,
  allowanceCheck: true,
};

describe('Policy Engine - Edge Cases', () => {
  it('should PASS at exact slippage limit boundary', () => {
    const intent = { ...baseIntent, maxSlippageBps: 50 };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('PASS');
  });

  it('should REJECT at slippage limit + 1 bps', () => {
    const intent = { ...baseIntent, maxSlippageBps: 51 };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('REJECT');
  });

  it('should PASS at exact price impact limit boundary', () => {
    const quote = { ...baseQuote, priceImpactBps: 100 };
    const result = evaluatePolicy(baseIntent, quote, baseSimulation, policy);
    expect(result.status).toBe('PASS');
  });

  it('should REJECT at price impact limit + 1 bps', () => {
    const quote = { ...baseQuote, priceImpactBps: 101 };
    const result = evaluatePolicy(baseIntent, quote, baseSimulation, policy);
    expect(result.status).toBe('REJECT');
  });

  it('should report multiple failures simultaneously', () => {
    const intent = { ...baseIntent, tokenIn: 'SHIB', maxSlippageBps: 200 };
    const quote = { ...baseQuote, priceImpactBps: 500 };
    const sim = { ...baseSimulation, success: false, balanceCheck: false };
    const result = evaluatePolicy(intent, quote, sim, policy);
    expect(result.status).toBe('REJECT');
    const failedChecks = result.checks.filter(c => !c.passed);
    expect(failedChecks.length).toBeGreaterThan(3);
  });

  it('should handle ETH token (alias in allowedTokens)', () => {
    const intent = { ...baseIntent, tokenOut: 'ETH' };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('PASS');
  });

  it('should handle lowercase tokens (engine uppercases)', () => {
    // Policy engine uses intent.tokenIn.toUpperCase() so lowercase passes
    const intent = { ...baseIntent, tokenIn: 'usdc' };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.checks.find(c => c.name === 'Token In Allowed')?.passed).toBe(true);
  });

  it('should PASS with zero slippage', () => {
    const intent = { ...baseIntent, maxSlippageBps: 0 };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('PASS');
  });

  it('should PASS with zero price impact', () => {
    const quote = { ...baseQuote, priceImpactBps: 0 };
    const result = evaluatePolicy(baseIntent, quote, baseSimulation, policy);
    expect(result.status).toBe('PASS');
  });
});
