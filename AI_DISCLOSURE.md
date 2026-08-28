# AI Disclosure

AI coding assistants were used during development of this project.

## AI-Assisted Areas

- UI scaffolding and component generation
- Utility functions
- Test generation and expansion
- Documentation drafting
- Implementation assistance for boilerplate
- Review and hardening of the quote, policy, simulation, RPC, and execution paths

## Human-Controlled Areas

- Product architecture and system design
- Security model and trust boundaries
- Policy engine design and constraints
- Protocol selection: Uniswap V3 on Sepolia
- Transaction flow and approval logic
- Acceptance criteria definition
- Testing strategy and validation
- DEX integration specifics
- Final decision to require browser-wallet approval for user execution

## Tools Used

- ClickUp Brain: project scaffolding, code generation, review, and test assistance
- OpenAI GPT-4o-mini: originally supported as an optional intent-parser provider; the shipped static UI uses the validated deterministic fallback parser and does not expose an OpenAI secret in the browser

## Runtime Trust Boundary

The application follows this boundary:

```text
Natural-language input
  -> validated SwapIntent
  -> live quote
  -> deterministic policy
  -> balance / allowance / gas / eth_call preflight
  -> explicit user action
  -> browser wallet provider
  -> wallet signature and broadcast
```

The LLM, when used behind a server-side integration, may propose structured intent data only. It must not generate calldata or decide the policy result. The policy engine is ordinary deterministic code and has no LLM dependency.

The source tree contains no private-key loader, raw transaction signer, or `eth_sendRawTransaction` path. The only application broadcast calls are `walletClient.sendTransaction` in `src/ui/useSwapFlow.ts`: the approval call is reachable only from the explicit **Approve** button, and the swap call is reachable only from the explicit **Confirm Transaction** button after the flow is `ready`. Both calls require the wagmi browser wallet client, which delegates signing to the connected wallet provider. Policy failure, failed preflight, stale quote, wrong chain, missing balance, missing allowance, and a reverted receipt block the swap.

No private key, seed phrase, or provider secret is persisted by the application. `VITE_*` configuration is treated as public browser configuration.

## Autonomous Validation Record: 2026-08-28

The autonomous server-side validation deliberately did **not** use MetaMask. A local test script loaded the first key from a protected server-side file, derived the account with `privateKeyToAccount`, verified that the derived address matched the requested funded address, created a viem wallet client, and called `walletClient.sendTransaction`. This was a direct local signature and broadcast, not a browser-wallet flow. It was used only to validate the on-chain integration and is not evidence that the MetaMask UI path works.

The following items were validated autonomously:

- Sepolia chain ID `11155111` and the requested funded address
- Primary RPC: `https://1rpc.io/sepolia`
- Fallback RPC: `https://ethereum-sepolia-rpc.publicnode.com`
- Live block reads, ETH balance, USDC balance, and WETH balance through both RPC endpoints
- Forced primary failure with successful fallback recovery and a readable all-RPCs-failed error
- Live Uniswap V3 QuoterV2 output, pool state, and computed price impact
- Correct Sepolia SwapRouter02 calldata: deadline-protected `multicall(uint256,bytes[])` containing the 7-field `exactInputSingle` call
- Deterministic policy evaluation and fail-closed behavior
- Balance, allowance, gas estimation, and `eth_call` preflight
- Automated mock proposal pipeline through quote, calldata, simulation, and policy
- Two real Sepolia swap transactions after local signing, both confirmed on-chain

Recorded live swap transactions:

- `1 USDC -> WETH`: [0x6e752b41545cbeae27aff159c12069da070ed4ebec5b3cfb0947cfd975b7f43f](https://sepolia.etherscan.io/tx/0x6e752b41545cbeae27aff159c12069da070ed4ebec5b3cfb0947cfd975b7f43f)
- `2 USDC -> WETH`: [0x7202ade559fbe3481f8c8b75864a260a34822155a0a35606615aabb08619f836](https://sepolia.etherscan.io/tx/0x7202ade559fbe3481f8c8b75864a260a34822155a0a35606615aabb08619f836)

Those transactions prove the protocol, calldata, RPC, and preflight path can execute on Sepolia. They do **not** prove MetaMask connection, browser popup, human confirmation, or browser cancellation behavior.

## Manual Validation Still Required

The final UI acceptance run must be performed by a human in a browser with MetaMask:

- Connect MetaMask and verify the displayed address and Sepolia network
- Compare the displayed ETH, USDC, and WETH balances with MetaMask
- Enter the exact demo phrase and inspect the structured intent
- Click **Confirm Transaction** and verify the MetaMask signature popup
- Sign, wait for confirmation, and open the explorer link in the browser
- Cancel a wallet request and verify the UI returns to a usable error state

The manual browser-wallet run is intentionally separate from the autonomous local-signing validation above.

## Explorer Access Note

The server-side `curl` checks against Sepolia Etherscan returned HTTP `403`. This was an explorer website access response from the server environment, not a failed blockchain transaction or an RPC failure. The transaction receipts and status were verified through Sepolia JSON-RPC, and the links are intended to be opened from the user's browser where normal explorer access is available. The Etherscan page itself is not used as a source of truth for execution success.

## Review Process

All AI-assisted code was reviewed and tested during development. Automated validation currently includes TypeScript checking, Prettier formatting, lint checks, 59 Vitest tests, and a production build. The final human MetaMask acceptance run remains the authoritative test for the browser-wallet UX.
