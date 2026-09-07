# Uniswap Developer Feedback — IntentFi

## Project

**IntentFi** — a safety and policy execution layer for onchain financial intents.

Live demo: https://intentfi.fortravels.xyz/

Repository: https://github.com/Steel84/intentfi

---

## What we built

IntentFi lets a user express a swap as a natural-language intent and places a deterministic security boundary between that intent and onchain execution.

The runtime flow is:

Natural-language intent
→ structured SwapIntent
→ deterministic validation
→ deterministic policy checks
→ live Uniswap V3 quote
→ transaction simulation / preflight
→ explicit MetaMask approval
→ Uniswap V3 execution on Sepolia

The key design principle is:

> LLM proposes. Deterministic policy decides. Simulation verifies. Human approves. Blockchain executes.

The AI/LLM is not trusted with transaction execution. It only helps translate natural language into a structured intent when the deterministic parser cannot safely understand the user's phrasing.

---

## How Uniswap is used

IntentFi uses the Uniswap V3 stack on Ethereum Sepolia.

The integration currently uses:

- Uniswap V3 QuoterV2 for live quotes
- Uniswap V3 SwapRouter02 for execution
- Uniswap V3 Factory and pool state for price-impact calculation
- `exactInputSingle` for the swap
- deadline-protected `multicall(uint256,bytes[])` for execution
- live onchain state during quote and preflight

Relevant implementation:

- [`src/protocol/uniswap-v3.ts`](./src/protocol/uniswap-v3.ts)
  - Sepolia Uniswap deployments
  - QuoterV2 integration
  - live quote generation
  - price-impact calculation
  - SwapRouter02 calldata construction
  - deadline-protected multicall execution

The integration is intentionally kept behind the `SwapProtocol` abstraction so that the deterministic safety/policy layer is not coupled to an AI provider.

---

## Why Uniswap is load-bearing

Uniswap is not a cosmetic integration.

The actual execution flow depends on Uniswap V3:

1. The application requests a live quote from Uniswap V3 QuoterV2.
2. The quote is used to calculate expected output, minimum output, price impact and slippage bounds.
3. IntentFi checks the resulting values against deterministic policy constraints.
4. The transaction is simulated against current chain state.
5. Only after the checks pass can the user explicitly approve the transaction.
6. The resulting transaction executes through Uniswap V3 SwapRouter02.

A failed quote, invalid token, excessive slippage, excessive price impact, insufficient balance/allowance, stale quote or failed simulation blocks execution.

---

## Security boundary around Uniswap execution

IntentFi does not allow the LLM to generate transaction calldata or choose the execution policy.

The LLM output is first converted into a strict `SwapIntent` and validated.

The deterministic policy engine then checks:

- chain allowlist
- protocol allowlist
- token allowlist
- slippage bounds
- price-impact limits
- quote freshness
- balance
- allowance
- transaction simulation

The user must finally approve the transaction through MetaMask.

There is no automatic transaction signing.

---

## What we found during integration

### 1. Quote freshness matters

During development we found that a short quote TTL could become problematic while the user was reviewing or approving a transaction in MetaMask.

IntentFi now uses a 90-second quote validity window and explicitly avoids treating a quote as expired while an approval/signature flow is already in progress.

This was particularly important for making the user-facing approval flow robust rather than failing because a quote expired while the wallet was open.

### 2. Approval failures need to be treated separately from policy failures

Uniswap execution can surface allowance-related failures such as `STF` when the token approval is missing.

We changed the UI flow so that this condition is represented as an explicit token-approval requirement instead of exposing a low-level revert message to the user.

This keeps the distinction clear:

- policy rejection = the requested operation violates IntentFi policy
- missing allowance = the user must approve the input token before the swap can proceed

### 3. Preflight should happen before signing

The Uniswap integration is combined with transaction simulation before the final wallet signature.

This gives the user a deterministic pre-execution check against the current chain state instead of relying only on frontend assumptions.

---

## Developer experience feedback

### What worked well

- Uniswap V3 provides the required primitives for a controlled swap flow.
- QuoterV2 gives a useful live execution estimate that can be incorporated into deterministic policy checks.
- SwapRouter02 provides a straightforward execution target for the final transaction.
- Sepolia makes it practical to repeatedly test the complete flow with real onchain transactions without risking mainnet funds.
- The separation between quote generation and transaction construction fits well with IntentFi's policy architecture.

### What was more difficult

- Quote freshness becomes a real UX concern when a human approval step can take longer than expected.
- Allowance failures can surface as low-level protocol revert messages and need to be translated into a clear user action.
- The frontend needs to distinguish between a genuine policy rejection and a normal prerequisite such as token approval.
- A safe execution layer needs to preserve protocol-level details while presenting a simpler explanation to the user.

---

## Onchain validation

IntentFi has been exercised against real Uniswap V3 execution on Ethereum Sepolia.

Example transactions are linked from the project README.

The repository also contains the relevant Uniswap integration and tests.

---

## Summary

IntentFi uses Uniswap V3 as the actual execution and quoting layer while keeping the security decision process deterministic and independent from the LLM.

The goal is not to make AI execute swaps autonomously.

The goal is to make natural-language financial intents usable while keeping the final authority with deterministic policy, transaction simulation and the human wallet signature.
