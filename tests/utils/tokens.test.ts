import { describe, it, expect } from 'vitest';
import { toBaseUnits, fromBaseUnits, getTokenDecimals } from '../../src/utils/tokens';

describe('Token Utilities', () => {
  describe('toBaseUnits', () => {
    it('should convert whole number USDC (6 decimals)', () => {
      expect(toBaseUnits('100', 6)).toBe(100000000n);
    });

    it('should convert decimal USDC', () => {
      expect(toBaseUnits('100.5', 6)).toBe(100500000n);
    });

    it('should convert ETH (18 decimals)', () => {
      expect(toBaseUnits('1', 18)).toBe(1000000000000000000n);
    });

    it('should convert small decimal ETH', () => {
      expect(toBaseUnits('0.001', 18)).toBe(1000000000000000n);
    });

    it('should reject non-zero extra decimal places', () => {
      expect(() => toBaseUnits('100.1234567', 6)).toThrow('more than 6 decimal places');
    });

    it('should handle no decimal part', () => {
      expect(toBaseUnits('42', 18)).toBe(42000000000000000000n);
    });
  });

  describe('fromBaseUnits', () => {
    it('should convert base units to readable USDC', () => {
      expect(fromBaseUnits(100000000n, 6)).toBe('100');
    });

    it('should convert base units with decimal', () => {
      expect(fromBaseUnits(100500000n, 6)).toBe('100.5');
    });

    it('should convert 1 ETH in wei', () => {
      expect(fromBaseUnits(1000000000000000000n, 18)).toBe('1');
    });

    it('should convert small amounts', () => {
      expect(fromBaseUnits(1000000000000000n, 18)).toBe('0.001');
    });

    it('should handle zero', () => {
      expect(fromBaseUnits(0n, 18)).toBe('0');
    });
  });

  describe('getTokenDecimals', () => {
    it('should return 6 for USDC', () => {
      expect(getTokenDecimals('USDC')).toBe(6);
    });

    it('should return 18 for WETH', () => {
      expect(getTokenDecimals('WETH')).toBe(18);
    });

    it('should return 18 for ETH', () => {
      expect(getTokenDecimals('ETH')).toBe(18);
    });

    it('should return 18 for unknown tokens (default)', () => {
      expect(getTokenDecimals('UNKNOWN')).toBe(18);
    });

    it('should be case-insensitive', () => {
      expect(getTokenDecimals('usdc')).toBe(6);
      expect(getTokenDecimals('weth')).toBe(18);
    });
  });
});
