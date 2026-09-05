import { useState, useEffect } from 'react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { getAddress } from 'viem';
import { ConnectKitButton } from 'connectkit';
import { IntentInput } from './IntentInput';
import { IntentDisplay } from './IntentDisplay';
import { QuoteDisplay } from './QuoteDisplay';
import { PolicyDisplay } from './PolicyDisplay';
import { SimulationDisplay } from './SimulationDisplay';
import { ExecutionPanel } from './ExecutionPanel';
import { TxHistory } from './TxHistory';
import { RpcStatus } from './RpcStatus';
import { PolicySettings } from './PolicySettings';
import { AgentStatus } from './AgentStatus';
import { useSwapFlow } from './useSwapFlow';
import { CHAIN_CONFIG, TOKENS } from '../config';

export type AppState =
  | 'idle'
  | 'parsing'
  | 'parsed'
  | 'quoting'
  | 'quoted'
  | 'checking-policy'
  | 'policy-done'
  | 'simulating'
  | 'ready'
  | 'executing'
  | 'confirmed'
  | 'error';

function formatBalanceDisplay(formatted: string | undefined, maxDecimals: number): string {
  if (!formatted) return '0';
  const val = parseFloat(formatted);
  if (!Number.isFinite(val) || val === 0) return '0';
  const fixed = val.toFixed(maxDecimals);
  return fixed.replace(/(\.\d*?[1-9])0+$|\.0*$/, '$1');
}

