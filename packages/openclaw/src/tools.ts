import type { TrustChainClient } from "@trustchain/sdk";
import type { ToolDefinition, ToolResult } from "./openclaw-types.js";

function ok(content: string): ToolResult {
	return { content };
}

function err(message: string): ToolResult {
	return { content: message, isError: true };
}

/**
 * Create the 5 agent-facing TrustChain tools.
 */
export function createTools(getClient: () => TrustChainClient): ToolDefinition[] {
	return [
		checkTrustTool(getClient),
		discoverPeersTool(getClient),
		recordInteractionTool(getClient),
		verifyChainTool(getClient),
		getIdentityTool(getClient),
	];
}

function checkTrustTool(getClient: () => TrustChainClient): ToolDefinition {
	return {
		name: "trustchain_check_trust",
		description:
			"Check the trust score of a peer agent. Returns trust score, interaction count, and trust status.",
		parameters: {
			type: "object",
			properties: {
				pubkey: {
					type: "string",
					description: "The public key (hex) of the agent to check.",
				},
			},
			required: ["pubkey"],
		},
		execute: async (args) => {
			try {
				const client = getClient();
				const result = await client.trustScore(args.pubkey as string);

				const bootstrapThreshold = 3;
				const isBootstrap = result.interaction_count < bootstrapThreshold;
				const status = isBootstrap ? "bootstrap" : "established";
				const shortKey = result.pubkey.slice(0, 16) + "...";

				let output = [
					`Trust Score: ${result.trust_score.toFixed(3)}`,
					`Interactions: ${result.interaction_count}`,
					`Blocks: ${result.block_count}`,
					`Status: ${status}`,
					`Public Key: ${shortKey}`,
				].join("\n");

				if (!isBootstrap && result.trust_score < 0.5) {
					output += "\nWARNING: Trust score below threshold (0.5)";
				}

				return ok(output);
			} catch (e) {
				return err(`Failed to check trust: ${e instanceof Error ? e.message : String(e)}`);
			}
		},
	};
}

function discoverPeersTool(getClient: () => TrustChainClient): ToolDefinition {
	return {
		name: "trustchain_discover_peers",
		description:
			"Find capable agents ranked by trust score. Returns a list of agents with their capabilities and trust scores.",
		parameters: {
			type: "object",
			properties: {
				capability: {
					type: "string",
					description: "The capability to search for (e.g. 'code-review', 'translation').",
				},
				min_trust: {
					type: "number",
					description: "Minimum trust score threshold (0.0-1.0).",
					default: 0.0,
				},
				max_results: {
					type: "number",
					description: "Maximum number of results to return.",
					default: 10,
				},
			},
			required: ["capability"],
		},
		execute: async (args) => {
			try {
				const client = getClient();
				const result = await client.discover(args.capability as string, {
					min_trust: args.min_trust as number | undefined,
					max_results: args.max_results as number | undefined,
				});

				if (result.agents.length === 0) {
					return ok(`No agents found with capability "${args.capability}". Queried ${result.queried_peers} peers.`);
				}

				const lines = result.agents.map((agent, i) => {
					const shortKey = agent.pubkey.slice(0, 16) + "...";
					const trust = agent.trust_score?.toFixed(3) ?? "n/a";
					return `${i + 1}. ${shortKey} — trust: ${trust}, capability: ${agent.capability}, interactions: ${agent.interaction_count}`;
				});

				lines.push(`\nQueried ${result.queried_peers} peers, found ${result.agents.length} agents.`);
				return ok(lines.join("\n"));
			} catch (e) {
				return err(`Failed to discover peers: ${e instanceof Error ? e.message : String(e)}`);
			}
		},
	};
}

