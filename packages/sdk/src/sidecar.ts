import { type ChildProcess, spawn } from "node:child_process";
import { TrustChainClient } from "./client.js";
import { SidecarError } from "./errors.js";
import type {
	AcceptDelegationResponse,
	AcceptSuccessionResponse,
	DelegationRecord,
	DelegationResponse,
	DiscoverOptions,
	DiscoverResponse,
	HalfBlock,
	HealthResponse,
	IdentityResponse,
	PeerInfo,
	ProposeResponse,
	ReceiveAgreementResponse,
	ReceiveProposalResponse,
	SidecarOptions,
	StatusResponse,
	TrustScoreResponse,
} from "./types.js";
import { PORT_HTTP_OFFSET, PORT_PROXY_OFFSET, ensureBinary, findFreePortBase } from "./utils.js";

const PUBKEY_REGEX = /Public key:\s*([0-9a-fA-F]{64})/;
const READY_TIMEOUT_MS = 10_000;
const POLL_INITIAL_MS = 100;
const POLL_MAX_MS = 1000;

export class TrustChainSidecar {
	private process: ChildProcess | null = null;
	private _pubkey: string | null = null;
	private _portBase: number | null = null;
	private _running = false;
	private _client: TrustChainClient | null = null;
	private readonly options: Required<Pick<SidecarOptions, "name" | "logLevel">> & SidecarOptions;
	private savedHttpProxy: string | undefined;
	private savedHttpProxyLower: string | undefined;

	constructor(options?: SidecarOptions) {
		this.options = {
			name: options?.name ?? `ts-agent-${process.pid}`,
			logLevel: options?.logLevel ?? "info",
			...options,
		};
	}

	get pubkey(): string | null {
		return this._pubkey;
	}

	get httpUrl(): string {
		if (!this._portBase) throw new SidecarError("Sidecar not started");
		return `http://127.0.0.1:${this._portBase + PORT_HTTP_OFFSET}`;
	}

	get proxyUrl(): string {
		if (!this._portBase) throw new SidecarError("Sidecar not started");
		return `http://127.0.0.1:${this._portBase + PORT_PROXY_OFFSET}`;
	}

	get isRunning(): boolean {
		return this._running;
	}

	get client(): TrustChainClient {
		if (!this._client) throw new SidecarError("Sidecar not started");
		return this._client;
	}

	async start(): Promise<void> {
		if (this._running) return;

		const binary = await ensureBinary(this.options.binary);
		this._portBase = this.options.portBase ?? (await findFreePortBase());

		const args = [
			"sidecar",
			"--name",
			this.options.name,
			"--endpoint",
			this.options.endpoint ?? "http://127.0.0.1:0",
			"--port-base",
			String(this._portBase),
			"--log-level",
			this.options.logLevel,
		];

		if (this.options.bootstrap?.length) {
			args.push("--bootstrap", this.options.bootstrap.join(","));
		}
		if (this.options.dataDir) {
			args.push("--data-dir", this.options.dataDir);
		}

		// Strip proxy env to prevent loops
		const env = { ...process.env };
		env.HTTP_PROXY = undefined;
		env.http_proxy = undefined;

		const spawnOptions: Parameters<typeof spawn>[2] = {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		};
		if (process.platform === "win32") {
			(spawnOptions as Record<string, unknown>).windowsHide = true;
		}

		this.process = spawn(binary, args, spawnOptions);

		// Read stdout for pubkey
		this.process.stdout?.on("data", (data: Buffer) => {
			const line = data.toString();
			const match = line.match(PUBKEY_REGEX);
			if (match && !this._pubkey) {
				this._pubkey = match[1];
			}
		});

		// Collect stderr for error reporting
		let stderr = "";
		this.process.stderr?.on("data", (data: Buffer) => {
			if (stderr.length < 8192) {
				stderr += data.toString();
			}
		});

		this.process.on("exit", (code) => {
			this._running = false;
			if (code !== null && code !== 0) {
				const msg = stderr.slice(0, 1024);
				console.error(`trustchain-node exited with code ${code}: ${msg}`);
			}
		});

		this._client = new TrustChainClient({
			baseUrl: this.httpUrl,
			timeoutMs: 5_000,
		});

		await this.waitReady();

		// Set HTTP_PROXY
		this.savedHttpProxy = process.env.HTTP_PROXY;
		this.savedHttpProxyLower = process.env.http_proxy;
		process.env.HTTP_PROXY = this.proxyUrl;
		process.env.http_proxy = this.proxyUrl;

		this._running = true;
	}

