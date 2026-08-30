/**
 * Stress test: 7 phrases through the hybrid parsing pipeline.
 * Reads VITE_GEMINI_API_KEY from the process environment or the local .env file.
 * Usage: node scripts/stress-test.mjs
 */

import { existsSync, readFileSync } from 'node:fs';

function loadDotEnv(file = '.env') {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

loadDotEnv();
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('Set VITE_GEMINI_API_KEY in .env or the process environment.');
  process.exit(1);
}

const TOKENS = {
  USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, symbol: 'USDC' },
  WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18, symbol: 'WETH' },
  ETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18, symbol: 'ETH' },
};

function validateSwapIntent(raw) {
  if (!raw || typeof raw !== 'object') return { success: false, error: 'Intent must be an object' };
  if (raw.error) return { success: false, error: String(raw.error) };
  if (raw.action !== 'swap') return { success: false, error: `Unsupported action: ${raw.action}` };
  if (typeof raw.tokenIn !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/.test(raw.tokenIn.trim()))
    return { success: false, error: 'Missing or invalid tokenIn' };
  if (
    typeof raw.tokenOut !== 'string' ||
    !/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/.test(raw.tokenOut.trim())
  )
    return { success: false, error: 'Missing or invalid tokenOut' };
  if (
    typeof raw.amountIn !== 'string' ||
    !/^\d+(\.\d+)?$/.test(raw.amountIn.trim()) ||
    /^0+(\.0+)?$/.test(raw.amountIn.trim())
  )
    return { success: false, error: 'Missing or invalid amountIn' };
  if (
    typeof raw.maxSlippageBps !== 'number' ||
    !Number.isInteger(raw.maxSlippageBps) ||
    raw.maxSlippageBps < 0 ||
    raw.maxSlippageBps > 10000
  )
    return { success: false, error: 'maxSlippageBps must be an integer from 0 to 10000' };
  const tokenIn = raw.tokenIn.trim().toUpperCase();
  const tokenOut = raw.tokenOut.trim().toUpperCase();
  if (!TOKENS[tokenIn]) return { success: false, error: `Unsupported input token: ${tokenIn}` };
  if (!TOKENS[tokenOut]) return { success: false, error: `Unsupported output token: ${tokenOut}` };
  if (tokenIn === 'ETH') return { success: false, error: 'Native ETH input is not supported.' };
  if (tokenIn === tokenOut)
    return { success: false, error: 'Input and output tokens must be different' };
  let unsupportedConditions;
  if (Array.isArray(raw.unsupportedConditions)) {
    const filtered = raw.unsupportedConditions
      .filter((c) => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());
    if (filtered.length > 0) unsupportedConditions = filtered;
  }
  return {
    success: true,
    intent: {
      action: 'swap',
      chainId: 11155111,
      tokenIn,
      tokenOut,
      amountIn: raw.amountIn.trim(),
      maxSlippageBps: raw.maxSlippageBps,
    },
    unsupportedConditions,
  };
}

function tryFallbackParse(input) {
  const match = input.match(
    /swap\s+(\d+(?:\.\d+)?)\s+([a-zA-Z][a-zA-Z0-9_-]{1,15})\s+(?:to|for)\s+([a-zA-Z][a-zA-Z0-9_-]{1,15})(?:.*?(?:max|maximum)\s+(\d+(?:\.\d+)?)%\s*slippage)?/i,
  );
  if (!match) return null;
  const [, amount, tokenIn, tokenOut, slippage] = match;
  const slippageMentioned = /\b(?:max(?:imum)?|slipp\w*)\b/i.test(input);
  if (slippageMentioned && !slippage) return null;
  function percentToBps(v) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(v.trim())) return -1;
    const [w, f = ''] = v.trim().split('.');
    const b = Number(w) * 100 + Number(f.padEnd(2, '0'));
    return Number.isSafeInteger(b) && b >= 0 && b <= 10000 ? b : -1;
  }
  const r = validateSwapIntent({
    action: 'swap',
    tokenIn,
    tokenOut,
    amountIn: amount,
    maxSlippageBps: slippage ? percentToBps(slippage) : 50,
  });
  return r.success ? r.intent : null;
}

const PROMPT = `You are an intent parser for a DeFi token swap application.
Return ONLY a JSON object with these fields:
{"action":"swap","tokenIn":"SYMBOL","tokenOut":"SYMBOL","amountIn":"DECIMAL","maxSlippageBps":NUMBER,"unsupportedConditions":[]}
Rules:
- Convert percentage slippage to integer basis points.
- Use uppercase token symbols.
- amountIn must be a positive decimal string. If the user says "all" or doesn't give a concrete number, return {"error": "Amount must be a specific number"}.
- If conditions exist that are not representable in the fields above, list them in unsupportedConditions.
- If you cannot determine the swap at all, return {"error": "<reason>"}.
- Do NOT generate calldata, addresses, or suggestions.`;

async function callGemini(userInput) {
  const MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT + '\n\nUser message:\n' + userInput }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (!resp.ok) return { success: false, error: `API ${resp.status}` };
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return { success: false, error: 'Invalid response' };
  return validateSwapIntent(JSON.parse(text));
}

const phrases = [
  'Swap 5 USDC to ETH, max 0.5% slippage',
  'exchange 10 USDC for WETH with 1% slippage tolerance',
  'I want to convert my 50 USDC into ETH please, keep slippage under 0.3%',
  'sell 20 USDC buy ETH slippage 2%',
  'put 5 USDC into ETH, but only if gas is below 30 gwei',
  'swap 100 USDC to ETH, max 0.5% slippage, but cancel if price moves more than 2% during execution',
  'trade all my USDC for ETH',
];

console.log('| # | Phrase | Fallback | LLM | Token | Amount | Slippage | Unsupported |');
console.log('|---|--------|----------|-----|-------|--------|----------|-------------|');

for (let i = 0; i < phrases.length; i++) {
  const phrase = phrases[i];
  const fb = tryFallbackParse(phrase);
  let source = 'fallback';
  let result;
  if (fb) {
    result = { success: true, intent: fb };
  } else {
    result = await callGemini(phrase);
    source = 'gemini';
    // Rate limit safety
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (result.success) {
    const { intent, unsupportedConditions } = result;
    const uc = unsupportedConditions ? unsupportedConditions.join('; ') : '';
    console.log(
      `| ${i + 1} | ${phrase.slice(0, 50)}${phrase.length > 50 ? '...' : ''} | ${fb ? '\u2713' : 'null'} | ${source} | ${intent.tokenIn}\u2192${intent.tokenOut} | ${intent.amountIn} | ${intent.maxSlippageBps}bps | ${uc || 'none'} |`,
    );
  } else {
    console.log(
      `| ${i + 1} | ${phrase.slice(0, 50)}${phrase.length > 50 ? '...' : ''} | ${fb ? '\u2713' : 'null'} | ${source} | FAIL: ${result.error} | | | |`,
    );
  }
}
