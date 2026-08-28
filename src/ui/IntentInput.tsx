import { useState } from 'react';
import { SwapIntent } from '../types';
import { parseIntent, validateSwapIntent } from '../intent/parser';
import { CHAIN_CONFIG } from '../config';
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

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: try simple regex parse
      const fallback = tryFallbackParse(input);
      if (fallback) {
        onIntentParsed(fallback);
      } else {
        onError('Could not parse intent. Try the form input or use a clearer format like: "Swap 100 USDC to ETH, max 0.5% slippage"');
      }
      setLoading(false);
      return;
    }

    const result = await parseIntent(input, apiKey);
    setLoading(false);

    if (result.success) {
      onIntentParsed(result.intent);
    } else {
      onError(result.error);
    }
  };

  const handleFormSubmit = () => {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      onError('Please enter a valid amount');
      return;
    }

    const slippageBps = Math.round(parseFloat(formSlippage) * 100);
    if (isNaN(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
      onError('Slippage must be between 0% and 100%');
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
              placeholder='Swap 100 USDC to ETH, max 0.5% slippage'
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

/**
 * Fallback parser (no LLM needed)
 * Handles: "Swap X TOKEN to/for TOKEN[, max/maximum Y% slippage]"
 */
function tryFallbackParse(input: string): SwapIntent | null {
  const match = input.match(
    /swap\s+([\d.]+)\s+(\w+)\s+(?:to|for)\s+(\w+)(?:.*?(?:max|maximum)\s+([\d.]+)%\s*slippage)?/i
  );
  if (!match) return null;

  const [, amount, tokenIn, tokenOut, slippage] = match;
  const result = validateSwapIntent({
    action: 'swap',
    tokenIn: tokenIn.toUpperCase(),
    tokenOut: tokenOut.toUpperCase(),
    amountIn: amount,
    maxSlippageBps: slippage ? Math.round(parseFloat(slippage) * 100) : 50,
  });

  return result.success ? result.intent : null;
}
