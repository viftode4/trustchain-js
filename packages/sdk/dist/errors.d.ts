export declare class TrustChainError extends Error {
	constructor(message: string);
}
export declare class HttpError extends TrustChainError {
	readonly status: number;
	readonly body: string;
	constructor(status: number, body: string);
}
export declare class ConnectionError extends TrustChainError {
	readonly cause?: Error | undefined;
	constructor(message: string, cause?: Error | undefined);
}
export declare class TimeoutError extends TrustChainError {
	constructor(message?: string);
}
export declare class BinaryNotFoundError extends TrustChainError {
	constructor(message?: string);
}
export declare class SidecarError extends TrustChainError {
	constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map
