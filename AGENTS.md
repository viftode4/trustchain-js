<!-- OMX:AGENTS-INIT:MANAGED -->
<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-07 | Updated: 2026-05-21 -->

# trustchain-js

## Purpose
TypeScript SDK for TrustChain — universal trust primitive. Bun monorepo, zero runtime dependencies (Node 20+ fetch only). Ships `@trustchain/sdk` and an OpenClaw MCP plugin (5 agent-facing trust tools). Must remain wire-compatible with the Rust workspace. See `CLAUDE.md` for parity rules.

## Key Files
| File | Description |
|------|-------------|
| `CLAUDE.md` | TypeScript SDK guide and parity rules (read first) |
| `package.json` | Workspace root + scripts |
| `bun.lock` | Bun lockfile |
| `tsconfig.json` | TypeScript config (strict, ESM, Node16 resolution) |
| `biome.json` | Biome lint/format config (tabs, line width 100, double quotes, semicolons) |
| `README.md` | Overview |
| `LICENSE` | License |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `packages/sdk/` | `@trustchain/sdk`: `client.ts` (raw HTTP), `sidecar.ts` (spawn + manage node), `delegation.ts`, `types.ts`, `index.ts` (`init`/`protect`/`initDelegate`) |
| `packages/openclaw/` | OpenClaw MCP plugin — 5 agent-facing trust tools |
| `examples/` | Usage examples |

## For AI Agents
### Working In This Directory
- Read `CLAUDE.md` before non-trivial changes.
- **Bun only** — never npm/yarn/pnpm.
- Timestamps: `number` type, integer milliseconds everywhere. Never floats, never seconds.
- Wire JSON field names must be snake_case matching Rust serde structs exactly. No camelCase on the wire.
- Zero runtime dependencies — only Node 20+ fetch. Adding deps requires explicit discussion.
- `MAX_DELEGATION_TTL_MS = 2_592_000_000` (30 days) — same as Rust.
- Sub-delegation scope rules in `delegation.ts` mirror Rust `create_sub_delegation`.
- ESM (`"type": "module"`), Node16 module resolution, `.js` extensions in imports.
- Strict TypeScript: `strict: true`, `isolatedModules: true`.

### Testing Requirements
- `bun install`
- `bun run build` (tsc across all packages)
- `bun test` (165 tests across packages)
- `bun run lint` (biome check) and `bun run format` (biome format --write)
- Integration tests spawn real `trustchain-node` binaries — require the Rust binary in PATH.

### Common Patterns
- `TrustChainClient` for raw HTTP calls to an already-running node.
- `TrustChainSidecar` to spawn and manage a local node lifecycle.
- Singleton helpers `init()` / `protect()` / `initDelegate()` for ergonomic setup.

## Dependencies
### Internal
- Wire-compatible with `../trustchain` (authoritative) and `../trustchain-py`.

### External
- None at runtime. Dev: TypeScript, Biome, Bun.

<!-- OMX:AGENTS-INIT:MANUAL:START -->
## Local Notes
- Read `CLAUDE.md` here before making non-trivial changes; it is the detailed TypeScript SDK guide.
- Verification: `bun install`, `bun run build`, `bun test`, `bun run lint`, `bun run format`.
- Bun only; do not switch package managers.
- Keep timestamps as integer milliseconds, keep wire JSON snake_case, and avoid new runtime dependencies unless explicitly requested.
- Any wire-level or delegation-constant change must stay aligned with `../trustchain` and `../trustchain-py`.
<!-- OMX:AGENTS-INIT:MANUAL:END -->
