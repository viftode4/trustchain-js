export class TrustChainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TrustChainError";
	}
}

export class HttpError extends TrustChainError {
	constructor(
		public readonly status: number,
		public readonly body: string,
	) {
		super(`HTTP ${status}: ${body}`);
		this.name = "HttpError";
	}
}

export class ConnectionError extends TrustChainError {
	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(message);
		this.name = "ConnectionError";
	}
}

export class TimeoutError extends TrustChainError {
	constructor(message = "Request timed out") {
		super(message);
		this.name = "TimeoutError";
	}
}

export class BinaryNotFoundError extends TrustChainError {
	constructor(message = "trustchain-node binary not found") {
		super(message);
		this.name = "BinaryNotFoundError";
	}
}

export class SidecarError extends TrustChainError {
	constructor(message: string) {
		super(message);
		this.name = "SidecarError";
	}
}
