# IntentFi

**AI-assisted on-chain intent execution system.**

> LLM proposes. Deterministic policy decides. Human approves. Blockchain executes.

## What it does

IntentFi translates natural-language financial intents into validated, policy-checked, simulated on-chain transactions.

Core flow:

```
User Input (NL or Form)
  -> Parse Intent
    -> Fetch Live Quote (Uniswap V3)
      -> Policy Engine (deterministic)
        -> Transaction Simulation
          -> User Approval
            -> Execute on Sepolia Testnet
              -> Confirmation + Explorer Link
```

## Architecture

```
┌──────────────────────────┐
│      Web UI (React)       │  wagmi + ConnectKit
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      Intent Layer         │  NL -> SwapIntent (OpenAI / Regex fallback)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Policy Engine         │  Deterministic validation (no LLM)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Protocol Adapter        │  Uniswap V3 QuoterV2 + SwapRouter
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Simulation Layer        │  Balance + Allowance + Gas + eth_call
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   User Approval           │  Explicit confirm required
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Wallet / Execution      │  wagmi sendTransaction
└──────────────────────────┘
```

## Key Design Decisions

- **LLM is ONLY used for NL parsing** -- never for transaction construction or policy decisions
- **Policy engine is pure deterministic code** -- no AI, no probabilistic decisions
- **Failed simulation blocks execution** -- transaction cannot be sent if preflight fails
- **No private keys stored** -- uses browser wallet via wagmi/ConnectKit
- **Integer arithmetic** -- all token amounts use BigInt, no floating point for financial math
- **Fallback at every layer** -- deterministic parser in the static client, fallback RPC if primary fails
- **Fail closed** -- unsupported tokens, unknown price impact, reverted receipts, stale quotes, and failed final preflight block execution
- **No blind approval** -- the app approves only the exact input amount required for the current swap

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Wallet:** wagmi 2 + ConnectKit
- **Chain:** Ethereum Sepolia testnet
- **DEX:** Uniswap V3 (QuoterV2 + SwapRouter)
- **RPC:** Configurable primary + fallback with health check
- **Tests:** Vitest (58 tests)
- **NL Parser:** validated deterministic fallback parser in the static client; optional LLM integration belongs behind a server-side proxy

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your values

# Development
npm run dev

# Build
npm run build

# Test
npm test
```

## Environment Variables

| Variable                        | Required | Description                           |
| ------------------------------- | -------- | ------------------------------------- |
| `VITE_RPC_PRIMARY`              | No       | Primary Sepolia RPC (default: public) |
| `VITE_RPC_FALLBACK`             | No       | Fallback RPC (default: publicnode)    |
| `VITE_WALLETCONNECT_PROJECT_ID` | No       | WalletConnect v2 project ID           |

## Testing

```bash
# Run all tests
npm run test:run

# Watch mode
npm test
```

Test coverage:

- Intent validation (6 tests)
- Fallback regex parser (6 tests)
- Policy engine core (7 tests)
- Policy engine edge cases (9 tests)
- Token utilities (16 tests)

## Supported Tokens (Sepolia)

| Token | Address                                      |
| ----- | -------------------------------------------- |
| USDC  | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| WETH  | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

## Demo Scenario

> "Swap 100 USDC to ETH, max 0.5% slippage"

1. Connect MetaMask to Sepolia
2. Enter intent (NL or form)
3. View parsed intent, live quote, policy checks
4. Approve token spending (if first time)
5. Confirm transaction
6. View on Etherscan

The app also persists a small, wallet-scoped transaction history and local safety policy. History is capped at 10 entries and no private key or seed phrase is stored.
The connected wallet header shows live ETH, USDC, and WETH balances from the configured RPC.

## Security Model

- No private key storage
- No automatic transactions
- Explicit user confirmation required
- Deterministic policy validation
- Token address validation (never trust symbols alone)
- Chain ID verification
- Integer arithmetic for financial calculations
- Testnet clearly labeled

## License

MIT

## Final acceptance checklist

Run the automated checks before the manual demo:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

The remaining acceptance step is intentionally manual: connect a pre-funded browser wallet on Sepolia, complete one real swap, and record the 2-4 minute demo without presenting mock success as a real transaction. The automated `tests/flow/mock-flow.test.ts` covers the complete proposal pipeline through calldata, simulation, and deterministic policy without signing.
