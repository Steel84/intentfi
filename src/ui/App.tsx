import { useState, useEffect } from 'react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
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
import { FlowProgress } from './FlowProgress';
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

export default function App() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: nativeBalance } = useBalance({ address });
  const { data: usdcBalance } = useBalance({
    address,
    token: TOKENS.USDC.address as `0x${string}`,
  });
  const { data: wethBalance } = useBalance({
    address,
    token: TOKENS.WETH.address as `0x${string}`,
  });
  const flow = useSwapFlow();
  const [inputError, setInputError] = useState<string | null>(null);

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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '0.25rem 0.6rem', borderRadius: '20px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#e4e4e7' }} title={address}>
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    color: '#f87171',
                    borderRadius: '12px',
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </header>
        {isConnected && (
          <div className="token-balances-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', margin: '-1rem 0 2rem 0' }}>
            {nativeBalance && (
              <span className="balance">
                {parseFloat(nativeBalance.formatted).toFixed(4)} {nativeBalance.symbol}
              </span>
            )}
            {usdcBalance && (
              <span className="balance">{parseFloat(usdcBalance.formatted).toFixed(2)} USDC</span>
            )}
            {wethBalance && (
              <span className="balance">{parseFloat(wethBalance.formatted).toFixed(6)} WETH</span>
            )}
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
            <FlowProgress state={flow.state} />
            <AgentStatus
              state={flow.state}
              quote={flow.quote}
              policy={flow.policyResult}
              simulation={flow.simulation}
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

            {flow.state === 'quoting' && (
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

            {(inputError || flow.error) && (
              <div className="error-box">
                <strong>Error:</strong> {inputError || flow.error}
                {flow.needsApproval && (
                  <button
                    className="btn-approve"
                    onClick={flow.approveToken}
                    disabled={flow.approving}
                  >
                    {flow.approving ? 'Approving...' : `Approve ${flow.intent?.tokenIn}`}
                  </button>
                )}
                {flow.state === 'error' && !flow.needsApproval && (
                  <button className="btn-retry" onClick={flow.retry}>
                    Try Again
                  </button>
                )}
              </div>
            )}

            {flow.intent && <IntentDisplay intent={flow.intent} />}
            {flow.quote && <QuoteDisplay quote={flow.quote} onRefresh={flow.refreshQuote} />}
            {flow.simulation && <SimulationDisplay result={flow.simulation} />}
            {flow.policyResult && <PolicyDisplay result={flow.policyResult} />}

            {flow.state === 'ready' && flow.intent && flow.quote && (
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
