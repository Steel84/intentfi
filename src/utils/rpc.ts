import { createPublicClient, http, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_CONFIG } from '../config';

let activeClient: PublicClient | null = null;
let usingFallback = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // Re-check every 60s

export type RpcStatus = {
  connected: boolean;
  usingFallback: boolean;
  latency: number | null;
  blockNumber: bigint | null;
  error: string | null;
};

/**
 * RPC Health Check + Failover
 *
 * If primary is unavailable, switches to fallback.
 * Periodically re-checks primary to switch back.
 */
export async function getHealthyClient(): Promise<PublicClient> {
  const now = Date.now();

  // If we have an active client and it's not stale, use it
  if (activeClient && (now - lastHealthCheck) < HEALTH_CHECK_INTERVAL) {
    return activeClient;
  }

  // Try primary
  const primary = createPublicClient({
    chain: sepolia,
    transport: http(CHAIN_CONFIG.rpcPrimary),
  });

  try {
    await primary.getBlockNumber();
    activeClient = primary;
    usingFallback = false;
    lastHealthCheck = now;
    return primary;
  } catch {
    console.warn('[RPC] Primary unavailable, trying fallback...');
  }

  // Try fallback
  const fallback = createPublicClient({
    chain: sepolia,
    transport: http(CHAIN_CONFIG.rpcFallback),
  });

  try {
    await fallback.getBlockNumber();
    activeClient = fallback;
    usingFallback = true;
    lastHealthCheck = now;
    return fallback;
  } catch {
    throw new Error('Both primary and fallback RPC are unavailable. Check your connection.');
  }
}

/**
 * Get detailed RPC status for UI display
 */
export async function getRpcStatus(): Promise<RpcStatus> {
  try {
    const start = Date.now();
    const client = await getHealthyClient();
    const blockNumber = await client.getBlockNumber();
    const latency = Date.now() - start;

    return {
      connected: true,
      usingFallback,
      latency,
      blockNumber,
      error: null,
    };
  } catch (e: any) {
    return {
      connected: false,
      usingFallback: false,
      latency: null,
      blockNumber: null,
      error: e.message,
    };
  }
}

export function isUsingFallback(): boolean {
  return usingFallback;
}

export function resetClient(): void {
  activeClient = null;
  lastHealthCheck = 0;
}
