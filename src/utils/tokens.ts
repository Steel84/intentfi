import { TOKENS } from '../config';

export function resolveTokenAddress(symbol: string): string | null {
  const token = TOKENS[symbol.toUpperCase()];
  return token?.address || null;
}

export function getTokenDecimals(symbol: string): number {
  const token = TOKENS[symbol.toUpperCase()];
  return token?.decimals ?? 18;
}

/** Convert a strict non-negative decimal string to base units without floating point. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error('Invalid token decimals');
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('Amount must be a positive decimal number');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error(`Amount has more than ${decimals} decimal places`);
  }
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const value = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(paddedFraction || '0');
  if (value <= 0n) throw new Error('Amount must be greater than zero');
  return value;
}

export function fromBaseUnits(amount: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error('Invalid token decimals');
  if (amount < 0n) throw new Error('Amount cannot be negative');
  if (decimals === 0) return amount.toString();
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}
