import { useState } from 'react';
import { SwapIntent } from '../types';
import { validateSwapIntent, percentToBps, tryFallbackParse } from '../intent/parser';
import { AppState } from './App';

type Props = {
  onIntentParsed: (intent: SwapIntent) => void;
  onError: (error: string) => void;
  onStateChange: (state: AppState) => void;
  disabled: boolean;
};

type InputMode = 'natural' | 'form';

export function IntentInput({ onIntentParsed, onError, disabled }: Props) {
  const [mode, setMode] = useState<InputMode>('natural');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Form fields
  const [formTokenIn, setFormTokenIn] = useState('USDC');
  const [formTokenOut, setFormTokenOut] = useState('ETH');
  const [formAmount, setFormAmount] = useState('');
  const [formSlippage, setFormSlippage] = useState('0.5');

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);

    // Keep the shipped static app free of browser-exposed provider secrets.
    // The validated deterministic parser is enough for the demo scenario.
    const fallback = tryFallbackParse(input);
    setLoading(false);
    if (fallback) {
      onIntentParsed(fallback);
    } else {
      onError(
        'Could not parse intent. Try the form input or use a clearer format like: "Swap 100 USDC to ETH, max 0.5% slippage"',
      );
    }
  };

  const handleFormSubmit = () => {
    const slippageBps = percentToBps(formSlippage);
    if (slippageBps < 0) {
      onError('Slippage must be a percentage from 0% to 100% with up to two decimal places');
      return;
    }

    const result = validateSwapIntent({
      action: 'swap',
      tokenIn: formTokenIn,
      tokenOut: formTokenOut,
      amountIn: formAmount,
      maxSlippageBps: slippageBps,
    });

    if (result.success) {
      onIntentParsed(result.intent);
    } else {
      onError(result.error);
    }
  };

  return (
    <div className="intent-input">
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'natural' ? 'active' : ''}`}
          onClick={() => setMode('natural')}
          disabled={disabled}
        >
          Natural Language
        </button>
        <button
          className={`mode-btn ${mode === 'form' ? 'active' : ''}`}
          onClick={() => setMode('form')}
          disabled={disabled}
        >
          Form
        </button>
      </div>

      {mode === 'natural' ? (
        <>
          <label>What would you like to do?</label>
          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Swap 100 USDC to ETH, max 0.5% slippage"
              disabled={disabled || loading}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button onClick={handleAnalyze} disabled={disabled || loading || !input.trim()}>
              {loading ? 'Parsing...' : 'Analyze'}
            </button>
          </div>
        </>
      ) : (
        <div className="form-input">
          <div className="form-row">
            <div className="form-field">
              <label>Amount</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="100"
                disabled={disabled}
                min="0"
                step="any"
              />
            </div>
            <div className="form-field">
              <label>From</label>
              <select
                value={formTokenIn}
                onChange={(e) => setFormTokenIn(e.target.value)}
                disabled={disabled}
              >
                <option value="USDC">USDC</option>
                <option value="WETH">WETH</option>
              </select>
            </div>
            <div className="form-field">
              <label>To</label>
              <select
                value={formTokenOut}
                onChange={(e) => setFormTokenOut(e.target.value)}
                disabled={disabled}
              >
                <option value="ETH">ETH</option>
                <option value="WETH">WETH</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Max Slippage (%)</label>
              <input
                type="number"
                value={formSlippage}
                onChange={(e) => setFormSlippage(e.target.value)}
                placeholder="0.5"
                disabled={disabled}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="form-field form-submit">
              <button
                className="btn-form-submit"
                onClick={handleFormSubmit}
                disabled={disabled || !formAmount}
              >
                Execute Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fallback parsing is shared with the test suite so the no-key path stays real. */
export { tryFallbackParse };
