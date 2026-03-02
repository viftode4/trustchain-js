export { TrustChainClient } from "./client.js";
export { TrustChainSidecar } from "./sidecar.js";
export * from "./types.js";
export * from "./errors.js";
export { findBinary, findFreePortBase } from "./utils.js";

import { TrustChainClient } from "./client.js";
import { TrustChainSidecar } from "./sidecar.js";
import type { SidecarOptions } from "./types.js";

let singleton: TrustChainSidecar | null = null;

/**
 * Initialize a TrustChain sidecar (singleton).
 * Subsequent calls return the same instance.
 */
export async function init(options?: SidecarOptions): Promise<TrustChainSidecar> {
	if (singleton?.isRunning) return singleton;
	singleton = new TrustChainSidecar(options);
	await singleton.start();
	return singleton;
}

/** Alias for init() — protect your agent with TrustChain. */
export const protect = init;

/**
 * Initialize a delegated agent sidecar.
 * Starts a local sidecar, then requests delegation from a parent node.
 */
export async function initDelegate(options: {
	parentUrl: string;
	scope: string[];
	ttlSeconds?: number;
	sidecar?: SidecarOptions;
}): Promise<TrustChainSidecar> {
	const sidecar = await init(options.sidecar);
	const pubkey = sidecar.pubkey;
	if (!pubkey) throw new Error("Sidecar started but pubkey not available");

	// Request delegation from parent
	const parentClient = new TrustChainClient({ baseUrl: options.parentUrl });
	const delegationResp = await parentClient.delegate(pubkey, {
		scope: options.scope,
		ttl_seconds: options.ttlSeconds ?? 3600,
	});

	// Complete bilateral handshake
	if (delegationResp.block) {
		await sidecar.acceptDelegation(delegationResp.block);
	}

	return sidecar;
}