	stop(): void {
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
		this._running = false;

		// Restore HTTP_PROXY
		if (this.savedHttpProxy !== undefined) {
			process.env.HTTP_PROXY = this.savedHttpProxy;
		} else {
			process.env.HTTP_PROXY = undefined;
		}
		if (this.savedHttpProxyLower !== undefined) {
			process.env.http_proxy = this.savedHttpProxyLower;
		} else {
			process.env.http_proxy = undefined;
		}
	}

	[Symbol.dispose](): void {
		this.stop();
	}

	// --- Forwarded client methods ---

	status(): Promise<StatusResponse> {
		return this.client.status();
	}
	healthz(): Promise<HealthResponse> {
		return this.client.healthz();
	}
	metrics(): Promise<string> {
		return this.client.metrics();
	}
	propose(counterpartyPubkey: string, transaction?: unknown): Promise<ProposeResponse> {
		return this.client.propose(counterpartyPubkey, transaction);
	}
	receiveProposal(proposal: HalfBlock): Promise<ReceiveProposalResponse> {
		return this.client.receiveProposal(proposal);
	}
	receiveAgreement(agreement: HalfBlock): Promise<ReceiveAgreementResponse> {
		return this.client.receiveAgreement(agreement);
	}
	chain(pubkey?: string): Promise<HalfBlock[]> {
		return this.client.chain(pubkey);
	}
	block(pubkey: string, seq: number): Promise<HalfBlock | null> {
		return this.client.block(pubkey, seq);
	}
	crawl(pubkey: string, startSeq?: number): Promise<HalfBlock[]> {
		return this.client.crawl(pubkey, startSeq);
	}
	peers(): Promise<PeerInfo[]> {
		return this.client.peers();
	}
	registerPeer(pubkey: string, address: string): Promise<{ status: string }> {
		return this.client.registerPeer(pubkey, address);
	}
	trustScore(pubkey: string): Promise<TrustScoreResponse> {
		return this.client.trustScore(pubkey);
	}
	discover(capability: string, options?: DiscoverOptions): Promise<DiscoverResponse> {
		return this.client.discover(capability, options);
	}
	delegate(
		delegatePubkey: string,
		options?: { scope?: string[]; max_depth?: number; ttl_seconds?: number },
	): Promise<DelegationResponse> {
		return this.client.delegate(delegatePubkey, options);
	}
	acceptDelegation(proposalBlock: HalfBlock): Promise<AcceptDelegationResponse> {
		return this.client.acceptDelegation(proposalBlock);
	}
	revoke(delegationId: string): Promise<DelegationResponse> {
		return this.client.revoke(delegationId);
	}
	delegations(pubkey: string): Promise<DelegationRecord[]> {
		return this.client.delegations(pubkey);
	}
	delegation(delegationId: string): Promise<DelegationRecord> {
		return this.client.delegation(delegationId);
	}
	acceptSuccession(proposalBlock: HalfBlock): Promise<AcceptSuccessionResponse> {
		return this.client.acceptSuccession(proposalBlock);
	}
	identity(pubkey: string): Promise<IdentityResponse> {
		return this.client.identity(pubkey);
	}

	// --- Internal ---

	private async waitReady(): Promise<void> {
		const deadline = Date.now() + READY_TIMEOUT_MS;
		let delay = POLL_INITIAL_MS;

		while (Date.now() < deadline) {
			// Check if process died
			if (this.process?.exitCode !== null && this.process?.exitCode !== undefined) {
				throw new SidecarError(
					`trustchain-node exited with code ${this.process.exitCode} before becoming ready`,
				);
			}

			try {
				const health = await this._client!.healthz();
				if (health.public_key && !this._pubkey) {
					this._pubkey = health.public_key;
				}
				return;
			} catch {
				// Not ready yet, try status as fallback
				try {
					const st = await this._client!.status();
					if (st.public_key && !this._pubkey) {
						this._pubkey = st.public_key;
					}
					return;
				} catch {
					// Still not ready
				}
			}

			await sleep(delay);
			delay = Math.min(delay * 1.5, POLL_MAX_MS);
		}

		throw new SidecarError(`Sidecar did not become ready within ${READY_TIMEOUT_MS}ms`);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
