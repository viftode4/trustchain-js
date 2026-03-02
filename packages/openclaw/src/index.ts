import { createHooks } from "./hooks.js";
import type { PluginContext, PluginRegistration } from "./openclaw-types.js";
import { SidecarService } from "./service.js";
import { createTools } from "./tools.js";

export { SidecarService } from "./service.js";
export { createTools } from "./tools.js";
export { createHooks } from "./hooks.js";

/**
 * Register the TrustChain plugin with OpenClaw.
 */
export function register(ctx: PluginContext): PluginRegistration {
	const config = ctx.config;
	const log = ctx.log;

	const service = new SidecarService(log);
	const autoStart = (config.autoStart as boolean) ?? true;
	const autoRecord = (config.autoRecord as boolean) ?? false;

	const tools = createTools(() => service.getClient());
	const hooks = createHooks(() => service.getClient(), log, autoRecord);

	return {
		tools,
		hooks,
		onStart: async () => {
			if (!autoStart) {
				log.info("TrustChain autoStart disabled. Use trustchain_check_trust to verify connection.");
				return;
			}
			await service.start({
				binary: config.sidecarBinary as string | undefined,
				portBase: config.portBase as number | undefined,
				bootstrap: config.bootstrap as string[] | undefined,
				logLevel: config.logLevel as string | undefined,
			});
		},
		onStop: () => {
			service.stop();
			return Promise.resolve();
		},
	};
}
