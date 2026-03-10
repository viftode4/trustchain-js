import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { TrustChainClient } from "./client.js";
import { SidecarError } from "./errors.js";
import { PORT_HTTP_OFFSET, PORT_PROXY_OFFSET, ensureBinary, findFreePortBase } from "./utils.js";
const PUBKEY_REGEX = /Public key:\s*([0-9a-fA-F]{64})/;
const READY_TIMEOUT_MS = 10_000;
// Early-access public seed node. Not production-scale yet — will be
// replaced with a domain and additional nodes as the network grows.
const DEFAULT_SEED_NODES = ["http://5.161.255.238:8202"];
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
            name: options?.name ?? "trustchain-default",
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
        // Kill any orphaned sidecar from a previous run with the same name
        killOrphanedSidecar(this.options.name);
        const binary = await ensureBinary(this.options.binary);
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
        const bootstrap = this.options.bootstrap?.length ? this.options.bootstrap : DEFAULT_SEED_NODES;
        args.push("--bootstrap", bootstrap.join(","));
        if (this.options.dataDir) {
            args.push("--data-dir", this.options.dataDir);
        }
        // Strip proxy env to prevent loops
        const env = { ...process.env };
        env.HTTP_PROXY = undefined;
        env.http_proxy = undefined;
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
        writePidFile(this.options.name, this.process.pid);
    }
    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this._running = false;
        removePidFile(this.options.name);
        // Restore HTTP_PROXY
        if (this.savedHttpProxy !== undefined) {
            process.env.HTTP_PROXY = this.savedHttpProxy;
        }
        else {
            process.env.HTTP_PROXY = undefined;
        }
        if (this.savedHttpProxyLower !== undefined) {
            process.env.http_proxy = this.savedHttpProxyLower;
        }
        else {
            process.env.http_proxy = undefined;
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
// --- PID file management ---
const PID_DIR = join(homedir(), ".trustchain", "pids");
function pidFilePath(name) {
    // Sanitize name for filesystem safety
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    return join(PID_DIR, `${safe}.pid`);
}
function writePidFile(name, pid) {
    try {
        mkdirSync(PID_DIR, { recursive: true });
        writeFileSync(pidFilePath(name), String(pid), "utf8");
    }
    catch {
        // Best-effort — don't fail the sidecar over a PID file
    }
}
function removePidFile(name) {
    try {
        const p = pidFilePath(name);
        if (existsSync(p))
            unlinkSync(p);
    }
    catch {
        // Best-effort
    }
}
function killOrphanedSidecar(name) {
    const p = pidFilePath(name);
    try {
        if (!existsSync(p))
            return;
        const pid = Number.parseInt(readFileSync(p, "utf8").trim(), 10);
        if (Number.isNaN(pid) || pid <= 0) {
            removePidFile(name);
            return;
        }
        // Check if process is alive and kill it
        process.kill(pid, 0); // Throws if process doesn't exist
        process.kill(pid, "SIGTERM");
        removePidFile(name);
    }
    catch {
        // Process already dead or permission error — clean up PID file
        removePidFile(name);
    }
}
//# sourceMappingURL=sidecar.js.map