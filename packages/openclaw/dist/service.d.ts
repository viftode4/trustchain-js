import { TrustChainClient } from "@trustchain/sdk";
import type { SidecarOptions } from "@trustchain/sdk";
import type { Logger } from "./openclaw-types.js";
/**
 * Manages the TrustChain sidecar lifecycle for the OpenClaw plugin.
 */
export declare class SidecarService {
    private sidecar;
    private externalClient;
    private readonly log;
    constructor(log: Logger);
    get isRunning(): boolean;
    /**
     * Get the active TrustChainClient.
     * Either from a managed sidecar or an external URL.
     */
    getClient(): TrustChainClient;
    /**
     * Start the sidecar with the given options.
     */
    start(options?: SidecarOptions): Promise<void>;
    /**
     * Connect to an already-running sidecar at the given URL.
     */
    connectExternal(baseUrl: string): void;
    /**
     * Stop the managed sidecar.
     */
    stop(): void;
    get pubkey(): string | null;
}
//# sourceMappingURL=service.d.ts.map