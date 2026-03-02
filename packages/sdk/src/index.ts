export { TrustChainClient } from "./client.js";
export { TrustChainSidecar } from "./sidecar.js";
export * from "./types.js";
export * from "./errors.js";
export { findBinary, ensureBinary, findFreePortBase } from "./utils.js";
export {
	MAX_DELEGATION_TTL_MS,
	validateSubDelegationScope,
	validateDelegationTtlMs,
	validateDelegationTtlSeconds,
} from "./delegation.js";

import { TrustChainClient } from "./client.js";
import { TrustChainSidecar } from "./sidecar.js";
import { validateDelegationTtlSeconds } from "./delegation.js";
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
 *
 * Enforces the 30-day maximum TTL cap before making any network call.
 */
export async function initDelegate(options: {
	parentUrl: string;
	scope: string[];
	ttlSeconds?: number;
	sidecar?: SidecarOptions;
}): Promise<TrustChainSidecar> {
	const ttlSeconds = options.ttlSeconds ?? 3600;

	// Enforce 30-day TTL cap before making any network call.
	validateDelegationTtlSeconds(ttlSeconds);

	const sidecar = await init(options.sidecar);
	const pubkey = sidecar.pubkey;
	if (!pubkey) throw new Error("Sidecar started but pubkey not available");

	// Request delegation from parent
	const parentClient = new TrustChainClient({ baseUrl: options.parentUrl });
	const delegationResp = await parentClient.delegate(pubkey, {
		scope: options.scope,
		ttl_seconds: ttlSeconds,
	});

	// Complete bilateral handshake
	if (delegationResp.block) {
		await sidecar.acceptDelegation(delegationResp.block);
	}

	return sidecar;
}
