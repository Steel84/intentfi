import { SwapIntent, ParsedIntentResult } from '../types';
import { CHAIN_CONFIG, TOKENS } from '../config';

// ---------------------------------------------------------------------------
// Gemini prompt
// ---------------------------------------------------------------------------

const GEMINI_PROMPT = `You are an intent parser for a DeFi token swap application.
Your ONLY job is to extract structured swap parameters from the user's message.

Return ONLY a JSON object with these fields:
{
  "action": "swap",
  "tokenIn": "SYMBOL",        // uppercase token symbol
  "tokenOut": "SYMBOL",       // uppercase token symbol
  "amountIn": "DECIMAL",      // decimal string, e.g. "100" or "0.5"
  "maxSlippageBps": NUMBER,   // integer basis points (0.5% = 50)
  "unsupportedConditions": [] // string[] of conditions the user stated
                              // that are NOT part of the fields above
                              // (e.g. gas limits, price movement checks,
                              //  conditional execution, time constraints)
}

Rules:
- Convert percentage slippage to integer basis points.
- Use uppercase token symbols (ETH, WETH, USDC).
- amountIn must be a positive decimal string. If the user says "all" or
  doesn't give a concrete number, return {"error": "Amount must be a specific number"}.
- If the user mentions conditions you cannot represent in the fields above,
  list each one as a human-readable string in unsupportedConditions.
  Still fill in the swap fields if possible.
- If you cannot determine the swap at all, return {"error": "<reason>"}.
- Do NOT generate calldata, addresses, or transaction suggestions.
- Do NOT add commentary outside the JSON object.`;

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

export async function parseIntent(userInput: string, apiKey: string): Promise<ParsedIntentResult> {
  if (!userInput.trim()) return { success: false, error: 'Intent cannot be empty' };
  if (!apiKey.trim()) return { success: false, error: 'LLM API key is not configured' };

  const model =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
    'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: GEMINI_PROMPT + '\n\nUser message:\n' + userInput }] },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return { success: false, error: 'LLM is rate-limited. Try Form mode or wait a moment.' };
      return { success: false, error: `LLM API error (${response.status})` };
    }

    const data = await response.json();
    const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string')
      return { success: false, error: 'LLM returned an invalid response' };

    const parsed = JSON.parse(text);
    return validateSwapIntent(parsed);
  } catch (e: unknown) {
    return {
      success: false,
      error: `LLM parse failed: ${e instanceof Error ? e.message : 'unknown error'}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Validation (shared by fallback, LLM, and form paths)
// ---------------------------------------------------------------------------

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

  // Extract unsupportedConditions from the LLM response
  let unsupportedConditions: string[] | undefined;
  if (Array.isArray(candidate.unsupportedConditions)) {
    const filtered = (candidate.unsupportedConditions as unknown[])
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());
    if (filtered.length > 0) unsupportedConditions = filtered;
  }

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
    unsupportedConditions,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback parser (no LLM, no network)
// ---------------------------------------------------------------------------

export function tryFallbackParse(input: string): SwapIntent | null {
  const match = input.match(
    /swap\s+(\d+(?:\.\d+)?)\s+([a-zA-Z][a-zA-Z0-9_-]{1,15})\s+(?:to|for)\s+([a-zA-Z][a-zA-Z0-9_-]{1,15})(?:.*?(?:max|maximum)\s+(\d+(?:\.\d+)?)%\s*slippage)?/i,
  );
  if (!match) return null;

  const [, amount, tokenIn, tokenOut, slippage] = match;
  const slippageMentioned = /\b(?:max(?:imum)?|slipp\w*)\b/i.test(input);
  if (slippageMentioned && !slippage) return null;

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
