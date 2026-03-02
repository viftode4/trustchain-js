import { spawn } from "node:child_process";
import { SidecarError } from "./errors.js";
import { TrustChainClient } from "./client.js";
import { PORT_HTTP_OFFSET, PORT_PROXY_OFFSET, findBinary, findFreePortBase, } from "./utils.js";
const PUBKEY_REGEX = /Public key:\s*([0-9a-fA-F]{64})/;
const READY_TIMEOUT_MS = 10_000;
const POLL_INITIAL_MS = 100;
const POLL_MAX_MS = 1000;
export class TrustChainSidecar {
    process = null;
    _pubkey = null;
    _portBase = null;
    _running = false;
    _client = null;
    options;
    savedHttpProxy;
    savedHttpProxyLower;
    constructor(options) {
        this.options = {
            name: options?.name ?? `ts-agent-${process.pid}`,
            logLevel: options?.logLevel ?? "info",
            ...options,
        };
    }
    get pubkey() {
        return this._pubkey;
    }
    get httpUrl() {
        if (!this._portBase)
            throw new SidecarError("Sidecar not started");
        return `http://127.0.0.1:${this._portBase + PORT_HTTP_OFFSET}`;
    }
    get proxyUrl() {
        if (!this._portBase)
            throw new SidecarError("Sidecar not started");
        return `http://127.0.0.1:${this._portBase + PORT_PROXY_OFFSET}`;
    }
    get isRunning() {
        return this._running;
    }
    get client() {
        if (!this._client)
            throw new SidecarError("Sidecar not started");
        return this._client;
    }
    async start() {
        if (this._running)
            return;
        const binary = findBinary(this.options.binary);
        this._portBase = this.options.portBase ?? (await findFreePortBase());
        const args = [
            "sidecar",
            "--name",
            this.options.name,
            "--endpoint",
            this.options.endpoint ?? "http://127.0.0.1:0",
            "--port-base",
            String(this._portBase),
            "--log-level",
            this.options.logLevel,
        ];
        if (this.options.bootstrap?.length) {
            args.push("--bootstrap", this.options.bootstrap.join(","));
        }
        if (this.options.dataDir) {
            args.push("--data-dir", this.options.dataDir);
        }
        // Strip proxy env to prevent loops
        const env = { ...process.env };
        delete env.HTTP_PROXY;
        delete env.http_proxy;
        const spawnOptions = {
            env,
            stdio: ["ignore", "pipe", "pipe"],
        };
        if (process.platform === "win32") {
            spawnOptions.windowsHide = true;
        }
        this.process = spawn(binary, args, spawnOptions);
        // Read stdout for pubkey
        this.process.stdout?.on("data", (data) => {
            const line = data.toString();
            const match = line.match(PUBKEY_REGEX);
            if (match && !this._pubkey) {
                this._pubkey = match[1];
            }
        });
        // Collect stderr for error reporting
        let stderr = "";
        this.process.stderr?.on("data", (data) => {
            if (stderr.length < 8192) {
                stderr += data.toString();
            }
        });
        this.process.on("exit", (code) => {
            this._running = false;
            if (code !== null && code !== 0) {
                const msg = stderr.slice(0, 1024);
                console.error(`trustchain-node exited with code ${code}: ${msg}`);
            }
        });
        this._client = new TrustChainClient({
            baseUrl: this.httpUrl,
            timeoutMs: 5_000,
        });
        await this.waitReady();
        // Set HTTP_PROXY
        this.savedHttpProxy = process.env.HTTP_PROXY;
        this.savedHttpProxyLower = process.env.http_proxy;
        process.env.HTTP_PROXY = this.proxyUrl;
        process.env.http_proxy = this.proxyUrl;
        this._running = true;
    }
    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this._running = false;
        // Restore HTTP_PROXY
        if (this.savedHttpProxy !== undefined) {
            process.env.HTTP_PROXY = this.savedHttpProxy;
        }
        else {
            delete process.env.HTTP_PROXY;
        }
        if (this.savedHttpProxyLower !== undefined) {
            process.env.http_proxy = this.savedHttpProxyLower;
        }
        else {
            delete process.env.http_proxy;
        }
    }
    [Symbol.dispose]() {
        this.stop();
    }
    // --- Forwarded client methods ---
    status() {
        return this.client.status();
    }
    healthz() {
        return this.client.healthz();
    }
    metrics() {
        return this.client.metrics();
    }
    propose(counterpartyPubkey, transaction) {
        return this.client.propose(counterpartyPubkey, transaction);
    }
    receiveProposal(proposal) {
        return this.client.receiveProposal(proposal);
    }
    receiveAgreement(agreement) {
        return this.client.receiveAgreement(agreement);
    }
    chain(pubkey) {
        return this.client.chain(pubkey);
    }
    block(pubkey, seq) {
        return this.client.block(pubkey, seq);
    }
    crawl(pubkey, startSeq) {
        return this.client.crawl(pubkey, startSeq);
    }
    peers() {
        return this.client.peers();
    }
    registerPeer(pubkey, address) {
        return this.client.registerPeer(pubkey, address);
    }
    trustScore(pubkey) {
        return this.client.trustScore(pubkey);
    }
    discover(capability, options) {
        return this.client.discover(capability, options);
    }
    delegate(delegatePubkey, options) {
        return this.client.delegate(delegatePubkey, options);
    }
    acceptDelegation(proposalBlock) {
        return this.client.acceptDelegation(proposalBlock);
    }
    revoke(delegationId) {
        return this.client.revoke(delegationId);
    }
    delegations(pubkey) {
        return this.client.delegations(pubkey);
    }
    delegation(delegationId) {
        return this.client.delegation(delegationId);
    }
    acceptSuccession(proposalBlock) {
        return this.client.acceptSuccession(proposalBlock);
    }
    identity(pubkey) {
        return this.client.identity(pubkey);
    }
    // --- Internal ---
    async waitReady() {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        let delay = POLL_INITIAL_MS;
        while (Date.now() < deadline) {
            // Check if process died
            if (this.process?.exitCode !== null && this.process?.exitCode !== undefined) {
                throw new SidecarError(`trustchain-node exited with code ${this.process.exitCode} before becoming ready`);
            }
            try {
                const health = await this._client.healthz();
                if (health.public_key && !this._pubkey) {
                    this._pubkey = health.public_key;
                }
                return;
            }
            catch {
                // Not ready yet, try status as fallback
                try {
                    const st = await this._client.status();
                    if (st.public_key && !this._pubkey) {
                        this._pubkey = st.public_key;
                    }
                    return;
                }
                catch {
                    // Still not ready
                }
            }
            await sleep(delay);
            delay = Math.min(delay * 1.5, POLL_MAX_MS);
        }
        throw new SidecarError(`Sidecar did not become ready within ${READY_TIMEOUT_MS}ms`);
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=sidecar.js.map