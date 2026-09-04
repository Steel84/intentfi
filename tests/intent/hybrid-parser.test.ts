import { describe, it, expect } from 'vitest';
import { validateSwapIntent, parseIntent, tryFallbackParse } from '../../src/intent/parser';

describe('Hybrid parser: LLM result through validateSwapIntent', () => {
  it('accepts a well-formed Gemini response without unsupported conditions', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 100,
      unsupportedConditions: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toBeUndefined();
      expect(r.intent.maxSlippageBps).toBe(100);
    }
  });

  it('passes through unsupported conditions from LLM', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '5',
      maxSlippageBps: 50,
      unsupportedConditions: ['gas must be below 30 gwei'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toEqual(['gas must be below 30 gwei']);
      expect(r.intent.tokenIn).toBe('USDC');
    }
  });

  it('passes through multiple unsupported conditions', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50,
      unsupportedConditions: [
        'cancel if price moves more than 2%',
        'execute only during US market hours',
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toHaveLength(2);
    }
  });

  it('ignores empty unsupported conditions array', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amountIn: '20',
      maxSlippageBps: 50,
      unsupportedConditions: [],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.unsupportedConditions).toBeUndefined();
  });

  it('filters out empty strings and whitespace from unsupported conditions', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 50,
      unsupportedConditions: ['gas limit', '', '  ', 'price check'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toEqual(['gas limit', 'price check']);
    }
  });

  it('rejects LLM error response', () => {
    const r = validateSwapIntent({ error: 'Amount must be a specific number' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('Amount must be a specific number');
  });

  it('rejects unsupported token even when LLM returns it', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'SHIB',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-integer slippage from LLM', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '100',
      maxSlippageBps: 50.5,
    });
    expect(r.success).toBe(false);
  });

  it('ignores non-string values in unsupported conditions array', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 50,
      unsupportedConditions: [42, null, 'real condition', undefined],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.unsupportedConditions).toEqual(['real condition']);
    }
  });

  it('rejects unexpected fields from a malformed LLM response', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amountIn: '10',
      maxSlippageBps: 50,
      calldata: '0xdeadbeef',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('Unexpected intent field');
  });

  it('validates LLM output with same strictness as fallback (same-token rejection)', () => {
    const r = validateSwapIntent({
      action: 'swap',
      tokenIn: 'USDC',
      tokenOut: 'USDC',
      amountIn: '100',
      maxSlippageBps: 50,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('different');
  });
});

describe('Full chain & Mocked Gemini fallback integration', () => {
  it('A. "Swap 10 USDC for ETH" uses deterministic parser and does NOT call Gemini', async () => {
    let geminiCalled = false;
    const fetchMock = async () => {
      geminiCalled = true;
      throw new Error('Gemini should not be called');
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const input = 'Swap 10 USDC for ETH';
      const fallback = tryFallbackParse(input);
      expect(fallback).not.toBeNull();
      expect(fallback?.amountIn).toBe('10');
      expect(fallback?.tokenIn).toBe('USDC');
      expect(fallback?.tokenOut).toBe('ETH');
      expect(geminiCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('B. Complex command uses Gemini fallback and validates successfully', async () => {
    const input = 'Convert ten USDC into ETH and keep slippage below half a percent.';
    // Deterministic parser returns null
    expect(tryFallbackParse(input)).toBeNull();

    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  action: 'swap',
                  tokenIn: 'USDC',
                  tokenOut: 'ETH',
                  amountIn: '10',
                  maxSlippageBps: 50,
                  unsupportedConditions: [],
                }),
              },
            ],
          },
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => mockGeminiResponse,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const res = await parseIntent(input, 'test-key', 'gemini');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.intent.action).toBe('swap');
        expect(res.intent.tokenIn).toBe('USDC');
        expect(res.intent.tokenOut).toBe('ETH');
        expect(res.intent.amountIn).toBe('10');
        expect(res.intent.maxSlippageBps).toBe(50);
      }
      expect(requestedUrl).toContain('generativelanguage.googleapis.com');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('C. Gemini response with unexpected field is rejected (fail-closed)', async () => {
    const mockBadResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  action: 'swap',
                  tokenIn: 'USDC',
                  tokenOut: 'ETH',
                  amountIn: '10',
                  maxSlippageBps: 50,
                  unsupportedConditions: [],
                  calldata: '0x123456',
                }),
              },
            ],
          },
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => mockBadResponse,
    })) as unknown as typeof fetch;

    try {
      const res = await parseIntent('some complex phrase', 'test-key');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Unexpected intent field');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('D. Missing Gemini API key produces clear error and fails closed', async () => {
    const res = await parseIntent('Convert ten USDC into ETH', '', 'gemini');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('LLM API key is not configured');
    }
  });

  it('E. Gemini network error or timeout fails closed', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('Network failure');
    }) as unknown as typeof fetch;

    try {
      const res = await parseIntent('Convert ten USDC into ETH', 'test-key');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('LLM parse failed');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
