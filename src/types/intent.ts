/**
 * Core Intent Types
 * Independent of LLM provider and DEX implementation
 */

export type SwapIntent = {
  action: 'swap';
  chainId: number;
  tokenIn: string; // token symbol or address
  tokenOut: string; // token symbol or address
  amountIn: string; // human-readable amount
  maxSlippageBps: number; // basis points (50 = 0.5%)
  maxPriceImpactBps?: number;
  maxGasWei?: string;
};

export type Intent = SwapIntent; // union type for future actions

export type ParsedIntentResult =
  | {
      success: true;
      intent: Intent;
    }
  | {
      success: false;
      error: string;
    };
