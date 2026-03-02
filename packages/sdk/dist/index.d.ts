export { TrustChainClient } from "./client.js";
export { TrustChainSidecar } from "./sidecar.js";
export * from "./types.js";
export * from "./errors.js";
export { findBinary, findFreePortBase } from "./utils.js";
import { TrustChainSidecar } from "./sidecar.js";
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
 */
export declare function initDelegate(options: {
    parentUrl: string;
    scope: string[];
    ttlSeconds?: number;
    sidecar?: SidecarOptions;
}): Promise<TrustChainSidecar>;
//# sourceMappingURL=index.d.ts.map