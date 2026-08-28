import { describe, it, expect } from 'vitest';
import { isSupportedChain, shortenAddress } from '../../src/wallet/connection';

describe('Wallet safety helpers', () => {
  it('accepts only Sepolia', () => {
    expect(isSupportedChain(11155111)).toBe(true);
    expect(isSupportedChain(1)).toBe(false);
    expect(isSupportedChain(undefined)).toBe(false);
  });

  it('shortens valid addresses without changing invalid values', () => {
    const address = '0x1234567890123456789012345678901234567890';
    expect(shortenAddress(address)).toBe('0x1234…7890');
    expect(shortenAddress('not-an-address')).toBe('not-an-address');
  });
});
