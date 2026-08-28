/**
 * Protocol Adapter Types
 * DEX-agnostic interface for quote/build/metadata
 */

export type QuoteParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  chainId: number;
};

export type Quote = {
  inputAmount: string;
  expectedOutput: string;
  minimumOutput: string;
  price: string;
  priceImpactBps: number;
  slippageBps: number;
  gasEstimate: string;
  route?: string;
  expiresAt: number;
};

export type SwapParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  recipient: string;
  chainId: number;
  deadline: number;
};

export type TransactionRequest = {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  chainId: number;
};

export type ProtocolMetadata = {
  name: string;
  router: string;
  chainId: number;
  supportedTokens: string[];
};

export interface SwapProtocol {
  getQuote(params: QuoteParams): Promise<Quote>;
  buildTransaction(params: SwapParams): Promise<TransactionRequest>;
  getProtocolMetadata(): ProtocolMetadata;
}