export default function App() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const safeAccountAddress = (() => {
    if (!address) return undefined;
    try {
      return getAddress(address);
    } catch {
      return undefined;
    }
  })();

  const {
    data: nativeBalance,
    isLoading: nativeLoading,
    isError: nativeError,
    error: nativeErrObj,
    refetch: refetchNative
  } = useBalance({
    address: safeAccountAddress,
    chainId: CHAIN_CONFIG.chainId,
    query: { enabled: Boolean(safeAccountAddress) }
  });

  const {
    data: usdcBalance,
    isLoading: usdcLoading,
    isError: usdcError,
    error: usdcErrObj,
    refetch: refetchUsdc
  } = useBalance({
    address: safeAccountAddress,
    token: getAddress(TOKENS.USDC.address),
    chainId: CHAIN_CONFIG.chainId,
    query: { enabled: Boolean(safeAccountAddress) }
  });

  const {
    data: wethBalance,
    isLoading: wethLoading,
    isError: wethError,
    error: wethErrObj,
    refetch: refetchWeth
  } = useBalance({
    address: safeAccountAddress,
    token: getAddress(TOKENS.WETH.address),
    chainId: CHAIN_CONFIG.chainId,
    query: { enabled: Boolean(safeAccountAddress) }
  });

  const flow = useSwapFlow();

  useEffect(() => {
    if (!safeAccountAddress) return;
    const refreshBalances = () => {
      void refetchNative();
      void refetchUsdc();
      void refetchWeth();
    };
    const interval = window.setInterval(refreshBalances, 20_000);
    return () => window.clearInterval(interval);
  }, [safeAccountAddress, flow.balancesVersion, refetchNative, refetchUsdc, refetchWeth]);

  useEffect(() => {
    if (nativeError && nativeErrObj) console.warn('[Balance:ETH error]', nativeErrObj);
    if (wethError && wethErrObj) console.warn('[Balance:WETH error]', wethErrObj);
    if (usdcError && usdcErrObj) console.warn('[Balance:USDC error]', usdcErrObj);
  }, [nativeError, nativeErrObj, wethError, wethErrObj, usdcError, usdcErrObj]);

  const [inputError, setInputError] = useState<string | null>(null);
  const [showQuoteLoading, setShowQuoteLoading] = useState(false);

  useEffect(() => {
    if (flow.state !== 'quoting') {
      setShowQuoteLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowQuoteLoading(true), 250);
    return () => window.clearTimeout(timer);
  }, [flow.state]);

  useEffect(() => {
    setInputError(null);
  }, [address, isConnected]);

  return (
    <div className="app">
      {isConnected && <>
        <header className="header">
          <h1 className="logo">IntentFi</h1>
          <div className="wallet-area">
            {address && (
              <div className="wallet-account-badge">
                <span className="wallet-pill" title={address}>
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <button
                  type="button"
                  className="btn-disconnect"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </header>
        {address && (
          <div className="token-balances-bar" aria-label="Wallet balances">
            <span className="balance">
              ETH {nativeLoading ? '…' : formatBalanceDisplay(nativeBalance?.formatted, 4)}
            </span>
            <span className="balance">
              WETH {wethLoading ? '…' : formatBalanceDisplay(wethBalance?.formatted, 6)}
            </span>
            <span className="balance">
              USDC {usdcLoading ? '…' : formatBalanceDisplay(usdcBalance?.formatted, 2)}
            </span>
          </div>
        )}
      </>}

      <main className="main">
        {!isConnected ? (
          <div className="connect-prompt">
            <h1 className="landing-logo">
              Intent<span>Fi</span>
            </h1>
            <p className="landing-tagline">
              A safety and policy execution layer for onchain financial intents.
            </p>
            <ConnectKitButton />
          </div>
        ) : flow.isWrongChain ? (
          <div className="wrong-chain">
            <div className="card">
              <h3>Wrong Network</h3>
              <p>
                Please switch to <strong>{CHAIN_CONFIG.name}</strong> to use IntentFi.
              </p>
              <button className="btn-switch" onClick={flow.switchToSepolia}>
                Switch to {CHAIN_CONFIG.name}
              </button>
            </div>
          </div>
        ) : (
          <div className="flow">
            <AgentStatus
              state={flow.state}
              quote={flow.quote}
              policy={flow.policyResult}
              simulation={flow.simulation}
              needsApproval={flow.needsApproval}
            />
            <PolicySettings config={flow.policyConfig} onSave={flow.updatePolicyConfig} />
            <IntentInput
              key={address ?? 'disconnected'}
              onIntentParsed={(intent) => {
                setInputError(null);
                flow.runFlow(intent);
              }}
              onError={(error) => setInputError(error)}
              onStateChange={() => {}}
              disabled={flow.state === 'executing' || flow.approving}
            />

            {flow.state === 'quoting' && showQuoteLoading && (
              <div className="card loading-card">
                <div className="spinner" />
                <p>Fetching live quote from Uniswap V3...</p>
              </div>
            )}

            {flow.state === 'simulating' && (
              <div className="card loading-card">
                <div className="spinner" />
                <p>Simulating transaction on-chain...</p>
              </div>
            )}

            {flow.state === 'checking-policy' && (
              <div className="card loading-card">
                <div className="spinner" />
                <p>Running policy checks...</p>
              </div>
            )}

            {(inputError || flow.error) && flow.state !== 'confirmed' && (
              !inputError && flow.needsApproval ? (
                <div className="action-box">
                  <strong>Action required:</strong> {flow.error}
                  <button
                    className="btn-approve"
                    onClick={flow.approveToken}
                    disabled={flow.approving}
                  >
                    {flow.approving ? 'Approving...' : `Approve ${flow.intent?.tokenIn}`}
                  </button>
                </div>
              ) : (
                <div className="error-box">
                  <strong>Error:</strong> {inputError || flow.error}
                  {flow.state === 'error' && (
                    <button className="btn-retry" onClick={flow.retry}>
                      Try Again
                    </button>
                  )}
                </div>
              )
            )}

                        {/* When confirmed: show Confirmed box prominently at the top */}
            {flow.state === 'confirmed' && flow.txHash && (
              <div className="success-box">
                <h3>Transaction Confirmed ✓</h3>
                <p className="tx-hash">{flow.txHash}</p>
                <a
                  href={`${CHAIN_CONFIG.explorer}/tx/${flow.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  View on Explorer →
                </a>
                <button className="btn-new-swap" onClick={flow.reset}>
                  New Swap
                </button>
              </div>
            )}

            {/* Always display transaction cards: during preparation and as calm audit trail after confirmation */}
            {flow.intent && <IntentDisplay intent={flow.intent} />}
            {flow.quote && (
              <QuoteDisplay
                quote={flow.quote}
                onRefresh={flow.state !== 'confirmed' ? flow.refreshQuote : undefined}
                isConfirmed={flow.state === 'confirmed'}
              />
            )}
            {flow.simulation && (
              <SimulationDisplay
                result={flow.simulation}
                needsApproval={flow.needsApproval}
                isQuoteExpired={flow.state !== 'confirmed' && (flow.isQuoteExpired || Boolean(flow.quote && flow.quote.expiresAt <= Date.now()))}
                isConfirmed={flow.state === 'confirmed'}
              />
            )}
            {flow.policyResult && (
              <PolicyDisplay
                result={flow.policyResult}
                needsApproval={flow.needsApproval}
                isQuoteExpired={flow.state !== 'confirmed' && (flow.isQuoteExpired || Boolean(flow.quote && flow.quote.expiresAt <= Date.now()))}
                isConfirmed={flow.state === 'confirmed'}
              />
            )}

            {flow.state !== 'confirmed' &&
              (flow.state === 'ready' ||
                (flow.intent &&
                  flow.quote &&
                  flow.quote.expiresAt <= Date.now() &&
                  flow.simulation?.success)) &&
              flow.intent &&
              flow.quote && (
                <ExecutionPanel
                  intent={flow.intent}
                  quote={flow.quote}
                  onConfirmClick={flow.executeTransaction}
                  onCancelClick={flow.reset}
                  onRefreshQuote={flow.refreshQuote}
                />
              )}

            {flow.state === 'executing' && (
              <div className="card loading-card">
                <div className="spinner" />
                <p>Waiting for wallet signature and confirmation...</p>
              </div>
            )}

            {flow.txHistory.length > 0 && flow.state !== 'confirmed' && (
              <TxHistory entries={flow.txHistory} />
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <RpcStatus />
        <span>Sepolia Testnet • Not real funds</span>
        <span>v0.1</span>
      </footer>
    </div>
  );
}
