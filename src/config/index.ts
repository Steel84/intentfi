import { PolicyConfig } from '../types';

// Target: Sepolia testnet with Uniswap V3
export const CHAIN_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcPrimary: import.meta.env.VITE_RPC_PRIMARY || 'https://1rpc.io/sepolia',
  rpcFallback: import.meta.env.VITE_RPC_FALLBACK || 'https://ethereum-sepolia-rpc.publicnode.com',
  explorer: 'https://sepolia.etherscan.io',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as const;

// Uniswap V3 Sepolia deployments (verified)
// SwapRouter02 is used with deadline-protected multicall; the legacy V1 router is not deployed on Sepolia.
// https://docs.uniswap.org/contracts/v3/reference/deployments/sepolia-deployments
export const UNISWAP_V3_ADDRESSES = {
  swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  quoterV2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
  factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
} as const;

// Token registry (Sepolia verified addresses)
export const TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  USDC: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    symbol: 'USDC',
  },
  WETH: {
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    decimals: 18,
    symbol: 'WETH',
  },
  ETH: {
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    decimals: 18,
    symbol: 'ETH',
  },
};

// Default policy for v0.1 (hardcoded)
export const DEFAULT_POLICY: PolicyConfig = {
  maxTransactionValueUsd: 100,
  maxSlippageBps: 50,
  maxPriceImpactBps: 100,
  allowedProtocols: ['uniswap-v3'],
  allowedTokens: ['USDC', 'WETH', 'ETH'],
};

// Protocol config
export const PROTOCOL_CONFIG = {
  name: 'uniswap-v3',
  router: UNISWAP_V3_ADDRESSES.swapRouter,
  quoter: UNISWAP_V3_ADDRESSES.quoterV2,
} as const;

/** Safely load locally persisted policy values without trusting arbitrary JSON. */
export function normalizePolicyConfig(value: unknown): PolicyConfig {
  const candidate = value && typeof value === 'object' ? (value as Partial<PolicyConfig>) : {};
  const numberInRange = (input: unknown, fallback: number, max: number) =>
    typeof input === 'number' && Number.isFinite(input) && input >= 0 && input <= max
      ? input
      : fallback;
  const allowedTokens = Array.isArray(candidate.allowedTokens)
    ? candidate.allowedTokens
        .filter((token): token is string => typeof token === 'string')
        .map((token) => token.toUpperCase())
        .filter(Boolean)
    : DEFAULT_POLICY.allowedTokens;
  const allowedProtocols = Array.isArray(candidate.allowedProtocols)
    ? candidate.allowedProtocols
        .filter((protocol): protocol is string => typeof protocol === 'string')
        .map((protocol) => protocol.toLowerCase())
        .filter(Boolean)
    : DEFAULT_POLICY.allowedProtocols;

  return {
    maxTransactionValueUsd: numberInRange(
      candidate.maxTransactionValueUsd,
      DEFAULT_POLICY.maxTransactionValueUsd,
      1_000_000,
    ),
    maxSlippageBps: Math.floor(
      numberInRange(candidate.maxSlippageBps, DEFAULT_POLICY.maxSlippageBps, 10_000),
    ),
    maxPriceImpactBps: Math.floor(
      numberInRange(candidate.maxPriceImpactBps, DEFAULT_POLICY.maxPriceImpactBps, 10_000),
    ),
    allowedProtocols: allowedProtocols.length ? allowedProtocols : DEFAULT_POLICY.allowedProtocols,
    allowedTokens: allowedTokens.length ? allowedTokens : DEFAULT_POLICY.allowedTokens,
  };
}
