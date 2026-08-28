import { SwapIntent, ParsedIntentResult } from '../types';
import { CHAIN_CONFIG } from '../config';

const SYSTEM_PROMPT = `You are an intent parser for a DeFi swap application.
Return ONLY JSON matching: {"action":"swap","tokenIn":"SYMBOL","tokenOut":"SYMBOL","amountIn":"DECIMAL","maxSlippageBps":NUMBER}.
Do not generate calldata, addresses, or transaction suggestions. Convert percentage slippage to basis points.`;

export async function parseIntent(userInput: string, apiKey: string): Promise<ParsedIntentResult> {
  if (!userInput.trim()) return { success: false, error: 'Intent cannot be empty' };
  if (!apiKey.trim()) return { success: false, error: 'Parser API key is not configured' };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userInput }], temperature: 0, response_format: { type: 'json_object' } }),
    });
    if (!response.ok) return { success: false, error: response.status === 429 ? 'Parser is rate-limited. Use Form mode instead.' : `Parser API error (${response.status})` };
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { success: false, error: 'Parser returned an invalid response' };
    return validateSwapIntent(JSON.parse(content));
  } catch (e: unknown) {
    return { success: false, error: `Parse failed: ${e instanceof Error ? e.message : 'unknown error'}` };
  }
}

export function validateSwapIntent(raw: any): ParsedIntentResult {
  if (!raw || typeof raw !== 'object') return { success: false, error: 'Intent must be an object' };
  if (raw.error) return { success: false, error: String(raw.error) };
  if (raw.action !== 'swap') return { success: false, error: `Unsupported action: ${String(raw.action)}` };
  if (typeof raw.tokenIn !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/.test(raw.tokenIn.trim())) return { success: false, error: 'Missing or invalid tokenIn' };
  if (typeof raw.tokenOut !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/.test(raw.tokenOut.trim())) return { success: false, error: 'Missing or invalid tokenOut' };
  if (typeof raw.amountIn !== 'string' || !/^\d+(\.\d+)?$/.test(raw.amountIn.trim()) || /^0+(\.0+)?$/.test(raw.amountIn.trim())) return { success: false, error: 'Missing or invalid amountIn' };
  if (typeof raw.maxSlippageBps !== 'number' || !Number.isInteger(raw.maxSlippageBps) || raw.maxSlippageBps < 0 || raw.maxSlippageBps > 10000) return { success: false, error: 'maxSlippageBps must be an integer from 0 to 10000' };
  return { success: true, intent: { action: 'swap', chainId: CHAIN_CONFIG.chainId, tokenIn: raw.tokenIn.trim().toUpperCase(), tokenOut: raw.tokenOut.trim().toUpperCase(), amountIn: raw.amountIn.trim(), maxSlippageBps: raw.maxSlippageBps } };
}
