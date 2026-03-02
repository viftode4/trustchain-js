import { ConnectionError, HttpError, TimeoutError } from "./errors.js";
import type {
	AcceptDelegationRequest,
	AcceptDelegationResponse,
	AcceptSuccessionRequest,
	AcceptSuccessionResponse,
	ClientOptions,
	DelegateRequest,
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
	StatusResponse,
	TrustScoreResponse,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export class TrustChainClient {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;

	constructor(options: ClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	// --- Core endpoints ---

	async status(): Promise<StatusResponse> {
		return this.get("/status");
	}

	async healthz(): Promise<HealthResponse> {
		return this.get("/healthz");
	}

	async metrics(): Promise<string> {
		return this.getText("/metrics");
	}

	// --- Block operations ---

	async propose(counterpartyPubkey: string, transaction?: unknown): Promise<ProposeResponse> {
		return this.post("/propose", {
			counterparty_pubkey: counterpartyPubkey,
			transaction: transaction ?? {},
		});
	}

	async receiveProposal(proposal: HalfBlock): Promise<ReceiveProposalResponse> {
		return this.post("/receive_proposal", { proposal });
	}

	async receiveAgreement(agreement: HalfBlock): Promise<ReceiveAgreementResponse> {
		return this.post("/receive_agreement", { agreement });
	}

	async chain(pubkey?: string): Promise<HalfBlock[]> {
		const pk = pubkey ?? (await this.status()).public_key;
		const resp = await this.get<{ blocks: HalfBlock[] }>(`/chain/${pk}`);
		return resp.blocks;
	}

	async block(pubkey: string, seq: number): Promise<HalfBlock | null> {
		const resp = await this.get<{ block: HalfBlock | null }>(`/block/${pubkey}/${seq}`);
		return resp.block;
	}

	async crawl(pubkey: string, startSeq?: number): Promise<HalfBlock[]> {
		const params = startSeq !== undefined ? `?start_seq=${startSeq}` : "";
		const resp = await this.get<{ blocks: HalfBlock[] }>(`/crawl/${pubkey}${params}`);
		return resp.blocks;
	}

	// --- Peer management ---

	async peers(): Promise<PeerInfo[]> {
		return this.get("/peers");
	}

	async registerPeer(pubkey: string, address: string): Promise<{ status: string }> {
		return this.post("/peers", { pubkey, address });
	}

	// --- Trust ---

	async trustScore(pubkey: string): Promise<TrustScoreResponse> {
		return this.get(`/trust/${pubkey}`);
	}

	async discover(capability: string, options?: DiscoverOptions): Promise<DiscoverResponse> {
		const params = new URLSearchParams({ capability });
		if (options?.min_trust !== undefined) params.set("min_trust", String(options.min_trust));
		if (options?.max_results !== undefined) params.set("max_results", String(options.max_results));
		if (options?.fan_out !== undefined) params.set("fan_out", String(options.fan_out));
		return this.get(`/discover?${params}`);
	}

	// --- Delegation ---

	async delegate(
		delegatePubkey: string,
		options?: { scope?: string[]; max_depth?: number; ttl_seconds?: number },
	): Promise<DelegationResponse> {
		const body: DelegateRequest = {
			delegate_pubkey: delegatePubkey,
			...options,
		};
		return this.post("/delegate", body);
	}

	async acceptDelegation(proposalBlock: HalfBlock): Promise<AcceptDelegationResponse> {
		const body: AcceptDelegationRequest = { proposal_block: proposalBlock };
		return this.post("/accept_delegation", body);
	}

	async revoke(delegationId: string): Promise<DelegationResponse> {
		return this.post("/revoke", { delegation_id: delegationId });
	}

	async delegations(pubkey: string): Promise<DelegationRecord[]> {
		return this.get(`/delegations/${pubkey}`);
	}

	async delegation(delegationId: string): Promise<DelegationRecord> {
		return this.get(`/delegation/${delegationId}`);
	}

	// --- Succession ---

	async acceptSuccession(proposalBlock: HalfBlock): Promise<AcceptSuccessionResponse> {
		const body: AcceptSuccessionRequest = { proposal_block: proposalBlock };
		return this.post("/accept_succession", body);
	}

	// --- Identity ---

	async identity(pubkey: string): Promise<IdentityResponse> {
		return this.get(`/identity/${pubkey}`);
	}

	// --- Internal HTTP helpers ---

	private async get<T>(path: string): Promise<T> {
		const resp = await this.fetch(path, { method: "GET" });
		return resp.json() as Promise<T>;
	}

	private async getText(path: string): Promise<string> {
		const resp = await this.fetch(path, { method: "GET" });
		return resp.text();
	}

	private async post<T>(path: string, body: unknown): Promise<T> {
		const resp = await this.fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		return resp.json() as Promise<T>;
	}

	private async fetch(path: string, init: RequestInit): Promise<Response> {
		const url = `${this.baseUrl}${path}`;
		let resp: Response;
		try {
			resp = await fetch(url, {
				...init,
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === "TimeoutError") {
				throw new TimeoutError(`Request to ${path} timed out after ${this.timeoutMs}ms`);
			}
			if (err instanceof DOMException && err.name === "AbortError") {
				throw new TimeoutError(`Request to ${path} was aborted`);
			}
			throw new ConnectionError(
				`Failed to connect to ${url}`,
				err instanceof Error ? err : undefined,
			);
		}

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			throw new HttpError(resp.status, text);
		}

		return resp;
	}
}
