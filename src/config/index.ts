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

// Token registry (Sepolia addresses — to be confirmed with actual deployment)
export const TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  USDC: {
    address: '', // fill after verifying Sepolia USDC
    decimals: 6,
    symbol: 'USDC',
  },
  WETH: {
    address: '', // fill after verifying Sepolia WETH
    decimals: 18,
    symbol: 'WETH',
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
  router: '', // Uniswap V3 SwapRouter on Sepolia
  quoter: '', // Uniswap V3 Quoter on Sepolia
} as const;
