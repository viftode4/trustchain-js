# TrustChain — Decentralized Trust for Agents

## What it does
TrustChain provides a decentralized trust layer for AI agents. It maintains bilateral signed interaction records between agents and computes Sybil-resistant trust scores using network flow analysis.

## Tools
- `trustchain_check_trust` — Check the trust score of a peer agent before interacting
- `trustchain_discover_peers` — Find capable agents ranked by trust score
- `trustchain_record_interaction` — Record a bilateral interaction with another agent
- `trustchain_verify_chain` — Verify the integrity of an agent's interaction chain
- `trustchain_get_identity` — Get identity details and delegation info for a pubkey

## When to use
- Before calling an unknown agent, check its trust score
- When looking for agents to delegate work to, discover peers by capability
- After completing an interaction, record the outcome for future trust computation
