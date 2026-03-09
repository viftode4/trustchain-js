/**
 * Audit schema validation and configuration for single-player mode.
 * Provides structured audit levels and schema validators for compliance.
 */
import type { AuditLevel, EventType } from "./types.js";
export type SchemaId = "base" | "ai_act" | "aiuc1";
/**
 * Returns the default enabled EventType[] for a given audit level.
 */
export declare function defaultEvents(level: AuditLevel): EventType[];
/**
 * Validate a transaction object against the named schema.
 * Dispatches to the appropriate schema validator; throws on missing fields.
 */
export declare function validateTransaction(schema: SchemaId, transaction: Record<string, unknown>): void;
export declare class AuditConfig {
    readonly level: AuditLevel;
    readonly enabledEvents: EventType[];
    readonly schema: SchemaId;
    constructor(options?: {
        level?: AuditLevel;
        enabledEvents?: EventType[];
        schema?: SchemaId;
    });
}
/**
 * Validate base schema: requires event_type and timestamp.
 * Throws if required fields are missing.
 */
export declare function validateBaseSchema(data: Record<string, unknown>): void;
/**
 * Validate AI Act schema: base fields plus model_id, input_hash, output_hash, risk_level.
 * Throws if required fields are missing.
 */
export declare function validateAiActSchema(data: Record<string, unknown>): void;
/**
 * Validate AIUC1 schema: base fields plus session_id and actor.
 * Throws if required fields are missing.
 */
export declare function validateAiuc1Schema(data: Record<string, unknown>): void;
//# sourceMappingURL=audit.d.ts.map