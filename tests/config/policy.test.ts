import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, normalizePolicyConfig } from '../../src/config';

describe('Persisted policy validation', () => {
  it('falls back safely for malformed values', () => {
    expect(
      normalizePolicyConfig({ maxSlippageBps: '50', allowedTokens: [], allowedProtocols: [] }),
    ).toEqual(DEFAULT_POLICY);
  });

  it('normalizes case and clamps numeric policy values', () => {
    const policy = normalizePolicyConfig({
      maxSlippageBps: 50.9,
      maxPriceImpactBps: 101,
      allowedTokens: ['usdc'],
      allowedProtocols: ['UNISWAP-V3'],
    });
    expect(policy.maxSlippageBps).toBe(50);
    expect(policy.allowedTokens).toEqual(['USDC']);
    expect(policy.allowedProtocols).toEqual(['uniswap-v3']);
  });
});
