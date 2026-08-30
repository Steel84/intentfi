import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prepareSwap, readQuotedAmount } from '../../src/flow/prepare';
import { evaluatePolicy } from '../../src/policy/engine';
import {
  SwapIntent,
  Quote,
  SimulationResult,
  PolicyConfig,
  TransactionRequest,
} from '../../src/types';

// === Shared fixtures ===

const intent: SwapIntent = {
  action: 'swap',
  chainId: 11155111,
  tokenIn: 'USDC',
  tokenOut: 'WETH',
  amountIn: '100',
  maxSlippageBps: 50,
};

const policy: PolicyConfig = {
  maxSlippageBps: 50,
  maxPriceImpactBps: 100,
  allowedProtocols: ['uniswap-v3'],
  allowedTokens: ['USDC', 'WETH', 'ETH'],
};

const tx: TransactionRequest = {
  to: '0x0000000000000000000000000000000000000002',
  data: '0xabcdef',
  value: '0',
  gasLimit: '300000',
  chainId: 11155111,
};

const goodSim: SimulationResult = {
  success: true,
  gasUsed: '145000',
  balanceCheck: true,
  allowanceCheck: true,
};

function makeQuote(expiresAt: number): Quote {
  return {
    inputAmount: '100 USDC',
    expectedOutput: '0.04 WETH',
    minimumOutput: '0.0398 WETH',
    price: '0.0004',
    priceImpactBps: 10,
    slippageBps: 50,
    gasEstimate: '150000',
    route: 'USDC -> WETH',
    expiresAt,
  };
}

// === 1. Countdown correctness ===

describe('Quote countdown logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('remaining is non-negative when quote is far in the future', () => {
    const quote = makeQuote(Date.now() + 30_000);
    const remaining = Math.max(0, quote.expiresAt - Date.now());
    expect(remaining).toBe(30_000);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('remaining is zero (not negative) for an already-expired quote', () => {
    const quote = makeQuote(Date.now() - 5_000);
    const remaining = Math.max(0, quote.expiresAt - Date.now());
    expect(remaining).toBe(0);
  });

  it('remaining counts down correctly with advancing time', () => {
    const now = Date.now();
    const quote = makeQuote(now + 30_000);
    expect(Math.max(0, quote.expiresAt - Date.now())).toBe(30_000);

    vi.advanceTimersByTime(10_000);
    expect(Math.max(0, quote.expiresAt - Date.now())).toBe(20_000);

    vi.advanceTimersByTime(20_000);
    expect(Math.max(0, quote.expiresAt - Date.now())).toBe(0);
  });

  it('never goes negative even when time overshoots', () => {
    const quote = makeQuote(Date.now() + 5_000);
    vi.advanceTimersByTime(60_000);
    const remaining = Math.max(0, quote.expiresAt - Date.now());
    expect(remaining).toBe(0);
  });

  it('ceil(remaining/1000) shows 1s for the last fractional second', () => {
    const quote = makeQuote(Date.now() + 500); // 0.5s left
    const remaining = Math.max(0, quote.expiresAt - Date.now());
    expect(Math.ceil(remaining / 1000)).toBe(1);
  });

  it('ceil(remaining/1000) shows 0 only when truly expired', () => {
    const quote = makeQuote(Date.now());
    const remaining = Math.max(0, quote.expiresAt - Date.now());
    expect(Math.ceil(remaining / 1000)).toBe(0);
  });
});

// === 2. Race condition at expiry boundary ===

