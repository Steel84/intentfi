import { useState } from 'react';
import { SwapIntent } from '../types';
import { parseIntent, validateSwapIntent } from '../intent/parser';
import { AppState } from './App';

type Props = {
  onIntentParsed: (intent: SwapIntent) => void;
  onError: (error: string) => void;
  onStateChange: (state: AppState) => void;
  disabled: boolean;
};

export function IntentInput({ onIntentParsed, onError, onStateChange, disabled }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    onStateChange('parsing');

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: try simple regex parse
      const fallback = tryFallbackParse(input);
      if (fallback) {
        onIntentParsed(fallback);
      } else {
        onError('OpenAI API key not configured and fallback parse failed');
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

  return (
    <div className="intent-input">
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
    </div>
  );
}

/**
 * Fallback parser (no LLM needed)
 * Handles: "Swap X TOKEN to TOKEN, max Y% slippage"
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
