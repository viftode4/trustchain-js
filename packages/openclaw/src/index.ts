import type { PluginAPI } from "./openclaw-types.js";
import { SidecarService } from "./service.js";
import { createTools } from "./tools.js";

export { SidecarService } from "./service.js";
export { createTools } from "./tools.js";
export { createHooks } from "./hooks.js";

/**
 * OpenClaw plugin entry point.
 * Uses the api.registerTool() pattern expected by OpenClaw.
 */
export default function (api: PluginAPI) {
	const config = api.config ?? {};
	const log = api.log ?? {
		info: console.log,
		warn: console.warn,
		error: console.error,
		debug: console.debug,
	};

	const service = new SidecarService(log);
	const autoStart = (config.autoStart as boolean) ?? true;

	// Register each tool with the OpenClaw API
	const tools = createTools(() => service.getClient());
	for (const tool of tools) {
		api.registerTool(
			{
				name: tool.name,
				label: tool.label,
				description: tool.description,
				parameters: tool.parameters,
				async execute(_id: string, params: Record<string, unknown>) {
					const result = await tool.execute(params);
					return {
						content: [{ type: "text", text: result.content }],
					};
				},
			},
			{ optional: true },
		);
	}

	// Auto-start sidecar if configured
	if (autoStart) {
		service
			.start({
				binary: config.sidecarBinary as string | undefined,
				portBase: config.portBase as number | undefined,
				bootstrap: config.bootstrap as string[] | undefined,
				logLevel: config.logLevel as string | undefined,
			})
			.then(() => {
				log.info(`TrustChain sidecar ready — pubkey: ${service.pubkey}`);
			})
			.catch((err) => {
				log.error(`TrustChain sidecar failed to start: ${err}`);
				log.info("Use trustchain_check_trust to verify connection manually.");
			});
	}
}