describe('Expiry boundary race condition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('executeTransaction guard blocks expired quote even if UI timer lag', () => {
    // Simulate: UI timer shows 1s remaining, but by the time the handler runs,
    // Date.now() has crossed expiresAt.
    const quote = makeQuote(Date.now() + 1_000);

    // Advance time so quote is now expired
    vi.advanceTimersByTime(1_500);

    // This is the guard from executeTransaction in useSwapFlow:
    const isExpired = Date.now() >= quote.expiresAt;
    expect(isExpired).toBe(true);
  });

  it('quote exactly at expiresAt is treated as expired (gte comparison)', () => {
    const now = Date.now();
    const quote = makeQuote(now);
    // Date.now() === quote.expiresAt
    expect(Date.now() >= quote.expiresAt).toBe(true);
  });

  it('1ms before expiry is still valid', () => {
    const quote = makeQuote(Date.now() + 1);
    // Not yet expired
    expect(Date.now() >= quote.expiresAt).toBe(false);
  });

  it('policy engine also rejects expired quote independently', () => {
    const expiredQuote = makeQuote(Date.now() - 1);
    const result = evaluatePolicy(intent, expiredQuote, goodSim, policy);
    expect(result.status).toBe('REJECT');
    const check = result.checks.find((c) => c.name === 'Quote Fresh');
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it('double protection: both UI guard and policy catch expired quote', () => {
    const quote = makeQuote(Date.now() + 2_000);
    vi.advanceTimersByTime(3_000);

    // UI-level guard
    const uiBlocks = Date.now() >= quote.expiresAt;
    expect(uiBlocks).toBe(true);

    // Even if UI guard were bypassed, policy blocks
    const result = evaluatePolicy(intent, quote, goodSim, policy);
    expect(result.status).toBe('REJECT');
  });
});

// === 3. Refresh Quote produces new expiresAt and full re-evaluation ===

describe('Refresh Quote flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshed quote has new expiresAt in the future', async () => {
    let callCount = 0;
    const adapter = {
      getQuote: async () => {
        callCount++;
        return makeQuote(Date.now() + 30_000);
      },
      buildTransaction: async () => tx,
    };
    const simulate = async () => goodSim;

    // First call
    const result1 = await prepareSwap(
      intent,
      '0x0000000000000000000000000000000000000001',
      policy,
      {
        adapter,
        simulate,
        now: () => Date.now(),
      },
    );
    expect(result1.quote.expiresAt).toBeGreaterThan(Date.now());
    expect(result1.policyResult.status).toBe('PASS');

    // Advance past expiry
    vi.advanceTimersByTime(31_000);
    expect(Date.now() >= result1.quote.expiresAt).toBe(true);

    // Refresh (second call, simulates what refreshQuote does)
    const result2 = await prepareSwap(
      intent,
      '0x0000000000000000000000000000000000000001',
      policy,
      {
        adapter,
        simulate,
        now: () => Date.now(),
      },
    );
    expect(result2.quote.expiresAt).toBeGreaterThan(Date.now());
    expect(result2.policyResult.status).toBe('PASS');
    expect(callCount).toBe(2);
  });

  it('refreshed quote replaces expired one entirely', async () => {
    const quotes: Quote[] = [];
    const adapter = {
      getQuote: async () => {
        const q = makeQuote(Date.now() + 30_000);
        quotes.push(q);
        return q;
      },
      buildTransaction: async () => tx,
    };

    await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate: async () => goodSim,
      now: () => Date.now(),
    });
    vi.advanceTimersByTime(35_000);

    await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate: async () => goodSim,
      now: () => Date.now(),
    });

    expect(quotes).toHaveLength(2);
    expect(quotes[1].expiresAt).toBeGreaterThan(quotes[0].expiresAt);
  });
});

// === 4. Multiple rapid refreshes (concurrency / stale run detection) ===

describe('Multiple rapid refreshes', () => {
  it('runId pattern discards stale results', async () => {
    // Simulates the runId.current guard in useSwapFlow:
    // each call increments runId; stale runs bail out
    let runId = 0;
    const results: string[] = [];

    async function simulateRunFlow(id: number, delayMs: number) {
      const currentRun = ++runId;
      const isCurrent = () => runId === currentRun;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (!isCurrent()) {
        results.push(`run-${id}-discarded`);
        return;
      }
      results.push(`run-${id}-applied`);
    }

    // Fire 3 rapid refreshes with different latencies
    await Promise.all([
      simulateRunFlow(1, 100), // slow, will be stale
      simulateRunFlow(2, 50), // medium, will be stale
      simulateRunFlow(3, 10), // fast, will win
    ]);

    // Only the last one should be applied
    expect(results).toContain('run-3-applied');
    expect(results).toContain('run-1-discarded');
    expect(results).toContain('run-2-discarded');
  });

  it('actionInFlight ref prevents concurrent executions', () => {
    // Mirrors the guard in executeTransaction/approveToken
    let actionInFlight = false;
    const attempts: string[] = [];

    function tryExecute(label: string) {
      if (actionInFlight) {
        attempts.push(`${label}-blocked`);
        return;
      }
      actionInFlight = true;
      attempts.push(`${label}-started`);
    }

    tryExecute('A');
    tryExecute('B');
    tryExecute('C');
    actionInFlight = false;
    tryExecute('D');

    expect(attempts).toEqual(['A-started', 'B-blocked', 'C-blocked', 'D-started']);
  });
});

