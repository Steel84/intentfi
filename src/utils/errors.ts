/** Convert wallet/RPC errors into concise, actionable UI copy. */
export function toUserError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('user rejected') ||
    normalized.includes('user denied') ||
    normalized.includes('rejected') ||
    normalized.includes('denied')
  ) {
    return 'Request rejected in your wallet.';
  }
  if (normalized.includes('insufficient funds')) return 'Insufficient ETH for gas.';
  if (normalized.includes('insufficient balance'))
    return 'Insufficient token balance for this swap.';
  if (normalized.includes('nonce')) return 'Wallet nonce is out of sync. Refresh and try again.';
  if (normalized.includes('timeout') || normalized.includes('timed out'))
    return 'The network took too long to respond. Try again.';
  if (
    normalized.includes('method not found') ||
    normalized.includes('eth_sendrawtransaction') ||
    normalized.includes('sendrawtransaction') ||
    normalized.includes('rpc error') ||
    normalized.includes('-32601')
  )
    return 'MetaMask RPC cannot broadcast this transaction. Change the wallet RPC and try again.';
  if (normalized.includes('revert') || normalized.includes('execution reverted'))
    return 'The transaction would revert on-chain. Refresh the quote and try again.';
  if (normalized.includes('no route') || normalized.includes('liquidity'))
    return 'No Uniswap liquidity was found for this pair.';
  if (normalized.includes('fetch') || normalized.includes('network') || normalized.includes('rpc'))
    return 'The network is unavailable. Check the RPC status and try again.';
  if (normalized.includes('approval')) return 'Token approval is required before this swap.';
  return fallback;
}
