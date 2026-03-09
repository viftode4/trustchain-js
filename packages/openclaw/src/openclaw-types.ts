/**
 * Type stubs for the OpenClaw plugin API.
 */

export interface PluginAPI {
	registerTool(definition: ToolRegistration, options?: { optional?: boolean }): void;
	log: Logger;
	config: Record<string, unknown>;
}

export interface Logger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}

export interface ToolRegistration {
	name: string;
	description: string;
	parameters: ToolParameters;
	execute: (id: string, args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameters {
	type: "object";
	properties: Record<string, ToolParameterProperty>;
	required?: string[];
}

export interface ToolParameterProperty {
	type: string;
	description: string;
	default?: unknown;
	enum?: string[];
}

export interface ToolResult {
	content: Array<{ type: string; text: string }>;
}

/** Internal tool format — tools.ts returns plain strings, index.ts wraps them for OpenClaw */
export interface ToolDefinition {
	name: string;
	description: string;
	parameters: ToolParameters;
	execute: (args: Record<string, unknown>) => Promise<InternalToolResult>;
}

export interface InternalToolResult {
	content: string;
	isError?: boolean;
}

export interface EventHook {
	event: string;
	handler: (data: unknown) => Promise<void> | void;
}

/** @deprecated — old registration pattern */
export interface PluginContext {
	config: Record<string, unknown>;
	log: Logger;
}

/** @deprecated — old registration pattern */
export interface PluginRegistration {
	tools: ToolDefinition[];
	hooks?: EventHook[];
	onStart?: () => Promise<void>;
	onStop?: () => Promise<void>;
}
