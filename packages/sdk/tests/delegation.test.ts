import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import {
	MAX_DELEGATION_TTL_MS,
	validateSubDelegationScope,
	validateDelegationTtlMs,
	validateDelegationTtlSeconds,
} from "../src/delegation.js";

// ─────────────────────────────────────────────────────────────────────────────
// MAX_DELEGATION_TTL_MS constant
// ─────────────────────────────────────────────────────────────────────────────

describe("MAX_DELEGATION_TTL_MS", () => {
	it("equals exactly 30 days in milliseconds", () => {
		expect(MAX_DELEGATION_TTL_MS).toBe(30 * 24 * 3600 * 1000);
	});

	it("equals 2_592_000_000 ms", () => {
		expect(MAX_DELEGATION_TTL_MS).toBe(2_592_000_000);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 1 — Sub-delegation scope escalation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSubDelegationScope", () => {
	// ── Unrestricted parent (empty scope) ────────────────────────────────────

	it("allows unrestricted child when parent is unrestricted", () => {
		// parent [] + child [] → fine (both unrestricted)
		expect(() => validateSubDelegationScope([], [])).not.toThrow();
	});

	it("allows restricted child when parent is unrestricted", () => {
		// parent [] + child ["compute"] → fine (child is narrower)
		expect(() => validateSubDelegationScope([], ["compute"])).not.toThrow();
	});

	it("allows multi-capability child when parent is unrestricted", () => {
		expect(() =>
			validateSubDelegationScope([], ["read", "write", "admin"]),
		).not.toThrow();
	});

	// ── Restricted parent — escalation via empty child scope ─────────────────

	it("rejects empty child scope when parent scope is restricted (Bug 1)", () => {
		// parent ["compute"] + child [] → escalation: child would be unrestricted
		expect(() => validateSubDelegationScope(["compute"], [])).toThrow(
			/unrestricted when parent scope is restricted/,
		);
	});

	it("rejects empty child scope even for a single-capability parent", () => {
		expect(() => validateSubDelegationScope(["read"], [])).toThrow(
			/unrestricted when parent scope is restricted/,
		);
	});

	it("rejects empty child scope for a multi-capability parent", () => {
		expect(() =>
			validateSubDelegationScope(["read", "write", "delete"], []),
		).toThrow(/unrestricted when parent scope is restricted/);
	});

	// ── Restricted parent — valid subsets ────────────────────────────────────

	it("allows child scope that is an exact match of parent scope", () => {
		expect(() =>
			validateSubDelegationScope(["read", "write"], ["read", "write"]),
		).not.toThrow();
	});

	it("allows child scope that is a proper subset of parent scope", () => {
		expect(() =>
			validateSubDelegationScope(["read", "write", "compute"], ["read"]),
		).not.toThrow();
	});

	it("allows single-capability child within multi-capability parent", () => {
		expect(() =>
			validateSubDelegationScope(["read", "write"], ["write"]),
		).not.toThrow();
	});

	// ── Restricted parent — superset child (capability escalation) ────────────

	it("rejects child scope that introduces a capability not in parent", () => {
		expect(() =>
			validateSubDelegationScope(["read"], ["read", "write"]),
		).toThrow(/scope escalation.*"write".*not in parent scope/);
	});

	it("rejects child scope that is entirely outside parent scope", () => {
		expect(() =>
			validateSubDelegationScope(["compute"], ["storage"]),
		).toThrow(/scope escalation.*"storage".*not in parent scope/);
	});

	it("rejects child scope with one valid and one invalid capability", () => {
		expect(() =>
			validateSubDelegationScope(["read", "write"], ["read", "admin"]),
		).toThrow(/scope escalation.*"admin".*not in parent scope/);
	});

	it("error message includes parent scope capabilities", () => {
		let msg = "";
		try {
			validateSubDelegationScope(["read", "write"], ["admin"]);
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).toContain("read");
		expect(msg).toContain("write");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 2 — MAX_DELEGATION_TTL enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("validateDelegationTtlMs", () => {
	it("accepts TTL of exactly 30 days", () => {
		expect(() => validateDelegationTtlMs(MAX_DELEGATION_TTL_MS)).not.toThrow();
	});

	it("accepts TTL of 1 hour", () => {
		expect(() => validateDelegationTtlMs(3_600_000)).not.toThrow();
	});

	it("accepts TTL of 1 day", () => {
		expect(() => validateDelegationTtlMs(86_400_000)).not.toThrow();
	});

	it("accepts TTL of 29 days", () => {
		expect(() =>
			validateDelegationTtlMs(29 * 24 * 3600 * 1000),
		).not.toThrow();
	});

	it("rejects TTL of 30 days + 1 ms (Bug 2)", () => {
		expect(() =>
			validateDelegationTtlMs(MAX_DELEGATION_TTL_MS + 1),
		).toThrow(/exceeds maximum of 30 days/);
	});

	it("rejects TTL of 31 days", () => {
		expect(() =>
			validateDelegationTtlMs(31 * 24 * 3600 * 1000),
		).toThrow(/exceeds maximum of 30 days/);
	});

	it("rejects TTL of 1 year", () => {
		expect(() =>
			validateDelegationTtlMs(365 * 24 * 3600 * 1000),
		).toThrow(/exceeds maximum of 30 days/);
	});

	it("error message includes the offending value", () => {
		const ttl = MAX_DELEGATION_TTL_MS + 1;
		let msg = "";
		try {
			validateDelegationTtlMs(ttl);
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).toContain(String(ttl));
	});
});

describe("validateDelegationTtlSeconds", () => {
	it("accepts TTL of 3600 seconds (1 hour)", () => {
		expect(() => validateDelegationTtlSeconds(3600)).not.toThrow();
	});

	it("accepts TTL of 2592000 seconds (exactly 30 days)", () => {
		expect(() => validateDelegationTtlSeconds(2_592_000)).not.toThrow();
	});

	it("rejects TTL of 2592001 seconds (30 days + 1 s)", () => {
		expect(() => validateDelegationTtlSeconds(2_592_001)).toThrow(
			/exceeds maximum of 30 days/,
		);
	});

	it("rejects TTL of 86400 * 31 seconds (31 days)", () => {
		expect(() => validateDelegationTtlSeconds(86_400 * 31)).toThrow(
			/exceeds maximum of 30 days/,
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// initDelegate — TTL enforcement (integration smoke test via mock)
// ─────────────────────────────────────────────────────────────────────────────

describe("initDelegate TTL enforcement", () => {
	// We import initDelegate dynamically so the singleton is fresh per-test.
	// Rather than spin up a real sidecar, we verify the TTL error is thrown
	// BEFORE any network/sidecar work begins.

	it("throws before starting sidecar when ttlSeconds exceeds 30 days", async () => {
		// Dynamic import to get a reference to the function.
		const { initDelegate } = await import("../src/index.js");

		await expect(
			initDelegate({
				parentUrl: "http://127.0.0.1:9999",
				scope: ["compute"],
				ttlSeconds: 2_592_001, // 30 days + 1 second
			}),
		).rejects.toThrow(/exceeds maximum of 30 days/);
	});
});
