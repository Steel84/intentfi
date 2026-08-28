import { SwapProtocol, QuoteParams, Quote, SwapParams, TransactionRequest, ProtocolMetadata } from '../types';
import { PROTOCOL_CONFIG, CHAIN_CONFIG, TOKENS } from '../config';

/**
 * Uniswap V3 Protocol Adapter (Sepolia)
 * 
 * Isolated behind SwapProtocol interface.
 * Rest of the app never touches DEX-specific SDK calls directly.
 */
export class UniswapV3Adapter implements SwapProtocol {
  
  async getQuote(params: QuoteParams): Promise<Quote> {
    // TODO: Implement using Uniswap V3 Quoter contract on Sepolia
    // This will use viem to call quoterV2.quoteExactInputSingle
    throw new Error('Not implemented yet - Day 2 deliverable');
  }

  async buildTransaction(params: SwapParams): Promise<TransactionRequest> {
    // TODO: Encode swap call via SwapRouter
    // exactInputSingle with deadline and amountOutMinimum
    throw new Error('Not implemented yet - Day 2 deliverable');
  }

  getProtocolMetadata(): ProtocolMetadata {
    return {
      name: 'uniswap-v3',
      router: PROTOCOL_CONFIG.router,
      chainId: CHAIN_CONFIG.chainId,
      supportedTokens: Object.keys(TOKENS),
    };
  }
}
