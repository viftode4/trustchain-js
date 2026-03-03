---
name: trustchain
description: Decentralized trust layer for AI agents — bilateral signed interaction records with Sybil-resistant trust scores
version: 1.0.0
author: viftode4
tags:
  - security
  - trust
  - identity
  - agents
  - mcp
metadata:
  openclaw:
    emoji: "🔗"
    homepage: https://github.com/viftode4/trustchain-js
    install:
      - kind: node
        package: "@trustchain/openclaw"
---

# TrustChain — Decentralized Trust for Agents

Adds a decentralized trust layer to your agent. TrustChain maintains bilateral signed interaction records between agents and computes Sybil-resistant trust scores using network flow analysis. The sidecar binary auto-downloads on first use — no Rust toolchain needed.

## Tools

- `trustchain_check_trust` — Check the trust score of a peer agent before interacting. Returns score (0-1), interaction count, and bootstrap/established status. Warns when score < 0.5.
- `trustchain_discover_peers` — Find capable agents ranked by trust score. Pass a capability string and optionally min_trust and max_results.
- `trustchain_record_interaction` — Record a bilateral signed interaction with another agent. Creates a cryptographic proposal/agreement pair.
- `trustchain_verify_chain` — Verify the integrity of an agent's interaction chain. Reports VALID or lists specific sequence gaps and hash breaks.
- `trustchain_get_identity` — Get identity details, key succession status, and active/revoked delegations for a pubkey.

## When to use

- Before calling an unknown agent, check its trust score
- When looking for agents to delegate work to, discover peers by capability
- After completing an interaction, record the outcome for future trust computation
- When you need to verify an agent hasn't tampered with its interaction history
- When checking if an agent has valid delegations from a trusted authority
