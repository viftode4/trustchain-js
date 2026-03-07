import { ConnectionError, HttpError, TimeoutError } from "./errors.js";
const DEFAULT_TIMEOUT_MS = 30_000;
export class TrustChainClient {
    baseUrl;
    timeoutMs;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, "");
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }
    // --- Core endpoints ---
    async status() {
        return this.get("/status");
    }
    async healthz() {
        return this.get("/healthz");
    }
    async metrics() {
        return this.getText("/metrics");
    }
    // --- Block operations ---
    async audit(transaction) {
        return this.post("/audit", { transaction: transaction ?? {} });
    }
    async propose(counterpartyPubkey, transaction) {
        return this.post("/propose", {
            counterparty_pubkey: counterpartyPubkey,
            transaction: transaction ?? {},
        });
    }
    async receiveProposal(proposal) {
        return this.post("/receive_proposal", { proposal });
    }
    async receiveAgreement(agreement) {
        return this.post("/receive_agreement", { agreement });
    }
    async chain(pubkey) {
        const pk = pubkey ?? (await this.status()).public_key;
        const resp = await this.get(`/chain/${pk}`);
        return resp.blocks;
    }
    async block(pubkey, seq) {
        const resp = await this.get(`/block/${pubkey}/${seq}`);
        return resp.block;
    }
    async crawl(pubkey, startSeq) {
        const params = startSeq !== undefined ? `?start_seq=${startSeq}` : "";
        const resp = await this.get(`/crawl/${pubkey}${params}`);
        return resp.blocks;
    }
    // --- Peer management ---
    async peers() {
        return this.get("/peers");
    }
    async registerPeer(pubkey, address) {
        return this.post("/peers", { pubkey, address });
    }
    // --- Trust ---
    async trustScore(pubkey, context) {
        const params = context ? `?context=${encodeURIComponent(context)}` : "";
        return this.get(`/trust/${pubkey}${params}`);
    }
    async discover(capability, options) {
        const params = new URLSearchParams({ capability });
        if (options?.min_trust !== undefined)
            params.set("min_trust", String(options.min_trust));
        if (options?.max_results !== undefined)
            params.set("max_results", String(options.max_results));
        if (options?.fan_out !== undefined)
            params.set("fan_out", String(options.fan_out));
        return this.get(`/discover?${params}`);
    }
    // --- Delegation ---
    async delegate(delegatePubkey, options) {
        const body = {
            delegate_pubkey: delegatePubkey,
            ...options,
        };
        return this.post("/delegate", body);
    }
    async acceptDelegation(proposalBlock) {
        const body = { proposal_block: proposalBlock };
        return this.post("/accept_delegation", body);
    }
    async revoke(delegationId) {
        return this.post("/revoke", { delegation_id: delegationId });
    }
    async delegations(pubkey) {
        return this.get(`/delegations/${pubkey}`);
    }
    async delegation(delegationId) {
        return this.get(`/delegation/${delegationId}`);
    }
    // --- Succession ---
    async acceptSuccession(proposalBlock) {
        const body = { proposal_block: proposalBlock };
        return this.post("/accept_succession", body);
    }
    // --- Identity ---
    async identity(pubkey) {
        return this.get(`/identity/${pubkey}`);
    }
    // --- Internal HTTP helpers ---
    async get(path) {
        const resp = await this.fetch(path, { method: "GET" });
        return resp.json();
    }
    async getText(path) {
        const resp = await this.fetch(path, { method: "GET" });
        return resp.text();
    }
    async post(path, body) {
        const resp = await this.fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return resp.json();
    }
    async fetch(path, init) {
        const url = `${this.baseUrl}${path}`;
        let resp;
        try {
            resp = await fetch(url, {
                ...init,
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === "TimeoutError") {
                throw new TimeoutError(`Request to ${path} timed out after ${this.timeoutMs}ms`);
            }
            if (err instanceof DOMException && err.name === "AbortError") {
                throw new TimeoutError(`Request to ${path} was aborted`);
            }
            throw new ConnectionError(`Failed to connect to ${url}`, err instanceof Error ? err : undefined);
        }
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            throw new HttpError(resp.status, text);
        }
        return resp;
    }
}
//# sourceMappingURL=client.js.map