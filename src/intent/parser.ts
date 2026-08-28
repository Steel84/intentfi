import { SwapIntent, ParsedIntentResult } from '../types';
import { CHAIN_CONFIG, TOKENS } from '../config';

const SYSTEM_PROMPT = `You are an intent parser for a DeFi swap application.
Return ONLY JSON matching: {"action":"swap","tokenIn":"SYMBOL","tokenOut":"SYMBOL","amountIn":"DECIMAL","maxSlippageBps":NUMBER}.
Do not generate calldata, addresses, or transaction suggestions. Convert percentage slippage to basis points.`;

export async function parseIntent(userInput: string, apiKey: string): Promise<ParsedIntentResult> {
  if (!userInput.trim()) return { success: false, error: 'Intent cannot be empty' };
  if (!apiKey.trim()) return { success: false, error: 'Parser API key is not configured' };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok)
      return {
        success: false,
        error:
          response.status === 429
            ? 'Parser is rate-limited. Use Form mode instead.'
            : `Parser API error (${response.status})`,
      };
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string')
      return { success: false, error: 'Parser returned an invalid response' };
    return validateSwapIntent(JSON.parse(content));
  } catch (e: unknown) {
    return {
      success: false,
      error: `Parse failed: ${e instanceof Error ? e.message : 'unknown error'}`,
    };
  }
}

export function validateSwapIntent(raw: unknown): ParsedIntentResult {
  if (!raw || typeof raw !== 'object') return { success: false, error: 'Intent must be an object' };
  const candidate = raw as Record<string, unknown>;
  if (candidate.error) return { success: false, error: String(candidate.error) };
  if (candidate.action !== 'swap')
    return { success: false, error: `Unsupported action: ${String(candidate.action)}` };
  if (
    typeof candidate.tokenIn !== 'string' ||
    !/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/.test(candidate.tokenIn.trim())
  )
    return { success: false, error: 'Missing or invalid tokenIn' };
  if (
    typeof candidate.tokenOut !== 'string' ||
    !/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/.test(candidate.tokenOut.trim())
  )
    return { success: false, error: 'Missing or invalid tokenOut' };
  if (
    typeof candidate.amountIn !== 'string' ||
    !/^\d+(\.\d+)?$/.test(candidate.amountIn.trim()) ||
    /^0+(\.0+)?$/.test(candidate.amountIn.trim())
  )
    return { success: false, error: 'Missing or invalid amountIn' };
  if (
    typeof candidate.maxSlippageBps !== 'number' ||
    !Number.isInteger(candidate.maxSlippageBps) ||
    candidate.maxSlippageBps < 0 ||
    candidate.maxSlippageBps > 10000
  )
    return { success: false, error: 'maxSlippageBps must be an integer from 0 to 10000' };

  const tokenIn = candidate.tokenIn.trim().toUpperCase();
  const tokenOut = candidate.tokenOut.trim().toUpperCase();
  if (!TOKENS[tokenIn]) return { success: false, error: `Unsupported input token: ${tokenIn}` };
  if (!TOKENS[tokenOut]) return { success: false, error: `Unsupported output token: ${tokenOut}` };
  if (tokenIn === 'ETH')
    return {
      success: false,
      error: 'Native ETH input is not supported. Use WETH as the input token.',
    };
  if (tokenIn === tokenOut)
    return { success: false, error: 'Input and output tokens must be different' };

  return {
    success: true,
    intent: {
      action: 'swap',
      chainId: CHAIN_CONFIG.chainId,
      tokenIn,
      tokenOut,
      amountIn: candidate.amountIn.trim(),
      maxSlippageBps: candidate.maxSlippageBps,
    },
  };
}

/** Parse the deterministic fallback syntax used when no LLM key is configured. */
export function tryFallbackParse(input: string): SwapIntent | null {
  const match = input.match(
    /swap\s+(\d+(?:\.\d+)?)\s+([a-zA-Z][a-zA-Z0-9_-]{1,15})\s+(?:to|for)\s+([a-zA-Z][a-zA-Z0-9_-]{1,15})(?:.*?(?:max|maximum)\s+(\d+(?:\.\d+)?)%\s*slippage)?/i,
  );
  if (!match) return null;
  const [, amount, tokenIn, tokenOut, slippage] = match;
  const result = validateSwapIntent({
    action: 'swap',
    tokenIn,
    tokenOut,
    amountIn: amount,
    maxSlippageBps: slippage ? percentToBps(slippage) : 50,
  });
  return result.success ? result.intent : null;
}

/** Convert a percentage with at most two decimal places to integer basis points. */
export function percentToBps(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return -1;
  const [whole, fraction = ''] = value.trim().split('.');
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(bps) && bps >= 0 && bps <= 10000 ? bps : -1;
}
