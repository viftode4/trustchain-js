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

## Related Projects

- [trustchain](https://github.com/viftode4/trustchain) — Rust core: sidecar binary, QUIC P2P, MCP server
- [trustchain-py](https://github.com/viftode4/trustchain-py) — Python SDK: `pip install trustchain-py`
- [trustchain-agent-os](https://github.com/viftode4/trustchain-agent-os) — Agent framework adapters

## License

MIT
