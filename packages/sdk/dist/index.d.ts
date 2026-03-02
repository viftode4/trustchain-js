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
import type { TrustChainSidecar } from "./sidecar.js";
import type { SidecarOptions } from "./types.js";
/**
 * Initialize a TrustChain sidecar (singleton).
 * Subsequent calls return the same instance.
 */
export declare function init(options?: SidecarOptions): Promise<TrustChainSidecar>;
/** Alias for init() — protect your agent with TrustChain. */
export declare const protect: typeof init;
/**
 * Initialize a delegated agent sidecar.
 * Starts a local sidecar, then requests delegation from a parent node.
 *
 * Enforces the 30-day maximum TTL cap before making any network call.
 */
export declare function initDelegate(options: {
	parentUrl: string;
	scope: string[];
	ttlSeconds?: number;
	sidecar?: SidecarOptions;
}): Promise<TrustChainSidecar>;
//# sourceMappingURL=index.d.ts.map
