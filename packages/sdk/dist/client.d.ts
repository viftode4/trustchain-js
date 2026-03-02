import type {
	AcceptDelegationResponse,
	AcceptSuccessionResponse,
	ClientOptions,
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
export declare class TrustChainClient {
	private readonly baseUrl;
	private readonly timeoutMs;
	constructor(options: ClientOptions);
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
	private get;
	private getText;
	private post;
	private fetch;
}
//# sourceMappingURL=client.d.ts.map
