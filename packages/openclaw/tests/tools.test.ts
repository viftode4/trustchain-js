import { describe, expect, it, mock } from "bun:test";
import type { TrustChainClient } from "@trustchain/sdk";
import type {
	DelegationRecord,
	DiscoverResponse,
	HalfBlock,
	IdentityResponse,
	ProposeResponse,
	TrustScoreResponse,
} from "@trustchain/sdk";
import { createTools } from "../src/tools.js";

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

function createMockClient(overrides?: Partial<TrustChainClient>): TrustChainClient {
	return {
		trustScore: mock(() =>
			Promise.resolve({
				pubkey: "a".repeat(64),
				trust_score: 0.85,
				interaction_count: 5,
				block_count: 10,
			} satisfies TrustScoreResponse),
		),
		discover: mock(() =>
			Promise.resolve({
				agents: [
					{
						pubkey: "b".repeat(64),
						address: "1.2.3.4:18200",
						capability: "code-review",
						interaction_count: 5,
						trust_score: 0.9,
					},
				],
				queried_peers: 3,
			} satisfies DiscoverResponse),
		),
		propose: mock(() =>
			Promise.resolve({
				proposal: makeBlock(),
				completed: true,
			} satisfies ProposeResponse),
		),
		chain: mock(() => Promise.resolve([makeBlock()])),
		identity: mock(() =>
			Promise.resolve({
				pubkey: "a".repeat(64),
				resolved_pubkey: "a".repeat(64),
				is_successor: false,
			} satisfies IdentityResponse),
		),
		delegations: mock(() =>
			Promise.resolve([
				{
					delegation_id: `del-${"1".repeat(60)}`,
					delegator_pubkey: "a".repeat(64),
					delegate_pubkey: "b".repeat(64),
					scope: ["read"],
					max_depth: 0,
					issued_at: 1700000000000,
					expires_at: 1700003600000,
					delegation_block_hash: "f".repeat(64),
					agreement_block_hash: "e".repeat(64),
					parent_delegation_id: null,
					revoked: false,
					revocation_block_hash: null,
				},
			] satisfies DelegationRecord[]),
		),
		...overrides,
	} as unknown as TrustChainClient;
}

describe("TrustChain OpenClaw tools", () => {
	describe("trustchain_check_trust", () => {
		it("returns trust score info", async () => {
			const client = createMockClient();
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_check_trust")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });

			expect(result.isError).toBeUndefined();
			expect(result.content).toContain("Trust Score: 0.850");
			expect(result.content).toContain("Interactions: 5");
			expect(result.content).toContain("Status: established");
		});

		it("shows bootstrap status for few interactions", async () => {
			const client = createMockClient({
				trustScore: mock(() =>
					Promise.resolve({
						pubkey: "a".repeat(64),
						trust_score: 0.3,
						interaction_count: 1,
						block_count: 2,
					}),
				),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_check_trust")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("Status: bootstrap");
			expect(result.content).not.toContain("WARNING");
		});

		it("shows warning for low trust established agent", async () => {
			const client = createMockClient({
				trustScore: mock(() =>
					Promise.resolve({
						pubkey: "a".repeat(64),
						trust_score: 0.2,
						interaction_count: 10,
						block_count: 20,
					}),
				),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_check_trust")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("WARNING");
		});

		it("returns error on failure", async () => {
			const client = createMockClient({
				trustScore: mock(() => Promise.reject(new Error("connection refused"))),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_check_trust")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.isError).toBe(true);
			expect(result.content).toContain("connection refused");
		});
	});

	describe("trustchain_discover_peers", () => {
		it("returns discovered agents", async () => {
			const client = createMockClient();
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_discover_peers")!;

			const result = await tool.execute({ capability: "code-review" });

			expect(result.isError).toBeUndefined();
			expect(result.content).toContain("trust: 0.900");
			expect(result.content).toContain("capability: code-review");
			expect(result.content).toContain("interactions: 5");
			expect(result.content).toContain("found 1 agents");
		});

		it("reports no agents found", async () => {
			const client = createMockClient({
				discover: mock(() => Promise.resolve({ agents: [], queried_peers: 5 })),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_discover_peers")!;

			const result = await tool.execute({ capability: "rare-skill" });
			expect(result.content).toContain("No agents found");
		});
	});

	describe("trustchain_record_interaction", () => {
		it("records a completed interaction", async () => {
			const client = createMockClient();
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_record_interaction")!;

			const result = await tool.execute({
				counterparty_pubkey: "b".repeat(64),
				interaction_type: "tool_call",
				outcome: "success",
			});

			expect(result.isError).toBeUndefined();
			expect(result.content).toContain("completed (bilateral)");
			expect(result.content).toContain("Sequence: 1");
		});
	});

	describe("trustchain_verify_chain", () => {
		it("reports valid chain", async () => {
			const client = createMockClient();
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_verify_chain")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("Status: VALID");
			expect(result.content).toContain("Chain Length: 1");
		});

		it("detects sequence gaps", async () => {
			const block1 = makeBlock({ sequence_number: 1, block_hash: "f".repeat(64) });
			const block2 = makeBlock({
				sequence_number: 3, // gap!
				previous_hash: "f".repeat(64),
			});
			const client = createMockClient({
				chain: mock(() => Promise.resolve([block1, block2])),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_verify_chain")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("INTEGRITY ISSUES");
			expect(result.content).toContain("GAP");
		});

		it("detects hash breaks", async () => {
			const block1 = makeBlock({ sequence_number: 1, block_hash: "f".repeat(64) });
			const block2 = makeBlock({
				sequence_number: 2,
				previous_hash: "0".repeat(64), // wrong!
			});
			const client = createMockClient({
				chain: mock(() => Promise.resolve([block1, block2])),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_verify_chain")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("HASH BREAK");
		});

		it("reports empty chain", async () => {
			const client = createMockClient({
				chain: mock(() => Promise.resolve([])),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_verify_chain")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("empty");
		});
	});

	describe("trustchain_get_identity", () => {
		it("returns identity with delegations", async () => {
			const client = createMockClient();
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_get_identity")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });

			expect(result.isError).toBeUndefined();
			expect(result.content).toContain("Is Successor: false");
			expect(result.content).toContain("Delegations (1)");
			expect(result.content).toContain("ACTIVE");
			expect(result.content).toContain("scope: [read]");
		});

		it("shows no delegations message", async () => {
			const client = createMockClient({
				delegations: mock(() => Promise.resolve([])),
			} as unknown as Partial<TrustChainClient>);
			const tools = createTools(() => client);
			const tool = tools.find((t) => t.name === "trustchain_get_identity")!;

			const result = await tool.execute({ pubkey: "a".repeat(64) });
			expect(result.content).toContain("No delegations");
		});
	});

	it("creates exactly 5 tools", () => {
		const client = createMockClient();
		const tools = createTools(() => client);
		expect(tools).toHaveLength(5);

		const names = tools.map((t) => t.name);
		expect(names).toContain("trustchain_check_trust");
		expect(names).toContain("trustchain_discover_peers");
		expect(names).toContain("trustchain_record_interaction");
		expect(names).toContain("trustchain_verify_chain");
		expect(names).toContain("trustchain_get_identity");
	});
});
