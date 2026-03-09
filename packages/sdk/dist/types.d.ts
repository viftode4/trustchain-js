/**
 * Wire-compatible types matching Rust serde structs exactly.
 * All timestamps are number (int milliseconds since epoch).
 * Property names use snake_case to match JSON wire format.
 */
export type BlockType = "proposal" | "agreement" | "checkpoint" | "delegation" | "revocation" | "succession" | "audit";
export interface HalfBlock {
    public_key: string;
    sequence_number: number;
    link_public_key: string;
    link_sequence_number: number;
    previous_hash: string;
    signature: string;
    block_type: BlockType;
    transaction: unknown;
    block_hash: string;
    timestamp: number;
}
export interface ProposeRequest {
    counterparty_pubkey: string;
    transaction?: unknown;
}
export interface ReceiveProposalRequest {
    proposal: HalfBlock;
}
export interface ReceiveAgreementRequest {
    agreement: HalfBlock;
}
export interface RegisterPeerRequest {
    pubkey: string;
    address: string;
    agent_endpoint?: string;
    timestamp?: number;
    signature?: string;
}
export interface DelegateRequest {
    delegate_pubkey: string;
    scope?: string[];
    max_depth?: number;
    ttl_seconds?: number;
}
export interface RevokeRequest {
    delegation_id: string;
}
export interface AcceptDelegationRequest {
    proposal_block: HalfBlock;
}
export interface AcceptSuccessionRequest {
    proposal_block: HalfBlock;
}
export interface AuditRequest {
    transaction: unknown;
}
export interface AuditResponse {
    block: HalfBlock;
    sequence_number: number;
}
export type AuditLevel = "minimal" | "standard" | "comprehensive";
export type EventType = "tool_call" | "llm_decision" | "error" | "state_change" | "human_override" | "external_api" | "raw_http";
export interface AuditBatchRequest {
    entries: unknown[];
}
export interface AuditBatchResponse {
    blocks: HalfBlock[];
    count: number;
}
export interface AuditReportResponse {
    total_blocks: number;
    audit_blocks: number;
    bilateral_blocks: number;
    integrity_valid: boolean;
    integrity_score: number;
    event_type_breakdown: Record<string, number>;
    first_timestamp?: number;
    last_timestamp?: number;
    chain_length: number;
}
export interface ExportChainResponse {
    pubkey: string;
    chain: HalfBlock[];
    exported_at: number;
    chain_hash: string;
    signature: string;
}
export interface StatusResponse {
    public_key: string;
    latest_seq: number;
    block_count: number;
    peer_count: number;
    agent_endpoint?: string;
}
export interface HealthResponse {
    status: string;
    public_key: string;
}
export interface ProposeResponse {
    proposal: HalfBlock;
    agreement?: HalfBlock;
    completed: boolean;
}
export interface ReceiveProposalResponse {
    accepted: boolean;
    agreement?: HalfBlock;
    error?: string;
}
export interface ReceiveAgreementResponse {
    accepted: boolean;
    error?: string;
}
export interface BlocksResponse {
    blocks: HalfBlock[];
}
export interface BlockResponse {
    block: HalfBlock | null;
}
export interface PeerInfo {
    pubkey: string;
    address: string;
    latest_seq: number;
}
export interface TrustScoreResponse {
    pubkey: string;
    trust_score: number;
    connectivity?: number;
    integrity?: number;
    diversity?: number;
    recency?: number;
    unique_peers?: number;
    interactions?: number;
    fraud?: boolean;
    path_diversity?: number;
    interaction_count: number;
    block_count: number;
    audit_count?: number;
}
export interface DiscoveredAgent {
    pubkey: string;
    address?: string;
    capability: string;
    interaction_count: number;
    trust_score?: number;
    connectivity?: number;
    diversity?: number;
}
export interface DiscoverResponse {
    agents: DiscoveredAgent[];
    queried_peers: number;
}
export interface DelegationResponse {
    block: HalfBlock;
    delegation_id?: string;
}
export interface AcceptDelegationResponse {
    agreement: HalfBlock;
    delegation_id: string;
    delegation_record: DelegationRecord;
}
export interface AcceptSuccessionResponse {
    agreement: HalfBlock;
    succession_id: string;
}
export interface DelegationRecord {
    delegation_id: string;
    delegator_pubkey: string;
    delegate_pubkey: string;
    scope: string[];
    max_depth: number;
    issued_at: number;
    expires_at: number;
    delegation_block_hash: string;
    agreement_block_hash: string | null;
    parent_delegation_id: string | null;
    revoked: boolean;
    revocation_block_hash: string | null;
}
export interface IdentityResponse {
    pubkey: string;
    resolved_pubkey: string;
    is_successor: boolean;
}
export interface ErrorResponse {
    error: string;
}
export interface ClientOptions {
    baseUrl: string;
    timeoutMs?: number;
}
export interface DiscoverOptions {
    min_trust?: number;
    max_results?: number;
    fan_out?: number;
}
export interface SidecarOptions {
    name?: string;
    binary?: string;
    portBase?: number;
    endpoint?: string;
    bootstrap?: string[];
    dataDir?: string;
    logLevel?: string;
}
//# sourceMappingURL=types.d.ts.map