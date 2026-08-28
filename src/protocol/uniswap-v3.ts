import {
  SwapProtocol,
  QuoteParams,
  Quote,
  SwapParams,
  TransactionRequest,
  ProtocolMetadata,
} from '../types';
import { CHAIN_CONFIG } from '../config';
import { getHealthyClient } from '../utils/rpc';
import { toBaseUnits, fromBaseUnits, getTokenDecimals } from '../utils/tokens';
import { encodeFunctionData, parseAbi } from 'viem';

// Uniswap V3 Sepolia deployments
// The deployed SwapRouter02 uses a 7-field exactInputSingle tuple.
// https://docs.uniswap.org/contracts/v3/reference/deployments/sepolia-deployments
const UNISWAP_SEPOLIA = {
  swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as `0x${string}`,
  quoterV2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3' as `0x${string}`,
  factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c' as `0x${string}`,
  // Sepolia test tokens
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`,
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
};

const QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const SWAP_ROUTER_ABI = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

const MULTICALL_ABI = parseAbi([
  'function multicall(uint256 deadline, bytes[] data) external payable returns (bytes[] results)',
]);

const FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
]);

const POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

// Pool fee tier (0.3%)
const FEE_TIER = 3000;

/**
 * Uniswap V3 Protocol Adapter (Sepolia)
 *
 * Implements SwapProtocol interface.
 * Uses live on-chain data via QuoterV2 contract.
 */
export class UniswapV3Adapter implements SwapProtocol {
  private resolveAddress(symbol: string): `0x${string}` {
    const upper = symbol.toUpperCase();
    if (upper === 'ETH' || upper === 'WETH') return UNISWAP_SEPOLIA.WETH;
    if (upper === 'USDC') return UNISWAP_SEPOLIA.USDC;
    throw new Error(`Unsupported token: ${symbol}`);
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    if (params.chainId !== CHAIN_CONFIG.chainId)
      throw new Error(`Unsupported chain: ${params.chainId}`);
    if (params.tokenIn.toUpperCase() === 'ETH')
      throw new Error('Native ETH input is not supported. Use WETH as the input token.');
    if (params.tokenIn.toUpperCase() === params.tokenOut.toUpperCase())
      throw new Error('Input and output tokens must be different');
    const slippageBps = params.slippageBps ?? 50;
    if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10000)
      throw new Error('Invalid slippage');
    const client = await getHealthyClient();
    const tokenInAddress = this.resolveAddress(params.tokenIn);
    const tokenOutAddress = this.resolveAddress(params.tokenOut);
    const decimalsIn = getTokenDecimals(params.tokenIn);
    const decimalsOut = getTokenDecimals(params.tokenOut);
    const amountInWei = toBaseUnits(params.amountIn, decimalsIn);

    // Call QuoterV2.quoteExactInputSingle
    const result = await client.simulateContract({
      address: UNISWAP_SEPOLIA.quoterV2,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          amountIn: amountInWei,
          fee: FEE_TIER,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const [amountOut, , , gasEstimate] = result.result as [bigint, bigint, number, bigint];

    const priceImpactBps = await this.getPriceImpactBps(
      client,
      tokenInAddress,
      tokenOutAddress,
      amountInWei,
      amountOut,
      decimalsIn,
      decimalsOut,
    );
    const expectedOutput = fromBaseUnits(amountOut, decimalsOut);
    // Calculate minimum output with slippage (default 0.5%)
    const minOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;
    const minimumOutput = fromBaseUnits(minOut, decimalsOut);

    // Price = amountOut / amountIn (normalized)
    const price = Number(amountOut) / 10 ** decimalsOut / (Number(amountInWei) / 10 ** decimalsIn);

    return {
      inputAmount: `${params.amountIn} ${params.tokenIn}`,
      expectedOutput: `${expectedOutput} ${params.tokenOut}`,
      minimumOutput: `${minimumOutput} ${params.tokenOut}`,
      price: price.toFixed(8),
      priceImpactBps,
      slippageBps,
      gasEstimate: gasEstimate.toString(),
      route: `${params.tokenIn} -> ${params.tokenOut} (0.3% fee)`,
      expiresAt: Date.now() + 30000, // 30s validity
    };
  }

  async buildTransaction(params: SwapParams): Promise<TransactionRequest> {
    if (params.chainId !== CHAIN_CONFIG.chainId)
      throw new Error(`Unsupported chain: ${params.chainId}`);
    if (params.tokenIn.toUpperCase() === 'ETH')
      throw new Error('Native ETH input is not supported. Use WETH as the input token.');
    if (params.tokenIn.toUpperCase() === params.tokenOut.toUpperCase())
      throw new Error('Input and output tokens must be different');
    const tokenInAddress = this.resolveAddress(params.tokenIn);
    const tokenOutAddress = this.resolveAddress(params.tokenOut);
    const decimalsIn = getTokenDecimals(params.tokenIn);
    const amountInWei = toBaseUnits(params.amountIn, decimalsIn);
    const decimalsOut = getTokenDecimals(params.tokenOut);
    const minAmountOutWei = toBaseUnits(params.minAmountOut, decimalsOut);

    // Sepolia's deployed address is SwapRouter02. Its swap tuple has no deadline,
    // so wrap the exact-input call in deadline-protected multicall(uint256,bytes[]).
    const swapData = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          fee: FEE_TIER,
          recipient: params.recipient as `0x${string}`,
          amountIn: amountInWei,
          amountOutMinimum: minAmountOutWei,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    const data = encodeFunctionData({
      abi: MULTICALL_ABI,
      functionName: 'multicall',
      args: [BigInt(params.deadline), [swapData]],
    });

    return {
      to: UNISWAP_SEPOLIA.swapRouter,
      data,
      value: '0', // ERC20 swap, no ETH value
      gasLimit: '300000',
      chainId: CHAIN_CONFIG.chainId,
    };
  }

  getProtocolMetadata(): ProtocolMetadata {
    return {
      name: 'uniswap-v3',
      router: UNISWAP_SEPOLIA.swapRouter,
      chainId: CHAIN_CONFIG.chainId,
      supportedTokens: ['USDC', 'WETH', 'ETH'],
    };
  }

  /**
   * Compare the quoted execution price with the current pool spot price.
   * All comparisons use integer ratios, so policy decisions never depend on floats.
   */
  private async getPriceImpactBps(
    client: Awaited<ReturnType<typeof getHealthyClient>>,
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint,
    amountOut: bigint,
    decimalsIn: number,
    decimalsOut: number,
  ): Promise<number | undefined> {
    const pool = (await client.readContract({
      address: UNISWAP_SEPOLIA.factory,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [tokenIn, tokenOut, FEE_TIER],
    })) as `0x${string}`;
    if (!pool || /^0x0{40}$/i.test(pool)) return undefined;

    const slot0 = (await client.readContract({
      address: pool,
      abi: POOL_ABI,
      functionName: 'slot0',
    })) as readonly [bigint, ...unknown[]];
    const sqrtPriceX96 = slot0[0];
    if (!sqrtPriceX96 || sqrtPriceX96 <= 0n || amountIn <= 0n || amountOut <= 0n) return undefined;

    const token0IsIn = tokenIn.toLowerCase() < tokenOut.toLowerCase();
    const q192 = 2n ** 192n;
    const scale = 1_000_000_000_000_000_000n;
    const sqrtSquared = sqrtPriceX96 * sqrtPriceX96;
    const inScale = 10n ** BigInt(decimalsIn);
    const outScale = 10n ** BigInt(decimalsOut);
    const spot = token0IsIn
      ? (sqrtSquared * inScale * scale) / (q192 * outScale)
      : (q192 * inScale * scale) / (sqrtSquared * outScale);
    const execution = (amountOut * inScale * scale) / (amountIn * outScale);
    if (spot <= 0n || execution >= spot) return 0;
    return Number(((spot - execution) * 10_000n) / spot);
  }

  /**
   * Check ERC20 balance for user
   */
  async getBalance(token: string, userAddress: `0x${string}`): Promise<bigint> {
    const client = await getHealthyClient();
    const tokenAddress = this.resolveAddress(token);

    const balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    });

    return balance as bigint;
  }

  /**
   * Check ERC20 allowance for router
   */
  async getAllowance(token: string, userAddress: `0x${string}`): Promise<bigint> {
    const client = await getHealthyClient();
    const tokenAddress = this.resolveAddress(token);

    const allowance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddress, UNISWAP_SEPOLIA.swapRouter],
    });

    return allowance as bigint;
  }

  /**
   * Build approval transaction
   */
  buildApprovalTx(token: string, amount: bigint): TransactionRequest {
    const tokenAddress = this.resolveAddress(token);

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [UNISWAP_SEPOLIA.swapRouter, amount],
    });

    return {
      to: tokenAddress,
      data,
      value: '0',
      gasLimit: '60000',
      chainId: CHAIN_CONFIG.chainId,
    };
  }
}

export const uniswapAdapter = new UniswapV3Adapter();
