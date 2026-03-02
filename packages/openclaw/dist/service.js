import { TrustChainClient, TrustChainSidecar } from "@trustchain/sdk";
/**
 * Manages the TrustChain sidecar lifecycle for the OpenClaw plugin.
 */
export class SidecarService {
    sidecar = null;
    externalClient = null;
    log;
    constructor(log) {
        this.log = log;
    }
    get isRunning() {
        return this.sidecar?.isRunning ?? this.externalClient !== null;
    }
    /**
     * Get the active TrustChainClient.
     * Either from a managed sidecar or an external URL.
     */
    getClient() {
        if (this.sidecar?.isRunning)
            return this.sidecar.client;
        if (this.externalClient)
            return this.externalClient;
        throw new Error("TrustChain sidecar not started. Enable autoStart or call start().");
    }
    /**
     * Start the sidecar with the given options.
     */
    async start(options) {
        if (this.sidecar?.isRunning)
            return;
        this.sidecar = new TrustChainSidecar(options);
        this.log.info("Starting TrustChain sidecar...");
        await this.sidecar.start();
        this.log.info(`TrustChain sidecar ready — pubkey: ${this.sidecar.pubkey}`);
    }
    /**
     * Connect to an already-running sidecar at the given URL.
     */
    connectExternal(baseUrl) {
        this.externalClient = new TrustChainClient({ baseUrl });
        this.log.info(`Connected to external TrustChain sidecar at ${baseUrl}`);
    }
    /**
     * Stop the managed sidecar.
     */
    stop() {
        if (this.sidecar) {
            this.log.info("Stopping TrustChain sidecar...");
            this.sidecar.stop();
            this.sidecar = null;
        }
        this.externalClient = null;
    }
    get pubkey() {
        return this.sidecar?.pubkey ?? null;
    }
}
//# sourceMappingURL=service.js.map