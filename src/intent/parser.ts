import { SwapIntent, ParsedIntentResult } from '../types';
import { CHAIN_CONFIG } from '../config';

/**
 * Intent Parser
 * 
 * LLM's job: translate natural language -> structured SwapIntent
 * Application's job: validate the output against schema
 * 
 * Invalid output is rejected. LLM never generates calldata directly.
 */

const SYSTEM_PROMPT = `You are an intent parser for a DeFi swap application.
Your ONLY job is to extract structured swap parameters from user input.
Return ONLY valid JSON matching the SwapIntent schema.
Do NOT add commentary. Do NOT suggest transactions.
Do NOT generate calldata or addresses.

Schema:
{
  "action": "swap",
  "tokenIn": "<TOKEN_SYMBOL>",
  "tokenOut": "<TOKEN_SYMBOL>",
  "amountIn": "<AMOUNT_AS_STRING>",
  "maxSlippageBps": <NUMBER>
}

Rules:
- Convert percentage slippage to basis points (0.5% = 50 bps)
- Use uppercase token symbols
- amountIn must be a decimal string
- If information is missing, return {"error": "<what is missing>"}
`;

export async function parseIntent(userInput: string, apiKey: string): Promise<ParsedIntentResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
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

    if (!response.ok) {
      return { success: false, error: `LLM API error: ${response.status}` };
    }

    const data = await response.json();
    const raw = JSON.parse(data.choices[0].message.content);

    // Validate against schema
    return validateSwapIntent(raw);
  } catch (e: any) {
    return { success: false, error: `Parse failed: ${e.message}` };
  }
}

/**
 * Validate LLM output against SwapIntent schema
 * Rejects anything that doesn't conform
 */
export function validateSwapIntent(raw: any): ParsedIntentResult {
  if (raw.error) {
    return { success: false, error: raw.error };
  }

  if (raw.action !== 'swap') {
    return { success: false, error: `Unsupported action: ${raw.action}` };
  }

  if (!raw.tokenIn || typeof raw.tokenIn !== 'string') {
    return { success: false, error: 'Missing or invalid tokenIn' };
  }

  if (!raw.tokenOut || typeof raw.tokenOut !== 'string') {
    return { success: false, error: 'Missing or invalid tokenOut' };
  }

  if (!raw.amountIn || isNaN(Number(raw.amountIn)) || Number(raw.amountIn) <= 0) {
    return { success: false, error: 'Missing or invalid amountIn' };
  }

  if (typeof raw.maxSlippageBps !== 'number' || raw.maxSlippageBps < 0 || raw.maxSlippageBps > 10000) {
    return { success: false, error: 'Missing or invalid maxSlippageBps (must be 0-10000)' };
  }

  const intent: SwapIntent = {
    action: 'swap',
    chainId: CHAIN_CONFIG.chainId,
    tokenIn: raw.tokenIn.toUpperCase(),
    tokenOut: raw.tokenOut.toUpperCase(),
    amountIn: raw.amountIn,
    maxSlippageBps: raw.maxSlippageBps,
    maxPriceImpactBps: raw.maxPriceImpactBps,
    maxGasWei: raw.maxGasWei,
  };

  return { success: true, intent };
}
