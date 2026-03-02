/**
 * Type stubs for the OpenClaw plugin API.
 * Replace with official @openclaw/types when available.
 */

export interface PluginContext {
	config: Record<string, unknown>;
	log: Logger;
}

export interface Logger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: ToolParameters;
	execute: (args: Record<string, unknown>) => Promise<ToolResult>;
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
	content: string;
	isError?: boolean;
}

export interface EventHook {
	event: string;
	handler: (data: unknown) => Promise<void> | void;
}

export interface PluginRegistration {
	tools: ToolDefinition[];
	hooks?: EventHook[];
	onStart?: () => Promise<void>;
	onStop?: () => Promise<void>;
}
