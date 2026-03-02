import { createHooks } from "./hooks.js";
import { SidecarService } from "./service.js";
import { createTools } from "./tools.js";
export { SidecarService } from "./service.js";
export { createTools } from "./tools.js";
export { createHooks } from "./hooks.js";
/**
 * Register the TrustChain plugin with OpenClaw.
 */
export function register(ctx) {
    const config = ctx.config;
    const log = ctx.log;
    const service = new SidecarService(log);
    const autoStart = config.autoStart ?? true;
    const autoRecord = config.autoRecord ?? false;
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
                binary: config.sidecarBinary,
                portBase: config.portBase,
                bootstrap: config.bootstrap,
                logLevel: config.logLevel,
            });
        },
        onStop: () => {
            service.stop();
            return Promise.resolve();
        },
    };
}
//# sourceMappingURL=index.js.map