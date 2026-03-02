/**
 * Basic TrustChain SDK usage example.
 *
 * Prerequisites:
 *   - trustchain-node binary in PATH or set TRUSTCHAIN_BINARY env var
 *
 * Run:
 *   TRUSTCHAIN_BINARY=path/to/trustchain-node bun run examples/basic-usage.ts
 */

import { init } from "@trustchain/sdk";

async function main() {
	// Start the TrustChain sidecar
	const sidecar = await init({
		name: "example-agent",
		binary: process.env.TRUSTCHAIN_BINARY,
	});

	console.log(`Sidecar started — pubkey: ${sidecar.pubkey}`);
	console.log(`HTTP: ${sidecar.httpUrl}`);
	console.log(`Proxy: ${sidecar.proxyUrl}`);

	// Check node status
	const status = await sidecar.status();
	console.log("\nStatus:", status);

	// If there's a peer to interact with, propose an interaction
	const peers = await sidecar.peers();
	if (peers.length > 0) {
		const peer = peers[0];
		console.log(`\nProposing interaction with peer: ${peer.pubkey.slice(0, 16)}...`);

		const result = await sidecar.propose(peer.pubkey, {
			interaction_type: "greeting",
			outcome: "success",
		});
		console.log("Proposal:", result.completed ? "completed" : "pending");

		// Check trust score
		const trust = await sidecar.trustScore(peer.pubkey);
		console.log(`Trust score: ${trust.trust_score.toFixed(3)}`);
	} else {
		console.log("\nNo peers connected. Try bootstrapping with another node.");
	}

	// Clean up
	sidecar.stop();
	console.log("\nSidecar stopped.");
}

main().catch(console.error);
