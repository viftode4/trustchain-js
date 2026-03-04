# TrustChain TypeScript SDK

[![CI](https://github.com/viftode4/trustchain-js/actions/workflows/ci.yml/badge.svg)](https://github.com/viftode4/trustchain-js/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**TypeScript SDK for [TrustChain](https://github.com/viftode4/trustchain) — decentralized trust for AI agents.**

Zero runtime dependencies. The `trustchain-node` binary downloads automatically on first use.

## Packages

| Package | Description |
|---------|-------------|
| [`@trustchain/sdk`](./packages/sdk) | HTTP client + sidecar process management. Zero runtime deps. |
| [`@trustchain/openclaw`](./packages/openclaw) | OpenClaw plugin — 5 agent-facing trust tools. |

## Quick Start

```bash
# Install from git (not yet published to npm)
bun add github:viftode4/trustchain-js
```

```typescript
import { init } from "@trustchain/sdk";

// Starts sidecar, downloads binary if needed, sets HTTP_PROXY
const sidecar = await init({ name: "my-agent" });

// Check trust
const trust = await sidecar.trustScore(peerPubkey);
console.log(`Trust: ${trust.trust_score}`);

// Record an interaction
await sidecar.propose(peerPubkey, { type: "tool_call", outcome: "success" });

// Clean up
sidecar.stop();
```

### Client-only (connect to existing node)

```typescript
import { TrustChainClient } from "@trustchain/sdk";

const client = new TrustChainClient({ baseUrl: "http://localhost:18202" });
const status = await client.status();
```

### Delegation

```typescript
import { initDelegate } from "@trustchain/sdk";

const sidecar = await initDelegate({
  parentUrl: "http://parent-node:18202",
  scope: ["read", "write"],
  ttlSeconds: 3600,
});
```

## How It Works

Every call to a known TrustChain peer triggers a bilateral trust handshake: both parties sign a half-block recording the interaction. Trust scores are computed from real interaction history using NetFlow analysis — fake identities cannot manufacture trust because they have no legitimate transaction graph.

The sidecar proxy runs locally on port 8203. Agents set `HTTP_PROXY=http://127.0.0.1:8203` and all inter-agent HTTP calls are automatically instrumented. No code changes to agent logic required.

Trust is a number between 0.0 and 1.0, combining:
- **Chain integrity** (50%) — hash-linked, Ed25519-signed interaction history
- **NetFlow** (50%) — max-flow from seed nodes; Sybil attacks fail here

Proven fraud results in a permanent hard-zero trust score.

## Binary Auto-Download

The SDK automatically downloads the `trustchain-node` binary from [GitHub Releases](https://github.com/viftode4/trustchain/releases) on first use. No Rust toolchain required.

Search order: explicit path → PATH → `~/.trustchain/bin/` → auto-download.

To pre-download (e.g. in Docker):

```typescript
import { ensureBinary } from "@trustchain/sdk";
await ensureBinary();
```

## Development

```bash
bun install
bun run build
bun test        # 126 tests
bun run lint    # biome check
```

## Public Seed Node

A public seed node is running at `http://5.161.255.238:8202`. It is the default bootstrap peer — agents connect automatically without any configuration.

> Early-access: not production-scale yet. Will be replaced with a domain and additional nodes as the network grows.

## Protocol

Implements [draft-pouwelse-trustchain-01](https://datatracker.ietf.org/doc/draft-pouwelse-trustchain/) (Pouwelse, TU Delft, 2018). Trust computation and NetFlow Sybil resistance are specified in draft-viftode-trustchain-trust-00 (filed March 2026). Wire format matches the Rust implementation exactly — same JSON field names, same timestamp convention (integer milliseconds), same constants.

## Related Projects

- [trustchain](https://github.com/viftode4/trustchain) — Rust core: sidecar binary, QUIC P2P, MCP server
- [trustchain-py](https://github.com/viftode4/trustchain-py) — Python SDK: `pip install trustchain-py`
- [trustchain-agent-os](https://github.com/viftode4/trustchain-agent-os) — Agent framework adapters

## License

MIT
