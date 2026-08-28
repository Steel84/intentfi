import { createPublicClient, http, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_CONFIG } from '../config';

let activeClient: PublicClient | null = null;
let usingFallback = false;

/**
 * RPC Health Check + Fallback
 * 
 * If primary is unavailable, switches to fallback.
 * Lightweight: just checks block number response.
 */
export async function getHealthyClient(): Promise<PublicClient> {
  if (activeClient) return activeClient;

  const primary = createPublicClient({
    chain: sepolia,
    transport: http(CHAIN_CONFIG.rpcPrimary),
  });

  try {
    await primary.getBlockNumber();
    activeClient = primary;
    usingFallback = false;
    return primary;
  } catch {
    console.warn('Primary RPC unavailable, switching to fallback');
    const fallback = createPublicClient({
      chain: sepolia,
      transport: http(CHAIN_CONFIG.rpcFallback),
    });

    try {
      await fallback.getBlockNumber();
      activeClient = fallback;
      usingFallback = true;
      return fallback;
    } catch {
      throw new Error('Both primary and fallback RPC are unavailable');
    }
  }
}

export function isUsingFallback(): boolean {
  return usingFallback;
}

export function resetClient(): void {
  activeClient = null;
}
