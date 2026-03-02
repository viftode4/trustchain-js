import type { TrustChainClient } from "@trustchain/sdk";
import type { EventHook, Logger } from "./openclaw-types.js";

interface CommandCompleteData {
	counterpartyPubkey?: string;
	interactionType?: string;
	outcome?: string;
}

/**
 * Create event hooks for automatic interaction recording.
 */
export function createHooks(
	getClient: () => TrustChainClient,
	log: Logger,
	autoRecord: boolean,
): EventHook[] {
	if (!autoRecord) return [];

	return [
		{
			event: "command:complete",
			handler: async (data: unknown) => {
				const event = data as CommandCompleteData;
				if (!event.counterpartyPubkey) return;

				try {
					const client = getClient();
					const transaction = {
						interaction_type: event.interactionType ?? "tool_call",
						outcome: event.outcome ?? "success",
					};
					await client.propose(event.counterpartyPubkey, transaction);
					log.debug(`Auto-recorded interaction with ${event.counterpartyPubkey.slice(0, 16)}...`);
				} catch (e) {
					log.warn(`Failed to auto-record interaction: ${e instanceof Error ? e.message : String(e)}`);
				}
			},
		},
	];
}
