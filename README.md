# TrustChain TypeScript SDK

[![CI](https://github.com/viftode4/trustchain-js/actions/workflows/ci.yml/badge.svg)](https://github.com/viftode4/trustchain-js/actions)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

**TypeScript SDK for [TrustChain](https://github.com/viftode4/trustchain) — portable identity, signed interaction history, and sidecar-managed coordination for agent networks.**

Use the TypeScript SDK to start or connect to a TrustChain sidecar, record bilateral interactions, and add trust-aware discovery, delegation, audit, and routing primitives to existing agents. Zero runtime dependencies; the `trustchain-node` binary downloads automatically on first use.

## Packages

| Package | Description |
|---------|-------------|
| [`@trustchain/sdk`](./packages/sdk) | HTTP client + sidecar process management. Zero runtime deps. |
| [`openclaw-trustchain`](./packages/openclaw) | OpenClaw plugin — 5 agent-facing coordination and trust tools. |

## Quick Start

```bash
bun add @trustchain/sdk
# or
npm install @trustchain/sdk
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

Every call to a known TrustChain peer triggers a bilateral handshake: both parties sign a half-block recording the interaction. Trust scores are computed from real interaction history using MeritRank (default) or NetFlow connectivity analysis, and the same history also supports audit, delegation, and trust-weighted discovery.

The sidecar proxy runs locally on port 8203. Agents set `HTTP_PROXY=http://127.0.0.1:8203` and all inter-agent HTTP calls are automatically instrumented. No code changes to agent logic required.

Trust is a number between 0.0 and 1.0, computed as **(0.3 × structural + 0.7 × behavioral) × confidence_scale** (weighted-additive model, v4):
- **structural** = connectivity × integrity — Sybil resistance × chain integrity
- **behavioral** = recency (quality-weighted, λ=0.95) — recent interaction quality
- **confidence_scale** = min(interactions / 5, 1.0) — new agents ramp up gradually
- **connectivity** — MeritRank random walks (default) or NetFlow max-flow; `diversity` is evidence-only, not in final score

Proven fraud results in a permanent hard-zero trust score.

When no TrustChain-aware peer exists, the SDK supports **single-player audit mode** — self-signed audit blocks as a cryptographic log.

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
bun test        # 165 tests
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
- [trustchain-economy](https://github.com/viftode4/trustchain-economy) — mechanism-design and adversarial evaluation engine for agent networks

## License

Apache-2.0
