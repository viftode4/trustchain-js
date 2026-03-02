import { TrustChainClient, TrustChainSidecar } from "@trustchain/sdk";
import type { SidecarOptions } from "@trustchain/sdk";
import type { Logger } from "./openclaw-types.js";

/**
 * Manages the TrustChain sidecar lifecycle for the OpenClaw plugin.
 */
export class SidecarService {
	private sidecar: TrustChainSidecar | null = null;
	private externalClient: TrustChainClient | null = null;
	private readonly log: Logger;

	constructor(log: Logger) {
		this.log = log;
	}

	get isRunning(): boolean {
		return this.sidecar?.isRunning ?? this.externalClient !== null;
	}

	/**
	 * Get the active TrustChainClient.
	 * Either from a managed sidecar or an external URL.
	 */
	getClient(): TrustChainClient {
		if (this.sidecar?.isRunning) return this.sidecar.client;
		if (this.externalClient) return this.externalClient;
		throw new Error("TrustChain sidecar not started. Enable autoStart or call start().");
	}

	/**
	 * Start the sidecar with the given options.
	 */
	async start(options?: SidecarOptions): Promise<void> {
		if (this.sidecar?.isRunning) return;

		this.sidecar = new TrustChainSidecar(options);
		this.log.info("Starting TrustChain sidecar...");
		await this.sidecar.start();
		this.log.info(`TrustChain sidecar ready — pubkey: ${this.sidecar.pubkey}`);
	}

	/**
	 * Connect to an already-running sidecar at the given URL.
	 */
	connectExternal(baseUrl: string): void {
		this.externalClient = new TrustChainClient({ baseUrl });
		this.log.info(`Connected to external TrustChain sidecar at ${baseUrl}`);
	}

	/**
	 * Stop the managed sidecar.
	 */
	stop(): void {
		if (this.sidecar) {
			this.log.info("Stopping TrustChain sidecar...");
			this.sidecar.stop();
			this.sidecar = null;
		}
		this.externalClient = null;
	}

	get pubkey(): string | null {
		return this.sidecar?.pubkey ?? null;
	}
}
