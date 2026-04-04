# openclaw-trustchain

OpenClaw plugin for TrustChain, the interaction-record and coordination layer for autonomous agents and agent networks.

Adds 5 tools that let agents inspect identity and trust state, discover peers by capability, record signed interaction outcomes, and verify chain integrity. The TrustChain sidecar starts automatically and downloads itself if not already installed, so agents can coordinate with evidence instead of blind trust.

## Install

```bash
# npm
npm install openclaw-trustchain

# bun
bun add openclaw-trustchain
```

Register the plugin in your OpenClaw config by pointing at the manifest:

```json
{
  "plugins": ["openclaw-trustchain"]
}
```

OpenClaw reads `openclaw.plugin.json` from the package root and handles the rest.

## Configuration

All fields are optional. The sidecar starts with sensible defaults if nothing is set.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoStart` | `boolean` | `true` | Start the sidecar automatically when the plugin loads. Set to `false` if you manage the sidecar externally. |
| `autoRecord` | `boolean` | `false` | Automatically record an interaction on every `command:complete` event. The event must include `counterpartyPubkey`. |
| `sidecarBinary` | `string` | auto | Explicit path to the `trustchain-node` binary. Skips discovery when set. |
| `portBase` | `number` | auto | Base port for the sidecar (4 consecutive ports are reserved). Omit to let the sidecar allocate automatically. |
| `bootstrap` | `string[]` | `[]` | Initial peer addresses (`host:port`) to connect to on startup. |
| `logLevel` | `string` | `"info"` | Sidecar log verbosity. One of `error`, `warn`, `info`, `debug`, `trace`. |

Example (OpenClaw plugin config section):

```json
{
  "plugins": {
    "openclaw-trustchain": {
      "autoStart": true,
      "autoRecord": true,
      "bootstrap": ["relay.trustchain.dev:8203"],
      "logLevel": "warn"
    }
  }
}
```

## Tools

Five tools are registered under the `trustchain_` namespace. All tools communicate with the local sidecar over HTTP; they return a plain text result or an error string.

| Tool | Required args | Optional args | What it does |
|------|--------------|---------------|--------------|
| `trustchain_check_trust` | `pubkey` (hex) | — | Returns trust score (0–1), interaction count, block count, and a `bootstrap`/`established` status. Warns when score is below 0.5. |
| `trustchain_discover_peers` | `capability` (string) | `min_trust` (0–1), `max_results` (int) | Queries the local gossip network for agents with the given capability, ranked by trust score. |
| `trustchain_record_interaction` | `counterparty_pubkey` (hex) | `interaction_type`, `outcome` | Sends a signed proposal to the counterparty. Reports whether the bilateral handshake completed immediately or is awaiting agreement. |
| `trustchain_verify_chain` | `pubkey` (hex) | — | Fetches the full chain and checks sequence continuity and hash linkage. Reports `VALID` or lists specific gaps and hash breaks. |
| `trustchain_get_identity` | `pubkey` (hex) | — | Resolves the key (handles succession) and lists active/revoked delegations with their scope. |

### Interaction outcomes

`trustchain_record_interaction` accepts `outcome` values: `success`, `failure`, `partial`.

## Quick Start

```typescript
import { register } from "openclaw-trustchain";

// Simulate what OpenClaw does internally
const plugin = register({
  config: {
    autoStart: true,
    logLevel: "info",
  },
  log: {
    info:  (msg) => console.log(`[INFO]  ${msg}`),
    warn:  (msg) => console.warn(`[WARN]  ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    debug: (msg) => console.debug(`[DEBUG] ${msg}`),
  },
});

// Start the sidecar (OpenClaw calls this on plugin load)
await plugin.onStart();

// Find the tool and call it directly
const checkTrust = plugin.tools.find((t) => t.name === "trustchain_check_trust")!;
const result = await checkTrust.execute({ pubkey: "<64-char hex pubkey>" });
console.log(result.content);
// Trust Score: 0.812
// Interactions: 47
// Blocks: 94
// Status: established
// Public Key: 3f2a1b9c7e4d0a8f...

// Stop when done (OpenClaw calls this on plugin unload)
await plugin.onStop();
```

Run the full demo:

```bash
TRUSTCHAIN_BINARY=path/to/trustchain-node bun run examples/openclaw-demo.ts
```

## Binary Auto-Discovery

The plugin delegates binary resolution to `@trustchain/sdk`. The search order is:

1. Explicit path from `sidecarBinary` config or `TRUSTCHAIN_BINARY` env var
2. `trustchain-node` on `PATH`
3. `~/.trustchain/bin/trustchain-node`
4. Auto-download from [GitHub Releases](https://github.com/viftode4/trustchain/releases) (no Rust toolchain required)

To pre-download the binary (useful in Docker or CI):

```typescript
import { ensureBinary } from "@trustchain/sdk";
await ensureBinary();
```

The downloaded binary is cached at `~/.trustchain/bin/` and reused on subsequent starts.

## How `autoRecord` Works

When `autoRecord: true`, the plugin registers a `command:complete` hook. After each completed command, if the event payload includes a `counterpartyPubkey` field, the plugin automatically calls `client.propose()` to record the interaction. Failures are logged as warnings and do not surface to the agent.

This is opt-in because not every command involves a bilateral peer interaction.

## How the Proxy Works

When the sidecar starts, the plugin sets `HTTP_PROXY` / `http_proxy` in the Node.js process environment to route outbound HTTP traffic through the TrustChain proxy. This enables transparent trust header injection on all requests. The environment is restored when the sidecar stops.

If you run other plugins that make HTTP requests, be aware they will also be routed through the proxy while TrustChain is active. To avoid this, set `autoStart: false` and manage the sidecar externally.

## Links

- [trustchain-js](https://github.com/viftode4/trustchain-js) — full TypeScript SDK (`@trustchain/sdk`)
- [trustchain](https://github.com/viftode4/trustchain) — Rust core: sidecar binary, QUIC P2P, MCP server
- [IETF draft-pouwelse-trustchain-01](https://datatracker.ietf.org/doc/draft-pouwelse-trustchain/) — original bilateral ledger specification
- [IETF draft-viftode-trustchain-trust-00](https://datatracker.ietf.org/doc/draft-viftode-trustchain-trust/) — NetFlow trust computation extension

## License

Apache-2.0