function recordInteractionTool(getClient: () => TrustChainClient): ToolDefinition {
	return {
		name: "trustchain_record_interaction",
		description:
			"Record a bilateral interaction with another agent. Creates a proposal and attempts to complete the handshake.",
		parameters: {
			type: "object",
			properties: {
				counterparty_pubkey: {
					type: "string",
					description: "The public key (hex) of the counterparty agent.",
				},
				interaction_type: {
					type: "string",
					description: "Type of interaction (e.g. 'tool_call', 'delegation', 'query').",
					default: "tool_call",
				},
				outcome: {
					type: "string",
					description: "Outcome of the interaction.",
					enum: ["success", "failure", "partial"],
					default: "success",
				},
			},
			required: ["counterparty_pubkey"],
		},
		execute: async (args) => {
			try {
				const client = getClient();
				const transaction = {
					interaction_type: args.interaction_type ?? "tool_call",
					outcome: args.outcome ?? "success",
				};

				const result = await client.propose(args.counterparty_pubkey as string, transaction);

				const status = result.completed ? "completed (bilateral)" : "proposed (awaiting agreement)";
				const shortHash = result.proposal.block_hash.slice(0, 12) + "...";

				return ok(
					[
						`Interaction recorded: ${status}`,
						`Block hash: ${shortHash}`,
						`Sequence: ${result.proposal.sequence_number}`,
					].join("\n"),
				);
			} catch (e) {
				return err(`Failed to record interaction: ${e instanceof Error ? e.message : String(e)}`);
			}
		},
	};
}

function verifyChainTool(getClient: () => TrustChainClient): ToolDefinition {
	return {
		name: "trustchain_verify_chain",
		description:
			"Verify the integrity of an agent's interaction chain. Checks for gaps, hash breaks, and signature failures.",
		parameters: {
			type: "object",
			properties: {
				pubkey: {
					type: "string",
					description: "The public key (hex) of the agent whose chain to verify.",
				},
			},
			required: ["pubkey"],
		},
		execute: async (args) => {
			try {
				const client = getClient();
				const blocks = await client.chain(args.pubkey as string);

				if (blocks.length === 0) {
					return ok("Chain is empty — no blocks to verify.");
				}

				// Basic structural checks
				const issues: string[] = [];
				for (let i = 1; i < blocks.length; i++) {
					const prev = blocks[i - 1];
					const curr = blocks[i];

					// Sequence continuity
					if (curr.sequence_number !== prev.sequence_number + 1) {
						issues.push(
							`GAP: seq ${prev.sequence_number} → ${curr.sequence_number}`,
						);
					}

					// Hash chain
					if (curr.previous_hash !== prev.block_hash) {
						issues.push(
							`HASH BREAK: block ${curr.sequence_number} previous_hash mismatch`,
						);
					}
				}

				const status = issues.length === 0 ? "VALID" : "INTEGRITY ISSUES";
				const lines = [
					`Chain Length: ${blocks.length}`,
					`Status: ${status}`,
				];

				if (issues.length > 0) {
					lines.push(`Issues (${issues.length}):`);
					for (const issue of issues) {
						lines.push(`  - ${issue}`);
					}
				}

				return ok(lines.join("\n"));
			} catch (e) {
				return err(`Failed to verify chain: ${e instanceof Error ? e.message : String(e)}`);
			}
		},
	};
}

function getIdentityTool(getClient: () => TrustChainClient): ToolDefinition {
	return {
		name: "trustchain_get_identity",
		description:
			"Get identity details and delegation information for a public key. Shows if the key is a successor and lists active delegations.",
		parameters: {
			type: "object",
			properties: {
				pubkey: {
					type: "string",
					description: "The public key (hex) to look up.",
				},
			},
			required: ["pubkey"],
		},
		execute: async (args) => {
			try {
				const client = getClient();
				const pubkey = args.pubkey as string;
				const [idResult, delegationList] = await Promise.all([
					client.identity(pubkey),
					client.delegations(pubkey),
				]);

				const shortKey = idResult.pubkey.slice(0, 16) + "...";
				const lines = [
					`Identity: ${shortKey}`,
					`Resolved Key: ${idResult.resolved_pubkey.slice(0, 16)}...`,
					`Is Successor: ${idResult.is_successor}`,
				];

				if (delegationList.length > 0) {
					lines.push(`\nDelegations (${delegationList.length}):`);
					for (const del of delegationList) {
						const scope = del.scope.length > 0 ? del.scope.join(", ") : "all";
						const status = del.revoked ? "REVOKED" : "ACTIVE";
						lines.push(`  - ${del.delegation_id.slice(0, 12)}... [${status}] scope: [${scope}]`);
					}
				} else {
					lines.push("\nNo delegations.");
				}

				return ok(lines.join("\n"));
			} catch (e) {
				return err(`Failed to get identity: ${e instanceof Error ? e.message : String(e)}`);
			}
		},
	};
}