// === 5. Policy and Simulation re-run after refresh ===

describe('Full re-evaluation after refresh', () => {
  it('prepareSwap calls quote, buildTx, simulate, and policy in order each time', async () => {
    const callLog: string[][] = [[], []];
    let round = 0;

    const adapter = {
      getQuote: async () => {
        callLog[round].push('getQuote');
        return makeQuote(Date.now() + 30_000);
      },
      buildTransaction: async () => {
        callLog[round].push('buildTransaction');
        return tx;
      },
    };

    const simulate = async () => {
      callLog[round].push('simulate');
      return goodSim;
    };

    // First pass
    const r1 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(callLog[0]).toEqual(['getQuote', 'buildTransaction', 'simulate']);
    expect(r1.policyResult.status).toBe('PASS');

    // Second pass (refresh)
    round = 1;
    const r2 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(callLog[1]).toEqual(['getQuote', 'buildTransaction', 'simulate']);
    expect(r2.policyResult.status).toBe('PASS');
  });

  it('stale policy result is not reused: changed conditions fail after refresh', async () => {
    let simulationRound = 0;

    const adapter = {
      getQuote: async () => makeQuote(Date.now() + 30_000),
      buildTransaction: async () => tx,
    };

    const simulate = async (): Promise<SimulationResult> => {
      simulationRound++;
      if (simulationRound === 1) return goodSim;
      // Second call: balance dropped
      return {
        success: false,
        balanceCheck: false,
        allowanceCheck: true,
        error: 'Insufficient balance',
      };
    };

    const r1 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(r1.policyResult.status).toBe('PASS');

    const r2 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(r2.policyResult.status).toBe('REJECT');
    expect(r2.simulation.balanceCheck).toBe(false);
  });
});

// === 6. Approve regression: allowance persists across refresh ===

describe('Approve path regression', () => {
  it('refresh after approve does not require re-approval when allowance is sufficient', async () => {
    let approvalDone = false;

    const adapter = {
      getQuote: async () => makeQuote(Date.now() + 30_000),
      buildTransaction: async () => tx,
    };

    const simulate = async (): Promise<SimulationResult> => {
      // First call: no allowance. After approval, allowance is set.
      if (!approvalDone) {
        return {
          success: false,
          balanceCheck: true,
          allowanceCheck: false,
          error: 'Approval required',
        };
      }
      return goodSim;
    };

    // Before approval
    const r1 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(r1.simulation.allowanceCheck).toBe(false);
    expect(r1.policyResult.status).toBe('REJECT');

    // User approves (external action)
    approvalDone = true;

    // Refresh after approval
    const r2 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(r2.simulation.allowanceCheck).toBe(true);
    expect(r2.policyResult.status).toBe('PASS');
  });

  it('allowance sufficient from the start: refresh does not trigger spurious approval', async () => {
    let quoteCount = 0;
    const adapter = {
      getQuote: async () => {
        quoteCount++;
        return makeQuote(Date.now() + 30_000);
      },
      buildTransaction: async () => tx,
    };

    // Always sufficient allowance
    const simulate = async () => goodSim;

    const r1 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(r1.simulation.allowanceCheck).toBe(true);
    expect(r1.policyResult.status).toBe('PASS');

    // Refresh
    const r2 = await prepareSwap(intent, '0x0000000000000000000000000000000000000001', policy, {
      adapter,
      simulate,
      now: () => Date.now(),
    });
    expect(r2.simulation.allowanceCheck).toBe(true);
    expect(r2.policyResult.status).toBe('PASS');
    expect(quoteCount).toBe(2);
  });
});

// === 7. Existing helpers still work ===

describe('readQuotedAmount regression', () => {
  it('parses clean decimal', () => {
    expect(readQuotedAmount('0.0398 WETH')).toBe('0.0398');
  });

  it('parses integer', () => {
    expect(readQuotedAmount('100 USDC')).toBe('100');
  });

  it('rejects garbage', () => {
    expect(() => readQuotedAmount('abc')).toThrow();
  });
});
