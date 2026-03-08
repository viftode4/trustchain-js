import { describe, expect, it } from "bun:test";
import {
	AuditConfig,
	defaultEvents,
	validateAiActSchema,
	validateAiuc1Schema,
	validateBaseSchema,
	validateTransaction,
} from "../src/audit.js";
import type { SchemaId } from "../src/audit.js";

// ─────────────────────────────────────────────────────────────────────────────
// AuditConfig
// ─────────────────────────────────────────────────────────────────────────────

describe("AuditConfig", () => {
	it("defaults to standard level, base schema", () => {
		const cfg = new AuditConfig();
		expect(cfg.level).toBe("standard");
		expect(cfg.schema).toBe("base");
	});

	it("minimal level enables only error and human_override", () => {
		const cfg = new AuditConfig({ level: "minimal" });
		expect(cfg.enabledEvents).toEqual(["error", "human_override"]);
	});

	it("standard level enables tool_call, llm_decision, error, human_override", () => {
		const cfg = new AuditConfig({ level: "standard" });
		expect(cfg.enabledEvents).toEqual(["tool_call", "llm_decision", "error", "human_override"]);
	});

	it("comprehensive level enables all event types", () => {
		const cfg = new AuditConfig({ level: "comprehensive" });
		expect(cfg.enabledEvents).toHaveLength(7);
		expect(cfg.enabledEvents).toContain("tool_call");
		expect(cfg.enabledEvents).toContain("llm_decision");
		expect(cfg.enabledEvents).toContain("error");
		expect(cfg.enabledEvents).toContain("state_change");
		expect(cfg.enabledEvents).toContain("human_override");
		expect(cfg.enabledEvents).toContain("external_api");
		expect(cfg.enabledEvents).toContain("raw_http");
	});

	it("accepts custom enabledEvents override", () => {
		const cfg = new AuditConfig({ level: "minimal", enabledEvents: ["tool_call"] });
		expect(cfg.enabledEvents).toEqual(["tool_call"]);
	});

	it("accepts custom schema", () => {
		const cfg = new AuditConfig({ schema: "ai_act" });
		expect(cfg.schema).toBe("ai_act");
	});

	it("does not share internal array reference with defaults", () => {
		const cfg1 = new AuditConfig({ level: "minimal" });
		const cfg2 = new AuditConfig({ level: "minimal" });
		cfg1.enabledEvents.push("tool_call" as never);
		expect(cfg2.enabledEvents).toHaveLength(2);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateBaseSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("validateBaseSchema", () => {
	it("passes with all required fields", () => {
		expect(() =>
			validateBaseSchema({ event_type: "tool_call", timestamp: 1700000000000 }),
		).not.toThrow();
	});

	it("passes with extra fields", () => {
		expect(() =>
			validateBaseSchema({ event_type: "error", timestamp: 1700000000000, extra: true }),
		).not.toThrow();
	});

	it("throws when event_type is missing", () => {
		expect(() => validateBaseSchema({ timestamp: 1700000000000 })).toThrow(/event_type/);
	});

	it("throws when timestamp is missing", () => {
		expect(() => validateBaseSchema({ event_type: "error" })).toThrow(/timestamp/);
	});

	it("throws when both fields are missing", () => {
		expect(() => validateBaseSchema({})).toThrow(/event_type.*timestamp|timestamp.*event_type/);
	});

	it("error message mentions 'Base schema'", () => {
		let msg = "";
		try {
			validateBaseSchema({});
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).toContain("Base schema");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAiActSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("validateAiActSchema", () => {
	const validAiAct = {
		event_type: "llm_decision",
		timestamp: 1700000000000,
		model_id: "gpt-4",
		input_hash: "abc123",
		output_hash: "def456",
		risk_level: "high",
	};

	it("passes with all required fields", () => {
		expect(() => validateAiActSchema(validAiAct)).not.toThrow();
	});

	it("throws when model_id is missing", () => {
		const { model_id, ...rest } = validAiAct;
		expect(() => validateAiActSchema(rest)).toThrow(/model_id/);
	});

	it("throws when input_hash is missing", () => {
		const { input_hash, ...rest } = validAiAct;
		expect(() => validateAiActSchema(rest)).toThrow(/input_hash/);
	});

	it("throws when output_hash is missing", () => {
		const { output_hash, ...rest } = validAiAct;
		expect(() => validateAiActSchema(rest)).toThrow(/output_hash/);
	});

	it("throws when risk_level is missing", () => {
		const { risk_level, ...rest } = validAiAct;
		expect(() => validateAiActSchema(rest)).toThrow(/risk_level/);
	});

	it("throws when base fields are missing", () => {
		expect(() =>
			validateAiActSchema({
				model_id: "gpt-4",
				input_hash: "abc",
				output_hash: "def",
				risk_level: "low",
			}),
		).toThrow(/Base schema/);
	});

	it("error message mentions 'AI Act schema' for AI Act-specific fields", () => {
		let msg = "";
		try {
			const { model_id, ...rest } = validAiAct;
			validateAiActSchema(rest);
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).toContain("AI Act schema");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAiuc1Schema
// ─────────────────────────────────────────────────────────────────────────────

describe("validateAiuc1Schema", () => {
	const validAiuc1 = {
		event_type: "tool_call",
		timestamp: 1700000000000,
		session_id: "sess-001",
		actor: "agent-alpha",
	};

	it("passes with all required fields", () => {
		expect(() => validateAiuc1Schema(validAiuc1)).not.toThrow();
	});

	it("throws when session_id is missing", () => {
		const { session_id, ...rest } = validAiuc1;
		expect(() => validateAiuc1Schema(rest)).toThrow(/session_id/);
	});

	it("throws when actor is missing", () => {
		const { actor, ...rest } = validAiuc1;
		expect(() => validateAiuc1Schema(rest)).toThrow(/actor/);
	});

	it("throws when base fields are missing", () => {
		expect(() => validateAiuc1Schema({ session_id: "s", actor: "a" })).toThrow(/Base schema/);
	});

	it("error message mentions 'AIUC1 schema' for AIUC1-specific fields", () => {
		let msg = "";
		try {
			const { session_id, ...rest } = validAiuc1;
			validateAiuc1Schema(rest);
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).toContain("AIUC1 schema");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// defaultEvents
// ─────────────────────────────────────────────────────────────────────────────

describe("defaultEvents", () => {
	it("returns error and human_override for minimal", () => {
		expect(defaultEvents("minimal")).toEqual(["error", "human_override"]);
	});

	it("returns 4 events for standard", () => {
		const events = defaultEvents("standard");
		expect(events).toEqual(["tool_call", "llm_decision", "error", "human_override"]);
	});

	it("returns all 7 events for comprehensive", () => {
		const events = defaultEvents("comprehensive");
		expect(events).toHaveLength(7);
		expect(events).toContain("raw_http");
		expect(events).toContain("external_api");
		expect(events).toContain("state_change");
	});

	it("returns a copy, not the internal array", () => {
		const a = defaultEvents("minimal");
		const b = defaultEvents("minimal");
		a.push("tool_call");
		expect(b).toHaveLength(2);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe("validateTransaction", () => {
	it("dispatches to base schema validator", () => {
		expect(() =>
			validateTransaction("base", { event_type: "error", timestamp: 1700000000000 }),
		).not.toThrow();
	});

	it("dispatches to ai_act schema validator", () => {
		expect(() =>
			validateTransaction("ai_act", {
				event_type: "llm_decision",
				timestamp: 1700000000000,
				model_id: "gpt-4",
				input_hash: "abc",
				output_hash: "def",
				risk_level: "high",
			}),
		).not.toThrow();
	});

	it("dispatches to aiuc1 schema validator", () => {
		expect(() =>
			validateTransaction("aiuc1", {
				event_type: "tool_call",
				timestamp: 1700000000000,
				session_id: "s1",
				actor: "agent",
			}),
		).not.toThrow();
	});

	it("throws on missing fields via base schema", () => {
		expect(() => validateTransaction("base", {})).toThrow(/Base schema/);
	});

	it("throws on missing ai_act fields", () => {
		expect(() =>
			validateTransaction("ai_act", { event_type: "error", timestamp: 1700000000000 }),
		).toThrow(/AI Act schema/);
	});

	it("throws on unknown schema id", () => {
		expect(() =>
			validateTransaction("unknown" as SchemaId, { event_type: "error", timestamp: 1 }),
		).toThrow(/Unknown schema/);
	});
});
