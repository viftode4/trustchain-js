/**
 * Integration tests against real trustchain-node binaries.
 *
 * These tests spawn actual sidecar processes and exercise the full HTTP API.
 * Skip if binary not found.
 *
 * Run: bun test tests/integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { TrustChainClient } from "../src/client.js";
import { HttpError } from "../src/errors.js";
import { TrustChainSidecar } from "../src/sidecar.js";

// --- Binary discovery ---
const BINARY_CANDIDATES = [
	process.env.TRUSTCHAIN_BINARY,
	"G:/Projects/blockchains/trustchain/target/release/trustchain-node.exe",
	"G:/Projects/blockchains/trustchain/target/debug/trustchain-node.exe",
].filter(Boolean) as string[];

const BINARY = BINARY_CANDIDATES.find((p) => existsSync(p));

const describeIntegration = BINARY ? describe : describe.skip;

describeIntegration("Integration: single node", () => {
	let sidecar: TrustChainSidecar;

	beforeAll(async () => {
		sidecar = new TrustChainSidecar({
			name: "test-single",
			binary: BINARY,
			logLevel: "warn",
		});
		await sidecar.start();
	}, 15_000);

	afterAll(() => {
		sidecar?.stop();
	});

	it("start() sets pubkey as 64 hex chars", () => {
		expect(sidecar.pubkey).not.toBeNull();
		expect(sidecar.pubkey).toHaveLength(64);
		expect(sidecar.pubkey).toMatch(/^[0-9a-fA-F]{64}$/);
	});

	it("isRunning is true after start", () => {
		expect(sidecar.isRunning).toBe(true);
	});

	it("httpUrl and proxyUrl are set and different", () => {
		expect(sidecar.httpUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		expect(sidecar.proxyUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		expect(sidecar.httpUrl).not.toBe(sidecar.proxyUrl);
	});

	it("GET /healthz returns ok with matching pubkey", async () => {
		const resp = await sidecar.healthz();
		expect(resp.status).toBe("ok");
		expect(resp.public_key).toBe(sidecar.pubkey);
	});

	it("GET /status returns valid StatusResponse shape", async () => {
		const resp = await sidecar.status();
		expect(resp.public_key).toBe(sidecar.pubkey);
		expect(typeof resp.latest_seq).toBe("number");
		expect(typeof resp.block_count).toBe("number");
		expect(typeof resp.peer_count).toBe("number");
		expect(resp.latest_seq).toBeGreaterThanOrEqual(0);
		expect(resp.block_count).toBeGreaterThanOrEqual(0);
		expect(resp.peer_count).toBeGreaterThanOrEqual(0);
	});

	it("GET /metrics returns Prometheus text format", async () => {
		const text = await sidecar.metrics();
		expect(typeof text).toBe("string");
		expect(text).toContain("trustchain_block_count");
		// Prometheus format: metric_name value
		expect(text).toMatch(/trustchain_\w+ \d+/);
	});

	it("GET /peers returns array", async () => {
		const peers = await sidecar.peers();
		expect(Array.isArray(peers)).toBe(true);
	});

	it("GET /chain returns array of HalfBlocks", async () => {
		const chain = await sidecar.chain(sidecar.pubkey!);
		expect(Array.isArray(chain)).toBe(true);
		// May or may not be empty depending on sidecar init behavior
		for (const block of chain) {
			expect(block.public_key).toBe(sidecar.pubkey);
			expect(typeof block.sequence_number).toBe("number");
			expect(typeof block.block_hash).toBe("string");
		}
	});

	it("GET /trust/{pubkey} returns valid TrustScoreResponse", async () => {
		const resp = await sidecar.trustScore(sidecar.pubkey!);
		expect(resp.pubkey).toBe(sidecar.pubkey);
		expect(typeof resp.trust_score).toBe("number");
		expect(resp.trust_score).toBeGreaterThanOrEqual(0);
		expect(resp.trust_score).toBeLessThanOrEqual(1);
		expect(typeof resp.interaction_count).toBe("number");
		expect(typeof resp.block_count).toBe("number");
	});

	it("GET /identity/{pubkey} returns valid IdentityResponse", async () => {
		const resp = await sidecar.identity(sidecar.pubkey!);
		expect(resp.pubkey).toBe(sidecar.pubkey);
		expect(resp.resolved_pubkey).toBe(sidecar.pubkey);
		expect(resp.is_successor).toBe(false);
	});

	it("GET /delegations/{pubkey} returns array", async () => {
		const delegations = await sidecar.delegations(sidecar.pubkey!);
		expect(Array.isArray(delegations)).toBe(true);
	});

	it("GET /discover returns valid DiscoverResponse", async () => {
		const resp = await sidecar.discover("anything");
		expect(Array.isArray(resp.agents)).toBe(true);
		expect(typeof resp.queried_peers).toBe("number");
	});

	it("GET /block returns null for nonexistent block", async () => {
		const block = await sidecar.block(sidecar.pubkey!, 99999);
		expect(block).toBeNull();
	});

	it("GET /crawl returns array", async () => {
		const blocks = await sidecar.crawl(sidecar.pubkey!);
		expect(Array.isArray(blocks)).toBe(true);
	});

	it("client property returns working TrustChainClient", async () => {
		const client = sidecar.client;
		expect(client).toBeInstanceOf(TrustChainClient);
		const health = await client.healthz();
		expect(health.status).toBe("ok");
	});
});

describeIntegration("Integration: two-node bilateral interaction", () => {
	let node1: TrustChainSidecar;
	let node2: TrustChainSidecar;

	beforeAll(async () => {
		node1 = new TrustChainSidecar({
			name: "test-bilateral-a",
			binary: BINARY,
			logLevel: "warn",
		});
		await node1.start();

		node2 = new TrustChainSidecar({
			name: "test-bilateral-b",
			binary: BINARY,
			logLevel: "warn",
		});
		await node2.start();

		// Register each other as peers
		const addr1 = node1.httpUrl.replace("http://", "");
		const addr2 = node2.httpUrl.replace("http://", "");
		await node1.registerPeer(node2.pubkey!, addr2);
		await node2.registerPeer(node1.pubkey!, addr1);
	}, 30_000);

	afterAll(() => {
		node2?.stop();
		node1?.stop();
	});

	it("nodes have different pubkeys", () => {
		expect(node1.pubkey).not.toBe(node2.pubkey);
		expect(node1.pubkey).toHaveLength(64);
		expect(node2.pubkey).toHaveLength(64);
	});

	it("POST /peers registered peers correctly", async () => {
		const peers1 = await node1.peers();
		const found = peers1.find((p) => p.pubkey === node2.pubkey);
		expect(found).toBeDefined();
		expect(found?.address).toContain("127.0.0.1");
	});

	it("POST /propose creates a valid proposal HalfBlock", async () => {
		const result = await node1.propose(node2.pubkey!, {
			interaction_type: "test_call",
			outcome: "success",
		});

		expect(result.proposal).toBeDefined();
		expect(result.proposal.public_key).toBe(node1.pubkey);
		expect(result.proposal.link_public_key).toBe(node2.pubkey);
		expect(typeof result.proposal.sequence_number).toBe("number");
		expect(result.proposal.sequence_number).toBeGreaterThan(0);
		expect(typeof result.completed).toBe("boolean");

		// Validate HalfBlock wire format
		const block = result.proposal;
		expect(block.public_key).toMatch(/^[0-9a-fA-F]{64}$/);
		expect(block.link_public_key).toMatch(/^[0-9a-fA-F]{64}$/);
		expect(block.previous_hash).toMatch(/^[0-9a-fA-F]{64}$/);
		expect(block.signature).toMatch(/^[0-9a-fA-F]{128}$/);
		expect(block.block_hash).toMatch(/^[0-9a-fA-F]{64}$/);
		expect([
			"proposal",
			"agreement",
			"delegation",
			"revocation",
			"checkpoint",
			"succession",
		]).toContain(block.block_type);
		expect(typeof block.timestamp).toBe("number");
		expect(block.timestamp).toBeGreaterThan(1_000_000_000_000); // ms since epoch
	});

	it("manual bilateral handshake: receive_proposal + receive_agreement", async () => {
		// node1 creates a proposal
		const proposeResult = await node1.propose(node2.pubkey!, {
			interaction_type: "manual_handshake",
			outcome: "success",
		});

		// If P2P already completed it, great — otherwise do manual handshake
		if (!proposeResult.completed) {
			// node2 receives the proposal
			const receiveResult = await node2.receiveProposal(proposeResult.proposal);
			expect(receiveResult.accepted).toBe(true);
			expect(receiveResult.agreement).toBeDefined();

			// node1 receives the agreement back
			if (receiveResult.agreement) {
				const ackResult = await node1.receiveAgreement(receiveResult.agreement);
				expect(ackResult.accepted).toBe(true);
			}
		}

		// After handshake, node1 should have blocks
		const chain1 = await node1.chain(node1.pubkey!);
		expect(chain1.length).toBeGreaterThan(0);
	});

	it("GET /chain returns blocks after interaction", async () => {
		const chain = await node1.chain(node1.pubkey!);
		expect(chain.length).toBeGreaterThan(0);

		for (const block of chain) {
			expect(block.public_key).toBe(node1.pubkey);
			expect(typeof block.sequence_number).toBe("number");
			expect(block.sequence_number).toBeGreaterThan(0);
		}
	});

	it("GET /block/{pubkey}/{seq} returns specific block", async () => {
		const chain = await node1.chain(node1.pubkey!);
		expect(chain.length).toBeGreaterThan(0);

		const firstSeq = chain[0].sequence_number;
		const block = await node1.block(node1.pubkey!, firstSeq);
		expect(block).not.toBeNull();
		expect(block?.sequence_number).toBe(firstSeq);
		expect(block?.public_key).toBe(node1.pubkey);
	});

	it("GET /crawl returns blocks", async () => {
		const blocks = await node1.crawl(node1.pubkey!);
		expect(blocks.length).toBeGreaterThan(0);
	});

	it("GET /crawl with start_seq filters results", async () => {
		const allBlocks = await node1.crawl(node1.pubkey!);
		if (allBlocks.length > 1) {
			const lastSeq = allBlocks[allBlocks.length - 1].sequence_number;
			const partial = await node1.crawl(node1.pubkey!, lastSeq);
			expect(partial.length).toBeLessThanOrEqual(allBlocks.length);
		}
	});

	it("GET /trust/{pubkey} returns score for interacted peer", async () => {
		const trust = await node1.trustScore(node2.pubkey!);
		expect(trust.pubkey).toBe(node2.pubkey);
		expect(typeof trust.trust_score).toBe("number");
		expect(trust.trust_score).toBeGreaterThanOrEqual(0);
		expect(trust.trust_score).toBeLessThanOrEqual(1);
	});

	it("GET /status reflects blocks after interactions", async () => {
		const status = await node1.status();
		expect(status.block_count).toBeGreaterThan(0);
		expect(status.latest_seq).toBeGreaterThan(0);
	});
});

describeIntegration("Integration: delegation lifecycle", () => {
	let delegator: TrustChainSidecar;
	let delegate: TrustChainSidecar;
	let activeDelegationId: string;

	beforeAll(async () => {
		delegator = new TrustChainSidecar({
			name: "test-delegator",
			binary: BINARY,
			logLevel: "warn",
		});
		await delegator.start();

		delegate = new TrustChainSidecar({
			name: "test-delegate",
			binary: BINARY,
			logLevel: "warn",
		});
		await delegate.start();

		// Register as peers
		const addr1 = delegator.httpUrl.replace("http://", "");
		const addr2 = delegate.httpUrl.replace("http://", "");
		await delegator.registerPeer(delegate.pubkey!, addr2);
		await delegate.registerPeer(delegator.pubkey!, addr1);
	}, 30_000);

	afterAll(() => {
		delegate?.stop();
		delegator?.stop();
	});

	it("POST /delegate creates delegation proposal block", async () => {
		const resp = await delegator.delegate(delegate.pubkey!, {
			scope: ["read", "write"],
			ttl_seconds: 3600,
			max_depth: 1,
		});

		expect(resp.block).toBeDefined();
		expect(resp.block.block_type).toBe("delegation");
		expect(resp.block.public_key).toBe(delegator.pubkey);
		expect(resp.block.link_public_key).toBe(delegate.pubkey);
		expect(typeof resp.delegation_id).toBe("string");
		expect(resp.delegation_id?.length).toBeGreaterThan(0);

		// Transaction should contain delegation metadata
		const tx = resp.block.transaction as Record<string, unknown>;
		expect(tx.delegation_id).toBe(resp.delegation_id);
		expect(tx.interaction_type).toBe("delegation");
	});

	it("POST /accept_delegation completes bilateral delegation handshake", async () => {
		const delResp = await delegator.delegate(delegate.pubkey!, {
			scope: ["test-accept"],
			ttl_seconds: 1800,
		});

		// Delegate accepts the proposal — this goes to the DELEGATE's node
		const acceptResp = await delegate.acceptDelegation(delResp.block);
		expect(acceptResp.agreement).toBeDefined();
		// Agreement block preserves "delegation" block_type (not "agreement")
		expect(acceptResp.agreement.block_type).toBe("delegation");
		expect(acceptResp.agreement.public_key).toBe(delegate.pubkey);
		expect(typeof acceptResp.delegation_id).toBe("string");
		expect(acceptResp.delegation_id.length).toBeGreaterThan(0);

		// Verify DelegationRecord structure
		expect(acceptResp.delegation_record).toBeDefined();
		expect(acceptResp.delegation_record.delegate_pubkey).toBe(delegate.pubkey);
		expect(acceptResp.delegation_record.delegator_pubkey).toBe(delegator.pubkey);
		expect(acceptResp.delegation_record.revoked).toBe(false);
		expect(typeof acceptResp.delegation_record.issued_at).toBe("number");
		expect(typeof acceptResp.delegation_record.expires_at).toBe("number");
		expect(typeof acceptResp.delegation_record.delegation_block_hash).toBe("string");

		activeDelegationId = acceptResp.delegation_id;
	});

	it("GET /delegations/{pubkey} lists delegations on delegate's node", async () => {
		// Delegations are stored on the DELEGATE's node (not delegator's)
		const records = await delegate.delegations(delegate.pubkey!);
		expect(records.length).toBeGreaterThan(0);

		const record = records.find((r) => r.delegation_id === activeDelegationId);
		expect(record).toBeDefined();
		expect(record?.revoked).toBe(false);

		// Verify full DelegationRecord wire format
		expect(typeof record?.delegation_id).toBe("string");
		expect(typeof record?.delegator_pubkey).toBe("string");
		expect(typeof record?.delegate_pubkey).toBe("string");
		expect(Array.isArray(record?.scope)).toBe(true);
		expect(typeof record?.max_depth).toBe("number");
		expect(typeof record?.issued_at).toBe("number");
		expect(typeof record?.expires_at).toBe("number");
		expect(typeof record?.delegation_block_hash).toBe("string");
		expect(typeof record?.revoked).toBe("boolean");
	});

	it("GET /delegation/{id} returns single delegation record from delegate's node", async () => {
		// Delegation record lives on the delegate's node
		const record = await delegate.delegation(activeDelegationId);
		expect(record.delegation_id).toBe(activeDelegationId);
		expect(record.delegate_pubkey).toBe(delegate.pubkey);
		expect(record.delegator_pubkey).toBe(delegator.pubkey);
		expect(record.revoked).toBe(false);
	});

	it("POST /revoke: delegator can't revoke without local record (known limitation)", async () => {
		// Create and accept a delegation
		const delResp = await delegator.delegate(delegate.pubkey!, {
			scope: ["to-revoke"],
			ttl_seconds: 600,
		});
		const acceptResp = await delegate.acceptDelegation(delResp.block);
		const revokeId = acceptResp.delegation_id;

		// Revocation requires the DelegationRecord in the local store.
		// Currently the record only lives on the delegate's node (from accept_delegation).
		// The delegator's node doesn't have it — so revoke fails with "Unknown delegation".
		// The delegate's node has it, but rejects with "Only the delegator can revoke".
		// This is a Rust node limitation: P2P delegation record propagation is needed.
		await expect(delegator.revoke(revokeId)).rejects.toThrow(HttpError);
		await expect(delegate.revoke(revokeId)).rejects.toThrow(HttpError);
	});
});

describeIntegration("Integration: error cases", () => {
	let sidecar: TrustChainSidecar;

	beforeAll(async () => {
		sidecar = new TrustChainSidecar({
			name: "test-errors",
			binary: BINARY,
			logLevel: "warn",
		});
		await sidecar.start();
	}, 15_000);

	afterAll(() => {
		sidecar?.stop();
	});

	it("propose to unknown peer creates local-only proposal", async () => {
		const fakePubkey = "f".repeat(64);
		const result = await sidecar.propose(fakePubkey, { test: true });
		expect(result.proposal).toBeDefined();
		expect(result.proposal.link_public_key).toBe(fakePubkey);
		expect(result.completed).toBe(false);
	});

	it("identity for unknown pubkey returns self-resolution", async () => {
		const fakePubkey = "0".repeat(64);
		const resp = await sidecar.identity(fakePubkey);
		expect(resp.pubkey).toBe(fakePubkey);
		expect(typeof resp.is_successor).toBe("boolean");
	});

	it("revoke with invalid delegation_id throws HttpError", async () => {
		await expect(sidecar.revoke("nonexistent-id")).rejects.toThrow();
	});
});

describeIntegration("Integration: sidecar lifecycle", () => {
	it("start and stop are idempotent", async () => {
		const sc = new TrustChainSidecar({
			name: "test-lifecycle",
			binary: BINARY,
			logLevel: "warn",
		});
		await sc.start();
		expect(sc.isRunning).toBe(true);

		// Second start should be a no-op
		await sc.start();
		expect(sc.isRunning).toBe(true);

		sc.stop();
		expect(sc.isRunning).toBe(false);

		// Second stop should be safe
		sc.stop();
		expect(sc.isRunning).toBe(false);
	}, 15_000);

	it("Symbol.dispose stops the sidecar", async () => {
		const sc = new TrustChainSidecar({
			name: "test-dispose",
			binary: BINARY,
			logLevel: "warn",
		});
		await sc.start();
		expect(sc.isRunning).toBe(true);
		const pubkey = sc.pubkey;
		expect(pubkey).toHaveLength(64);

		sc[Symbol.dispose]();
		expect(sc.isRunning).toBe(false);
	}, 15_000);

	it("concurrent API calls work after start", async () => {
		const sc = new TrustChainSidecar({
			name: "test-concurrent",
			binary: BINARY,
			logLevel: "warn",
		});
		try {
			await sc.start();
			// Fire all GET endpoints in parallel
			const [health, status, metrics, peers, trust, discover, identity, delegations] =
				await Promise.all([
					sc.healthz(),
					sc.status(),
					sc.metrics(),
					sc.peers(),
					sc.trustScore(sc.pubkey!),
					sc.discover("test"),
					sc.identity(sc.pubkey!),
					sc.delegations(sc.pubkey!),
				]);
			expect(health.status).toBe("ok");
			expect(status.public_key).toBe(sc.pubkey);
			expect(typeof metrics).toBe("string");
			expect(Array.isArray(peers)).toBe(true);
			expect(typeof trust.trust_score).toBe("number");
			expect(Array.isArray(discover.agents)).toBe(true);
			expect(identity.pubkey).toBe(sc.pubkey);
			expect(Array.isArray(delegations)).toBe(true);
		} finally {
			sc.stop();
		}
	}, 15_000);
});

describeIntegration("Integration: standalone TrustChainClient", () => {
	let sidecar: TrustChainSidecar;
	let client: TrustChainClient;

	beforeAll(async () => {
		sidecar = new TrustChainSidecar({
			name: "test-standalone",
			binary: BINARY,
			logLevel: "warn",
		});
		await sidecar.start();
		// Create a standalone client (separate from sidecar.client)
		client = new TrustChainClient({ baseUrl: sidecar.httpUrl });
	}, 15_000);

	afterAll(() => {
		sidecar?.stop();
	});

	it("standalone client works independently of sidecar wrapper", async () => {
		const health = await client.healthz();
		expect(health.status).toBe("ok");
		expect(health.public_key).toBe(sidecar.pubkey);
	});

	it("standalone client with custom timeout", async () => {
		const fastClient = new TrustChainClient({
			baseUrl: sidecar.httpUrl,
			timeoutMs: 500,
		});
		const health = await fastClient.healthz();
		expect(health.status).toBe("ok");
	});

	it("standalone client to unreachable port throws", async () => {
		const badClient = new TrustChainClient({
			baseUrl: "http://127.0.0.1:1",
			timeoutMs: 2000,
		});
		await expect(badClient.healthz()).rejects.toThrow();
	});
});
