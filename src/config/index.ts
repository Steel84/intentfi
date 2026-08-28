import { PolicyConfig } from '../types';

// Target: Sepolia testnet with Uniswap V3
export const CHAIN_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcPrimary: import.meta.env.VITE_RPC_PRIMARY || 'https://rpc.sepolia.org',
  rpcFallback: import.meta.env.VITE_RPC_FALLBACK || 'https://ethereum-sepolia-rpc.publicnode.com',
  explorer: 'https://sepolia.etherscan.io',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as const;

// Uniswap V3 Sepolia deployments (verified)
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
