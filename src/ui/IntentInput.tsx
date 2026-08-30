import { useState } from 'react';
import { SwapIntent, ParsedIntentResult } from '../types';
import { validateSwapIntent, percentToBps, tryFallbackParse, parseIntent } from '../intent/parser';
import { UnsupportedConditionsGate } from './UnsupportedConditionsGate';
import { AppState } from './App';

type Props = {
  onIntentParsed: (intent: SwapIntent) => void;
  onError: (error: string) => void;
  onStateChange: (state: AppState) => void;
  disabled: boolean;
};

type InputMode = 'natural' | 'form';

/** Pending intent that has unsupported conditions awaiting user acknowledgment. */
type PendingGate = {
  intent: SwapIntent;
  conditions: string[];
};

export function IntentInput({ onIntentParsed, onError, disabled }: Props) {
  const [mode, setMode] = useState<InputMode>('natural');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingGate, setPendingGate] = useState<PendingGate | null>(null);

  // Form fields
  const [formTokenIn, setFormTokenIn] = useState('USDC');
  const [formTokenOut, setFormTokenOut] = useState('ETH');
  const [formAmount, setFormAmount] = useState('');
  const [formSlippage, setFormSlippage] = useState('0.5');

  /** Route a successful parse result, gating on unsupported conditions. */
  const handleResult = (result: ParsedIntentResult) => {
    if (!result.success) {
      onError(result.error);
      return;
    }
    if (result.unsupportedConditions && result.unsupportedConditions.length > 0) {
      setPendingGate({ intent: result.intent, conditions: result.unsupportedConditions });
      return;
    }
    onIntentParsed(result.intent);
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setPendingGate(null);
    setLoading(true);

    // 1. Try deterministic fallback first (no network, instant)
    const fallback = tryFallbackParse(input);
    if (fallback) {
      setLoading(false);
      onIntentParsed(fallback);
      return;
    }

    // 2. Fallback returned null: try LLM if key is available
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) {
      setLoading(false);
      onError(
        'Could not parse intent. Try the Form input, or configure a Gemini API key for advanced parsing.',
      );
      return;
    }

    const llmResult = await parseIntent(input, geminiKey);
    setLoading(false);
    handleResult(llmResult);
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

  // --- Unsupported conditions gate ---
  if (pendingGate) {
    return (
      <UnsupportedConditionsGate
        intent={pendingGate.intent}
        conditions={pendingGate.conditions}
        onContinue={() => {
          const intent = pendingGate.intent;
          setPendingGate(null);
          onIntentParsed(intent);
        }}
        onCancel={() => {
          setPendingGate(null);
        }}
      />
    );
  }

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

export { tryFallbackParse };
