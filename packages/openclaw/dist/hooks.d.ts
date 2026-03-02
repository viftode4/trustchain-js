import type { TrustChainClient } from "@trustchain/sdk";
import type { EventHook, Logger } from "./openclaw-types.js";
/**
 * Create event hooks for automatic interaction recording.
 */
export declare function createHooks(
	getClient: () => TrustChainClient,
	log: Logger,
	autoRecord: boolean,
): EventHook[];
//# sourceMappingURL=hooks.d.ts.map
