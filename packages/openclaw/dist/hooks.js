/**
 * Create event hooks for automatic interaction recording.
 */
export function createHooks(getClient, log, autoRecord) {
    if (!autoRecord)
        return [];
    return [
        {
            event: "command:complete",
            handler: async (data) => {
                const event = data;
                if (!event.counterpartyPubkey)
                    return;
                try {
                    const client = getClient();
                    const transaction = {
                        interaction_type: event.interactionType ?? "tool_call",
                        outcome: event.outcome ?? "success",
                    };
                    await client.propose(event.counterpartyPubkey, transaction);
                    log.debug(`Auto-recorded interaction with ${event.counterpartyPubkey.slice(0, 16)}...`);
                }
                catch (e) {
                    log.warn(`Failed to auto-record interaction: ${e instanceof Error ? e.message : String(e)}`);
                }
            },
        },
    ];
}
//# sourceMappingURL=hooks.js.map