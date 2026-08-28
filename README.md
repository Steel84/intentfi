# IntentFi

**AI-assisted on-chain intent execution.**

> LLM proposes. Deterministic policy decides. Human approves. Blockchain executes.

## What it does

IntentFi translates natural-language financial intents into executable on-chain transactions, validated by a deterministic policy engine and requiring explicit human approval before execution.

## Architecture

```
User Intent (NL) -> Intent Parser (LLM) -> Structured SwapIntent
    -> Policy Engine (deterministic) -> Protocol Adapter (live quote)
    -> Simulation (preflight) -> User Approval -> Wallet Execution
```

## Core Principle

The AI never executes. It only proposes. A deterministic policy engine validates constraints, simulation verifies feasibility, and the user gives final approval.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Wallet:** wagmi + viem + ConnectKit
- **Chain:** Sepolia testnet
- **DEX:** Uniswap V3
- **LLM:** OpenAI GPT-4o-mini (intent parsing only)
- **Testing:** Vitest

## Quick Start

```bash
npm install
cp .env.example .env  # fill in API keys
npm run dev
```

## Development

```bash
npm run test      # run tests in watch mode
npm run test:run  # single test run
npm run build     # production build
```

## Project Structure

```
src/
  intent/       # NL parsing + validation
  policy/       # Deterministic policy engine
  protocol/     # DEX adapter (Uniswap V3)
  simulation/   # Preflight validation
  wallet/       # Connection + execution
  ui/           # React components
  config/       # Chain, token, protocol config
  types/        # TypeScript type definitions
tests/          # Automated tests
```

## Status

v0.1 - Prototype (testnet only)
