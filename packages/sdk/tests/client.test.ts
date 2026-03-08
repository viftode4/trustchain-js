import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TrustChainClient } from "../src/client.js";
import { ConnectionError, HttpError, TimeoutError } from "../src/errors.js";
import type { HalfBlock } from "../src/types.js";

const BASE_URL = "http://127.0.0.1:18202";

function makeBlock(overrides?: Partial<HalfBlock>): HalfBlock {
	return {
		public_key: "a".repeat(64),
		sequence_number: 1,
		link_public_key: "b".repeat(64),
		link_sequence_number: 0,
		previous_hash: "c".repeat(64),
		signature: "d".repeat(128),
		block_type: "proposal",
		transaction: {},
		block_hash: "e".repeat(64),
		timestamp: 1700000000000,
		...overrides,
	};
}

/** Extract URL, method, and parsed body from a mock fetch call. */
function extractCall(mockFetch: ReturnType<typeof mock>, index = 0) {
	const [url, init] = mockFetch.mock.calls[index] as [string, RequestInit | undefined];
	const method = init?.method ?? "GET";
	const body = init?.body ? JSON.parse(init.body as string) : undefined;
	return { url, method, body };
}

describe("TrustChainClient", () => {
	let client: TrustChainClient;
	let originalFetch: typeof globalThis.fetch;
	let mockFetch: ReturnType<typeof mock>;

	beforeEach(() => {
		client = new TrustChainClient({ baseUrl: BASE_URL });
		originalFetch = globalThis.fetch;
		mockFetch = mock(() => Promise.resolve(new Response("{}")));
		globalThis.fetch = mockFetch as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockJsonResponse(data: unknown, status = 200) {
		mockFetch.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(data), {
					status,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);
	}

	function mockTextResponse(text: string, status = 200) {
		mockFetch.mockImplementation(() =>
			Promise.resolve(
				new Response(text, {
					status,
					headers: { "Content-Type": "text/plain" },
				}),
			),
		);
	}

	// --- Core endpoints ---

	it("status() sends GET /status", async () => {
		const data = {
			public_key: "a".repeat(64),
			latest_seq: 5,
			block_count: 10,
			peer_count: 2,
		};
		mockJsonResponse(data);
		const resp = await client.status();
		expect(resp).toEqual(data);
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/status`);
		expect(method).toBe("GET");
	});

	it("healthz() sends GET /healthz", async () => {
		const data = { status: "ok", public_key: "a".repeat(64) };
		mockJsonResponse(data);
		const resp = await client.healthz();
		expect(resp.status).toBe("ok");
		expect(resp.public_key).toBe("a".repeat(64));
		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/healthz`);
		expect(method).toBe("GET");
	});

	it("metrics() sends GET /metrics and returns raw text", async () => {
		const text = "# HELP trustchain_block_count\ntrustchain_block_count 42\n";
		mockTextResponse(text);
		const resp = await client.metrics();
		expect(resp).toContain("trustchain_block_count 42");
		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/metrics`);
		expect(method).toBe("GET");
	});

	// --- Block operations ---

	it("propose() sends POST /propose with snake_case body", async () => {
		const proposal = makeBlock();
		mockJsonResponse({ proposal, agreement: null, completed: true });
		const resp = await client.propose("b".repeat(64), { action: "test" });
		expect(resp.completed).toBe(true);
		expect(resp.proposal).toEqual(proposal);

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/propose`);
		expect(method).toBe("POST");
		expect(body).toEqual({
			counterparty_pubkey: "b".repeat(64),
			transaction: { action: "test" },
		});
	});

	it("propose() defaults transaction to empty object", async () => {
		mockJsonResponse({ proposal: makeBlock(), completed: false });
		await client.propose("b".repeat(64));
		const { body } = extractCall(mockFetch);
		expect(body.transaction).toEqual({});
	});

	it("receiveProposal() sends POST /receive_proposal with wrapped body", async () => {
		const block = makeBlock();
		mockJsonResponse({ accepted: true, agreement: makeBlock({ block_type: "agreement" }) });
		const resp = await client.receiveProposal(block);
		expect(resp.accepted).toBe(true);
		expect(resp.agreement).toBeDefined();

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/receive_proposal`);
		expect(method).toBe("POST");
		expect(body).toEqual({ proposal: block });
	});

	it("receiveAgreement() sends POST /receive_agreement with wrapped body", async () => {
		const agreement = makeBlock({ block_type: "agreement" });
		mockJsonResponse({ accepted: true });
		const resp = await client.receiveAgreement(agreement);
		expect(resp.accepted).toBe(true);

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/receive_agreement`);
		expect(method).toBe("POST");
		expect(body).toEqual({ agreement });
	});

	it("chain() with pubkey sends GET /chain/{pubkey}", async () => {
		const blocks = [makeBlock()];
		mockJsonResponse({ blocks });
		const resp = await client.chain("a".repeat(64));
		expect(resp).toHaveLength(1);
		expect(resp[0].block_type).toBe("proposal");

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/chain/${"a".repeat(64)}`);
		expect(method).toBe("GET");
	});

	it("chain() without pubkey fetches status first then chain", async () => {
		let callCount = 0;
		mockFetch.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							public_key: "f".repeat(64),
							latest_seq: 1,
							block_count: 1,
							peer_count: 0,
						}),
					),
				);
			}
			return Promise.resolve(new Response(JSON.stringify({ blocks: [makeBlock()] })));
		});

		const resp = await client.chain();
		expect(resp).toHaveLength(1);
		expect(callCount).toBe(2);

		// First call: GET /status
		const call1 = extractCall(mockFetch, 0);
		expect(call1.url).toBe(`${BASE_URL}/status`);
		expect(call1.method).toBe("GET");

		// Second call: GET /chain/{pubkey from status}
		const call2 = extractCall(mockFetch, 1);
		expect(call2.url).toBe(`${BASE_URL}/chain/${"f".repeat(64)}`);
		expect(call2.method).toBe("GET");
	});

	it("block() sends GET /block/{pubkey}/{seq}", async () => {
		mockJsonResponse({ block: makeBlock() });
		const resp = await client.block("a".repeat(64), 1);
		expect(resp).not.toBeNull();
		expect(resp?.sequence_number).toBe(1);

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/block/${"a".repeat(64)}/1`);
		expect(method).toBe("GET");
	});

	it("block() returns null when not found", async () => {
		mockJsonResponse({ block: null });
		const resp = await client.block("a".repeat(64), 999);
		expect(resp).toBeNull();
	});

	it("crawl() sends GET /crawl/{pubkey} without startSeq", async () => {
		mockJsonResponse({ blocks: [] });
		const resp = await client.crawl("a".repeat(64));
		expect(resp).toEqual([]);

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/crawl/${"a".repeat(64)}`);
		expect(method).toBe("GET");
	});

	it("crawl() appends ?start_seq when provided", async () => {
		mockJsonResponse({ blocks: [makeBlock()] });
		const resp = await client.crawl("a".repeat(64), 5);
		expect(resp).toHaveLength(1);

		const { url } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/crawl/${"a".repeat(64)}?start_seq=5`);
	});

	// --- Audit batch & report ---

	it("auditBatch() sends POST /audit-batch with entries array", async () => {
		const blocks = [
			makeBlock({ block_type: "audit" }),
			makeBlock({ block_type: "audit", sequence_number: 2 }),
		];
		mockJsonResponse({ blocks, count: 2 });
		const entries = [
			{ event_type: "tool_call", timestamp: 1700000000000 },
			{ event_type: "error", timestamp: 1700000001000 },
		];
		const resp = await client.auditBatch(entries);
		expect(resp.count).toBe(2);
		expect(resp.blocks).toHaveLength(2);

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/audit-batch`);
		expect(method).toBe("POST");
		expect(body).toEqual({ entries });
	});

	it("auditBatch() sends empty entries array", async () => {
		mockJsonResponse({ blocks: [], count: 0 });
		const resp = await client.auditBatch([]);
		expect(resp.count).toBe(0);
		expect(resp.blocks).toEqual([]);

		const { body } = extractCall(mockFetch);
		expect(body).toEqual({ entries: [] });
	});

	it("auditReport() sends GET /audit-report", async () => {
		const data = {
			total_blocks: 42,
			audit_blocks: 30,
			bilateral_blocks: 12,
			integrity_valid: true,
			integrity_score: 1.0,
			event_type_breakdown: { tool_call: 20, error: 10 },
			first_timestamp: 1700000000000,
			last_timestamp: 1700000099000,
			chain_length: 42,
		};
		mockJsonResponse(data);
		const resp = await client.auditReport();
		expect(resp.total_blocks).toBe(42);
		expect(resp.integrity_valid).toBe(true);
		expect(resp.event_type_breakdown.tool_call).toBe(20);

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/audit-report`);
		expect(method).toBe("GET");
	});

	it("exportChain() sends GET /export-chain", async () => {
		const data = {
			pubkey: "a".repeat(64),
			chain: [makeBlock({ block_type: "audit" })],
			exported_at: 1700000000000,
			chain_hash: "f".repeat(64),
			signature: "s".repeat(128),
		};
		mockJsonResponse(data);
		const resp = await client.exportChain();
		expect(resp.pubkey).toBe("a".repeat(64));
		expect(resp.chain).toHaveLength(1);
		expect(resp.chain_hash).toBe("f".repeat(64));
		expect(resp.signature).toBe("s".repeat(128));

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/export-chain`);
		expect(method).toBe("GET");
	});

	// --- Peer management ---

	it("peers() sends GET /peers", async () => {
		const peerData = [{ pubkey: "a".repeat(64), address: "1.2.3.4:18200", latest_seq: 3 }];
		mockJsonResponse(peerData);
		const resp = await client.peers();
		expect(resp).toHaveLength(1);
		expect(resp[0].pubkey).toBe("a".repeat(64));
		expect(resp[0].address).toBe("1.2.3.4:18200");

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/peers`);
		expect(method).toBe("GET");
	});

	it("registerPeer() sends POST /peers with body", async () => {
		mockJsonResponse({ status: "ok" });
		const resp = await client.registerPeer("a".repeat(64), "1.2.3.4:18200");
		expect(resp.status).toBe("ok");

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/peers`);
		expect(method).toBe("POST");
		expect(body).toEqual({ pubkey: "a".repeat(64), address: "1.2.3.4:18200" });
	});

	// --- Trust ---

	it("trustScore() sends GET /trust/{pubkey}", async () => {
		const data = {
			pubkey: "a".repeat(64),
			trust_score: 0.85,
			interaction_count: 5,
			block_count: 10,
		};
		mockJsonResponse(data);
		const resp = await client.trustScore("a".repeat(64));
		expect(resp.trust_score).toBe(0.85);
		expect(resp.interaction_count).toBe(5);

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/trust/${"a".repeat(64)}`);
		expect(method).toBe("GET");
	});

	it("discover() sends GET /discover with query params", async () => {
		mockJsonResponse({ agents: [], queried_peers: 3 });
		await client.discover("math", { min_trust: 0.5, max_results: 10, fan_out: 3 });

		const { url, method } = extractCall(mockFetch);
		expect(method).toBe("GET");
		expect(url).toContain("/discover?");
		expect(url).toContain("capability=math");
		expect(url).toContain("min_trust=0.5");
		expect(url).toContain("max_results=10");
		expect(url).toContain("fan_out=3");
	});

	it("discover() omits undefined options from query", async () => {
		mockJsonResponse({ agents: [], queried_peers: 0 });
		await client.discover("code");
		const { url } = extractCall(mockFetch);
		expect(url).toContain("capability=code");
		expect(url).not.toContain("min_trust");
		expect(url).not.toContain("max_results");
		expect(url).not.toContain("fan_out");
	});

	// --- Delegation ---

	it("delegate() sends POST /delegate with snake_case body", async () => {
		mockJsonResponse({
			block: makeBlock({ block_type: "delegation" }),
			delegation_id: "del-123",
		});
		const resp = await client.delegate("b".repeat(64), {
			scope: ["read"],
			ttl_seconds: 7200,
			max_depth: 2,
		});
		expect(resp.delegation_id).toBe("del-123");

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/delegate`);
		expect(method).toBe("POST");
		expect(body).toEqual({
			delegate_pubkey: "b".repeat(64),
			scope: ["read"],
			ttl_seconds: 7200,
			max_depth: 2,
		});
	});

	it("delegate() without options sends only delegate_pubkey", async () => {
		mockJsonResponse({
			block: makeBlock({ block_type: "delegation" }),
		});
		await client.delegate("b".repeat(64));
		const { body } = extractCall(mockFetch);
		expect(body).toEqual({ delegate_pubkey: "b".repeat(64) });
	});

	it("acceptDelegation() sends POST /accept_delegation with proposal_block wrapper", async () => {
		const proposal = makeBlock({ block_type: "delegation" });
		mockJsonResponse({
			agreement: makeBlock({ block_type: "delegation" }),
			delegation_id: "del-456",
			delegation_record: {
				delegation_id: "del-456",
				delegator_pubkey: "a".repeat(64),
				delegate_pubkey: "b".repeat(64),
				scope: [],
				max_depth: 0,
				issued_at: 1700000000000,
				expires_at: 1700003600000,
				delegation_block_hash: "f".repeat(64),
				agreement_block_hash: "e".repeat(64),
				parent_delegation_id: null,
				revoked: false,
				revocation_block_hash: null,
			},
		});
		const resp = await client.acceptDelegation(proposal);
		expect(resp.delegation_id).toBe("del-456");

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/accept_delegation`);
		expect(method).toBe("POST");
		expect(body).toEqual({ proposal_block: proposal });
	});

	it("revoke() sends POST /revoke with delegation_id", async () => {
		mockJsonResponse({
			block: makeBlock({ block_type: "revocation" }),
		});
		const resp = await client.revoke("del-123");
		expect(resp.block.block_type).toBe("revocation");

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/revoke`);
		expect(method).toBe("POST");
		expect(body).toEqual({ delegation_id: "del-123" });
	});

	it("delegations() sends GET /delegations/{pubkey}", async () => {
		const records = [
			{
				delegation_id: "del-1",
				delegator_pubkey: "a".repeat(64),
				delegate_pubkey: "b".repeat(64),
				scope: [],
				max_depth: 0,
				issued_at: 1700000000000,
				expires_at: 1700003600000,
				delegation_block_hash: "f".repeat(64),
				agreement_block_hash: "e".repeat(64),
				parent_delegation_id: null,
				revoked: false,
				revocation_block_hash: null,
			},
		];
		mockJsonResponse(records);
		const resp = await client.delegations("a".repeat(64));
		expect(resp).toHaveLength(1);
		expect(resp[0].delegation_id).toBe("del-1");

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/delegations/${"a".repeat(64)}`);
		expect(method).toBe("GET");
	});

	it("delegation() sends GET /delegation/{id}", async () => {
		const record = {
			delegation_id: "del-42",
			delegator_pubkey: "a".repeat(64),
			delegate_pubkey: "b".repeat(64),
			scope: ["read"],
			max_depth: 1,
			issued_at: 1700000000000,
			expires_at: 1700003600000,
			delegation_block_hash: "f".repeat(64),
			agreement_block_hash: "e".repeat(64),
			parent_delegation_id: null,
			revoked: false,
			revocation_block_hash: null,
		};
		mockJsonResponse(record);
		const resp = await client.delegation("del-42");
		expect(resp.delegation_id).toBe("del-42");
		expect(resp.scope).toEqual(["read"]);

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/delegation/del-42`);
		expect(method).toBe("GET");
	});

	// --- Succession ---

	it("acceptSuccession() sends POST /accept_succession with proposal_block wrapper", async () => {
		const proposal = makeBlock({ block_type: "succession" });
		mockJsonResponse({
			agreement: makeBlock({ block_type: "agreement" }),
			succession_id: "succ-1",
		});
		const resp = await client.acceptSuccession(proposal);
		expect(resp.succession_id).toBe("succ-1");

		const { url, method, body } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/accept_succession`);
		expect(method).toBe("POST");
		expect(body).toEqual({ proposal_block: proposal });
	});

	// --- Identity ---

	it("identity() sends GET /identity/{pubkey}", async () => {
		const data = {
			pubkey: "a".repeat(64),
			resolved_pubkey: "a".repeat(64),
			is_successor: false,
		};
		mockJsonResponse(data);
		const resp = await client.identity("a".repeat(64));
		expect(resp.is_successor).toBe(false);
		expect(resp.resolved_pubkey).toBe("a".repeat(64));

		const { url, method } = extractCall(mockFetch);
		expect(url).toBe(`${BASE_URL}/identity/${"a".repeat(64)}`);
		expect(method).toBe("GET");
	});

	// --- Error handling ---

	it("throws HttpError on 404", async () => {
		mockFetch.mockImplementation(() =>
			Promise.resolve(new Response(JSON.stringify({ error: "not found" }), { status: 404 })),
		);
		await expect(client.status()).rejects.toBeInstanceOf(HttpError);

		try {
			await client.status();
		} catch (e) {
			expect(e).toBeInstanceOf(HttpError);
			expect((e as HttpError).status).toBe(404);
		}
	});

	it("throws HttpError on 500", async () => {
		mockFetch.mockImplementation(() =>
			Promise.resolve(new Response("internal server error", { status: 500 })),
		);
		await expect(client.healthz()).rejects.toBeInstanceOf(HttpError);
	});

	it("throws ConnectionError on network failure", async () => {
		mockFetch.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
		await expect(client.status()).rejects.toBeInstanceOf(ConnectionError);
	});

	it("ConnectionError wraps the original cause", async () => {
		const cause = new TypeError("ECONNREFUSED");
		mockFetch.mockImplementation(() => Promise.reject(cause));

		try {
			await client.status();
		} catch (e) {
			expect(e).toBeInstanceOf(ConnectionError);
			expect((e as ConnectionError).cause).toBe(cause);
		}
	});

	it("strips trailing slash from baseUrl", async () => {
		const c = new TrustChainClient({ baseUrl: "http://localhost:8080/" });
		mockJsonResponse({ status: "ok", public_key: "a".repeat(64) });
		await c.healthz();
		const { url } = extractCall(mockFetch);
		expect(url).toBe("http://localhost:8080/healthz");
	});

	it("strips multiple trailing slashes", async () => {
		const c = new TrustChainClient({ baseUrl: "http://localhost:8080///" });
		mockJsonResponse({});
		await c.status();
		const { url } = extractCall(mockFetch);
		expect(url).toBe("http://localhost:8080/status");
	});

	it("sets Content-Type header on POST requests", async () => {
		mockJsonResponse({ proposal: makeBlock(), completed: false });
		await client.propose("b".repeat(64));

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("passes AbortSignal.timeout for timeouts", async () => {
		const c = new TrustChainClient({ baseUrl: BASE_URL, timeoutMs: 5000 });
		mockJsonResponse({});
		await c.status();

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(init.signal).toBeDefined();
	});
});
