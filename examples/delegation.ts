/**
 * Delegation flow example — parent delegates authority to a child agent.
 *
 * Prerequisites:
 *   - trustchain-node binary in PATH or set TRUSTCHAIN_BINARY env var
 *
 * Run:
 *   TRUSTCHAIN_BINARY=path/to/trustchain-node bun run examples/delegation.ts
 */

import { TrustChainSidecar } from "@trustchain/sdk";

async function main() {
	// Start parent sidecar
	const parent = new TrustChainSidecar({
		name: "parent-agent",
		binary: process.env.TRUSTCHAIN_BINARY,
		portBase: 18200,
	});
	await parent.start();
	console.log(`Parent started — pubkey: ${parent.pubkey}`);

	// Start child sidecar
	const child = new TrustChainSidecar({
		name: "child-agent",
		binary: process.env.TRUSTCHAIN_BINARY,
		portBase: 18204,
	});
	await child.start();
	console.log(`Child started — pubkey: ${child.pubkey}`);

	// Register each other as peers
	await parent.registerPeer(child.pubkey!, "127.0.0.1:18204");
	await child.registerPeer(parent.pubkey!, "127.0.0.1:18200");

	// Parent delegates to child
	console.log("\nDelegating authority...");
	const delegation = await parent.delegate(child.pubkey!, {
		scope: ["read", "write"],
		ttl_seconds: 3600,
		max_depth: 1,
	});
	console.log(`Delegation ID: ${delegation.delegation_id}`);

	// Child accepts the delegation
	const accepted = await child.acceptDelegation(delegation.block);
	console.log(`Child accepted — delegation record ID: ${accepted.delegation_id}`);

	// Check delegations
	const delegations = await parent.delegations(parent.pubkey!);
	console.log(`\nParent delegations: ${delegations.length}`);

	// Revoke
	console.log("\nRevoking delegation...");
	await parent.revoke(delegation.delegation_id!);
	console.log("Delegation revoked.");

	// Clean up
	child.stop();
	parent.stop();
	console.log("\nDone.");
}

main().catch(console.error);
