import React from 'react';
import { useAccount, useBalance } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { IntentInput } from './IntentInput';
import { IntentDisplay } from './IntentDisplay';
import { QuoteDisplay } from './QuoteDisplay';
import { PolicyDisplay } from './PolicyDisplay';
import { SimulationDisplay } from './SimulationDisplay';
import { ExecutionPanel } from './ExecutionPanel';
import { useSwapFlow } from './useSwapFlow';

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
  const { data: balance } = useBalance({ address });
  const flow = useSwapFlow();

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">IntentFi</h1>
        <div className="wallet-area">
          <ConnectKitButton />
          {isConnected && balance && (
            <span className="balance">
              {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
            </span>
          )}
        </div>
      </header>

      <main className="main">
        {!isConnected ? (
          <div className="connect-prompt">
            <p>Connect your wallet to get started</p>
            <ConnectKitButton />
          </div>
        ) : (
          <div className="flow">
            <IntentInput
              onIntentParsed={(intent) => flow.runFlow(intent)}
              onError={() => {}}
              onStateChange={() => {}}
              disabled={flow.state === 'executing'}
            />

            {flow.state === 'parsing' && (
              <div className="card"><p>Understanding intent...</p></div>
            )}

            {flow.state === 'quoting' && (
              <div className="card"><p>Fetching live quote...</p></div>
            )}

            {flow.state === 'simulating' && (
              <div className="card"><p>Simulating transaction...</p></div>
            )}

            {flow.error && (
              <div className="error-box">
                <strong>Error:</strong> {flow.error}
              </div>
            )}

            {flow.intent && <IntentDisplay intent={flow.intent} />}
            {flow.quote && <QuoteDisplay quote={flow.quote} />}
            {flow.simulation && <SimulationDisplay result={flow.simulation} />}
            {flow.policyResult && <PolicyDisplay result={flow.policyResult} />}

            {flow.state === 'ready' && flow.intent && flow.quote && (
              <ExecutionPanel
                intent={flow.intent}
                quote={flow.quote}
                onExecuting={() => {}}
                onConfirmed={() => {}}
                onError={() => {}}
                onConfirmClick={flow.executeTransaction}
              />
            )}

            {flow.state === 'executing' && (
              <div className="card">
                <p>Waiting for wallet signature and confirmation...</p>
              </div>
            )}

            {flow.state === 'confirmed' && flow.txHash && (
              <div className="success-box">
                <h3>Transaction Confirmed \u2713</h3>
                <p className="tx-hash">{flow.txHash}</p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${flow.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  View on Explorer \u2192
                </a>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Sepolia Testnet \u2022 Not real funds</span>
        <span>v0.1</span>
      </footer>
    </div>
  );
}
