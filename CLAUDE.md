# TrustChain JS -- Claude Code Instructions

TypeScript SDK for TrustChain (universal trust primitive). Bun monorepo, zero runtime dependencies.

## Setup & Test

```sh
bun install        # install all workspace deps
bun run build      # tsc across all packages
bun test           # run all tests (126 tests across packages)
bun run lint       # biome check
bun run format     # biome format --write
```

## Package Structure

```
packages/
  sdk/        -- @trustchain/sdk: TrustChainClient, TrustChainSidecar, delegation validation
  openclaw/   -- OpenClaw plugin: 5 agent-facing MCP tools
```

`packages/sdk/src/` key modules:
- `client.ts` -- `TrustChainClient`: raw HTTP calls to a running Rust node
- `sidecar.ts` -- `TrustChainSidecar`: spawns + manages a local trustchain-node binary
- `delegation.ts` -- `validateSubDelegationScope()`, `validateDelegationTtlMs()`, `MAX_DELEGATION_TTL_MS`
- `types.ts` -- wire types (snake_case, int ms timestamps)
- `index.ts` -- `init()` / `protect()` singleton helpers, `initDelegate()`

## Key Conventions

- **Package manager**: bun only -- never npm/yarn/pnpm
- **Timestamps**: `number` type, integer milliseconds everywhere -- never float, never seconds
- **Wire compatibility**: JSON field names are snake_case matching Rust serde structs exactly
- **No runtime deps**: Node 20+ fetch only; add runtime dependencies only after discussion
- **Linter**: Biome (tabs, line width 100, double quotes, semicolons required)
- **Module format**: ESM (`"type": "module"`), Node16 module resolution, `.js` extensions in imports
- **Strict TypeScript**: `strict: true`, `isolatedModules: true`
- **Integration tests**: spawn real `trustchain-node` binaries -- require the Rust binary in PATH

## Rust Parity Rules

This SDK must stay wire-compatible with `trustchain/` (Rust). When touching types or logic:
- Match JSON field names exactly (snake_case, no camelCase on the wire)
- `MAX_DELEGATION_TTL_MS = 2_592_000_000` (30 days) -- same as Rust `MAX_DELEGATION_TTL_SECS * 1000`
- Sub-delegation scope rules in `delegation.ts` mirror Rust `create_sub_delegation`
- Completion rate, NetFlow trust scores: replicate Rust formula, not a new design

## Don't

- Don't use npm/yarn/pnpm -- use bun
- Don't use floats for timestamps (always integer milliseconds)
- Don't add runtime dependencies without discussion
- Don't camelCase wire-level JSON fields
- Don't bypass the 30-day delegation TTL cap
