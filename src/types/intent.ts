/**
 * Core Intent Types
 * Independent of LLM provider and DEX implementation
 */

export type SwapIntent = {
  action: 'swap';
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  maxPriceImpactBps?: number;
  maxGasWei?: string;
};

export type Intent = SwapIntent;

export type ParsedIntentResult =
  | { success: true; intent: Intent; unsupportedConditions?: string[] }
  | { success: false; error: string };

export type ParserSource = 'deterministic' | 'gemini';
