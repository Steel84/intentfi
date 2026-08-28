import { CHAIN_CONFIG } from '../config';

/** Wallet safety helpers. Keys never enter the application. */
export function isSupportedChain(chainId: number | undefined): boolean {
  return chainId === CHAIN_CONFIG.chainId;
}

export function shortenAddress(address: string, visible = 4): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return address;
  return `${address.slice(0, visible + 2)}…${address.slice(-visible)}`;
}
