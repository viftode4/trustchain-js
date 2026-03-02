/**
 * OpenClaw plugin usage demo.
 *
 * This demonstrates how the TrustChain plugin integrates with OpenClaw.
 * In a real OpenClaw environment, registration happens automatically via
 * openclaw.plugin.json. This example shows the API directly.
 *
 * Run:
 *   TRUSTCHAIN_BINARY=path/to/trustchain-node bun run examples/openclaw-demo.ts
 */

import { register } from "@trustchain/openclaw";

async function main() {
	// Simulate OpenClaw plugin context
	const ctx = {
		config: {
			autoStart: true,
			sidecarBinary: process.env.TRUSTCHAIN_BINARY,
			logLevel: "info",
			autoRecord: false,
		},
		log: {
			info: (msg: string) => console.log(`[INFO] ${msg}`),
			warn: (msg: string) => console.warn(`[WARN] ${msg}`),
			error: (msg: string) => console.error(`[ERROR] ${msg}`),
			debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
		},
	};

	// Register plugin (this is what OpenClaw calls)
	const plugin = register(ctx);

	console.log(`Registered ${plugin.tools.length} tools:`);
	for (const tool of plugin.tools) {
		console.log(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
	}

	// Start the sidecar (OpenClaw calls this on plugin load)
	await plugin.onStart?.();

	// Use a tool directly (OpenClaw's agent would call these)
	const checkTrust = plugin.tools.find((t) => t.name === "trustchain_check_trust")!;

	// This will fail without a real peer, but shows the API
	const result = await checkTrust.execute({ pubkey: "a".repeat(64) });
	console.log("\nTool result:");
	console.log(result.content);

	// Stop (OpenClaw calls this on plugin unload)
	await plugin.onStop?.();
	console.log("\nPlugin stopped.");
}

main().catch(console.error);
