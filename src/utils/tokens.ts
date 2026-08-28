import { TOKENS } from '../config';

/**
 * Token Utilities
 * 
 * Resolve symbols to addresses, handle decimals.
 * Never trust token symbols alone for execution.
 */

export function resolveTokenAddress(symbol: string): string | null {
  const token = TOKENS[symbol.toUpperCase()];
  return token?.address || null;
}

export function getTokenDecimals(symbol: string): number {
  const token = TOKENS[symbol.toUpperCase()];
  return token?.decimals ?? 18;
}

/**
 * Convert human-readable amount to base units (integer)
 * Uses integer arithmetic to avoid floating-point issues
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Convert base units back to human-readable
 */
export function fromBaseUnits(amount: bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const fraction = str.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}
