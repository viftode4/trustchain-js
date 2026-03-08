/**
 * Audit schema validation and configuration for single-player mode.
 * Provides structured audit levels and schema validators for compliance.
 */

import type { AuditLevel, EventType } from "./types.js";

// --- Schema IDs ---

export type SchemaId = "base" | "ai_act" | "aiuc1";

// --- Audit Configuration ---

/** Default enabled events per audit level. */
const LEVEL_EVENTS: Record<AuditLevel, EventType[]> = {
	minimal: ["error", "human_override"],
	standard: ["tool_call", "llm_decision", "error", "human_override"],
	comprehensive: [
		"tool_call",
		"llm_decision",
		"error",
		"state_change",
		"human_override",
		"external_api",
		"raw_http",
	],
};

/**
 * Returns the default enabled EventType[] for a given audit level.
 */
export function defaultEvents(level: AuditLevel): EventType[] {
	return [...LEVEL_EVENTS[level]];
}

/**
 * Validate a transaction object against the named schema.
 * Dispatches to the appropriate schema validator; throws on missing fields.
 */
export function validateTransaction(schema: SchemaId, transaction: Record<string, unknown>): void {
	switch (schema) {
		case "base":
			return validateBaseSchema(transaction);
		case "ai_act":
			return validateAiActSchema(transaction);
		case "aiuc1":
			return validateAiuc1Schema(transaction);
		default:
			throw new Error(`Unknown schema: ${schema as string}`);
	}
}

export class AuditConfig {
	readonly level: AuditLevel;
	readonly enabledEvents: EventType[];
	readonly schema: SchemaId;

	constructor(options?: { level?: AuditLevel; enabledEvents?: EventType[]; schema?: SchemaId }) {
		this.level = options?.level ?? "standard";
		this.enabledEvents = options?.enabledEvents ?? [...LEVEL_EVENTS[this.level]];
		this.schema = options?.schema ?? "base";
	}
}

// --- Schema Validators ---

/**
 * Validate base schema: requires event_type and timestamp.
 * Throws if required fields are missing.
 */
export function validateBaseSchema(data: Record<string, unknown>): void {
	const missing: string[] = [];
	if (data.event_type === undefined) missing.push("event_type");
	if (data.timestamp === undefined) missing.push("timestamp");
	if (missing.length > 0) {
		throw new Error(`Base schema validation failed: missing fields: ${missing.join(", ")}`);
	}
}

/**
 * Validate AI Act schema: base fields plus model_id, input_hash, output_hash, risk_level.
 * Throws if required fields are missing.
 */
export function validateAiActSchema(data: Record<string, unknown>): void {
	validateBaseSchema(data);
	const missing: string[] = [];
	if (data.model_id === undefined) missing.push("model_id");
	if (data.input_hash === undefined) missing.push("input_hash");
	if (data.output_hash === undefined) missing.push("output_hash");
	if (data.risk_level === undefined) missing.push("risk_level");
	if (missing.length > 0) {
		throw new Error(`AI Act schema validation failed: missing fields: ${missing.join(", ")}`);
	}
}

/**
 * Validate AIUC1 schema: base fields plus session_id and actor.
 * Throws if required fields are missing.
 */
export function validateAiuc1Schema(data: Record<string, unknown>): void {
	validateBaseSchema(data);
	const missing: string[] = [];
	if (data.session_id === undefined) missing.push("session_id");
	if (data.actor === undefined) missing.push("actor");
	if (missing.length > 0) {
		throw new Error(`AIUC1 schema validation failed: missing fields: ${missing.join(", ")}`);
	}
}
