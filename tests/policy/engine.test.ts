import { describe, it, expect } from 'vitest';
import { evaluatePolicy } from '../../src/policy/engine';
import { SwapIntent, Quote, SimulationResult, PolicyConfig } from '../../src/types';

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

const policy: PolicyConfig = {
  maxTransactionValueUsd: 100,
  maxSlippageBps: 50,
  maxPriceImpactBps: 100,
  allowedProtocols: ['uniswap-v3'],
  allowedTokens: ['USDC', 'WETH', 'ETH'],
};

describe('Policy Engine', () => {
  it('should PASS valid swap within all limits', () => {
    const result = evaluatePolicy(baseIntent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('PASS');
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('should REJECT when slippage exceeds limit', () => {
    const intent = { ...baseIntent, maxSlippageBps: 100 };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('REJECT');
    expect(result.checks.find((c) => c.name === 'Slippage Within Limit')?.passed).toBe(false);
  });

  it('should REJECT disallowed token', () => {
    const intent = { ...baseIntent, tokenIn: 'SHIB' };
    const result = evaluatePolicy(intent, baseQuote, baseSimulation, policy);
    expect(result.status).toBe('REJECT');
    expect(result.checks.find((c) => c.name === 'Token In Allowed')?.passed).toBe(false);
  });

  it('should REJECT when price impact too high', () => {
    const quote = { ...baseQuote, priceImpactBps: 200 };
    const result = evaluatePolicy(baseIntent, quote, baseSimulation, policy);
    expect(result.status).toBe('REJECT');
    expect(result.checks.find((c) => c.name === 'Price Impact Within Limit')?.passed).toBe(false);
  });

  it('should REJECT when simulation fails', () => {
    const sim = { ...baseSimulation, success: false, error: 'Execution reverted' };
    const result = evaluatePolicy(baseIntent, baseQuote, sim, policy);
    expect(result.status).toBe('REJECT');
    expect(result.checks.find((c) => c.name === 'Simulation Passed')?.passed).toBe(false);
  });

  it('should REJECT insufficient balance', () => {
    const sim = { ...baseSimulation, balanceCheck: false };
    const result = evaluatePolicy(baseIntent, baseQuote, sim, policy);
    expect(result.status).toBe('REJECT');
  });

  it('should REJECT missing token allowance', () => {
    const sim = { ...baseSimulation, allowanceCheck: false };
    const result = evaluatePolicy(baseIntent, baseQuote, sim, policy);
    expect(result.status).toBe('REJECT');
  });
});
