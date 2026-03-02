# trustchain-js

TypeScript SDK and OpenClaw plugin for [TrustChain](https://github.com/viftode4/trustchain) — the universal trust primitive for agents, humans, and devices.

## Packages

| Package | Description |
|---------|-------------|
| [`@trustchain/sdk`](./packages/sdk) | Pure HTTP client + sidecar process management. Zero runtime deps (Node 20+ fetch). |
| [`@trustchain/openclaw`](./packages/openclaw) | OpenClaw plugin — 5 agent-facing tools for trust-aware AI agents. |

## Quick Start

```bash
bun add @trustchain/sdk
```

```typescript
import { init } from "@trustchain/sdk";

// Start the TrustChain sidecar (auto-discovers binary)
const sidecar = await init({ name: "my-agent" });

// Check trust before interacting with a peer
const trust = await sidecar.trustScore(peerPubkey);
console.log(`Trust: ${trust.trust_score}`);

// Record an interaction
const result = await sidecar.propose(peerPubkey, {
  interaction_type: "tool_call",
  outcome: "success",
});

// Clean up
sidecar.stop();
```

### Client-only (no sidecar management)

```typescript
import { TrustChainClient } from "@trustchain/sdk";

// Connect to an already-running TrustChain node
const client = new TrustChainClient({ baseUrl: "http://localhost:18202" });
const status = await client.status();
```

### Delegation

```typescript
import { initDelegate } from "@trustchain/sdk";

// Start as a delegated agent
const sidecar = await initDelegate({
  parentUrl: "http://parent-node:18202",
  scope: ["read", "write"],
  ttlSeconds: 3600,
});
```

## OpenClaw Plugin

```bash
bun add @trustchain/openclaw
```

Install the plugin in OpenClaw:
```bash
openclaw plugins install @trustchain/openclaw
```

The plugin provides 5 tools to any OpenClaw agent:
- `trustchain_check_trust` — Check peer trust score
- `trustchain_discover_peers` — Find capable agents by trust
- `trustchain_record_interaction` — Record bilateral interactions
- `trustchain_verify_chain` — Verify chain integrity
- `trustchain_get_identity` — Resolve identity + delegations

## Prerequisites

The SDK requires the `trustchain-node` binary. Download from [GitHub Releases](https://github.com/viftode4/trustchain/releases) or:

```bash
cargo install trustchain-node
```

## Development

```bash
bun install
bun run build
bun test
```

## Architecture

TrustChain is a **bilateral ledger** — every interaction between two parties creates a cryptographically signed block pair. Trust scores are computed using Sybil-resistant network flow analysis (max-flow). The sidecar runs as a transparent HTTP proxy, intercepting agent-to-agent calls without requiring any changes to the agents themselves.

See the main [TrustChain repository](https://github.com/viftode4/trustchain) for the full architecture.

## License

MIT
