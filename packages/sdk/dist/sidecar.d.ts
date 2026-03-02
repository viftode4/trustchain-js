import type { TrustChainClient } from "./client.js";
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
export declare class TrustChainSidecar {
	private process;
	private _pubkey;
	private _portBase;
	private _running;
	private _client;
	private readonly options;
	private savedHttpProxy;
	private savedHttpProxyLower;
	constructor(options?: SidecarOptions);
	get pubkey(): string | null;
	get httpUrl(): string;
	get proxyUrl(): string;
	get isRunning(): boolean;
	get client(): TrustChainClient;
	start(): Promise<void>;
	stop(): void;
	[Symbol.dispose](): void;
	status(): Promise<StatusResponse>;
	healthz(): Promise<HealthResponse>;
	metrics(): Promise<string>;
	propose(counterpartyPubkey: string, transaction?: unknown): Promise<ProposeResponse>;
	receiveProposal(proposal: HalfBlock): Promise<ReceiveProposalResponse>;
	receiveAgreement(agreement: HalfBlock): Promise<ReceiveAgreementResponse>;
	chain(pubkey?: string): Promise<HalfBlock[]>;
	block(pubkey: string, seq: number): Promise<HalfBlock | null>;
	crawl(pubkey: string, startSeq?: number): Promise<HalfBlock[]>;
	peers(): Promise<PeerInfo[]>;
	registerPeer(
		pubkey: string,
		address: string,
	): Promise<{
		status: string;
	}>;
	trustScore(pubkey: string): Promise<TrustScoreResponse>;
	discover(capability: string, options?: DiscoverOptions): Promise<DiscoverResponse>;
	delegate(
		delegatePubkey: string,
		options?: {
			scope?: string[];
			max_depth?: number;
			ttl_seconds?: number;
		},
	): Promise<DelegationResponse>;
	acceptDelegation(proposalBlock: HalfBlock): Promise<AcceptDelegationResponse>;
	revoke(delegationId: string): Promise<DelegationResponse>;
	delegations(pubkey: string): Promise<DelegationRecord[]>;
	delegation(delegationId: string): Promise<DelegationRecord>;
	acceptSuccession(proposalBlock: HalfBlock): Promise<AcceptSuccessionResponse>;
	identity(pubkey: string): Promise<IdentityResponse>;
	private waitReady;
}
//# sourceMappingURL=sidecar.d.ts.map
