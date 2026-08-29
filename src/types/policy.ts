/**
 * Policy Engine Types
 * Deterministic validation — no LLM calls, no probabilistic decisions
 */

export type PolicyCheck = {
  name: string;
  passed: boolean;
  actual?: string;
  limit?: string;
  reason?: string;
};

export type PolicyResult = {
  status: 'PASS' | 'REJECT';
  checks: PolicyCheck[];
};

export type PolicyConfig = {
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  allowedProtocols: string[];
  allowedTokens: string[];
};
